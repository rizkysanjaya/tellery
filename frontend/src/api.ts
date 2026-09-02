/**
 * =============================================================================
 * Module: frontend/src/api.ts
 * Purpose: Frontend HTTP API client for TeleGallery REST endpoints, uploads, deletions,
 *          albums/folders, favorites, and Telegram Channel sync operations.
 * Used by: frontend/src/App.tsx, components.
 * Dependencies: frontend/src/types.ts
 * Public Members: fetchTimeline, fetchStats, fetchMediaItem, uploadMediaFile,
 *                deleteMediaItem, toggleFavoriteMedia, bulkToggleFavoriteMedia,
 *                fetchFolders, createFolder, deleteFolder,
 *                updateFolderColor, updateFolder, fetchFolderMediaOptions,
 *                addMediaToFolder, removeMediaFromFolder, triggerVaultSync, fetchSyncStatus
 * Side Effects: Executes HTTP requests to backend REST API.
 * =============================================================================
 */

import { CacheStats, FilterType, FolderItem, MediaItem, StatsResponse, SystemStats, TimelineResponse } from "./types";

const API_BASE = "";

export async function fetchTimeline(
  offset: number = 0,
  limit: number = 50,
  filterType: FilterType = "all",
  searchQuery: string = "",
  folderId?: number | null,
  sortBy: string = "date_desc",
  onlyFavorites: boolean = false
): Promise<TimelineResponse> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
    sort_by: sortBy,
  });

  if (filterType !== "all") {
    params.append("type", filterType);
  }

  if (searchQuery.trim()) {
    params.append("q", searchQuery.trim());
  }

  if (folderId !== undefined && folderId !== null) {
    params.append("folder_id", folderId.toString());
  }

  if (onlyFavorites) {
    params.append("only_favorites", "true");
  }

  const response = await fetch(`${API_BASE}/api/media?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch timeline: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchStats(): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE}/api/media/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchMediaItem(id: number): Promise<MediaItem> {
  const response = await fetch(`${API_BASE}/api/media/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch media item: ${response.statusText}`);
  }
  return response.json();
}

export function uploadMediaFile(
  file: File,
  onProgress?: (progressPercent: number, loadedBytes: number, totalBytes: number, speedMbps?: number) => void,
  onProcessing?: () => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const uploadId = "upl_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    formData.append("file", file);
    formData.append("upload_id", uploadId);

    let pollInterval: any = null;
    let isFinished = false;

    const stopPolling = () => {
      isFinished = true;
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    let maxReportedBytes = 0;

    // 1. Initial browser-to-server spool progress
    xhr.upload.addEventListener("progress", () => {
      if (isFinished) return;
      if (onProgress) {
        onProgress(1, 0, file.size, 0);
      }
    });

    // 2. Actively poll real-time MTProto upload to Telegram Cloud
    xhr.upload.addEventListener("load", () => {
      if (isFinished) return;
      if (onProcessing) {
        onProcessing();
      }

      pollInterval = setInterval(async () => {
        if (isFinished) {
          stopPolling();
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/api/media/upload/progress/${uploadId}`);
          if (isFinished) return;
          if (res.ok) {
            const data = await res.json();
            if (isFinished) return;
            if (data.status === "uploading_to_telegram" && onProgress) {
              const currentBytes = Math.max(maxReportedBytes, data.bytes_uploaded || 0);
              maxReportedBytes = currentBytes;
              const percent = Math.min(99, Math.max(1, Math.round((currentBytes / file.size) * 100)));
              onProgress(
                percent,
                currentBytes,
                file.size,
                data.speed_mbps || 0
              );
            }
          }
        } catch {}
      }, 200);
    });

    xhr.addEventListener("load", () => {
      stopPolling();
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) {
          onProgress(100, file.size, file.size, 0);
        }
        try {
          const res = JSON.parse(xhr.responseText);
          resolve(res);
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.detail || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => {
      stopPolling();
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
      stopPolling();
      reject(new Error("Upload aborted"));
    });

    xhr.open("POST", `${API_BASE}/api/media/upload`);
    xhr.send(formData);
  });
}

export async function deleteMediaItem(id: number): Promise<any> {
  const response = await fetch(`${API_BASE}/api/media/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Delete failed: ${response.statusText}`);
  }
  return response.json();
}

export async function toggleFavoriteMedia(mediaId: number, isFavorite: boolean): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/media/${mediaId}/favorite`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_favorite: isFavorite }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update favorite status: ${response.statusText}`);
  }
  return true;
}

export async function bulkToggleFavoriteMedia(mediaIds: number[], isFavorite: boolean): Promise<{ updated_count: number }> {
  const response = await fetch(`${API_BASE}/api/media/favorite/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_ids: mediaIds, is_favorite: isFavorite }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update bulk favorite status: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchFolders(): Promise<FolderItem[]> {
  const response = await fetch(`${API_BASE}/api/folders`);
  if (!response.ok) {
    throw new Error(`Failed to fetch folders: ${response.statusText}`);
  }
  return response.json();
}

export async function createFolder(
  name: string,
  parentId?: number | null,
  isCollection: boolean = false
): Promise<FolderItem> {
  const response = await fetch(`${API_BASE}/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      parent_id: parentId || null,
      is_collection: isCollection,
      icon: isCollection ? "Layers" : "Folder",
    }),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const data = await response.json();
      if (data.detail) errorDetail = data.detail;
    } catch {}
    throw new Error(errorDetail || "Failed to create folder");
  }
  return response.json();
}

