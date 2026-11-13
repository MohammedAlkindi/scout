import { fetchRecommendation } from "./api.js";
import { clearShareParamFromUrl, readSharedRecommendationFromUrl, } from "./share.js";
import { applySettings, initSettingsPanel } from "./settings.js";
import { createSession, createDemoSession, DEMO_SESSION_NAME, deleteSession, duplicateSession, loadSessions, loadSettings, saveSettings, saveSessions, upsertSession, } from "./storage.js";
import { placeKey, readFieldPlan, renderFieldPlan } from "./views/fieldPlan.js";
import { renderIntentInput } from "./views/intentInput.js";
import { renderLocationGrant } from "./views/locationGrant.js";
import { buildStaleNotice, renderResults } from "./views/results.js";
const LOCATION_PENDING_LABEL = "Location pending";
const STEPS = [
    { id: "location", label: "Location" },
    { id: "brief", label: "Brief" },
    { id: "shortlist", label: "Shortlist" },
    { id: "plan", label: "Plan" },
];
function closeNavigation() {
    const dialog = document.getElementById("mobile-nav");
    if (dialog?.open)
        dialog.close();
}
function requireElement(id, constructor) {
    const element = document.getElementById(id);
    if (!(element instanceof constructor)) {
        throw new Error(`Missing #${id}`);
    }
    return element;
}
function getElements() {
    return {
        sidebar: requireElement("sidebar", HTMLElement),
        sidebarToggle: requireElement("sidebar-toggle", HTMLButtonElement),
        sessionList: requireElement("session-list", HTMLElement),
        newSession: requireElement("new-session", HTMLButtonElement),
        sessionSearch: requireElement("session-search", HTMLInputElement),
        mainContent: requireElement("main-content", HTMLElement),
        activeTitle: requireElement("active-session-title", HTMLElement),
        steps: requireElement("steps", HTMLElement),
        settingsPanel: requireElement("settings-panel", HTMLElement),
        settingsOverlay: requireElement("settings-overlay", HTMLElement),
        settingsOpen: requireElement("settings-open", HTMLButtonElement),
    };
}
function formatSessionTime(iso) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(iso));
}
function activeSession(state) {
    const session = state.sessions.find((candidate) => candidate.id === state.activeSessionId);
    if (session !== undefined) {
        return session;
    }
    return state.sessions[0] ?? createSession();
}
function sessionHasLocation(session) {
    return session.location.label !== LOCATION_PENDING_LABEL;
}
function isUntouchedDraft(session) {
    return (!sessionHasLocation(session) &&
        session.intent.trim() === "" &&
        session.results === null);
}
function isDemoSession(session) {
    return (session.name === DEMO_SESSION_NAME &&
        session.location.label === "Muscat, Oman");
}
function ensureDemoSession(sessions) {
    if (sessions.some(isDemoSession)) {
        return sessions;
    }
    return [...sessions, createDemoSession()];
}
function defaultSessionName(location, intent) {
    if (intent.trim()) {
        return intent.trim().slice(0, 42);
    }
    return location.label;
}
function updateSession(state, session) {
    state.sessions = upsertSession(session);
    state.activeSessionId = session.id;
}
function openDemoSession(state) {
    const existingDemo = state.sessions.find(isDemoSession);
    if (existingDemo !== undefined) {
        state.activeSessionId = existingDemo.id;
        saveSessions(state.sessions);
        return;
    }
    const demo = createDemoSession();
    state.sessions = [...state.sessions, demo];
    state.activeSessionId = demo.id;
    saveSessions(state.sessions);
}
function chosenPlace(session) {
    const key = session.fieldPlan?.placeKey;
    if (!key || session.results === null)
        return undefined;
    return session.results.recommendations.find((item) => placeKey(item) === key);
}
function stepAvailable(session, step) {
    switch (step) {
        case "location":
            return true;
        case "brief":
            return sessionHasLocation(session);
        case "shortlist":
            return session.results !== null;
        case "plan":
            return chosenPlace(session) !== undefined;
    }
}
function furthestStep(session) {
    if (chosenPlace(session) !== undefined)
        return "plan";
    if (session.results !== null)
        return "shortlist";
    if (sessionHasLocation(session))
        return "brief";
    return "location";
}
function currentStep(state, session) {
    if (state.step !== null && stepAvailable(session, state.step)) {
        return state.step;
    }
    return furthestStep(session);
}
function goTo(state, step) {
    state.step = step;
    state.focusHeading = true;
}
function renderSteps(elements, state, session, renderApp) {
    const current = currentStep(state, session);
    elements.steps.textContent = "";
    for (const step of STEPS) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "steps__item";
        button.textContent = step.label;
        button.disabled = !stepAvailable(session, step.id);
        if (step.id === current) {
            button.setAttribute("aria-current", "step");
        }
        button.addEventListener("click", () => {
            if (currentStep(state, activeSession(state)) === step.id)
                return;
            goTo(state, step.id);
            renderApp();
        });
        elements.steps.appendChild(button);
    }
}
function createMenuButton(label, onClick) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = label;
    item.addEventListener("click", (event) => {
        event.stopPropagation();
        onClick();
    });
    return item;
}
function dotsIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("width", "16");
    svg.setAttribute("height", "16");
    svg.setAttribute("aria-hidden", "true");
    for (const cx of [3, 8, 13]) {
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", String(cx));
        dot.setAttribute("cy", "8");
        dot.setAttribute("r", "1.5");
        dot.setAttribute("fill", "currentColor");
        svg.appendChild(dot);
    }
    return svg;
}
function closeSessionMenus(except) {
    for (const popover of Array.from(document.querySelectorAll(".menu-popover"))) {
        if (popover !== except)
            popover.hidden = true;
    }
    for (const trigger of Array.from(document.querySelectorAll(".session-menu__trigger"))) {
        if (trigger.nextElementSibling !== except) {
            trigger.setAttribute("aria-expanded", "false");
        }
    }
}
function renderSidebar(elements, state, renderApp) {
    elements.sessionList.textContent = "";
    const query = state.sessionQuery.trim().toLowerCase();
    const sessions = query
        ? state.sessions.filter((session) => [session.name, session.location.label, session.intent]
            .join(" ")
            .toLowerCase()
            .includes(query))
        : state.sessions;
    for (const session of sessions) {
        const row = document.createElement("div");
        row.className = `session-button${session.id === state.activeSessionId ? " session-button--active" : ""}`;
        const activate = () => {
            state.activeSessionId = session.id;
            goTo(state, null);
            closeNavigation();
            renderApp();
        };
        const selector = document.createElement("button");
        selector.className = "session-button__select";
        selector.type = "button";
        selector.addEventListener("click", activate);
        if (session.id === state.activeSessionId) {
            selector.setAttribute("aria-current", "true");
        }
        const title = document.createElement("span");
        title.className = "session-button__title";
        title.textContent = session.name;
        const meta = document.createElement("span");
        meta.className = "session-button__meta";
        meta.textContent = `${session.location.label}, ${formatSessionTime(session.createdAt)}`;
        selector.append(title, meta);
        const menu = document.createElement("span");
        menu.className = "session-menu";
        const trigger = document.createElement("button");
        trigger.className = "icon-button session-menu__trigger";
        trigger.type = "button";
        trigger.appendChild(dotsIcon());
        trigger.setAttribute("aria-label", `Session actions for ${session.name}`);
        trigger.setAttribute("aria-haspopup", "menu");
        trigger.setAttribute("aria-expanded", "false");
        const popover = document.createElement("span");
        popover.className = "menu-popover";
        popover.setAttribute("role", "menu");
        popover.hidden = true;
        trigger.addEventListener("click", (event) => {
            event.stopPropagation();
            const open = popover.hidden;
            closeSessionMenus(popover);
            popover.hidden = !open;
            trigger.setAttribute("aria-expanded", String(open));
        });
        popover.append(createMenuButton("Rename", () => {
            const nextName = window.prompt("Rename this scout", session.name);
            if (nextName !== null && nextName.trim()) {
                updateSession(state, { ...session, name: nextName.trim() });
                renderApp();
            }
        }), createMenuButton("Duplicate", () => {
            const duplicate = duplicateSession(session);
            state.sessions = [duplicate, ...state.sessions];
            saveSessions(state.sessions);
            state.activeSessionId = duplicate.id;
            goTo(state, null);
            renderApp();
        }), createMenuButton("Delete", () => {
            if (!window.confirm(`Delete “${session.name}” from this device?`))
                return;
            state.sessions = deleteSession(session.id);
            if (state.sessions.length === 0) {
                const fresh = createSession();
                state.sessions = [fresh];
                saveSessions(state.sessions);
            }
            state.activeSessionId = state.sessions[0]?.id ?? createSession().id;
            goTo(state, null);
            renderApp();
        }));
        for (const item of Array.from(popover.children)) {
            item.setAttribute("role", "menuitem");
        }
        menu.append(trigger, popover);
        row.append(selector, menu);
        elements.sessionList.appendChild(row);
    }
    if (sessions.length === 0) {
        const empty = document.createElement("p");
        empty.className = "session-empty";
        empty.textContent = "No sessions match this search.";
        elements.sessionList.appendChild(empty);
    }
}
function planPlace(state, item, renderApp) {
    const session = activeSession(state);
    const previous = readFieldPlan(session.fieldPlan);
    const key = placeKey(item);
    const plan = {
        placeKey: key,
        notes: previous.notes,
        checks: previous.placeKey === key ? previous.checks : [],
    };
    state.planSaveFailed = false;
    try {
        updateSession(state, { ...session, fieldPlan: plan });
    }
    catch {
        // Storage is full or blocked: keep the plan in memory so the view still works.
        state.planSaveFailed = true;
        state.sessions = state.sessions.map((candidate) => candidate.id === session.id ? { ...candidate, fieldPlan: plan } : candidate);
    }
    goTo(state, "plan");
    renderApp();
}
function renderPlanView(wrapper, state, session, item, response, onRefresh) {
    const stale = buildStaleNotice(response, onRefresh);
    if (stale !== null)
        wrapper.appendChild(stale);
    const section = document.createElement("section");
    renderFieldPlan(section, item, response, state.settings, readFieldPlan(session.fieldPlan), (next) => {
        const current = activeSession(state);
        updateSession(state, { ...current, fieldPlan: next });
    });
    wrapper.appendChild(section);
    if (state.planSaveFailed) {
        const status = section.querySelector("[role=status]");
        if (status !== null) {
            status.textContent =
                "Couldn’t save locally. Download your brief to keep a copy.";
        }
    }
}
function renderActiveSession(elements, state, renderApp) {
    const session = activeSession(state);
    const step = currentStep(state, session);
    elements.activeTitle.textContent = session.name;
    renderSteps(elements, state, session, renderApp);
    elements.mainContent.textContent = "";
    const wrapper = document.createElement("div");
    wrapper.className = `view view--${step}`;
    elements.mainContent.appendChild(wrapper);
    const onRefresh = () => {
        goTo(state, "brief");
        renderApp();
        elements.mainContent
            .querySelector(".composer")
            ?.requestSubmit();
    };
    if (step === "location") {
        renderLocationGrant(wrapper, {
            onGranted: (location) => {
                const nextLocation = {
                    lat: location.latitude,
                    lng: location.longitude,
                    label: location.label ??
                        `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
                };
                const current = activeSession(state);
                const moved = !sessionHasLocation(current) ||
                    current.location.lat !== nextLocation.lat ||
                    current.location.lng !== nextLocation.lng;
                updateSession(state, {
                    ...current,
                    location: nextLocation,
                    name: defaultSessionName(nextLocation, current.intent),
                    results: moved ? null : current.results,
                    fieldPlan: moved ? undefined : current.fieldPlan,
                });
                goTo(state, "brief");
                renderApp();
            },
        });
    }
    else if (step === "brief" || session.results === null) {
        renderIntentInput(wrapper, session, state.settings, {
            onSubmit: async (intent, shotType, radiusMiles, travelStyle, activityLabel) => {
                const request = {
                    latitude: session.location.lat,
                    longitude: session.location.lng,
                    intent,
                    radius_miles: radiusMiles,
                    travel_style: travelStyle,
                };
                if (shotType !== undefined) {
                    request.shot_type = shotType;
                }
                const response = await fetchRecommendation(request);
                const current = state.sessions.find((candidate) => candidate.id === session.id) ??
                    session;
                const nextSession = {
                    ...current,
                    intent,
                    results: response,
                    searchRadiusMiles: radiusMiles,
                    travelStyle,
                    fieldPlan: current.fieldPlan
                        ? { ...current.fieldPlan, placeKey: "", checks: [] }
                        : undefined,
                    name: activityLabel,
                };
                state.sessions = upsertSession(nextSession);
                if (state.activeSessionId !== session.id)
                    return;
                goTo(state, "shortlist");
                renderApp();
            },
            onChangeLocation: () => {
                goTo(state, "location");
                renderApp();
            },
            onUseDemo: () => {
                openDemoSession(state);
                goTo(state, null);
                renderApp();
            },
        });
    }
    else if (step === "shortlist") {
        renderResults(wrapper, session.results, state.settings, session.fieldPlan?.placeKey ?? "", {
            onPlan: (item) => planPlace(state, item, renderApp),
            onRefresh,
        });
    }
    else {
        const item = chosenPlace(session);
        if (item === undefined) {
            goTo(state, "shortlist");
            renderApp();
            return;
        }
        renderPlanView(wrapper, state, session, item, session.results, onRefresh);
    }
    if (state.focusHeading) {
        state.focusHeading = false;
        elements.mainContent.scrollTop = 0;
        wrapper.querySelector("h1")?.focus({ preventScroll: true });
    }
}
function sharedSessionFromResponse(response) {
    const name = response.intent.trim()
        ? `Shared: ${response.intent.trim().slice(0, 36)}`
        : "Shared scout";
    return {
        id: crypto.randomUUID(),
        createdAt: response.generated_at,
        location: {
            lat: response.latitude,
            lng: response.longitude,
            label: "Shared location",
        },
        intent: response.intent,
        results: response,
        name,
    };
}
function main() {
    const elements = getElements();
    const sharedResponse = readSharedRecommendationFromUrl();
    const sessions = loadSessions();
    const firstSession = sessions[0] ?? createSession();
    const sessionsWithShare = sharedResponse === null
        ? sessions.length === 0
            ? [firstSession]
            : sessions
        : [sharedSessionFromResponse(sharedResponse), ...sessions];
    const initialSessions = ensureDemoSession(sessionsWithShare);
    if (sharedResponse !== null ||
        sessions.length === 0 ||
        initialSessions.length !== sessions.length) {
        saveSessions(initialSessions);
    }
    if (sharedResponse !== null) {
        clearShareParamFromUrl();
    }
    const state = {
        sessions: initialSessions,
        activeSessionId: sharedResponse === null
            ? firstSession.id
            : (initialSessions[0]?.id ?? firstSession.id),
        settings: loadSettings(),
        step: null,
        sessionQuery: "",
        focusHeading: false,
        planSaveFailed: false,
    };
    const renderApp = () => {
        renderSidebar(elements, state, renderApp);
        renderActiveSession(elements, state, renderApp);
    };
    elements.newSession.addEventListener("click", () => {
        const existingDraft = state.sessions.find(isUntouchedDraft);
        if (existingDraft !== undefined) {
            state.activeSessionId = existingDraft.id;
        }
        else {
            const session = createSession();
            state.sessions = [session, ...state.sessions];
            state.activeSessionId = session.id;
            saveSessions(state.sessions);
        }
        goTo(state, null);
        closeNavigation();
        renderApp();
    });
    const mobileNav = requireElement("mobile-nav", HTMLDialogElement);
    const navMedia = window.matchMedia("(max-width: 760px)");
    const mountNavigation = () => {
        if (navMedia.matches)
            mobileNav.append(elements.sidebar);
        else {
            closeNavigation();
            document.querySelector(".app-shell")?.prepend(elements.sidebar);
        }
    };
    navMedia.addEventListener("change", mountNavigation);
    mountNavigation();
    elements.sidebarToggle.addEventListener("click", () => {
        mobileNav.showModal();
        elements.sidebarToggle.setAttribute("aria-expanded", "true");
    });
    mobileNav.addEventListener("close", () => elements.sidebarToggle.setAttribute("aria-expanded", "false"));
    mobileNav.addEventListener("click", (event) => {
        if (event.target === mobileNav)
            closeNavigation();
    });
    requireElement("nav-close", HTMLButtonElement).addEventListener("click", closeNavigation);
    document.addEventListener("click", () => closeSessionMenus());
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape")
            closeSessionMenus();
    });
    elements.sessionSearch.addEventListener("input", () => {
        state.sessionQuery = elements.sessionSearch.value;
        renderSidebar(elements, state, renderApp);
    });
    elements.settingsOpen.addEventListener("click", closeNavigation);
    initSettingsPanel({
        panel: elements.settingsPanel,
        overlay: elements.settingsOverlay,
        openButton: elements.settingsOpen,
        settings: state.settings,
        onChange: (settings) => {
            state.settings = settings;
            saveSettings(settings);
            applySettings(settings);
            renderApp();
        },
    });
    renderApp();
    if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("/sw.js").catch(() => { });
        });
    }
}
main();
