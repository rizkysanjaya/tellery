/**
 * =============================================================================
 * Module: frontend/src/api.ts
 * Purpose: Frontend HTTP API client for TeleGallery REST endpoints, uploads, deletions,
 *          channel-isolated albums/folders & trash, favorites, Telegram Multi-Vault channel switching,
 *          authentication & onboarding, and sync operations.
 * Used by: frontend/src/App.tsx, components.
 * Dependencies: frontend/src/types.ts
 * Public Members: fetchTimeline, fetchTimelineSummary, fetchFilterMetadata, fetchStats, fetchMediaItem, uploadMediaFile,
 *                deleteMediaItem, toggleFavoriteMedia, bulkToggleFavoriteMedia,
 *                fetchFolders, createFolder, deleteFolder, bulkDeleteFolders,
 *                updateFolderColor, updateFolder, fetchFolderMediaOptions,
 *                addMediaToFolder, removeMediaFromFolder, triggerVaultSync, triggerChannelSync, fetchSyncStatus,
 *                fetchTrashMedia, restoreMediaItem, bulkRestoreMedia, permanentDeleteMediaItem, emptyTrash,
 *                downloadBatchMediaZip, getAlbumZipExportUrl, exportAlbumZip,
 *                fetchVaults, fetchActiveVault, setActiveVault,
 *                fetchAuthStatus, submitCredentials, sendAuthCode, verifyAuthCode, verifyAuthPassword, createStorageVault, logoutAccount
 * Side Effects: Executes HTTP requests to backend REST API, triggers file downloads.
 * =============================================================================
 */

import { ActiveExifFilters, AuthStatusResponse, CacheStats, FilterMetadataResponse, FilterType, FolderItem, MediaItem, StatsResponse, SystemStats, TimelineResponse, TimelineSummaryResponse, TrashResponse, VaultItem } from "./types";

const API_BASE = "";

export async function fetchTimeline(
  offset: number = 0,
  limit: number = 50,
  filterType: FilterType = "all",
  searchQuery: string = "",
  folderId?: number | null,
  sortBy: string = "date_desc",
  onlyFavorites: boolean = false,
  exifFilters?: ActiveExifFilters,
  channelId?: number | null,
  cursor?: string | null
): Promise<TimelineResponse> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
    sort_by: sortBy,
  });

  if (cursor) {
    params.append("cursor", cursor);
  }

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

  if (channelId !== undefined && channelId !== null) {
    params.append("channel_id", channelId.toString());
  }

  if (exifFilters) {
    if (exifFilters.camera) {
      params.append("camera", exifFilters.camera);
    }
    if (exifFilters.orientation) {
      params.append("orientation", exifFilters.orientation);
    }
    if (exifFilters.min_resolution) {
      params.append("min_resolution", exifFilters.min_resolution);
    }
    if (exifFilters.year) {
      params.append("year", exifFilters.year.toString());
    }
    if (exifFilters.month) {
      params.append("month", exifFilters.month);
    }
  }

  const response = await fetch(`${API_BASE}/api/media?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch timeline: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTimelineSummary(channelId?: number | null): Promise<TimelineSummaryResponse> {
  const params = new URLSearchParams();
  if (channelId !== undefined && channelId !== null) {
    params.append("channel_id", channelId.toString());
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE}/api/media/summary${qs}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch timeline summary: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchFilterMetadata(channelId?: number | null): Promise<FilterMetadataResponse> {
  const params = new URLSearchParams();
  if (channelId !== undefined && channelId !== null) {
    params.append("channel_id", channelId.toString());
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE}/api/media/filters/meta${qs}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch filter metadata: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchStats(channelId?: number | null): Promise<StatsResponse> {
  const params = new URLSearchParams();
  if (channelId !== undefined && channelId !== null) {
    params.append("channel_id", channelId.toString());
  }
  const qs = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${API_BASE}/api/media/stats${qs}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchVaults(refresh: boolean = false): Promise<VaultItem[]> {
  const url = refresh ? `${API_BASE}/api/vaults?refresh=true` : `${API_BASE}/api/vaults`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch vaults: ${response.statusText}`);
  }
  const data = await response.json();
  return data.vaults || [];
}

export async function fetchActiveVault(): Promise<VaultItem> {
  const response = await fetch(`${API_BASE}/api/vaults/active`);
  if (!response.ok) {
    throw new Error(`Failed to fetch active vault: ${response.statusText}`);
  }
  const data = await response.json();
  return data.vault;
}

export async function setActiveVault(channelId: number): Promise<any> {
  const response = await fetch(`${API_BASE}/api/vaults/active`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel_id: channelId }),
  });
  if (!response.ok) {
    throw new Error(`Failed to set active vault: ${response.statusText}`);
  }
  return response.json();
}

