import { ApiRequestError } from "../api.js";
const ACTIVITY_OPTIONS = [
    {
        id: "coastal-sunset",
        label: "Coastal sunset",
        description: "Clean light, open horizon, and foreground texture.",
        intent: "sunset landscape near the coast with foreground texture",
        shotType: "landscape",
        featured: true,
        keywords: ["sunset", "coast", "beach", "landscape", "golden"],
    },
    {
        id: "quiet-portrait",
        label: "Quiet portrait",
        description: "Soft light, shade, and easy access for people photos.",
        intent: "quiet portrait location with soft light shade and easy access",
        shotType: "portrait",
        featured: true,
        keywords: ["portrait", "people", "soft", "shade", "romantic"],
    },
    {
        id: "romantic-couples",
        label: "Couples shoot",
        description: "Low-friction location for romantic or engagement photos.",
        intent: "romantic couple portrait location with soft light and low crowds",
        shotType: "portrait",
        featured: true,
        keywords: ["romantic", "couple", "engagement", "wedding", "portrait"],
    },
    {
        id: "blue-hour-skyline",
        label: "Blue-hour skyline",
        description: "Urban viewpoint with lines, lights, and twilight color.",
        intent: "urban blue hour viewpoint with strong lines and city lights",
        shotType: "urban",
        featured: true,
        keywords: ["blue hour", "skyline", "urban", "city", "architecture"],
    },
    {
        id: "morning-trail",
        label: "Morning trail",
        description: "Short hike with visibility and a scenic payoff.",
        intent: "short morning hiking trail with good visibility and scenic viewpoint",
        shotType: "hiking",
        featured: true,
        keywords: ["hike", "trail", "morning", "viewpoint", "outdoor"],
    },
    {
        id: "street-photography",
        label: "Street photography",
        description: "Walkable urban area with texture and public activity.",
        intent: "urban street photography location with texture and public activity",
        shotType: "urban",
        featured: false,
        keywords: ["street", "urban", "city", "walk", "documentary"],
    },
    {
        id: "architecture",
        label: "Architecture",
        description: "Buildings, geometry, and clean urban compositions.",
        intent: "urban architecture photography location with strong geometry",
        shotType: "urban",
        featured: false,
        keywords: ["architecture", "building", "urban", "lines", "geometry"],
    },
    {
        id: "astro",
        label: "Night sky",
        description: "Dark, elevated, or open areas for stars and night scenes.",
        intent: "night sky astro photography viewpoint away from bright city lights",
        shotType: "astro",
        featured: false,
        keywords: ["astro", "stars", "night", "dark", "milky way"],
    },
    {
        id: "wildlife",
        label: "Wildlife",
        description: "Nature reserve, park, or quiet habitat with low disturbance.",
        intent: "wildlife photography nature reserve or quiet park with low disturbance",
        shotType: "wildlife",
        featured: false,
        keywords: ["wildlife", "animal", "nature", "reserve", "park"],
    },
    {
        id: "birding",
        label: "Birding",
        description: "Water, reserve, or green space with open sightlines.",
        intent: "bird photography location near water nature reserve or open park",
        shotType: "wildlife",
        featured: false,
        keywords: ["bird", "birding", "wildlife", "water", "reserve"],
    },
    {
        id: "beach-portraits",
        label: "Beach portraits",
        description: "Coastal portrait spot with soft light and simple access.",
        intent: "beach portrait location with soft light and easy access",
        shotType: "portrait",
        featured: false,
        keywords: ["beach", "portrait", "coast", "soft", "romantic"],
    },
    {
        id: "waterfront",
        label: "Waterfront",
        description: "Reflections, water texture, and open light.",
        intent: "waterfront landscape photography location with reflections and open light",
        shotType: "landscape",
        featured: false,
        keywords: ["water", "waterfront", "reflection", "landscape", "lake"],
    },
    {
        id: "viewpoint",
        label: "Scenic viewpoint",
        description: "High-value overlook for broad landscape compositions.",
        intent: "scenic viewpoint for landscape photography with good visibility",
        shotType: "landscape",
        featured: false,
        keywords: ["viewpoint", "overlook", "landscape", "mountain", "visibility"],
    },
    {
        id: "park-walk",
        label: "Park walk",
        description: "Easy outdoor route for casual scouting and photos.",
        intent: "easy park walk with good light and low access friction",
        shotType: "hiking",
        featured: false,
        keywords: ["park", "walk", "easy", "casual", "outdoor"],
    },
];
function defaultActivity() {
    const first = ACTIVITY_OPTIONS[0];
    if (first === undefined) {
        throw new Error("Scout requires at least one activity option.");
    }
    return first;
}
function inferInitialActivity(session, settings) {
    const saved = ACTIVITY_OPTIONS.find((activity) => activity.intent === session.intent);
    if (saved !== undefined) {
        return saved;
    }
    const preferred = settings.activityTypes.find((activity) => ACTIVITY_OPTIONS.some((option) => option.shotType === activity));
    const preferredActivity = ACTIVITY_OPTIONS.find((activity) => activity.shotType === preferred);
    return preferredActivity ?? defaultActivity();
}
export function renderIntentInput(root, session, settings, handlers) {
    let selectedActivity = inferInitialActivity(session, settings);
    let isSubmitting = false;
    const isNewScout = session.results === null;
    let activeRecovery = null;
    const form = document.createElement("form");
    form.className = `composer${isNewScout ? " composer--command" : ""}`;
    form.noValidate = true;
    const fields = document.createElement("div");
    fields.className = "composer__fields";
    const locationField = document.createElement("label");
    locationField.className = "field";
    const locationLabel = document.createElement("span");
    locationLabel.className = "label";
    locationLabel.textContent = "Location";
    const locationInput = document.createElement("input");
    locationInput.className = "input data";
    locationInput.value = session.location.label;
    locationInput.readOnly = true;
    locationField.append(locationLabel, locationInput);
    const activityField = document.createElement("div");
    activityField.className = "field activity-picker";
    const activityLabel = document.createElement("span");
    activityLabel.id = `activity-label-${session.id}`;
    activityLabel.className = "label";
    activityLabel.textContent = "Activity";
    const activitySearch = document.createElement("input");
    activitySearch.className = "input activity-picker__search";
    activitySearch.type = "search";
    activitySearch.placeholder = "Search activities";
    activitySearch.autocomplete = "off";
    activitySearch.setAttribute("aria-labelledby", activityLabel.id);
    const activityGrid = document.createElement("div");
    activityGrid.className = "activity-grid";
    activityGrid.setAttribute("role", "list");
    activityField.append(activityLabel, activitySearch, activityGrid);
    const change = document.createElement("button");
    change.type = "button";
    change.className = "text-button";
    change.textContent = "Change origin";
    change.addEventListener("click", handlers.onChangeLocation);
    const locationGroup = document.createElement("div");
    locationGroup.className = "field";
    locationGroup.append(locationField, change);
    const radiusField = document.createElement("label");
    radiusField.className = "field";
    radiusField.textContent = "Search radius (mi)";
    const radius = document.createElement("input");
    radius.type = "number";
    radius.name = "radius";
    radius.className = "input";
    radius.min = "1";
    radius.max = "50";
    radius.required = true;
    radius.value = String(session.searchRadiusMiles ?? settings.radiusMiles);
    radiusField.append(radius);
    const styleField = document.createElement("label");
    styleField.className = "field";
    styleField.textContent = "Prioritize";
    const style = document.createElement("select");
    style.name = "travel-style";
    style.className = "input";
    for (const [value, label] of [
        ["photographer", "Photography"],
        ["sightseeing", "Sightseeing"],
        ["family", "Family outing"],
        ["budget", "Low cost"],
        ["accessible", "Easier access"],
    ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        style.append(option);
    }
    style.value = session.travelStyle ?? "photographer";
    styleField.append(style);
    const priorities = document.createElement("div");
    priorities.className = "priority-fields";
    priorities.append(radiusField, styleField);
    fields.append(locationGroup, activityField, priorities);
    const controls = document.createElement("div");
    controls.className = "field composer__actions";
    const selectedSummary = document.createElement("p");
    selectedSummary.className = "activity-summary";
    const submit = document.createElement("button");
    submit.className = "button button--primary";
    submit.type = "submit";
    submit.textContent = "Scout";
    const status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    controls.append(selectedSummary, submit);
    form.append(fields, controls);
    function clearRecovery() {
        if (activeRecovery !== null) {
            activeRecovery.remove();
            activeRecovery = null;
        }
    }
    function renderRecovery(error) {
        clearRecovery();
        const recovery = document.createElement("section");
        recovery.className = "recovery-panel";
        recovery.setAttribute("role", "alert");
        const title = document.createElement("h2");
        title.textContent = "Scout could not complete the live search.";
        const message = document.createElement("p");
        message.textContent =
            error instanceof ApiRequestError
                ? error.message
                : "Map or weather data did not respond in time. Scout kept the raw provider error hidden.";
        const hint = document.createElement("p");
        hint.className = "recovery-panel__hint";
        hint.textContent =
            error instanceof ApiRequestError && error.recoveryHint !== null
                ? error.recoveryHint
                : "Retry once, or open the bundled Muscat demo to verify the product flow.";
        const meta = document.createElement("p");
        meta.className = "data recovery-panel__meta";
        if (error instanceof ApiRequestError) {
            meta.textContent = `status ${error.status || "offline"} / ${error.code} / ${error.retryable ? "retryable" : "check input"}`;
        }
        else {
            meta.textContent = "status unknown / client_error / retryable";
        }
        const actions = document.createElement("div");
        actions.className = "recovery-panel__actions";
        const retry = document.createElement("button");
        retry.className = "button button--primary";
        retry.type = "button";
        retry.textContent = "Retry live scout";
        retry.addEventListener("click", () => {
            form.requestSubmit();
        });
        const demo = document.createElement("button");
        demo.className = "button";
        demo.type = "button";
        demo.textContent = "Open Muscat demo";
        demo.addEventListener("click", handlers.onUseDemo);
        actions.append(retry, demo);
        recovery.append(title, message, hint, meta, actions);
        activeRecovery = recovery;
        root.appendChild(recovery);
    }
    function matchesActivity(activity, query) {
        if (!query) {
            return true;
        }
        const haystack = [
            activity.label,
            activity.description,
            activity.intent,
            ...activity.keywords,
        ]
            .join(" ")
            .toLowerCase();
        return haystack.includes(query);
    }
    function renderActivities() {
        const query = activitySearch.value.trim().toLowerCase();
        const matches = ACTIVITY_OPTIONS.filter((activity) => matchesActivity(activity, query));
        if (query &&
            !matches.some((activity) => activity.id === selectedActivity.id)) {
            const firstMatch = matches[0];
            if (firstMatch !== undefined) {
                selectedActivity = firstMatch;
            }
        }
        activityGrid.textContent = "";
        for (const activity of matches) {
            const button = document.createElement("button");
            button.className = `activity-card${activity.id === selectedActivity.id ? " activity-card--selected" : ""}`;
            button.type = "button";
            button.setAttribute("aria-pressed", String(activity.id === selectedActivity.id));
            button.setAttribute("aria-label", `${activity.label}: ${activity.description}`);
            const label = document.createElement("span");
            label.className = "activity-card__label";
            label.textContent = activity.label;
            const description = document.createElement("span");
            description.className = "activity-card__description";
            description.textContent = activity.description;
            button.append(label, description);
            button.addEventListener("click", () => {
                selectedActivity = activity;
                renderActivities();
            });
            activityGrid.appendChild(button);
        }
        if (matches.length === 0) {
            const empty = document.createElement("p");
            empty.className = "activity-picker__empty";
            empty.textContent =
                "No activity match. Try portrait, sunset, hiking, wildlife, urban, or beach.";
            activityGrid.appendChild(empty);
        }
        selectedSummary.textContent = `${selectedActivity.label} · Upcoming light windows`;
    }
    activitySearch.addEventListener("input", renderActivities);
    renderActivities();
    if (isNewScout) {
        const intro = document.createElement("header");
        intro.className = "search-intro";
        const step = document.createElement("p");
        step.className = "label";
        step.textContent = "Search brief";
        const heading = document.createElement("h1");
        heading.textContent = "What are you planning?";
        const copy = document.createElement("p");
        copy.textContent =
            "Choose an activity and what matters to you. Scout compares nearby places against upcoming light and weather.";
        intro.append(step, heading, copy);
        root.append(intro, form, status);
    }
    else {
        const edit = document.createElement("details");
        edit.className = "edit-search";
        const summary = document.createElement("summary");
        summary.textContent = `Edit search · ${session.location.label} · ${selectedActivity.label}`;
        edit.append(summary, form, status);
        root.append(edit);
    }
    function renderSkeleton() {
        const skeleton = document.createElement("section");
        skeleton.className = "results-skeleton";
        for (let index = 0; index < 3; index += 1) {
            const card = document.createElement("div");
            card.className = "skeleton-card";
            card.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
            skeleton.appendChild(card);
        }
        return skeleton;
    }
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (isSubmitting) {
            return;
        }
        if (!form.reportValidity())
            return;
        isSubmitting = true;
        submit.disabled = true;
        form.setAttribute("aria-busy", "true");
        clearRecovery();
        status.className = "status";
        status.textContent =
            "Checking map candidates, light windows, live weather, and access signals.";
        const skeleton = renderSkeleton();
        root.appendChild(skeleton);
        handlers
            .onSubmit(selectedActivity.intent, selectedActivity.shotType, Number(radius.value), style.value)
            .catch((error) => {
            isSubmitting = false;
            submit.disabled = false;
            form.setAttribute("aria-busy", "false");
            skeleton.remove();
            status.className = "status status--error";
            status.textContent =
                "Live scout stopped before recommendations were ready.";
            renderRecovery(error);
        });
    });
}
