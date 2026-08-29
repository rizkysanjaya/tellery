/**
 * =============================================================================
 * Module: frontend/src/types.ts
 * Purpose: TypeScript type declarations, API contracts, duplicate conflict interfaces,
 *          and state models for TeleGallery frontend.
 * Used by: frontend/src/App.tsx, frontend/src/api.ts, components/
 * Dependencies: None
 * Public Members: MediaItem, TimelineGroup, TimelineResponse, StorageStats,
 *                 FolderItem, UploadTask, DuplicateConflict, ConflictResolutionAction, TrashResponse
 * Side Effects: None (Type declarations only).
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
  thumbnail_url: string;
  stream_url: string;
  created_at: string;
  folder_id?: number | null;
  folder_name?: string | null;
  is_animation?: boolean;
  is_favorite?: boolean;
  deleted_at?: string | null;
}

export interface TimelineGroup {
  period_key: string;
  period_title: string;
  period?: string;
  count?: number;
  items: MediaItem[];
}

export interface TimelineResponse {
  total: number;
  groups: TimelineGroup[];
}

export interface StorageStats {
  total_files: number;
  total_bytes: number;
  photo_count: number;
  video_count: number;
  storage_quota_bytes: number;
  total_items?: number;
  total_photos?: number;
  total_videos?: number;
  total_size_formatted?: string;
  account_name?: string | null;
  account_username?: string | null;
  channel_name?: string | null;
  channel_avatar_url?: string | null;
  user_avatar_url?: string | null;
}

export type StatsResponse = StorageStats;

export interface FolderItem {
  id: number;
  name: string;
  parent_id: number | null;
  color: string | null;
  icon?: string | null;
  is_favorite?: boolean;
  is_collection?: boolean;
  sub_album_count?: number;
  item_count: number;
  cover_media_id?: number | null;
  cover_thumbnail_url: string | null;
  created_at: string;
}

export interface FolderMediaItem {
  id: number;
  file_name: string;
  mime_type: string;
  file_size: number;
  thumbnail_url: string | null;
  added_at: string;
}

export type FilterType = "all" | "photo" | "video";
export type MainView = "timeline" | "albums" | "favorites" | "trash";

export interface TrashResponse {
  total: number;
  items: MediaItem[];
}
export type DisplayLayout = "grid" | "dense" | "list" | "masonry";
export type SortOption =
  | "date_desc"
  | "date_asc"
  | "name_asc"
  | "name_desc"
  | "size_desc"
  | "size_asc";

export interface UploadTask {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  loadedBytes: number;
  speedMbps?: number;
  status: "pending" | "uploading" | "processing" | "completed" | "duplicate" | "error";
  errorMessage?: string;
  duplicateInfo?: {
    existingId: number;
    existingFileName: string;
    actionTaken?: "skipped" | "renamed_existing" | "alias_created";
  };
}

export interface DuplicateConflict {
  taskId: string;
  fileName: string;
  fileSize: number;
  existingMediaId: number;
  existingFileName: string;
  existingCreatedAt?: string;
  existingFileSize?: number;
}

export type ConflictResolutionAction = "skip" | "keep_both" | "rename_existing";

export interface CacheStats {
  cache_bytes: number;
  cache_formatted: string;
  max_bytes: number;
  max_formatted: string;
  percent_used: number;
  file_count: number;
}

export interface SystemStats {
  total_media_items: number;
  total_cloud_bytes: number;
  total_cloud_formatted: string;
  local_cache: CacheStats;
}
