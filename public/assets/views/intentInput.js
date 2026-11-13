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
    let activeRecovery = null;
    const header = document.createElement("header");
    header.className = "view-header";
    const heading = document.createElement("h1");
    heading.textContent = "What are you planning?";
    heading.tabIndex = -1;
    const lede = document.createElement("p");
    lede.className = "lede";
    lede.textContent =
        "Pick an activity and what matters most. Scout ranks the places nearby against the next light windows and the weather.";
    header.append(heading, lede);
    const form = document.createElement("form");
    form.className = "composer";
    form.noValidate = true;
    const origin = document.createElement("p");
    origin.className = "composer__origin";
    const originLabel = document.createElement("span");
    originLabel.textContent = "From ";
    const originValue = document.createElement("strong");
    originValue.textContent = session.location.label;
    const change = document.createElement("button");
    change.type = "button";
    change.className = "text-button";
    change.textContent = "Change location";
    change.addEventListener("click", handlers.onChangeLocation);
    origin.append(originLabel, originValue, change);
    const activityField = document.createElement("div");
    activityField.className = "activity-picker";
    const activitySearch = document.createElement("input");
    activitySearch.className = "input activity-picker__search";
    activitySearch.type = "search";
    activitySearch.placeholder = "Search activities";
    activitySearch.autocomplete = "off";
    activitySearch.setAttribute("aria-label", "Search activities");
    const activityGrid = document.createElement("div");
    activityGrid.className = "activity-grid";
    activityGrid.setAttribute("role", "list");
    activityField.append(activitySearch, activityGrid);
    const options = document.createElement("div");
    options.className = "composer__options";
    const radiusField = document.createElement("label");
    radiusField.className = "field";
    const radiusLabel = document.createElement("span");
    radiusLabel.className = "field__label";
    radiusLabel.textContent = "Search radius (mi)";
    const radius = document.createElement("input");
    radius.type = "number";
    radius.name = "radius";
    radius.className = "input";
    radius.min = "1";
    radius.max = "50";
    radius.required = true;
    radius.autocomplete = "off";
    radius.value = String(session.searchRadiusMiles ?? settings.radiusMiles);
    radiusField.append(radiusLabel, radius);
    const styleField = document.createElement("label");
    styleField.className = "field";
    const styleLabel = document.createElement("span");
    styleLabel.className = "field__label";
    styleLabel.textContent = "Prioritize";
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
    styleField.append(styleLabel, style);
    options.append(radiusField, styleField);
    const controls = document.createElement("div");
    controls.className = "composer__actions";
    const submit = document.createElement("button");
    submit.className = "button button--primary";
    submit.type = "submit";
    submit.textContent = "Scout";
    controls.append(submit);
    const status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    form.append(origin, activityField, options, controls);
    root.append(header, form, status);
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
                : "Map or weather data did not respond in time.";
        const hint = document.createElement("p");
        hint.className = "muted";
        hint.textContent =
            error instanceof ApiRequestError && error.recoveryHint !== null
                ? error.recoveryHint
                : "Retry once, or open the bundled Muscat demo to see the full flow.";
        const actions = document.createElement("div");
        actions.className = "recovery-panel__actions";
        const retry = document.createElement("button");
        retry.className = "button";
        retry.type = "button";
        retry.textContent = "Retry live scout";
        retry.addEventListener("click", () => {
            form.requestSubmit();
        });
        const demo = document.createElement("button");
        demo.className = "button button--ghost";
        demo.type = "button";
        demo.textContent = "Open Muscat demo";
        demo.addEventListener("click", handlers.onUseDemo);
        actions.append(retry, demo);
        recovery.append(title, message, hint, actions);
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
            empty.setAttribute("role", "status");
            empty.textContent =
                "No activity match. Try portrait, sunset, hiking, wildlife, urban, or beach.";
            activityGrid.appendChild(empty);
        }
    }
    activitySearch.addEventListener("input", renderActivities);
    renderActivities();
    function renderSkeleton() {
        const skeleton = document.createElement("section");
        skeleton.className = "results-skeleton";
        skeleton.setAttribute("aria-hidden", "true");
        for (let index = 0; index < 3; index += 1) {
            const row = document.createElement("div");
            row.className = "skeleton-row";
            skeleton.appendChild(row);
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
        submit.textContent = "Scouting…";
        form.setAttribute("aria-busy", "true");
        clearRecovery();
        status.className = "status";
        status.textContent =
            "Checking map candidates, light windows, live weather and access signals…";
        const skeleton = renderSkeleton();
        root.appendChild(skeleton);
        handlers
            .onSubmit(selectedActivity.intent, selectedActivity.shotType, Number(radius.value), style.value, selectedActivity.label)
            .catch((error) => {
            isSubmitting = false;
            submit.disabled = false;
            submit.textContent = "Scout";
            form.setAttribute("aria-busy", "false");
            skeleton.remove();
            status.className = "status status--error";
            status.textContent =
                "Live scout stopped before recommendations were ready.";
            renderRecovery(error);
        });
    });
}
