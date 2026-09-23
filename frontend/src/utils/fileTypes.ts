/**
 * =============================================================================
 * Module: frontend/src/utils/fileTypes.ts
 * Purpose: Color-coded file type metadata and badge styling for photos, videos,
 *          animations, and documents in the gallery and lightbox views.
 * Used by: frontend/src/components/MediaCard.tsx,
 *          frontend/src/components/MediaListItem.tsx,
 *          frontend/src/components/MediaLightbox.tsx
 * Dependencies: None (Pure TypeScript utility)
 * Public Members: getFileTypeBadge
 * Side Effects: None (Pure deterministic functions)
 * =============================================================================
 */

export interface FileTypeBadgeInfo {
  extension: string;
  category: "video" | "image" | "animation" | "raw" | "document" | "other";
  textColor: string;
  badgeClass: string;
  pillClass: string;
}

const FILE_TYPE_COLORS: Record<string, { textColor: string; badgeClass: string; pillClass: string; category: FileTypeBadgeInfo["category"] }> = {
  // --- Standard Video Formats (Indigo / Violet / Purple) ---
  mp4: {
    textColor: "text-indigo-400",
    badgeClass: "bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]",
    pillClass: "text-indigo-400 bg-indigo-500/15 border border-indigo-500/25",
    category: "video",
  },
  m4v: {
    textColor: "text-indigo-400",
    badgeClass: "bg-indigo-950/80 border border-indigo-500/30 text-indigo-300",
    pillClass: "text-indigo-400 bg-indigo-500/15 border border-indigo-500/25",
    category: "video",
  },
  mov: {
    textColor: "text-purple-400",
    badgeClass: "bg-purple-950/80 border border-purple-500/30 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]",
    pillClass: "text-purple-400 bg-purple-500/15 border border-purple-500/25",
    category: "video",
  },
  mkv: {
    textColor: "text-violet-400",
    badgeClass: "bg-violet-950/80 border border-violet-500/30 text-violet-300",
    pillClass: "text-violet-400 bg-violet-500/15 border border-violet-500/25",
    category: "video",
  },
  webm: {
    textColor: "text-fuchsia-400",
    badgeClass: "bg-fuchsia-950/80 border border-fuchsia-500/30 text-fuchsia-300",
    pillClass: "text-fuchsia-400 bg-fuchsia-500/15 border border-fuchsia-500/25",
    category: "video",
  },
  avi: {
    textColor: "text-indigo-300",
    badgeClass: "bg-indigo-950/80 border border-indigo-500/30 text-indigo-300",
    pillClass: "text-indigo-300 bg-indigo-500/15 border border-indigo-500/25",
    category: "video",
  },

  // --- Photography / JPEG (Emerald / Green) ---
  jpg: {
    textColor: "text-emerald-700 dark:text-emerald-400",
    badgeClass: "bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
    pillClass: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/25",
    category: "image",
  },
  jpeg: {
    textColor: "text-emerald-700 dark:text-emerald-400",
    badgeClass: "bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]",
    pillClass: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 border border-emerald-500/25",
    category: "image",
  },

  // --- Lossless Graphics (Sky / Cyan) ---
  png: {
    textColor: "text-sky-400",
    badgeClass: "bg-sky-950/80 border border-sky-500/30 text-sky-300 shadow-[0_0_10px_rgba(14,165,233,0.2)]",
    pillClass: "text-sky-400 bg-sky-500/15 border border-sky-500/25",
    category: "image",
  },

  // --- Modern Web Formats (Teal / Mint) ---
  webp: {
    textColor: "text-teal-400",
    badgeClass: "bg-teal-950/80 border border-teal-500/30 text-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.2)]",
    pillClass: "text-teal-400 bg-teal-500/15 border border-teal-500/25",
    category: "image",
  },
  avif: {
    textColor: "text-cyan-400",
    badgeClass: "bg-cyan-950/80 border border-cyan-500/30 text-cyan-300",
    pillClass: "text-cyan-400 bg-cyan-500/15 border border-cyan-500/25",
    category: "image",
  },

  // --- Animations (Amber / Orange) ---
  gif: {
    textColor: "text-amber-400",
    badgeClass: "bg-amber-950/80 border border-amber-500/30 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
    pillClass: "text-amber-400 bg-amber-500/15 border border-amber-500/25",
    category: "animation",
  },

  // --- High-Efficiency & Pro RAW (Rose / Pink) ---
  heic: {
    textColor: "text-rose-400",
    badgeClass: "bg-rose-950/80 border border-rose-500/30 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.2)]",
    pillClass: "text-rose-400 bg-rose-500/15 border border-rose-500/25",
    category: "raw",
  },
  heif: {
    textColor: "text-rose-400",
    badgeClass: "bg-rose-950/80 border border-rose-500/30 text-rose-300",
    pillClass: "text-rose-400 bg-rose-500/15 border border-rose-500/25",
    category: "raw",
  },
  dng: {
    textColor: "text-pink-400",
    badgeClass: "bg-pink-950/80 border border-pink-500/30 text-pink-300",
    pillClass: "text-pink-400 bg-pink-500/15 border border-pink-500/25",
    category: "raw",
  },
  raw: {
    textColor: "text-pink-400",
    badgeClass: "bg-pink-950/80 border border-pink-500/30 text-pink-300",
    pillClass: "text-pink-400 bg-pink-500/15 border border-pink-500/25",
    category: "raw",
  },
  cr2: {
    textColor: "text-pink-400",
    badgeClass: "bg-pink-950/80 border border-pink-500/30 text-pink-300",
    pillClass: "text-pink-400 bg-pink-500/15 border border-pink-500/25",
    category: "raw",
  },
  nef: {
    textColor: "text-pink-400",
    badgeClass: "bg-pink-950/80 border border-pink-500/30 text-pink-300",
    pillClass: "text-pink-400 bg-pink-500/15 border border-pink-500/25",
    category: "raw",
  },

  // --- Vector & Graphics (Yellow / Gold) ---
  svg: {
    textColor: "text-yellow-400",
    badgeClass: "bg-yellow-950/80 border border-yellow-500/30 text-yellow-300 shadow-[0_0_10px_rgba(234,179,8,0.2)]",
    pillClass: "text-yellow-400 bg-yellow-500/15 border border-yellow-500/25",
    category: "image",
  },

  // --- Documents (Slate / Red) ---
  pdf: {
    textColor: "text-red-400",
    badgeClass: "bg-red-950/80 border border-red-500/30 text-red-300",
    pillClass: "text-red-400 bg-red-500/15 border border-red-500/25",
    category: "document",
  },
  zip: {
    textColor: "text-slate-300",
    badgeClass: "bg-slate-900/80 border border-slate-600/30 text-slate-300",
    pillClass: "text-slate-300 bg-slate-600/15 border border-slate-600/25",
    category: "document",
  },
};

/**
 * Returns color-coded badge metadata for any given filename or mime type.
 */
export function getFileTypeBadge(fileName: string, mimeType?: string): FileTypeBadgeInfo {
  let ext = "";
  if (fileName && fileName.includes(".")) {
    ext = fileName.split(".").pop()?.toLowerCase() || "";
  } else if (mimeType) {
    ext = mimeType.split("/").pop()?.toLowerCase() || "";
  }

  const match = FILE_TYPE_COLORS[ext];
  if (match) {
    return {
      extension: ext.toUpperCase(),
      category: match.category,
      textColor: match.textColor,
      badgeClass: match.badgeClass,
      pillClass: match.pillClass,
    };
  }

  // Fallback for unknown extensions
  const isVideo = mimeType?.startsWith("video/") || ["mp4", "mkv", "mov", "avi", "webm"].includes(ext);
  return {
    extension: (ext || (isVideo ? "VIDEO" : "FILE")).toUpperCase(),
    category: isVideo ? "video" : "other",
    textColor: isVideo ? "text-indigo-400" : "text-on-surface-variant",
    badgeClass: "bg-surface-container border border-outline-variant/30 text-on-surface-variant",
    pillClass: "text-on-surface-variant bg-surface-container border border-outline-variant/20",
  };
}
