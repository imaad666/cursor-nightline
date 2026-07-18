"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MetroStation } from "@/data/kochi-metro";

const TERMINALS = new Set(["aluva", "thrippunithura"]);
/** Stations stay tucked into the line until this zoom (or line touch). */
const REVEAL_ZOOM = 13.2;

interface StationMarkersProps {
  stations: MetroStation[];
  selectedId: string | null;
  /** Line hover / touch — reveal stops without zooming. */
  lineTouched?: boolean;
  onSelect: (station: MetroStation) => void;
}

export default function StationMarkers({
  stations,
  selectedId,
  lineTouched = false,
  onSelect,
}: StationMarkersProps) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(() => map?.getZoom() ?? 12);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const revealed =
    zoom >= REVEAL_ZOOM || lineTouched || selectedId != null;

  useEffect(() => {
    if (!map) return;

    const syncZoom = () => setZoom(map.getZoom() ?? 12);
    syncZoom();
    const zoomListener = map.addListener("zoom_changed", syncZoom);
    return () => {
      google.maps.event.removeListener(zoomListener);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:0;top:0;width:0;height:0;overflow:visible;";
    containerRef.current = container;

    const overlay = new google.maps.OverlayView();
    overlayRef.current = overlay;

    const syncPositions = () => {
      const projection = overlay.getProjection();
      if (!projection) return;

      for (const station of stations) {
        const el = nodeRefs.current.get(station.id);
        if (!el) continue;
        const point = projection.fromLatLngToDivPixel(
          new google.maps.LatLng(station.lat, station.lng),
        );
        if (!point) continue;
        el.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
      }
    };

    overlay.onAdd = () => {
      overlay.getPanes()?.overlayMouseTarget.appendChild(container);
      setReady(true);
    };

    overlay.draw = () => {
      syncPositions();
    };

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
  }, [map, stations]);

  useEffect(() => {
    for (const [id, el] of nodeRefs.current) {
      el.classList.toggle("is-selected", id === selectedId);
      el.classList.toggle("is-revealed", revealed);
    }
  }, [selectedId, revealed]);

  useEffect(() => {
    if (!ready) return;
    const projection = overlayRef.current?.getProjection();
    if (!projection) return;
    for (const station of stations) {
      const el = nodeRefs.current.get(station.id);
      if (!el) continue;
      const point = projection.fromLatLngToDivPixel(
        new google.maps.LatLng(station.lat, station.lng),
      );
      if (!point) continue;
      el.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
      el.classList.toggle("is-revealed", revealed);
    }
  }, [ready, stations, revealed]);

  if (!ready || !containerRef.current) return null;

  return createPortal(
    <>
      {stations.map((station) => {
        const isFuture = station.status === "future";
        const isTerminal = TERMINALS.has(station.id);

        return (
          <button
            key={station.id}
            ref={(el) => {
              if (el) nodeRefs.current.set(station.id, el);
              else nodeRefs.current.delete(station.id);
            }}
            type="button"
            tabIndex={revealed && !isFuture ? 0 : -1}
            aria-hidden={!revealed}
            aria-label={
              isFuture ? `${station.name} (coming soon)` : station.name
            }
            aria-disabled={isFuture}
            className={[
              "station-node",
              revealed ? "is-revealed" : "",
              isTerminal ? "is-terminal" : "",
              selectedId === station.id ? "is-selected" : "",
              isFuture ? "is-future" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={(e) => {
              e.stopPropagation();
              if (!revealed || isFuture) return;
              onSelectRef.current(station);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            title={
              revealed
                ? isFuture
                  ? `${station.name} · coming soon`
                  : station.name
                : undefined
            }
          >
            <span className="station-waves" aria-hidden>
              <span className="station-wave" />
              <span className="station-wave" />
              <span className="station-wave" />
            </span>
            <span className="station-halo" aria-hidden />
            <span className="station-dot" aria-hidden>
              <span className="station-core" />
            </span>
            <span className="station-label">{station.name}</span>
          </button>
        );
      })}
    </>,
    containerRef.current,
  );
}
