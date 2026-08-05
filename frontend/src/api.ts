/**
 * =============================================================================
 * Module: frontend/src/api.ts
 * Purpose: Frontend HTTP API client for TeleGallery REST endpoints, uploads, and deletions.
 * Used by: frontend/src/App.tsx, components.
 * Dependencies: frontend/src/types.ts
 * Public Members: fetchTimeline, fetchStats, fetchMediaItem, uploadMediaFile, deleteMediaItem
 * Side Effects: Executes HTTP requests to backend REST API.
 * =============================================================================
 */

import { FilterType, MediaItem, StatsResponse, TimelineResponse } from "./types";

const API_BASE = "";

export async function fetchTimeline(
  offset: number = 0,
  limit: number = 50,
  filterType: FilterType = "all",
  searchQuery: string = ""
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

export async function uploadMediaFile(file: File): Promise<any> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/media/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
  return response.json();
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
