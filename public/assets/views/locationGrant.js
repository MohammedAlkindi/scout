const DESTINATIONS = [
    {
        kind: "City",
        name: "Muscat",
        region: "Oman",
        latitude: 23.5793,
        longitude: 58.4025,
        description: "Coast, mountains, and sunset-friendly waterfronts.",
        tags: ["oman", "coast", "sunset", "middle east"],
        featured: true,
    },
    {
        kind: "City",
        name: "Dubai",
        region: "United Arab Emirates",
        latitude: 25.2048,
        longitude: 55.2708,
        description: "Skyline, beach, architecture, and desert edges.",
        tags: ["uae", "emirates", "skyline", "beach", "architecture"],
        featured: true,
    },
    {
        kind: "City",
        name: "Salalah",
        region: "Oman",
        latitude: 17.0194,
        longitude: 54.0897,
        description: "Cliffs, monsoon greenery, beaches, and viewpoints.",
        tags: ["oman", "khareef", "cliffs", "beach", "green"],
        featured: true,
    },
    {
        kind: "City",
        name: "Doha",
        region: "Qatar",
        latitude: 25.2854,
        longitude: 51.531,
        description: "Corniche, architecture, museums, and coastal light.",
        tags: ["qatar", "corniche", "architecture", "coast"],
        featured: true,
    },
    {
        kind: "City",
        name: "London",
        region: "United Kingdom",
        latitude: 51.5072,
        longitude: -0.1276,
        description: "Street, architecture, parks, and river viewpoints.",
        tags: ["uk", "england", "street", "architecture", "river"],
        featured: false,
    },
    {
        kind: "City",
        name: "Tokyo",
        region: "Japan",
        latitude: 35.6762,
        longitude: 139.6503,
        description: "Urban layers, night scenes, parks, and skyline views.",
        tags: ["japan", "urban", "night", "street", "skyline"],
        featured: false,
    },
    {
        kind: "Country",
        name: "Oman",
        region: "Muscat anchor",
        latitude: 23.5793,
        longitude: 58.4025,
        description: "Start from Muscat for coast, mountain, and old-town scouting.",
        tags: ["country", "oman", "muscat", "coast", "mountain"],
        featured: false,
    },
    {
        kind: "Country",
        name: "United Arab Emirates",
        region: "Dubai anchor",
        latitude: 25.2048,
        longitude: 55.2708,
        description: "Start from Dubai for urban, coastal, and desert scouting.",
        tags: ["country", "uae", "emirates", "dubai", "desert"],
        featured: false,
    },
    {
        kind: "Country",
        name: "Japan",
        region: "Tokyo anchor",
        latitude: 35.6762,
        longitude: 139.6503,
        description: "Start from Tokyo for urban, park, and night-sky day trips.",
        tags: ["country", "japan", "tokyo", "urban", "mountain"],
        featured: false,
    },
    {
        kind: "Country",
        name: "South Africa",
        region: "Cape Town anchor",
        latitude: -33.9249,
        longitude: 18.4241,
        description: "Start from Cape Town for coast, mountain, and wildlife routes.",
        tags: ["country", "south africa", "cape town", "coast", "mountain"],
        featured: false,
    },
    {
        kind: "Place",
        name: "Yosemite Valley",
        region: "California, United States",
        latitude: 37.8651,
        longitude: -119.5383,
        description: "Granite walls, waterfalls, forest, and classic viewpoints.",
        tags: ["usa", "california", "national park", "waterfall", "landscape"],
        featured: false,
    },
    {
        kind: "Place",
        name: "Lake Louise",
        region: "Alberta, Canada",
        latitude: 51.4254,
        longitude: -116.1773,
        description: "Alpine lake, mountain light, trails, and winter scenes.",
        tags: ["canada", "banff", "lake", "mountain", "hiking"],
        featured: false,
    },
    {
        kind: "Place",
        name: "Oia",
        region: "Santorini, Greece",
        latitude: 36.4618,
        longitude: 25.3763,
        description: "Caldera views, blue hour, architecture, and sunset lanes.",
        tags: ["greece", "santorini", "sunset", "architecture", "coast"],
        featured: false,
    },
];
/** Keep the grid to two rows at most so nothing scrolls inside the view. */
const MAX_VISIBLE_DESTINATIONS = 8;
function describeGeolocationError(error) {
    switch (error.code) {
        case error.PERMISSION_DENIED:
            return "Location access was denied. Enter coordinates or allow location access in browser settings.";
        case error.POSITION_UNAVAILABLE:
            return "Could not reach location data. Check your connection and try again.";
        case error.TIMEOUT:
            return "Location lookup timed out. Check your connection and try again.";
        default:
            return "Could not reach location data. Check your connection and try again.";
    }
}
function parseCoordinate(value) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
}
function destinationLabel(destination) {
    return `${destination.name}, ${destination.region}`;
}
function matchesDestination(destination, query) {
    if (!query) {
        return destination.featured;
    }
    const haystack = [
        destination.kind,
        destination.name,
        destination.region,
        destination.description,
        ...destination.tags,
    ]
        .join(" ")
        .toLowerCase();
    return haystack.includes(query);
}
function destinationMatchRank(destination, query) {
    if (!query) {
        return destination.featured ? 0 : 1;
    }
    const name = destination.name.toLowerCase();
    const region = destination.region.toLowerCase();
    if (name === query) {
        return 0;
    }
    if (name.startsWith(query)) {
        return 1;
    }
    if (region === query || region.startsWith(query)) {
        return 2;
    }
    return 3;
}
function field(labelText, input) {
    const label = document.createElement("label");
    label.className = "field";
    const text = document.createElement("span");
    text.className = "field__label";
    text.textContent = labelText;
    label.append(text, input);
    return label;
}
export function renderLocationGrant(root, handlers) {
    const header = document.createElement("header");
    header.className = "view-header";
    const title = document.createElement("h1");
    title.textContent = "Starting location";
    title.tabIndex = -1;
    const lede = document.createElement("p");
    lede.className = "lede";
    lede.textContent =
        "Search a destination or use your position. Scout compares the places nearby against light and weather.";
    header.append(title, lede);
    let selectedDestination = DESTINATIONS[0] ?? {
        kind: "City",
        name: "Muscat",
        region: "Oman",
        latitude: 23.5793,
        longitude: 58.4025,
        description: "Coast, mountains, and sunset-friendly waterfronts.",
        tags: ["oman"],
        featured: true,
    };
    const picker = document.createElement("div");
    picker.className = "destination-picker";
    const destinationSearch = document.createElement("input");
    destinationSearch.className = "input destination-picker__search";
    destinationSearch.type = "search";
    destinationSearch.placeholder = "Search cities, countries, places";
    destinationSearch.autocomplete = "off";
    destinationSearch.setAttribute("aria-label", "Destination");
    const destinationGrid = document.createElement("div");
    destinationGrid.className = "destination-grid";
    destinationGrid.setAttribute("role", "list");
    const useDestination = document.createElement("button");
    useDestination.type = "button";
    useDestination.className = "button button--primary";
    const locate = document.createElement("button");
    locate.type = "button";
    locate.className = "button";
    locate.textContent = "Use my location";
    const actions = document.createElement("div");
    actions.className = "location-actions";
    actions.append(useDestination, locate);
    let liveDestinations = [];
    let liveQuery = "";
    let searchMessage = "";
    let searchTimer;
    function selectDestination(destination) {
        selectedDestination = destination;
        renderDestinations();
    }
    function renderDestinations() {
        const query = destinationSearch.value.trim().toLowerCase();
        const local = DESTINATIONS.filter((destination) => matchesDestination(destination, query));
        const matches = (local.length > 0 || !query
            ? local
            : liveQuery === query
                ? liveDestinations
                : [])
            .sort((left, right) => destinationMatchRank(left, query) - destinationMatchRank(right, query))
            .slice(0, MAX_VISIBLE_DESTINATIONS);
        if (query && !matches.includes(selectedDestination)) {
            selectedDestination = matches[0] ?? selectedDestination;
        }
        destinationGrid.textContent = "";
        for (const destination of matches) {
            const option = document.createElement("button");
            option.type = "button";
            option.className = `destination-card${destination === selectedDestination ? " destination-card--selected" : ""}`;
            option.setAttribute("aria-pressed", String(destination === selectedDestination));
            option.setAttribute("aria-label", `${destinationLabel(destination)} ${destination.kind}`);
            const name = document.createElement("span");
            name.className = "destination-card__name";
            name.textContent = destination.name;
            const region = document.createElement("span");
            region.className = "destination-card__region";
            region.textContent = destination.region;
            const description = document.createElement("span");
            description.className = "destination-card__description";
            description.textContent = destination.description;
            option.append(name, region, description);
            option.addEventListener("click", () => selectDestination(destination));
            destinationGrid.appendChild(option);
        }
        if (matches.length === 0) {
            const empty = document.createElement("p");
            empty.className = "destination-picker__empty";
            empty.setAttribute("role", "status");
            empty.textContent =
                searchMessage ||
                    (query.length < 3
                        ? "Type at least 3 characters to search more places."
                        : "No places found. Try a nearby city or exact coordinates.");
            destinationGrid.appendChild(empty);
        }
        useDestination.disabled = matches.length === 0;
        useDestination.textContent = `Scout ${selectedDestination.name}`;
    }
    destinationSearch.addEventListener("input", () => {
        window.clearTimeout(searchTimer);
        searchMessage = "";
        renderDestinations();
        const query = destinationSearch.value.trim().toLowerCase();
        if (query.length < 3 ||
            DESTINATIONS.some((destination) => matchesDestination(destination, query)))
            return;
        searchMessage = "Searching OpenStreetMap…";
        renderDestinations();
        searchTimer = window.setTimeout(() => {
            void fetch(`/api/destinations?q=${encodeURIComponent(query)}`)
                .then(async (response) => {
                if (!response.ok)
                    throw new Error("Destination search is unavailable. Use exact coordinates or try again.");
                return (await response.json());
            })
                .then((matches) => {
                if (destinationSearch.value.trim().toLowerCase() !== query ||
                    !root.isConnected)
                    return;
                liveQuery = query;
                liveDestinations = matches;
                searchMessage = "";
                renderDestinations();
            })
                .catch(() => {
                if (destinationSearch.value.trim().toLowerCase() !== query ||
                    !root.isConnected)
                    return;
                searchMessage =
                    "Destination search is unavailable. Use exact coordinates or try again.";
                renderDestinations();
            });
        }, 450);
    });
    useDestination.addEventListener("click", () => {
        handlers.onGranted({
            latitude: selectedDestination.latitude,
            longitude: selectedDestination.longitude,
            label: destinationLabel(selectedDestination),
        });
    });
    picker.append(destinationSearch, destinationGrid);
    renderDestinations();
    const status = document.createElement("p");
    status.className = "status";
    status.setAttribute("role", "status");
    const coordinates = document.createElement("form");
    coordinates.className = "coordinate-form";
    coordinates.noValidate = true;
    coordinates.setAttribute("aria-label", "Exact coordinates");
    const coordinateTitle = document.createElement("p");
    coordinateTitle.className = "coordinate-form__title";
    coordinateTitle.textContent = "Or enter exact coordinates";
    const latInput = document.createElement("input");
    latInput.className = "input data";
    latInput.inputMode = "decimal";
    latInput.placeholder = "37.7749";
    latInput.autocomplete = "off";
    const lngInput = document.createElement("input");
    lngInput.className = "input data";
    lngInput.inputMode = "decimal";
    lngInput.placeholder = "-122.4194";
    lngInput.autocomplete = "off";
    const manual = document.createElement("button");
    manual.type = "submit";
    manual.className = "button";
    manual.textContent = "Use coordinates";
    const coordinateRow = document.createElement("div");
    coordinateRow.className = "coordinate-form__row";
    coordinateRow.append(field("Latitude", latInput), field("Longitude", lngInput), manual);
    coordinates.append(coordinateTitle, coordinateRow);
    root.append(header, picker, actions, status, coordinates);
    if (!("geolocation" in navigator)) {
        locate.disabled = true;
        status.className = "status status--error";
        status.textContent =
            "This browser cannot access location. Enter coordinates to continue.";
    }
    locate.addEventListener("click", () => {
        locate.disabled = true;
        status.className = "status";
        status.textContent = "Reading browser location…";
        navigator.geolocation.getCurrentPosition((position) => {
            handlers.onGranted({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                label: "Current location",
            });
        }, (error) => {
            locate.disabled = false;
            status.className = "status status--error";
            status.textContent = describeGeolocationError(error);
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });
    coordinates.addEventListener("submit", (event) => {
        event.preventDefault();
        const latitude = parseCoordinate(latInput.value);
        const longitude = parseCoordinate(lngInput.value);
        if (latitude === null || latitude < -90 || latitude > 90) {
            status.className = "status status--error";
            status.textContent = "Latitude must be between -90 and 90.";
            latInput.focus();
            return;
        }
        if (longitude === null || longitude < -180 || longitude > 180) {
            status.className = "status status--error";
            status.textContent = "Longitude must be between -180 and 180.";
            lngInput.focus();
            return;
        }
        handlers.onGranted({ latitude, longitude });
    });
}
