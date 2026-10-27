const CHECKS = [
    ["access", "Confirm access, opening hours and any permits"],
    ["route", "Check the actual route, parking and travel time"],
    ["weather", "Recheck weather before leaving"],
    ["gear", "Pack batteries, storage and the kit for this shoot"],
];
export function placeKey(item) {
    return `${item.latitude},${item.longitude}`;
}
export function readFieldPlan(value) {
    const empty = { placeKey: "", notes: "", checks: [] };
    if (typeof value !== "object" || value === null)
        return empty;
    const plan = value;
    return {
        placeKey: typeof plan.placeKey === "string" ? plan.placeKey : "",
        notes: typeof plan.notes === "string" ? plan.notes.slice(0, 2000) : "",
        checks: Array.isArray(plan.checks)
            ? plan.checks.filter((key) => typeof key === "string" && CHECKS.some(([id]) => id === key))
            : [],
    };
}
function download(content, filename, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function escapeCalendar(value) {
    const slash = String.fromCharCode(92);
    return value
        .split(slash)
        .join(slash + slash)
        .split(String.fromCharCode(13))
        .join("")
        .split(String.fromCharCode(10))
        .join(slash + "n")
        .split(";")
        .join(slash + ";")
        .split(",")
        .join(slash + ",");
}
function foldLine(line) {
    const encoder = new TextEncoder();
    let part = "";
    let bytes = 0;
    const parts = [];
    for (const character of line) {
        const size = encoder.encode(character).length;
        if (bytes + size > 74) {
            parts.push(part);
            part = " ";
            bytes = 1;
        }
        part += character;
        bytes += size;
    }
    parts.push(part);
    return parts.join("\r\n");
}
export function calendarFile(item, response, notes) {
    const stamp = (value) => new Date(value).toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";
    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Scout//Field Plan//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:scout-${item.latitude}-${item.longitude}-${stamp(item.best_window.start_utc)}@scoutphotography.vercel.app`,
        `DTSTAMP:${stamp(response.generated_at)}`,
        `DTSTART:${stamp(item.best_window.start_utc)}`,
        `DTEND:${stamp(item.best_window.end_utc)}`,
        `SUMMARY:${escapeCalendar(`Scout: ${item.location_name}`)}`,
        `LOCATION:${escapeCalendar(`${item.location_name} (${item.latitude}, ${item.longitude})`)}`,
        `DESCRIPTION:${escapeCalendar(`${item.conditions_summary}\n${response.source_note ?? "Map and weather estimates; verify locally."}\n${notes}\nConfirm access and travel time separately. Calendar time is the light window, not a departure time.`)}`,
        `GEO:${item.latitude};${item.longitude}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ];
    return lines.map(foldLine).join("\r\n") + "\r\n";
}
export function renderFieldPlan(root, item, response, settings, initial, onChange) {
    let plan = {
        ...initial,
        placeKey: placeKey(item),
        checks: [...initial.checks],
    };
    root.textContent = "";
    root.className = "field-plan";
    root.id = "field-plan";
    root.setAttribute("aria-label", "Your field plan");
    const eyebrow = document.createElement("p");
    eyebrow.className = "label";
    eyebrow.textContent = "03 / Prepare";
    const heading = document.createElement("h2");
    heading.textContent = "Your field plan";
    heading.tabIndex = -1;
    const name = document.createElement("h3");
    name.textContent = item.location_name;
    const time = document.createElement("p");
    time.className = "plan-window";
    const format = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: settings.timeFormat === "12h",
        timeZoneName: "short",
    });
    time.textContent = `${format.format(new Date(item.best_window.start_utc))} – ${format.format(new Date(item.best_window.end_utc))}`;
    const context = document.createElement("p");
    context.className = "muted";
    context.textContent = `${item.conditions_summary}. This is the light window; allow extra time to travel and set up.`;
    const actions = document.createElement("div");
    actions.className = "plan-actions";
    const directions = document.createElement("a");
    directions.className = "button button--primary";
    directions.textContent = "Get directions";
    directions.href = `https://www.openstreetmap.org/directions?to=${item.latitude}%2C${item.longitude}`;
    directions.target = "_blank";
    directions.rel = "noreferrer";
    const calendar = document.createElement("button");
    calendar.type = "button";
    calendar.className = "button";
    calendar.textContent = "Add light window to calendar";
    calendar.disabled = new Date(item.best_window.end_utc).getTime() < Date.now();
    if (calendar.disabled)
        calendar.title =
            "This light window has passed. Refresh the scout for a new window.";
    calendar.addEventListener("click", () => download(calendarFile(item, response, plan.notes), "scout-light-window.ics", "text/calendar;charset=utf-8"));
    const exportBrief = document.createElement("button");
    exportBrief.type = "button";
    exportBrief.className = "button";
    exportBrief.textContent = "Download field brief";
    exportBrief.addEventListener("click", () => {
        const checks = CHECKS.map(([id, label]) => `- [${plan.checks.includes(id) ? "x" : " "}] ${label}`).join("\n");
        download(`# Scout field brief\n\n${item.location_name}\n${time.textContent}\nCoordinates: ${item.latitude}, ${item.longitude}\n${context.textContent}\n\n${response.source_note ?? "OpenStreetMap and Open-Meteo; verify locally."}\n\n## Before you go\n${checks}\n\n## Shoot notes\n${plan.notes || "No notes yet."}\n\nDirections: ${directions.href}\n`, "scout-field-brief.md", "text/markdown;charset=utf-8");
    });
    actions.append(directions, calendar, exportBrief);
    const grid = document.createElement("div");
    grid.className = "plan-grid";
    const checklist = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "Before you go";
    checklist.append(legend);
    const status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    const save = () => {
        try {
            onChange(plan);
            status.textContent = "Saved on this device";
        }
        catch {
            status.textContent =
                "Couldn’t save locally. Download your brief to keep a copy.";
        }
    };
    for (const [id, text] of CHECKS) {
        const label = document.createElement("label");
        label.className = "check-row";
        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = plan.checks.includes(id);
        check.addEventListener("change", () => {
            plan = {
                ...plan,
                checks: check.checked
                    ? [...plan.checks, id]
                    : plan.checks.filter((key) => key !== id),
            };
            save();
        });
        const caption = document.createElement("span");
        caption.textContent = text;
        label.append(check, caption);
        checklist.append(label);
    }
    const notesLabel = document.createElement("label");
    notesLabel.className = "field";
    notesLabel.textContent = "Shoot notes";
    const notes = document.createElement("textarea");
    notes.name = "shoot-notes";
    notes.maxLength = 2000;
    notes.rows = 5;
    notes.placeholder = "Composition, gear or a backup idea…";
    notes.value = plan.notes;
    notes.addEventListener("input", () => {
        plan = { ...plan, notes: notes.value };
        save();
    });
    notesLabel.append(notes);
    grid.append(checklist, notesLabel);
    const privacy = document.createElement("p");
    privacy.className = "muted small";
    privacy.textContent =
        "Notes stay with this scout on this device. They are excluded from shared result links; downloads include them. Choosing another place resets the checklist.";
    root.append(eyebrow, heading, name, time, context, actions, grid, privacy, status);
}