export async function triggerChannelSync(channelId: number, limit: number = 200): Promise<any> {
  const response = await fetch(`${API_BASE}/api/vaults/${channelId}/sync?limit=${limit}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to synchronize vault channel: ${response.statusText}`);
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
  onProcessing?: () => void,
  folderId?: number | null
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    const uploadId = "upl_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    formData.append("file", file);
    formData.append("upload_id", uploadId);
    if (folderId !== undefined && folderId !== null) {
      formData.append("folder_id", folderId.toString());
    }

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

export async function fetchFolders(channelId?: number | null): Promise<FolderItem[]> {
  const url = channelId ? `${API_BASE}/api/folders?channel_id=${channelId}` : `${API_BASE}/api/folders`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch folders: ${response.statusText}`);
  }
  return response.json();
}

export async function createFolder(
  name: string,
  parentId?: number | null,
  isCollection: boolean = false,
  channelId?: number | null
): Promise<FolderItem> {
  const response = await fetch(`${API_BASE}/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      parent_id: parentId || null,
      is_collection: isCollection,
      icon: isCollection ? "Layers" : "Folder",
      channel_id: channelId ?? undefined,
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

export async function bulkDeleteFolders(
  folderIds: number[]
): Promise<{ status: string; deleted_count: number; folder_ids: number[] }> {
  const response = await fetch(`${API_BASE}/api/folders/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_ids: folderIds }),
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const data = await response.json();
      if (data.detail) errorDetail = data.detail;
    } catch {}
    throw new Error(errorDetail || "Failed to delete folders");
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

export async function triggerVaultSync(
  channelId?: number | null,
  fullScan: boolean = false,
  limit: number = 200
): Promise<{
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
    body: JSON.stringify({
      channel_id: channelId ?? undefined,
      full_scan: fullScan,
      limit,
    }),
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

export async function fetchTrashMedia(
  limit: number = 100,
  offset: number = 0,
  channelId?: number | null
): Promise<TrashResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (channelId !== undefined && channelId !== null) {
    params.append("channel_id", channelId.toString());
  }
  const response = await fetch(`${API_BASE}/api/media/trash?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch trash items: ${response.statusText}`);
  }
  return response.json();
}

export async function restoreMediaItem(mediaId: number): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/media/${mediaId}/restore`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to restore media: ${response.statusText}`);
  }
  return response.json();
}

export async function bulkRestoreMedia(mediaIds: number[]): Promise<{ status: string; count: number; message: string }> {
  const response = await fetch(`${API_BASE}/api/media/trash/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_ids: mediaIds }),
  });
  if (!response.ok) {
    throw new Error(`Failed to bulk restore media: ${response.statusText}`);
  }
  return response.json();
}

export async function permanentDeleteMediaItem(mediaId: number): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/media/${mediaId}/permanent`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to permanently delete media: ${response.statusText}`);
  }
  return response.json();
}

export async function emptyTrash(channelId?: number | null): Promise<{ status: string; purged_count: number; message: string }> {
  const url = channelId ? `${API_BASE}/api/media/trash/empty?channel_id=${channelId}` : `${API_BASE}/api/media/trash/empty`;
  const response = await fetch(url, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Failed to empty trash: ${response.statusText}`);
  }
  return response.json();
}

export async function downloadBatchMediaZip(mediaIds: number[]): Promise<void> {
  const response = await fetch(`${API_BASE}/api/media/download-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ media_ids: mediaIds }),
  });

  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errData = await response.json();
      if (errData.detail) errorMsg = errData.detail;
    } catch {}
    throw new Error(errorMsg || "Failed to generate batch download archive");
  }

  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = "telegallery_download.zip";
  if (contentDisposition && contentDisposition.includes("filename=")) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

export function getAlbumZipExportUrl(folderId: number): string {
  return `${API_BASE}/api/folders/${folderId}/export-zip`;
}

export async function exportAlbumZip(folderId: number): Promise<void> {
  const response = await fetch(getAlbumZipExportUrl(folderId));
  if (!response.ok) {
    let errorMsg = response.statusText;
    try {
      const errData = await response.json();
      if (errData.detail) errorMsg = errData.detail;
    } catch {}
    throw new Error(errorMsg || "Failed to export album");
  }

  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = `album_${folderId}.zip`;
  if (contentDisposition && contentDisposition.includes("filename=")) {
    const match = contentDisposition.match(/filename="?([^";]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

// =============================================================================
// Authentication & Onboarding API
// =============================================================================

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  const response = await fetch(`${API_BASE}/api/auth/status`);
  if (!response.ok) {
    throw new Error(`Failed to check auth status: ${response.statusText}`);
  }
  return response.json();
}

export async function submitCredentials(
  apiId: number,
  apiHash: string
): Promise<{ status: string; step: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_id: apiId, api_hash: apiHash }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to save Telegram credentials");
  }
  return response.json();
}

export async function sendAuthCode(
  phone: string
): Promise<{ status: string; step: string; phone: string; phone_code_hash: string; timeout: number; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/send_code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to send verification code");
  }
  return response.json();
}

export async function verifyAuthCode(
  code: string,
  phoneCodeHash?: string
): Promise<{ status: string; step: string; user?: any; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/verify_code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, phone_code_hash: phoneCodeHash }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to verify code");
  }
  return response.json();
}

export async function verifyAuthPassword(
  password: string
): Promise<{ status: string; step: string; user?: any; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/verify_password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to verify 2FA password");
  }
  return response.json();
}

export async function createStorageVault(
  title: string,
  about?: string
): Promise<{ status: string; channel_id: number; title: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/create_vault`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, about }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create storage vault");
  }
  return response.json();
}

export async function logoutAccount(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to log out");
  }
  return response.json();
}


