/**
 * =============================================================================
 * Module: frontend/src/utils/fileSystemScanner.ts
 * Purpose: Browser utility for scanning dropped files and directories. Uses the HTML5
 *          FileSystem API (webkitGetAsEntry) to deeply and recursively traverse nested
 *          folders of arbitrary depth, filtering out system artifacts, deduplicating
 *          entries across items/files drag representations, and preserving root folder naming.
 * Used by: frontend/src/App.tsx
 * Dependencies: None (Standard Web FileSystem APIs)
 * Public Members: ScannedMediaItem, extractDroppedMedia
 * Side Effects: None (In-memory asynchronous traversal and deduplication).
 * =============================================================================
 */

export interface ScannedMediaItem {
  file: File;
  relativePath: string;
  rootFolderName?: string;
}

const MEDIA_EXTENSIONS = new Set([
  // Images
  "jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif", "tiff", "tif",
  "svg", "avif", "raw", "cr2", "nef", "arw", "dng",
  // Videos
  "mp4", "mov", "mkv", "webm", "avi", "m4v", "3gp", "flv", "wmv", "mts", "m2ts", "ts"
]);

const IGNORED_FILENAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "desktop.ini",
  ".gitkeep",
  ".gitignore",
]);

/**
 * Checks whether a given file qualifies as a valid image or video based on MIME type or extension.
 */
function isMediaFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();

  // Ignore OS-generated metadata files
  if (IGNORED_FILENAMES.has(lowerName) || lowerName.startsWith("._")) {
    return false;
  }

  // Accept if MIME type clearly indicates image or video
  if (file.type && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
    return true;
  }

  // Fallback to extension check for files with missing/generic MIME types (e.g. MKV, HEIC, RAW)
  const dotIndex = lowerName.lastIndexOf(".");
  if (dotIndex !== -1) {
    const ext = lowerName.substring(dotIndex + 1);
    return MEDIA_EXTENSIONS.has(ext);
  }

  return false;
}

/**
 * Reads all entries from a FileSystemDirectoryReader, looping until empty
 * to bypass Chromium's 100-entry batch truncation.
 */
async function readAllDirectoryEntries(reader: any): Promise<any[]> {
  const entries: any[] = [];
  const readBatch = (): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      reader.readEntries((results: any[]) => resolve(results || []), reject);
    });
  };

  try {
    while (true) {
      const batch = await readBatch();
      if (!batch || batch.length === 0) break;
      entries.push(...batch);
    }
  } catch (err) {
    console.warn("Failed to read directory batch:", err);
  }

  return entries;
}

/**
 * Recursively traverses a FileSystemEntry (file or directory).
 */
async function traverseFileSystemEntry(
  entry: any,
  currentPath: string,
  rootFolder: string | undefined,
  results: ScannedMediaItem[]
): Promise<void> {
  if (!entry) return;

  if (entry.isFile) {
    try {
      const file: File = await new Promise((resolve, reject) => {
        entry.file(resolve, reject);
      });

      if (isMediaFile(file)) {
        results.push({
          file,
          relativePath: currentPath ? `${currentPath}/${entry.name}` : entry.name,
          rootFolderName: rootFolder,
        });
      }
    } catch (err) {
      console.warn(`Could not read file ${entry.name}:`, err);
    }
  } else if (entry.isDirectory) {
    try {
      const dirReader = entry.createReader();
      const currentRoot = rootFolder ?? entry.name;
      const nextPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      const entries = await readAllDirectoryEntries(dirReader);

      for (const child of entries) {
        await traverseFileSystemEntry(child, nextPath, currentRoot, results);
      }
    } catch (err) {
      console.warn(`Could not traverse directory ${entry.name}:`, err);
    }
  }
}

/**
 * Extracts and parses all media files from a drag-and-drop DataTransfer object.
 * Deeply scans directories if folders were dropped, preserving root folder names
 * to enable automatic album grouping.
 */
export async function extractDroppedMedia(dataTransfer: DataTransfer): Promise<ScannedMediaItem[]> {
  const results: ScannedMediaItem[] = [];

  // 1. Modern WebKit Directory API
  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const promises: Promise<void>[] = [];

    for (let i = 0; i < dataTransfer.items.length; i++) {
      const item = dataTransfer.items[i];
      if (item.kind !== "file") continue;

      const entry = (item as any).webkitGetAsEntry ? (item as any).webkitGetAsEntry() : null;
      if (entry) {
        // If the top-level dropped item is a directory, its name is the root folder name
        const rootFolder = entry.isDirectory ? entry.name : undefined;
        promises.push(traverseFileSystemEntry(entry, "", rootFolder, results));
      } else {
        const file = item.getAsFile();
        if (file && isMediaFile(file)) {
          results.push({
            file,
            relativePath: file.name,
          });
        }
      }
    }

    await Promise.all(promises);
  } else if (dataTransfer.files && dataTransfer.files.length > 0) {
    // 2. Standard HTML5 DataTransfer.files fallback
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (isMediaFile(file)) {
        results.push({
          file,
          relativePath: (file as any).webkitRelativePath || file.name,
        });
      }
    }
  }

  // Deduplicate items to prevent double-processing from overlapping Chromium items/files APIs
  const seen = new Set<string>();
  const deduplicated: ScannedMediaItem[] = [];
  for (const item of results) {
    const key = `${item.rootFolderName || ""}::${item.relativePath || item.file.name}::${item.file.size}::${item.file.lastModified}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicated.push(item);
    }
  }

  return deduplicated;
}
