/**
 * =============================================================================
 * Module: frontend/src/types.ts
 * Purpose: TypeScript type definitions for media entities, timeline feeds, and stats.
 * Used by: frontend/src/api.ts, components.
 * Dependencies: None
 * Public Members: MediaItem, TimelineGroup, TimelineResponse, StatsResponse, FilterType
 * Side Effects: None
 * =============================================================================
 */

export interface MediaItem {
  id: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  camera_make: string | null;
  camera_model: string | null;
  date_taken: string | null;
  thumbnail_url: string | null;
  stream_url: string;
  created_at: string;
}

export interface TimelineGroup {
  period: string;
  period_key: string;
  count: number;
  items: MediaItem[];
}

export interface TimelineResponse {
  total_count: number;
  has_more: boolean;
  groups: TimelineGroup[];
}

export interface StatsResponse {
  total_items: number;
  total_photos: number;
  total_videos: number;
  total_size_bytes: number;
  total_size_formatted: string;
}

export type FilterType = "all" | "photo" | "video";
