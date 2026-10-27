/**
 * Shared types for the Scout frontend.
 *
 * Field names deliberately mirror the backend's JSON output exactly
 * (snake_case, matching server/schemas.py) rather than being remapped to
 * camelCase. That keeps `fetch` responses assignable to these interfaces
 * with zero transformation code -- one less place for a silent mismatch
 * between frontend and backend to hide.
 */

export type LightPhase = "golden_hour" | "blue_hour" | "daylight" | "night";

export type ShotType =
  "landscape" | "portrait" | "astro" | "wildlife" | "urban" | "hiking";

export type TravelStyle =
  "photographer" | "sightseeing" | "family" | "budget" | "accessible";

export type RankingBucketName = "best_overall" | "free" | "rainy_day";

/** An ISO 8601 UTC timestamp string, e.g. "2026-07-05T02:57:26.713324Z". */
export type IsoDateTimeString = string;

export interface TimeWindow {
  start_utc: IsoDateTimeString;
  end_utc: IsoDateTimeString;
}

export interface ScoreBreakdown {
  light: number;
  weather: number;
  crowd: number;
  access: number;
}

export type RecommendationConfidence = "high" | "medium" | "low";

export interface RecommendationItem {
  rank: number;
  location_name: string;
  latitude: number;
  longitude: number;
  distance_miles: number;
  terrain_type: string;
  best_window: TimeWindow;
  light_phase: LightPhase;
  score: number;
  score_breakdown: ScoreBreakdown;
  confidence: RecommendationConfidence;
  reason_tags: string[];
  caveats: string[];
  conditions_summary: string;
  advice: string;
  permit_required: boolean;
  permit_notes: string | null;
  image_url: string | null;
  image_attribution: string | null;
}

export interface ScoreWeights {
  light: number;
  weather: number;
  crowd: number;
  access: number;
}

export interface HardConstraints {
  free_only: boolean;
  open_now: boolean;
  wheelchair_required: boolean;
  max_walk_miles: number | null;
}

export interface RejectedPlace {
  location_name: string;
  distance_miles: number;
  reasons: string[];
}

export interface RankingBucket {
  bucket: RankingBucketName;
  recommendation: RecommendationItem;
}

/** Present only when the request sets travel_style. */
export interface TravelPlan {
  travel_style: TravelStyle;
  weights: ScoreWeights;
  constraints: HardConstraints;
  /** Wall-clock time at the origin, without an offset. Null when opening hours were not checked. */
  local_time: string | null;
  buckets: RankingBucket[];
  rejected: RejectedPlace[];
  explanation: string;
}

export interface RecommendationResponse {
  latitude: number;
  longitude: number;
  intent: string;
  shot_type: ShotType;
  generated_at: IsoDateTimeString;
  recommendations: RecommendationItem[];
  demo_mode?: boolean;
  source_note?: string | null;
  travel_plan?: TravelPlan | null;
}

export interface RecommendationRequest {
  latitude: number;
  longitude: number;
  intent: string;
  radius_miles?: number;
  shot_type?: ShotType;
  travel_style?: TravelStyle;
}

/** Shape of every error response body the backend returns (never a raw exception). */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  retryable?: boolean;
  recovery_hint?: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
  label?: string;
}

export interface SessionLocation {
  lat: number;
  lng: number;
  label: string;
}

export interface FieldPlan {
  placeKey: string;
  notes: string;
  checks: string[];
}

export interface Session {
  id: string;
  createdAt: string;
  location: SessionLocation;
  intent: string;
  results: RecommendationResponse | null;
  name: string;
  fieldPlan?: FieldPlan | undefined;
  searchRadiusMiles?: number;
  travelStyle?: TravelStyle;
}

export type Units = "metric" | "imperial";
export type TimeFormat = "12h" | "24h";
export type ThemePreference = "system" | "dark" | "light";

export interface Settings {
  units: Units;
  radiusMiles: number;
  activityTypes: string[];
  timeFormat: TimeFormat;
  theme: ThemePreference;
}
