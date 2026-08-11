/**
 * =============================================================================
 * Module: frontend/src/types.ts
 * Purpose: TypeScript type declarations, API contracts, duplicate conflict interfaces,
 *          and state models for TeleGallery frontend.
 * Used by: frontend/src/App.tsx, frontend/src/api.ts, components/
 * Dependencies: None
 * Public Members: MediaItem, TimelineGroup, TimelineResponse, StorageStats,
 *                 FolderItem, UploadTask, DuplicateConflict, ConflictResolutionAction
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
}

export type StatsResponse = StorageStats;

export interface FolderItem {
  id: number;
  name: string;
  parent_id: number | null;
  item_count: number;
  cover_thumbnail_url: string | null;
  created_at: string;
}

export type FilterType = "all" | "photo" | "video";
export type MainView = "timeline" | "albums";
export type DisplayLayout = "grid" | "dense" | "list" | "masonry";

export interface UploadTask {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  loadedBytes: number;
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