export async function deleteFolder(folderId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/api/folders/${folderId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete folder: ${response.statusText}`);
  }
  return response.json();
}

export async function updateFolderColor(folderId: number, color: string | null): Promise<FolderItem> {
  const response = await fetch(`${API_BASE}/api/folders/${folderId}/color`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update folder color: ${response.statusText}`);
  }
  return response.json();
}

export async function updateFolder(
  folderId: number,
  patch: {
    name?: string;
    color?: string | null;
    icon?: string | null;
    is_favorite?: boolean;
    is_collection?: boolean;
    parent_id?: number | null;
    cover_media_id?: number | null;
  }
): Promise<FolderItem> {
  const response = await fetch(`${API_BASE}/api/folders/${folderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const data = await response.json();
      if (data.detail) errorDetail = data.detail;
    } catch {}
    throw new Error(errorDetail || "Failed to update folder");
  }
  return response.json();
}

export async function fetchFolderMediaOptions(folderId: number): Promise<import("./types").FolderMediaItem[]> {
  const response = await fetch(`${API_BASE}/api/folders/${folderId}/media-options`);
  if (!response.ok) {
    throw new Error(`Failed to fetch album media: ${response.statusText}`);
  }
  return response.json();
}

export async function addMediaToFolder(folderId: number, mediaIds: number[]): Promise<any> {
  const response = await fetch(`${API_BASE}/api/folders/${folderId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_ids: mediaIds }),
  });

  if (!response.ok) {
    throw new Error(`Failed to add media to folder: ${response.statusText}`);
  }
  return response.json();
}

export async function removeMediaFromFolder(folderId: number, mediaId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/api/folders/${folderId}/media/${mediaId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(`Failed to remove media from folder: ${response.statusText}`);
  }
  return response.json();
}

export async function renameMediaItem(mediaId: number, newName: string): Promise<any> {
  const response = await fetch(`${API_BASE}/api/media/${mediaId}/rename`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_name: newName }),
  });

  if (!response.ok) {
    throw new Error(`Failed to rename media item: ${response.statusText}`);
  }
  return response.json();
}

export async function createMediaAlias(mediaId: number, newName: string): Promise<any> {
  const response = await fetch(`${API_BASE}/api/media/${mediaId}/alias`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ new_name: newName }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create duplicate alias: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchMediaFolders(mediaId: number): Promise<FolderItem[]> {
  const response = await fetch(`${API_BASE}/api/media/${mediaId}/folders`);
  if (!response.ok) {
    throw new Error(`Failed to fetch media folders: ${response.statusText}`);
  }
  return response.json();
}

export async function triggerVaultSync(fullScan: boolean = false, limit: number = 200): Promise<{
  status: string;
  message: string;
  stats: {
    scanned: number;
    added: number;
    skipped: number;
    duration_seconds: number;
    started_at: string;
  };
}> {
  const response = await fetch(`${API_BASE}/api/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_scan: fullScan, limit }),
  });

  if (!response.ok) {
    throw new Error(`Failed to synchronize vault: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchSyncStatus(): Promise<{
  is_syncing: boolean;
  listener_active: boolean;
  last_sync_time: string | null;
  last_sync_stats: any;
}> {
  const response = await fetch(`${API_BASE}/api/sync/status`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sync status: ${response.statusText}`);
  }
  return response.json();
}

export async function updateMediaMetadata(
  mediaId: number,
  metadata: { duration_seconds?: number; width?: number; height?: number }
): Promise<void> {
  await fetch(`${API_BASE}/api/media/${mediaId}/metadata`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
}

export async function fetchCacheStats(): Promise<CacheStats> {
  const response = await fetch(`${API_BASE}/api/system/cache`);
  if (!response.ok) {
    throw new Error(`Failed to fetch cache stats: ${response.statusText}`);
  }
  return response.json();
}

export async function updateCacheLimit(maxBytes: number): Promise<CacheStats> {
  const response = await fetch(`${API_BASE}/api/system/cache/limit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_bytes: maxBytes }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update cache limit: ${response.statusText}`);
  }
  return response.json();
}

export async function clearLocalCache(): Promise<{
  status: string;
  message: string;
  freed_bytes: number;
  freed_formatted: string;
  files_deleted: number;
}> {
  const response = await fetch(`${API_BASE}/api/system/cache`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to clear local cache: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchSystemStats(): Promise<SystemStats> {
  const response = await fetch(`${API_BASE}/api/system/stats`);
  if (!response.ok) {
    throw new Error(`Failed to fetch system stats: ${response.statusText}`);
  }
  return response.json();
}

