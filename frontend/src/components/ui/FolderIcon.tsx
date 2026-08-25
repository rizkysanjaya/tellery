/**
 * =============================================================================
 * Module: frontend/src/components/ui/FolderIcon.tsx
 * Purpose: Dynamic icon renderer for virtual albums and collections with curated Lucide icons.
 * Used by: Sidebar.tsx, FolderGrid.tsx, FolderCustomizeModal.tsx, App.tsx
 * Dependencies: React, lucide-react
 * Public Members: FolderIcon, AVAILABLE_FOLDER_ICONS, FolderIconName
 * Side Effects: None (Stateless SVG rendering).
 * =============================================================================
 */

import React from "react";
import {
  Folder,
  Heart,
  Star,
  Bookmark,
  Sparkles,
  Camera,
  Video,
  Music,
  Globe,
  Compass,
  MapPin,
  Flame,
  Sun,
  Moon,
  Smile,
  Tag,
  Briefcase,
  Coffee,
  Lock,
  Gift,
  Plane,
  Car,
  Home,
  Code,
  Layers,
  LucideProps,
} from "lucide-react";

export const AVAILABLE_FOLDER_ICONS = [
  { name: "Folder", label: "Folder", Icon: Folder },
  { name: "Heart", label: "Heart", Icon: Heart },
  { name: "Star", label: "Star", Icon: Star },
  { name: "Bookmark", label: "Bookmark", Icon: Bookmark },
  { name: "Sparkles", label: "Sparkles", Icon: Sparkles },
  { name: "Camera", label: "Camera", Icon: Camera },
  { name: "Video", label: "Video", Icon: Video },
  { name: "Music", label: "Music", Icon: Music },
  { name: "Globe", label: "Globe", Icon: Globe },
  { name: "Compass", label: "Compass", Icon: Compass },
  { name: "MapPin", label: "Location", Icon: MapPin },
  { name: "Flame", label: "Trending", Icon: Flame },
  { name: "Sun", label: "Summer", Icon: Sun },
  { name: "Moon", label: "Night", Icon: Moon },
  { name: "Smile", label: "Memories", Icon: Smile },
  { name: "Tag", label: "Category", Icon: Tag },
  { name: "Briefcase", label: "Work", Icon: Briefcase },
  { name: "Coffee", label: "Casual", Icon: Coffee },
  { name: "Lock", label: "Private", Icon: Lock },
  { name: "Gift", label: "Special", Icon: Gift },
  { name: "Plane", label: "Travel", Icon: Plane },
  { name: "Car", label: "Roadtrip", Icon: Car },
  { name: "Home", label: "Family", Icon: Home },
  { name: "Code", label: "Projects", Icon: Code },
  { name: "Layers", label: "Collection", Icon: Layers },
] as const;

export type FolderIconName = typeof AVAILABLE_FOLDER_ICONS[number]["name"];

const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {};
AVAILABLE_FOLDER_ICONS.forEach((item) => {
  ICON_MAP[item.name] = item.Icon;
});

interface FolderIconProps extends Omit<LucideProps, "color" | "name"> {
  name?: string | null;
  color?: string | null;
}

export const FolderIcon: React.FC<FolderIconProps> = ({
  name = "Folder",
  color,
  className = "",
  style = {},
  ...props
}) => {
  const IconComponent = (name && ICON_MAP[name]) ? ICON_MAP[name] : Folder;
  const computedStyle = color ? { color, ...style } : style;

  return (
    <IconComponent
      className={className}
      style={computedStyle}
      {...props}
    />
  );
};
