/**
 * =============================================================================
 * Module: frontend/src/api.ts
 * Purpose: Frontend HTTP API client for TeleGallery REST endpoints, uploads, deletions, and albums/folders.
 * Used by: frontend/src/App.tsx, components.
 * Dependencies: frontend/src/types.ts
 * Public Members: fetchTimeline, fetchStats, fetchMediaItem, uploadMediaFile,
 *                deleteMediaItem, fetchFolders, createFolder, deleteFolder,
 *                addMediaToFolder, removeMediaFromFolder, fetchMediaFolders
 * Side Effects: Executes HTTP requests to backend REST API.
 * =============================================================================
 */

import { FilterType, FolderItem, MediaItem, StatsResponse, TimelineResponse } from "./types";

const API_BASE = "";

export async function fetchTimeline(
  offset: number = 0,
  limit: number = 50,
  filterType: FilterType = "all",
  searchQuery: string = "",
  folderId?: number | null
): Promise<TimelineResponse> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
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
  onProgress?: (progressPercent: number, loadedBytes: number, totalBytes: number) => void,
  onProcessing?: () => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        // Scale browser-to-server progress to 0-95%
        const percent = Math.min(95, Math.round((e.loaded / e.total) * 100));
        onProgress(percent, e.loaded, e.total);
      }
    });

    xhr.upload.addEventListener("load", () => {
      if (onProcessing) {
        onProcessing();
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
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
      reject(new Error("Network error during upload"));
    });

    xhr.addEventListener("abort", () => {
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

export async function fetchFolders(): Promise<FolderItem[]> {
  const response = await fetch(`${API_BASE}/api/folders`);
  if (!response.ok) {
    throw new Error(`Failed to fetch folders: ${response.statusText}`);
  }
  return response.json();
}

export async function createFolder(name: string, parentId?: number | null): Promise<FolderItem> {
  const response = await fetch(`${API_BASE}/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parent_id: parentId || null }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create folder: ${response.statusText}`);
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

export async function fetchMediaFolders(mediaId: number): Promise<FolderItem[]> {
  const response = await fetch(`${API_BASE}/api/media/${mediaId}/folders`);
  if (!response.ok) {
    throw new Error(`Failed to fetch media folders: ${response.statusText}`);
  }
  return response.json();
}
