import { placeKey, readFieldPlan, renderFieldPlan } from "./fieldPlan.js";
import { formatLightPhase } from "../format.js";
import { buildShareUrl } from "../share.js";
const timeFormatters = {
    "12h": new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }),
    "24h": new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }),
};
function formatTimeWindow(startUtc, endUtc, settings) {
    const formatter = timeFormatters[settings.timeFormat];
    return `${formatter.format(new Date(startUtc))} - ${formatter.format(new Date(endUtc))}`;
}
function formatDistance(miles, settings) {
    if (settings.units === "metric") {
        return `${(miles * 1.609344).toFixed(1)} km`;
    }
    return `${miles.toFixed(1)} mi`;
}
function scoreClass(score) {
    if (score >= 75) {
        return "result-card__score result-card__score--high";
    }
    if (score >= 50) {
        return "result-card__score result-card__score--mid";
    }
    return "result-card__score result-card__score--low";
}
function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function isStringArray(value) {
    return (Array.isArray(value) && value.every((item) => typeof item === "string"));
}
function isScoreBreakdown(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const record = value;
    return (isNumber(record.light) &&
        isNumber(record.weather) &&
        isNumber(record.crowd) &&
        isNumber(record.access));
}
function safeScoreBreakdown(item) {
    const value = item.score_breakdown;
    if (isScoreBreakdown(value)) {
        return value;
    }
    return {
        light: item.score,
        weather: item.score,
        crowd: item.score,
        access: item.score,
    };
}
function safeStringList(value) {
    return isStringArray(value) ? value : [];
}
function confidenceLabel(item) {
    if (item.confidence === "high" ||
        item.confidence === "medium" ||
        item.confidence === "low") {
        return item.confidence;
    }
    return "medium";
}
function buildBounds(response) {
    const latitudes = [
        response.latitude,
        ...response.recommendations.map((item) => item.latitude),
    ];
    const longitudes = [
        response.longitude,
        ...response.recommendations.map((item) => item.longitude),
    ];
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latPadding = Math.max(0.012, (maxLat - minLat) * 0.28);
    const lngPadding = Math.max(0.012, (maxLng - minLng) * 0.28);
    return {
        west: minLng - lngPadding,
        east: maxLng + lngPadding,
        south: minLat - latPadding,
        north: maxLat + latPadding,
    };
}
function clampPercent(value) {
    return Math.max(4, Math.min(96, value));
}
function mapPointStyle(item, bounds) {
    const lngSpan = bounds.east - bounds.west || 1;
    const latSpan = bounds.north - bounds.south || 1;
    return {
        left: `${clampPercent(((item.longitude - bounds.west) / lngSpan) * 100)}%`,
        top: `${clampPercent(((bounds.north - item.latitude) / latSpan) * 100)}%`,
    };
}
function buildOverviewMapUrl(bounds) {
    const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
}
function buildOverviewMap(response, settings) {
    const section = document.createElement("section");
    section.className = "results-map";
    const header = document.createElement("div");
    header.className = "results-map__header";
    const text = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "label";
    eyebrow.textContent = "Map view";
    const title = document.createElement("h2");
    title.textContent = "Your nearby shortlist";
    const body = document.createElement("p");
    body.textContent =
        "Compare the places around your origin. Distances are straight-line estimates, not a driving route.";
    text.append(eyebrow, title, body);
    const openMap = document.createElement("a");
    openMap.className = "button";
    openMap.href = `https://www.openstreetmap.org/?mlat=${response.latitude}&mlon=${response.longitude}#map=13/${response.latitude}/${response.longitude}`;
    openMap.target = "_blank";
    openMap.rel = "noreferrer";
    openMap.textContent = "Open map";
    header.append(text, openMap);
    const bodyGrid = document.createElement("div");
    bodyGrid.className = "results-map__body";
    const bounds = buildBounds(response);
    const map = document.createElement("div");
    map.className = "overview-map";
    const frame = document.createElement("iframe");
    frame.title = "Scout recommendation map";
    frame.loading = "lazy";
    frame.referrerPolicy = "no-referrer-when-downgrade";
    frame.src = buildOverviewMapUrl(bounds);
    map.appendChild(frame);
    for (const item of response.recommendations) {
        const pin = document.createElement("a");
        pin.className = "overview-map__pin";
        pin.href = `#recommendation-${item.rank}`;
        pin.textContent = String(item.rank);
        pin.setAttribute("aria-label", `${item.location_name}, rank ${item.rank}`);
        const position = mapPointStyle(item, bounds);
        pin.style.left = position.left;
        pin.style.top = position.top;
        map.appendChild(pin);
    }
    const list = document.createElement("ol");
    list.className = "route-list";
    for (const item of response.recommendations) {
        const row = document.createElement("li");
        const titleRow = document.createElement("div");
        titleRow.className = "route-list__top";
        const name = document.createElement("strong");
        name.textContent = item.location_name;
        const score = document.createElement("span");
        score.className = scoreClass(item.score);
        score.textContent = `${item.score}`;
        titleRow.append(name, score);
        const meta = document.createElement("p");
        meta.textContent = `${formatDistance(item.distance_miles, settings)} / ${formatTimeWindow(item.best_window.start_utc, item.best_window.end_utc, settings)}`;
        row.append(titleRow, meta);
        list.appendChild(row);
    }
    bodyGrid.append(map, list);
    section.append(header, bodyGrid);
    return section;
}
function buildMedia(item) {
    const media = document.createElement("div");
    media.className = "result-card__media";
    const photoWrap = document.createElement("figure");
    photoWrap.className = "media-panel media-panel--photo";
    const image = document.createElement("img");
    image.src = item.image_url ?? "";
    image.alt = `${item.location_name} location photo`;
    image.loading = "lazy";
    image.width = 640;
    image.height = 360;
    const caption = document.createElement("figcaption");
    caption.textContent =
        typeof item.image_attribution === "string" &&
            item.image_attribution.trim().length > 0
            ? item.image_attribution
            : "Visual scouting preview";
    photoWrap.append(image, caption);
    media.append(photoWrap);
    return media;
}
function tile(label, value) {
    const element = document.createElement("div");
    element.className = "data-tile";
    const tileLabel = document.createElement("span");
    tileLabel.className = "data-tile__label";
    tileLabel.textContent = label;
    const tileValue = document.createElement("span");
    tileValue.className = "data-tile__value";
    tileValue.textContent = value;
    element.append(tileLabel, tileValue);
    return element;
}
function buildReasonChips(item) {
    const tags = safeStringList(item.reason_tags);
    if (tags.length === 0) {
        return null;
    }
    const list = document.createElement("ul");
    list.className = "reason-chips";
    for (const tag of tags) {
        const chip = document.createElement("li");
        chip.textContent = tag;
        list.appendChild(chip);
    }
    return list;
}
function buildBreakdown(item) {
    const breakdown = safeScoreBreakdown(item);
    const rows = [
        ["Light", breakdown.light],
        ["Weather", breakdown.weather],
        ["Crowd", breakdown.crowd],
        ["Access", breakdown.access],
    ];
    const list = document.createElement("div");
    list.className = "score-breakdown";
    for (const [label, value] of rows) {
        const row = document.createElement("div");
        row.className = "score-breakdown__row";
        const rowLabel = document.createElement("span");
        rowLabel.textContent = label;
        const track = document.createElement("span");
        track.className = "score-breakdown__track";
        const fill = document.createElement("span");
        fill.className = "score-breakdown__fill";
        fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
        const score = document.createElement("span");
        score.className = "data";
        score.textContent = value.toFixed(0);
        track.appendChild(fill);
        row.append(rowLabel, track, score);
        list.appendChild(row);
    }
    return list;
}
function buildCaveats(item) {
    const caveats = safeStringList(item.caveats);
    if (caveats.length === 0) {
        return null;
    }
    const details = document.createElement("details");
    details.className = "caveats";
    const summary = document.createElement("summary");
    summary.textContent = "What to verify";
    const list = document.createElement("ul");
    for (const caveat of caveats) {
        const row = document.createElement("li");
        row.textContent = caveat;
        list.appendChild(row);
    }
    details.append(summary, list);
    return details;
}
function buildTrustBadges(item, response) {
    const badges = [
        response.demo_mode === true
            ? { label: "Demo plan", detail: "Bundled fallback", tone: "fallback" }
            : {
                label: Date.now() - new Date(response.generated_at).getTime() > 30 * 60000
                    ? "Saved weather"
                    : "Live weather",
                detail: "Open-Meteo",
                tone: "live",
            },
        { label: "Map data", detail: "OpenStreetMap", tone: "live" },
        { label: "Crowd estimate", detail: "Public tags", tone: "estimated" },
        { label: "Access estimate", detail: "Verify locally", tone: "estimated" },
    ];
    const list = document.createElement("ul");
    list.className = "trust-badges";
    for (const badge of badges) {
        const row = document.createElement("li");
        row.className = `trust-badge trust-badge--${badge.tone}`;
        const label = document.createElement("span");
        label.textContent = badge.label;
        const detail = document.createElement("small");
        detail.textContent = badge.detail;
        row.append(label, detail);
        list.appendChild(row);
    }
    return list;
}
function reportFilename(item) {
    return `${item.location_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "scout"}-report.md`;
}
function buildReportText(item, response, settings) {
    const reasons = safeStringList(item.reason_tags);
    const caveats = safeStringList(item.caveats);
    const sourceNote = response.source_note ??
        (response.demo_mode === true
            ? "Bundled demo plan."
            : "Live recommendation from OpenStreetMap, Open-Meteo, and Scout scoring.");
    const mapUrl = `https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=15/${item.latitude}/${item.longitude}`;
    const directionsUrl = `https://www.openstreetmap.org/directions?to=${item.latitude}%2C${item.longitude}`;
    return [
        `# Scout Report: ${item.location_name}`,
        "",
        `Activity: ${response.intent}`,
        `Score: ${item.score}/100 (${confidenceLabel(item)} confidence)`,
        `Best window: ${formatTimeWindow(item.best_window.start_utc, item.best_window.end_utc, settings)}`,
        `Light: ${formatLightPhase(item.light_phase)}`,
        `Distance: ${formatDistance(item.distance_miles, settings)}`,
        `Coordinates: ${item.latitude.toFixed(4)}, ${item.longitude.toFixed(4)}`,
        "",
        "## Conditions",
        item.conditions_summary,
        "",
        "## Why This Place",
        item.advice,
        "",
        reasons.length > 0
            ? reasons.map((reason) => `- ${reason}`).join("\n")
            : "- No reason tags available.",
        "",
        "## Verify Before Leaving",
        caveats.length > 0
            ? caveats.map((caveat) => `- ${caveat}`).join("\n")
            : "- Verify access and conditions locally.",
        "",
        "## Links",
        `- Map: ${mapUrl}`,
        `- Directions: ${directionsUrl}`,
        "",
        "## Source Note",
        sourceNote,
    ].join("\n");
}
async function copyText(text) {
    if (navigator.clipboard !== undefined && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
}
function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
function buildReportActions(item, response, settings) {
    const actions = document.createElement("div");
    actions.className = "report-actions";
    const status = document.createElement("span");
    status.className = "report-actions__status";
    status.setAttribute("role", "status");
    const copy = document.createElement("button");
    copy.className = "button";
    copy.type = "button";
    copy.textContent = "Copy report";
    copy.addEventListener("click", () => {
        const report = buildReportText(item, response, settings);
        void copyText(report)
            .then((copied) => {
            status.textContent = copied
                ? "Copied"
                : "Copy unavailable. Download instead.";
        })
            .catch(() => {
            status.textContent = "Copy unavailable. Download instead.";
        });
    });
    const download = document.createElement("button");
    download.className = "button";
    download.type = "button";
    download.textContent = "Download";
    download.addEventListener("click", () => {
        downloadText(reportFilename(item), buildReportText(item, response, settings));
        status.textContent = "Downloaded";
    });
    actions.append(copy, download, status);
    return actions;
}
function buildSourceNotice(response) {
    if (typeof response.source_note !== "string" ||
        !response.source_note.trim()) {
        return null;
    }
    const notice = document.createElement("section");
    notice.className = "source-notice";
    const label = document.createElement("p");
    label.className = "label";
    label.textContent =
        response.demo_mode === true ? "Demo fallback" : "Source status";
    const body = document.createElement("p");
    body.textContent = response.source_note;
    notice.append(label, body);
    return notice;
}
function buildShareActions(response) {
    const section = document.createElement("section");
    section.className = "share-actions";
    const text = document.createElement("div");
    const label = document.createElement("p");
    label.className = "label";
    label.textContent = "Share";
    const body = document.createElement("p");
    body.textContent = "Create a read-only link for this scout result.";
    text.append(label, body);
    const actions = document.createElement("div");
    actions.className = "share-actions__controls";
    const status = document.createElement("span");
    status.className = "report-actions__status";
    status.setAttribute("role", "status");
    const shareUrl = buildShareUrl(response);
    const copy = document.createElement("button");
    copy.className = "button button--primary";
    copy.type = "button";
    copy.textContent = "Copy share link";
    copy.addEventListener("click", () => {
        void copyText(shareUrl)
            .then((copied) => {
            status.textContent = copied
                ? "Share link copied"
                : "Copy unavailable. Open the link instead.";
        })
            .catch(() => {
            status.textContent = "Copy unavailable. Open the link instead.";
        });
    });
    const open = document.createElement("a");
    open.className = "button";
    open.href = shareUrl;
    open.textContent = "Open share link";
    actions.append(copy, open, status);
    section.append(text, actions);
    return section;
}
function buildCard(item, index, response, settings, onChoose) {
    const card = document.createElement("article");
    card.className = `result-card result-card--${item.light_phase}${index === 0 ? " result-card--primary" : ""}`;
    card.id = `recommendation-${item.rank}`;
    card.style.setProperty("--stagger-index", String(index));
    const top = document.createElement("div");
    top.className = "result-card__top";
    const titleBlock = document.createElement("div");
    const name = document.createElement("h2");
    name.className = "result-card__name";
    name.textContent = item.location_name;
    const meta = document.createElement("p");
    meta.className = "result-card__meta";
    meta.textContent = `${item.terrain_type} / ${formatLightPhase(item.light_phase)} / ${confidenceLabel(item)} confidence`;
    titleBlock.append(name, meta);
    const score = document.createElement("div");
    score.className = scoreClass(item.score);
    score.textContent = `${item.score}`;
    top.append(titleBlock, score);
    const media = item.image_url ? buildMedia(item) : null;
    const grid = document.createElement("div");
    grid.className = "result-card__grid";
    grid.append(tile("Best window", formatTimeWindow(item.best_window.start_utc, item.best_window.end_utc, settings)), tile("Distance", formatDistance(item.distance_miles, settings)), tile("Score", `${item.score}/100`));
    const reasonChips = buildReasonChips(item);
    const trustBadges = buildTrustBadges(item, response);
    const breakdown = buildBreakdown(item);
    const summary = document.createElement("p");
    summary.className = "result-card__summary";
    summary.textContent = item.conditions_summary;
    const advice = document.createElement("p");
    advice.textContent = item.advice;
    const reportActions = buildReportActions(item, response, settings);
    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = "button button--primary choose-place";
    choose.textContent = "Plan this place";
    choose.setAttribute("aria-label", `Plan ${item.location_name}`);
    choose.addEventListener("click", () => onChoose(item));
    card.append(top);
    if (media !== null)
        card.append(media);
    card.append(grid, trustBadges);
    if (reasonChips !== null) {
        card.appendChild(reasonChips);
    }
    const evidence = document.createElement("details");
    evidence.className = "score-evidence";
    const evidenceTitle = document.createElement("summary");
    evidenceTitle.textContent = "Why this score?";
    evidence.append(evidenceTitle, breakdown, advice);
    card.append(summary, evidence, choose, reportActions);
    if (item.permit_required) {
        const permit = document.createElement("p");
        permit.className = "result-card__summary";
        permit.textContent = item.permit_notes ?? "A permit may be required here.";
        card.appendChild(permit);
    }
    const caveats = buildCaveats(item);
    if (caveats !== null) {
        card.appendChild(caveats);
    }
    return card;
}
export function renderResults(root, response, settings, savedPlan, onPlanChange = () => { }, onRefresh = () => { }) {
    if (response.recommendations.length === 0) {
        const empty = document.createElement("section");
        empty.className = "workspace-panel";
        const title = document.createElement("h1");
        title.textContent = "No recommendations found";
        const body = document.createElement("p");
        body.textContent = "Try a wider radius or a different activity.";
        empty.append(title, body);
        root.appendChild(empty);
        return;
    }
    const header = document.createElement("header");
    header.className = "results-heading";
    const step = document.createElement("p");
    step.className = "label";
    step.textContent = "Compare places";
    const heading = document.createElement("h1");
    heading.textContent = "Compare your shortlist";
    const freshness = document.createElement("p");
    freshness.className = "muted";
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    freshness.textContent = `${response.recommendations.length} places · Generated ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(response.generated_at))} · Times shown in ${zone}. Refresh before leaving.`;
    header.append(step, heading, freshness);
    root.append(header);
    if (Date.now() - new Date(response.generated_at).getTime() > 30 * 60000 ||
        response.recommendations.every((item) => new Date(item.best_window.end_utc).getTime() < Date.now())) {
        const warning = document.createElement("section");
        warning.className = "stale-notice";
        const text = document.createElement("p");
        text.textContent =
            "This is a saved result. Weather or light windows may be out of date; refresh before planning your trip.";
        const refresh = document.createElement("button");
        refresh.type = "button";
        refresh.className = "text-button";
        refresh.textContent = "Refresh live recommendations";
        refresh.addEventListener("click", onRefresh);
        warning.append(text, refresh);
        root.append(warning);
    }
    const sourceNotice = buildSourceNotice(response);
    if (sourceNotice !== null)
        root.append(sourceNotice);
    let plan = readFieldPlan(savedPlan);
    const planSection = document.createElement("section");
    const choose = (item, focus = true) => {
        plan = {
            ...plan,
            placeKey: placeKey(item),
            checks: plan.placeKey === placeKey(item) ? plan.checks : [],
        };
        let saveError = false;
        try {
            onPlanChange(plan);
        }
        catch {
            saveError = true;
        }
        renderFieldPlan(planSection, item, response, settings, plan, (next) => {
            plan = next;
            onPlanChange(next);
        });
        if (saveError)
            planSection.querySelector("[role=status]").textContent =
                "Couldn’t save locally. Download your brief to keep a copy.";
        for (const card of Array.from(root.querySelectorAll(".result-card")))
            card.classList.toggle("result-card--chosen", card.id === `recommendation-${item.rank}`);
        if (focus) {
            planSection.scrollIntoView({ block: "start" });
            planSection.querySelector("h2")?.focus({ preventScroll: true });
        }
    };
    const comparison = document.createElement("section");
    comparison.className = "comparison";
    comparison.setAttribute("aria-label", "Compare places");
    comparison.tabIndex = 0;
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.textContent = "The trade-offs at a glance";
    table.append(caption);
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of [
        "Place",
        "Score",
        "Distance¹",
        "Light window",
        "Confidence",
    ]) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.textContent = label;
        headRow.append(cell);
    }
    head.append(headRow);
    table.append(head);
    const body = document.createElement("tbody");
    for (const item of response.recommendations) {
        const row = document.createElement("tr");
        const title = document.createElement("th");
        title.scope = "row";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "text-button";
        button.textContent = item.location_name;
        button.setAttribute("aria-label", `Choose ${item.location_name}`);
        button.addEventListener("click", () => choose(item));
        title.append(button);
        row.append(title);
        const score = document.createElement("td");
        const meter = document.createElement("meter");
        meter.min = 0;
        meter.max = 100;
        meter.value = item.score;
        meter.setAttribute("aria-label", `${item.location_name} score`);
        const number = document.createElement("span");
        number.textContent = ` ${item.score}/100`;
        score.append(meter, number);
        row.append(score);
        for (const text of [
            formatDistance(item.distance_miles, settings),
            formatTimeWindow(item.best_window.start_utc, item.best_window.end_utc, settings),
            confidenceLabel(item),
        ]) {
            const cell = document.createElement("td");
            cell.textContent = text;
            row.append(cell);
        }
        body.append(row);
    }
    table.append(body);
    comparison.append(table);
    root.append(comparison);
    const footnote = document.createElement("p");
    footnote.className = "muted small";
    footnote.textContent =
        "¹ Straight-line distance. Scores compare these candidates; crowd and access are estimates, not live measurements.";
    root.append(footnote);
    if (response.travel_plan) {
        const priorities = document.createElement("details");
        priorities.className = "priority-note";
        const label = document.createElement("summary");
        label.textContent = "How your priorities affect the ranking";
        const explanation = document.createElement("p");
        explanation.textContent = response.travel_plan.explanation;
        priorities.append(label, explanation);
        root.append(priorities);
    }
    root.append(buildOverviewMap(response, settings));
    const list = document.createElement("section");
    list.className = "results-list";
    list.setAttribute("aria-label", "Scout recommendations");
    for (const [index, item] of response.recommendations.entries())
        list.append(buildCard(item, index, response, settings, choose));
    root.append(list, planSection);
    const selected = response.recommendations.find((item) => placeKey(item) === plan.placeKey);
    if (selected)
        choose(selected, false);
    else {
        planSection.className = "plan-empty";
        const title = document.createElement("h2");
        title.textContent = "Choose a place to make it yours.";
        const copy = document.createElement("p");
        copy.textContent =
            "Select Plan this place to prepare notes, check access and take your light window with you.";
        planSection.append(title, copy);
    }
    root.append(buildShareActions(response));
}
