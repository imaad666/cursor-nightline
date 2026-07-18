"use client";

import type { PlaceKind } from "@/data/hotspots";

const PATHS: Record<PlaceKind, string> = {
  cafe:
    "M6 8h10v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8zm12 1h1.5a2.5 2.5 0 0 1 0 5H18M8 3v3M11 3v3M14 3v3",
  restaurant:
    "M7 3v10M5 3v4a2 2 0 0 0 2 2v7M17 3c0 4-2 5-2 8v5M15 3c0 4 2 5 2 8",
  movie:
    "M4 7h16v10H4V7zm0 0l3 2.5L4 12m16-5l-3 2.5L20 12M8 7v10M12 7v10M16 7v10",
  park:
    "M12 18V11M8 18h8M12 11c-2.5 0-4-1.8-4-4 0 0 1.5.5 4 .5s4-.5 4-.5c0 2.2-1.5 4-4 4z",
  dessert:
    "M7 14h10l-1.2 5H8.2L7 14zm1-1.5C8 9.5 10 7 12 7s4 2.5 4 5.5M12 7V5",
  music:
    "M9 18a2 2 0 1 1-2-2 2 2 0 0 1 2 2zm8 0a2 2 0 1 1-2-2 2 2 0 0 1 2 2zM9 16V6l8-2v10",
  books:
    "M5 5h5v14H5V5zm9 0h5v14h-5V5zM10 5v14M14 5v14",
  art:
    "M12 4l2.2 4.5L19 9.2l-3.5 3.4.8 4.7L12 15.2 7.7 17.3l.8-4.7L5 9.2l4.8-.7L12 4z",
  shop:
    "M5 9l1.2-4h11.6L19 9M5 9h14v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V9zm4 3v5m6-5v5",
  place:
    "M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
};

interface PlaceKindIconProps {
  kind: PlaceKind;
  className?: string;
}

export default function PlaceKindIcon({ kind, className }: PlaceKindIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[kind]} />
    </svg>
  );
}
