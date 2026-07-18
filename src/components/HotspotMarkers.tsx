"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Hotspot } from "@/data/hotspots";
import { kindFromTag } from "@/data/hotspots";
import PlaceKindIcon from "./PlaceKindIcon";

interface HotspotMarkersProps {
  hotspots: Hotspot[];
  activeId: string | null;
  plannedIds: string[];
  onSelect: (hotspot: Hotspot) => void;
  onTogglePlan: (hotspot: Hotspot) => void;
}

export default function HotspotMarkers({
  hotspots,
  activeId,
  plannedIds,
  onSelect,
  onTogglePlan,
}: HotspotMarkersProps) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const hotspotsRef = useRef(hotspots);
  hotspotsRef.current = hotspots;
  const [ready, setReady] = useState(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onTogglePlanRef = useRef(onTogglePlan);
  onTogglePlanRef.current = onTogglePlan;

  useEffect(() => {
    if (!map) return;

    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:0;top:0;width:0;height:0;overflow:visible;";
    containerRef.current = container;

    const overlay = new google.maps.OverlayView();
    overlayRef.current = overlay;

    const sync = () => {
      const projection = overlay.getProjection();
      if (!projection) return;
      for (const spot of hotspotsRef.current) {
        const el = nodeRefs.current.get(spot.id);
        if (!el) continue;
        const point = projection.fromLatLngToDivPixel(
          new google.maps.LatLng(spot.lat, spot.lng),
        );
        if (!point) continue;
        el.style.left = "0";
        el.style.top = "0";
        el.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -100%)`;
      }
    };

    overlay.onAdd = () => {
      overlay.getPanes()?.overlayMouseTarget.appendChild(container);
      setReady(true);
    };
    overlay.draw = sync;
    overlay.onRemove = () => {
      container.remove();
      containerRef.current = null;
      setReady(false);
    };
    overlay.setMap(map);

    return () => {
      overlay.setMap(null);
      overlayRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    for (const [id, el] of nodeRefs.current) {
      el.classList.toggle("is-active", id === activeId);
    }
  }, [activeId]);

  useEffect(() => {
    if (!ready) return;
    const projection = overlayRef.current?.getProjection();
    if (!projection) return;
    for (const spot of hotspots) {
      const el = nodeRefs.current.get(spot.id);
      if (!el) continue;
      const point = projection.fromLatLngToDivPixel(
        new google.maps.LatLng(spot.lat, spot.lng),
      );
      if (!point) continue;
      el.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -100%)`;
    }
  }, [ready, hotspots, activeId]);

  if (!ready || !containerRef.current || hotspots.length === 0) return null;

  return createPortal(
    <>
      {hotspots.map((spot, i) => (
        <div
          key={spot.id}
          ref={(el) => {
            if (el) nodeRefs.current.set(spot.id, el);
            else nodeRefs.current.delete(spot.id);
          }}
          role="button"
          tabIndex={0}
          aria-label={`${spot.tag}: ${spot.name}`}
          className={[
            "hotspot-node",
            `kind-${spot.kind ?? kindFromTag(spot.tag)}`,
            activeId === spot.id ? "is-active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={(e) => {
            e.stopPropagation();
            onSelectRef.current(spot);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            onSelectRef.current(spot);
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <span
            className="hotspot-inner"
            style={{ animationDelay: `${220 + i * 90}ms` }}
          >
            <span className="hotspot-ping" aria-hidden />
            <span className="hotspot-pin" aria-hidden>
              <PlaceKindIcon kind={spot.kind ?? kindFromTag(spot.tag)} className="hotspot-pin-icon" />
            </span>
            <span
              className={`hotspot-add ${plannedIds.includes(spot.id) ? "is-added" : ""}`}
              role="button"
              tabIndex={0}
              aria-label={`${plannedIds.includes(spot.id) ? "Remove" : "Add"} ${spot.name} ${plannedIds.includes(spot.id) ? "from" : "to"} plan`}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePlanRef.current(spot);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter" && e.key !== " ") return;
                e.preventDefault();
                e.stopPropagation();
                onTogglePlanRef.current(spot);
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {plannedIds.includes(spot.id) ? "✓" : "+"}
            </span>
            <span className="hotspot-tip">
              <span className="hotspot-tip-tag">{spot.tag}</span>
              {spot.name}
            </span>
          </span>
        </div>
      ))}
    </>,
    containerRef.current,
  );
}
