/**
 * =============================================================================
 * Module: frontend/src/utils/navigation.ts
 * Purpose: URL hash-based routing utility for browser state persistence, deep linking,
 *          and browser Back/Forward history navigation across reloads and tab sessions.
 * Used by: frontend/src/App.tsx
 * Dependencies: frontend/src/types.ts (MainView, FolderItem)
 * Public Members: ParsedRoute, parseRouteFromHash, buildHashFromState, syncHashWithState
 * Side Effects: Reads and updates window.location.hash and window.history. No network I/O.
 * =============================================================================
 */

import { FolderItem, MainView } from "../types";

export interface ParsedRoute {
  view: MainView;
  folderId?: number;
  collectionId?: number;
}

/**
 * Parses the current window location hash into structured view state.
 *
 * Supported formats:
 * - #/ or #/timeline -> { view: "timeline" }
 * - #/albums -> { view: "albums" }
 * - #/albums/:id -> { view: "timeline", folderId: :id }
 * - #/albums/collection/:id -> { view: "albums", collectionId: :id }
 * - #/favorites -> { view: "favorites" }
 * - #/trash -> { view: "trash" }
 */
export function parseRouteFromHash(hashString: string): ParsedRoute {
  if (!hashString) {
    return { view: "timeline" };
  }

  // Strip leading hash
  const raw = hashString.startsWith("#") ? hashString.slice(1) : hashString;
  const path = raw.startsWith("/") ? raw : "/" + raw;
  const cleanPath = path.split("?")[0].replace(/\/+$/, "");

  if (!cleanPath || cleanPath === "/" || cleanPath === "/timeline") {
    return { view: "timeline" };
  }

  if (cleanPath === "/albums") {
    return { view: "albums" };
  }

  if (cleanPath.startsWith("/albums/collection/")) {
    const idStr = cleanPath.slice("/albums/collection/".length);
    const collectionId = parseInt(idStr, 10);
    if (!isNaN(collectionId) && collectionId > 0) {
      return { view: "albums", collectionId };
    }
    return { view: "albums" };
  }

  if (cleanPath.startsWith("/albums/")) {
    const idStr = cleanPath.slice("/albums/".length);
    const folderId = parseInt(idStr, 10);
    if (!isNaN(folderId) && folderId > 0) {
      return { view: "timeline", folderId };
    }
    return { view: "albums" };
  }

  if (cleanPath === "/favorites") {
    return { view: "favorites" };
  }

  if (cleanPath === "/trash") {
    return { view: "trash" };
  }

  return { view: "timeline" };
}

/**
 * Converts the current view state into a canonical URL hash string.
 */
export function buildHashFromState(
  view: MainView,
  activeFolder: FolderItem | null,
  selectedCollection: FolderItem | null
): string {
  if (activeFolder) {
    return `#/albums/${activeFolder.id}`;
  }

  if (view === "albums") {
    if (selectedCollection) {
      return `#/albums/collection/${selectedCollection.id}`;
    }
    return "#/albums";
  }

  if (view === "favorites") {
    return "#/favorites";
  }

  if (view === "trash") {
    return "#/trash";
  }

  return "#/timeline";
}

/**
 * Synchronizes window.location.hash with the current state.
 * Uses history.replaceState or window.location.hash assignment depending on replace flag.
 */
export function syncHashWithState(
  view: MainView,
  activeFolder: FolderItem | null,
  selectedCollection: FolderItem | null,
  replace: boolean = false
): void {
  const targetHash = buildHashFromState(view, activeFolder, selectedCollection);
  if (window.location.hash === targetHash) {
    return;
  }

  if (replace) {
    window.history.replaceState(null, "", targetHash);
  } else {
    window.location.hash = targetHash;
  }
}
