import { formatLightPhase } from "../format.js";
import { buildShareUrl } from "../share.js";
import type {
  RecommendationItem,
  RecommendationResponse,
  ScoreBreakdown,
  Settings,
} from "../types.js";

export interface ShortlistHandlers {
  onPlan: (item: RecommendationItem) => void;
  onRefresh: () => void;
}

const timeFormatters: Record<Settings["timeFormat"], Intl.DateTimeFormat> = {
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

function formatTimeWindow(
  startUtc: string,
  endUtc: string,
  settings: Settings,
): string {
  const formatter = timeFormatters[settings.timeFormat];
  return `${formatter.format(new Date(startUtc))} - ${formatter.format(new Date(endUtc))}`;
}

function formatDistance(miles: number, settings: Settings): string {
  if (settings.units === "metric") {
    return `${(miles * 1.609344).toFixed(1)} km`;
  }
  return `${miles.toFixed(1)} mi`;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isScoreBreakdown(value: unknown): value is ScoreBreakdown {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isNumber(record.light) &&
    isNumber(record.weather) &&
    isNumber(record.crowd) &&
    isNumber(record.access)
  );
}

function safeScoreBreakdown(item: RecommendationItem): ScoreBreakdown {
  const value = item.score_breakdown as unknown;
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

function safeStringList(value: unknown): string[] {
  return isStringArray(value) ? value : [];
}

function confidenceLabel(item: RecommendationItem): string {
  if (
    item.confidence === "high" ||
    item.confidence === "medium" ||
    item.confidence === "low"
  ) {
    return item.confidence;
  }
  return "medium";
}

function isStale(response: RecommendationResponse): boolean {
  return (
    Date.now() - new Date(response.generated_at).getTime() > 30 * 60_000 ||
    response.recommendations.every(
      (item) => new Date(item.best_window.end_utc).getTime() < Date.now(),
    )
  );
}

/** Shown on the shortlist and the plan when the result is old or its windows passed. */
export function buildStaleNotice(
  response: RecommendationResponse,
  onRefresh: () => void,
): HTMLElement | null {
  if (!isStale(response)) return null;
  const notice = document.createElement("section");
  notice.className = "notice";
  notice.setAttribute("role", "status");
  const text = document.createElement("p");
  text.textContent =
    "This is a saved result. Weather or light windows may be out of date; refresh before planning your trip.";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "button";
  refresh.textContent = "Refresh live recommendations";
  refresh.addEventListener("click", onRefresh);
  notice.append(text, refresh);
  return notice;
}

interface MapBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

function buildBounds(response: RecommendationResponse): MapBounds {
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

function clampPercent(value: number): number {
  return Math.max(4, Math.min(96, value));
}

function mapPointStyle(
  item: RecommendationItem,
  bounds: MapBounds,
): { left: string; top: string } {
  const lngSpan = bounds.east - bounds.west || 1;
  const latSpan = bounds.north - bounds.south || 1;
  return {
    left: `${clampPercent(((item.longitude - bounds.west) / lngSpan) * 100)}%`,
    top: `${clampPercent(((bounds.north - item.latitude) / latSpan) * 100)}%`,
  };
}

function buildOverviewMapUrl(bounds: MapBounds): string {
  const bbox = `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
}

function placeElement(rank: number): HTMLElement | null {
  return document.getElementById(`recommendation-${rank}`);
}

function pinElement(rank: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `.overview-map__pin[href="#recommendation-${rank}"]`,
  );
}

function highlightPlace(rank: number, on: boolean): void {
  placeElement(rank)?.classList.toggle("place--active", on);
}

function highlightPin(rank: number, on: boolean): void {
  pinElement(rank)?.classList.toggle("overview-map__pin--active", on);
}

function revealPlace(rank: number): void {
  const card = placeElement(rank);
  if (card === null) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("place--active");
  window.setTimeout(() => card.classList.remove("place--active"), 1200);
}

function buildMap(response: RecommendationResponse): HTMLElement {
  const aside = document.createElement("aside");
  aside.className = "results-map";
  aside.setAttribute("aria-label", "Map of the shortlist");

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
    pin.addEventListener("mouseenter", () => highlightPlace(item.rank, true));
    pin.addEventListener("mouseleave", () => highlightPlace(item.rank, false));
    pin.addEventListener("focus", () => highlightPlace(item.rank, true));
    pin.addEventListener("blur", () => highlightPlace(item.rank, false));
    pin.addEventListener("click", (event) => {
      event.preventDefault();
      revealPlace(item.rank);
    });
    map.appendChild(pin);
  }

  const openMap = document.createElement("a");
  openMap.className = "text-link";
  openMap.href = `https://www.openstreetmap.org/?mlat=${response.latitude}&mlon=${response.longitude}#map=13/${response.latitude}/${response.longitude}`;
  openMap.target = "_blank";
  openMap.rel = "noreferrer";
  openMap.textContent = "Open in OpenStreetMap";

  const note = document.createElement("p");
  note.className = "muted small";
  note.textContent =
    "Straight-line distances from your origin. Crowd and access are estimates from public map tags, not live measurements.";

  aside.append(map, openMap, note);
  return aside;
}

function buildLightLine(
  item: RecommendationItem,
  settings: Settings,
): HTMLElement {
  const line = document.createElement("p");
  line.className = `place__light place__light--${item.light_phase}`;
  const dot = document.createElement("span");
  dot.className = "light-dot";
  dot.setAttribute("aria-hidden", "true");
  const phase = document.createElement("span");
  phase.className = "place__light-phase";
  phase.textContent = formatLightPhase(item.light_phase);
  const window = document.createElement("span");
  window.className = "place__light-window";
  window.textContent = formatTimeWindow(
    item.best_window.start_utc,
    item.best_window.end_utc,
    settings,
  );
  line.append(dot, phase, window);
  return line;
}

function buildReasons(item: RecommendationItem): HTMLElement | null {
  const tags = safeStringList(item.reason_tags as unknown);
  if (tags.length === 0) {
    return null;
  }
  const list = document.createElement("ul");
  list.className = "place__reasons";
  list.setAttribute("aria-label", "Why it ranks here");
  for (const tag of tags) {
    const chip = document.createElement("li");
    chip.textContent = tag;
    list.appendChild(chip);
  }
  return list;
}

function buildBreakdown(item: RecommendationItem): HTMLElement {
  const breakdown = safeScoreBreakdown(item);
  const rows: ReadonlyArray<readonly [string, number]> = [
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
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("span");
    fill.className = "score-breakdown__fill";
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    const score = document.createElement("span");
    score.className = "score-breakdown__value";
    score.textContent = value.toFixed(0);
    track.appendChild(fill);
    row.append(rowLabel, track, score);
    list.appendChild(row);
  }
  return list;
}

function buildSources(
  item: RecommendationItem,
  response: RecommendationResponse,
): HTMLElement {
  const sources: ReadonlyArray<readonly [string, string]> = [
    response.demo_mode === true
      ? ["Demo plan", "bundled fallback"]
      : [
          Date.now() - new Date(response.generated_at).getTime() > 30 * 60_000
            ? "Saved weather"
            : "Live weather",
          "Open-Meteo",
        ],
    ["Map data", "OpenStreetMap"],
    ["Crowd estimate", "public tags"],
    ["Access estimate", "verify locally"],
  ];
  const list = document.createElement("ul");
  list.className = "place__sources";
  list.setAttribute("aria-label", `Sources for ${item.location_name}`);
  for (const [label, detail] of sources) {
    const row = document.createElement("li");
    const labelElement = document.createElement("span");
    labelElement.className = "place__source-label";
    labelElement.textContent = label;
    const detailElement = document.createElement("span");
    detailElement.className = "place__source-detail";
    detailElement.textContent = detail;
    row.append(labelElement, detailElement);
    list.appendChild(row);
  }
  return list;
}

function reportFilename(item: RecommendationItem): string {
  return `${
    item.location_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "scout"
  }-report.md`;
}

function buildReportText(
  item: RecommendationItem,
  response: RecommendationResponse,
  settings: Settings,
): string {
  const reasons = safeStringList(item.reason_tags as unknown);
  const caveats = safeStringList(item.caveats as unknown);
  const sourceNote =
    response.source_note ??
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

async function copyText(text: string): Promise<boolean> {
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

function downloadText(filename: string, text: string): void {
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

function buildSourceNotice(
  response: RecommendationResponse,
): HTMLElement | null {
  if (
    typeof response.source_note !== "string" ||
    !response.source_note.trim()
  ) {
    return null;
  }
  const notice = document.createElement("section");
  notice.className = "source-notice";
  notice.setAttribute("role", "status");
  const label = document.createElement("strong");
  label.className = "source-notice__label";
  label.textContent =
    response.demo_mode === true ? "Demo fallback" : "Source status";
  const body = document.createElement("p");
  body.textContent = response.source_note;
  notice.append(label, body);
  return notice;
}

function buildShareControls(response: RecommendationResponse): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "results-heading__share";
  const status = document.createElement("span");
  status.className = "status";
  status.setAttribute("role", "status");

  const shareUrl = buildShareUrl(response);
  const copy = document.createElement("button");
  copy.className = "button";
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
  open.className = "text-link";
  open.href = shareUrl;
  open.textContent = "Open share link";

  controls.append(copy, open, status);
  return controls;
}

function buildPlace(
  item: RecommendationItem,
  index: number,
  response: RecommendationResponse,
  settings: Settings,
  chosenKey: string,
  handlers: ShortlistHandlers,
): HTMLElement {
  const row = document.createElement("li");
  const card = document.createElement("article");
  const chosen = chosenKey === `${item.latitude},${item.longitude}`;
  card.className = `place${index === 0 ? " place--top" : ""}${chosen ? " place--chosen" : ""}`;
  card.id = `recommendation-${item.rank}`;
  card.setAttribute("aria-labelledby", `recommendation-${item.rank}-name`);

  const rank = document.createElement("span");
  rank.className = "place__rank";
  rank.textContent = String(item.rank);
  rank.setAttribute("aria-label", `Rank ${item.rank}`);

  const body = document.createElement("div");
  body.className = "place__body";

  const head = document.createElement("div");
  head.className = "place__head";
  const name = document.createElement("h2");
  name.className = "place__name";
  name.id = `recommendation-${item.rank}-name`;
  name.textContent = item.location_name;
  const score = document.createElement("span");
  score.className = "place__score";
  score.setAttribute("aria-label", `Score ${item.score} of 100`);
  score.textContent = String(item.score);
  const outOf = document.createElement("small");
  outOf.textContent = "/100";
  score.appendChild(outOf);
  head.append(name, score);

  const meta = document.createElement("p");
  meta.className = "place__meta";
  for (const text of [
    item.terrain_type,
    formatDistance(item.distance_miles, settings),
    `${confidenceLabel(item)} confidence`,
  ]) {
    const part = document.createElement("span");
    part.textContent = text;
    meta.appendChild(part);
  }

  const summary = document.createElement("p");
  summary.className = "place__summary";
  summary.textContent = item.conditions_summary;

  const actions = document.createElement("div");
  actions.className = "place__actions";
  const choose = document.createElement("button");
  choose.type = "button";
  choose.className = `button${index === 0 ? " button--primary" : ""}`;
  choose.textContent = chosen ? "Open plan" : "Plan this place";
  choose.setAttribute("aria-label", `Plan ${item.location_name}`);
  choose.addEventListener("click", () => handlers.onPlan(item));

  const reportStatus = document.createElement("span");
  reportStatus.className = "status";
  reportStatus.setAttribute("role", "status");
  const copy = document.createElement("button");
  copy.className = "button button--ghost";
  copy.type = "button";
  copy.textContent = "Copy report";
  copy.addEventListener("click", () => {
    void copyText(buildReportText(item, response, settings))
      .then((copied) => {
        reportStatus.textContent = copied
          ? "Copied"
          : "Copy unavailable. Download instead.";
      })
      .catch(() => {
        reportStatus.textContent = "Copy unavailable. Download instead.";
      });
  });
  const download = document.createElement("button");
  download.className = "button button--ghost";
  download.type = "button";
  download.textContent = "Download";
  download.setAttribute("aria-label", `Download report for ${item.location_name}`);
  download.addEventListener("click", () => {
    downloadText(reportFilename(item), buildReportText(item, response, settings));
    reportStatus.textContent = "Downloaded";
  });
  actions.append(choose, copy, download, reportStatus);

  const evidence = document.createElement("details");
  evidence.className = "place__details";
  const evidenceTitle = document.createElement("summary");
  evidenceTitle.textContent = "Why this score";
  const advice = document.createElement("p");
  advice.textContent = item.advice;
  evidence.append(evidenceTitle, buildBreakdown(item), advice);

  const verify = document.createElement("details");
  verify.className = "place__details";
  const verifyTitle = document.createElement("summary");
  verifyTitle.textContent = "What to verify";
  verify.append(verifyTitle);
  if (item.permit_required) {
    const permit = document.createElement("p");
    permit.textContent = item.permit_notes ?? "A permit may be required here.";
    verify.appendChild(permit);
  }
  const caveats = safeStringList(item.caveats as unknown);
  if (caveats.length > 0) {
    const list = document.createElement("ul");
    for (const caveat of caveats) {
      const entry = document.createElement("li");
      entry.textContent = caveat;
      list.appendChild(entry);
    }
    verify.appendChild(list);
  } else {
    const none = document.createElement("p");
    none.textContent = "Verify access and conditions locally.";
    verify.appendChild(none);
  }

  body.append(head, meta, buildLightLine(item, settings), summary);
  const reasons = buildReasons(item);
  if (reasons !== null) body.appendChild(reasons);
  body.append(actions, evidence, verify, buildSources(item, response));

  card.addEventListener("mouseenter", () => highlightPin(item.rank, true));
  card.addEventListener("mouseleave", () => highlightPin(item.rank, false));
  card.addEventListener("focusin", () => highlightPin(item.rank, true));
  card.addEventListener("focusout", () => highlightPin(item.rank, false));

  card.append(rank, body);
  row.appendChild(card);
  return row;
}

export function renderResults(
  root: HTMLElement,
  response: RecommendationResponse,
  settings: Settings,
  chosenKey: string,
  handlers: ShortlistHandlers,
): void {
  if (response.recommendations.length === 0) {
    const empty = document.createElement("section");
    empty.className = "empty-state";
    const title = document.createElement("h1");
    title.textContent = "No recommendations found";
    title.tabIndex = -1;
    const body = document.createElement("p");
    body.className = "lede";
    body.textContent =
      "Try a wider radius or a different activity. Open the Brief step to change either.";
    empty.append(title, body);
    root.appendChild(empty);
    return;
  }

  const header = document.createElement("header");
  header.className = "view-header results-heading";
  const text = document.createElement("div");
  const heading = document.createElement("h1");
  heading.textContent = "Compare your shortlist";
  heading.tabIndex = -1;
  const freshness = document.createElement("p");
  freshness.className = "lede";
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const generated = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(response.generated_at));
  freshness.textContent = `${response.recommendations.length} places for “${response.intent}”, generated ${generated}. Times are in ${zone}.`;
  text.append(heading, freshness);
  header.append(text, buildShareControls(response));
  root.append(header);

  const stale = buildStaleNotice(response, handlers.onRefresh);
  if (stale !== null) root.append(stale);
  const sourceNotice = buildSourceNotice(response);
  if (sourceNotice !== null) root.append(sourceNotice);

  const layout = document.createElement("div");
  layout.className = "shortlist";
  const list = document.createElement("ol");
  list.className = "shortlist__list";
  list.setAttribute("aria-label", "Scout recommendations");
  for (const [index, item] of response.recommendations.entries()) {
    list.appendChild(
      buildPlace(item, index, response, settings, chosenKey, handlers),
    );
  }
  layout.append(list, buildMap(response));
  root.append(layout);

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
}
