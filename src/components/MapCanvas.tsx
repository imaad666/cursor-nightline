"use client";

import { Map, useMap } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ALL_MAP_STATIONS,
  FUTURE_COUNT,
  KOCHI_MAP_CENTER,
  KOCHI_MAP_ZOOM,
  METRO_LINE_PATH,
  OPERATIONAL_COUNT,
  PINK_LINE_PATH,
  stationSearchRadius,
  type MetroStation,
} from "@/data/kochi-metro";
import type { Hotspot } from "@/data/hotspots";
import { lightMapStyles } from "@/lib/map-styles";
import StationMarkers from "./StationMarkers";
import PlaceLabels from "./PlaceLabels";
import FactsPanel from "./FactsPanel";
import HotspotMarkers from "./HotspotMarkers";
import HotspotDeck, { type SpotMode } from "./HotspotDeck";
import WalkRoutes from "./WalkRoutes";
import {
  BlueMetroLine,
  MetroLineHoverLabel,
  PinkMetroLineFuture,
  type LineId,
} from "./MetroLine";
import MetroLineZap from "./MetroLineZap";

const STATION_ZOOM = 16;
const OVERVIEW_ZOOM = 12;
const CAMERA_MS = 780;
const FOCUS_MS = 480;
const ZOOM_STEP = 0.125;
/** Fraction of the map height covered by the bottom carousel + chrome. */
const DECK_COVER = 0.42;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Place `focus` in the middle of the map band above the carousel
 * by shifting the camera center south (focus reads higher on screen).
 */
function deckAwareCenter(
  map: google.maps.Map,
  focus: { lat: number; lng: number },
  zoom: number,
): { lat: number; lng: number } {
  const h = map.getDiv()?.clientHeight || window.innerHeight;
  const deckPx = Math.min(h * DECK_COVER, 380);
  const clearMidFromTop = (h - deckPx) / 2;
  const shiftPx = h / 2 - clearMidFromTop;

  const metersPerPx =
    (156543.03392 * Math.cos((focus.lat * Math.PI) / 180)) / 2 ** zoom;
  const southDeg = (shiftPx * metersPerPx) / 111_320;

  return { lat: focus.lat - southDeg, lng: focus.lng };
}

function animateCamera(
  map: google.maps.Map,
  target: { center: { lat: number; lng: number }; zoom: number },
  tokenRef: { current: number },
  token: number,
  durationMs = CAMERA_MS,
) {
  const startCenter = map.getCenter();
  const startZoom = map.getZoom() ?? KOCHI_MAP_ZOOM;
  if (!startCenter) {
    map.moveCamera({ center: target.center, zoom: target.zoom });
    return;
  }

  const from = { lat: startCenter.lat(), lng: startCenter.lng() };
  const t0 = performance.now();
  let lastZoom = startZoom;

  const frame = (now: number) => {
    if (tokenRef.current !== token) return;
    const t = Math.min(1, (now - t0) / durationMs);
    const e = easeInOutCubic(t);
    const easedZoom = startZoom + (target.zoom - startZoom) * e;
    const nextZoom =
      t === 1 ? target.zoom : Math.round(easedZoom / ZOOM_STEP) * ZOOM_STEP;

    if (nextZoom !== lastZoom) lastZoom = nextZoom;

    map.moveCamera({
      center: {
        lat: from.lat + (target.center.lat - from.lat) * e,
        lng: from.lng + (target.center.lng - from.lng) * e,
      },
      zoom: lastZoom,
    });
    if (t < 1) requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

/**
 * Overview ↔ station zoom, then pans to each active spot above the deck.
 */
function SmoothCamera({
  station,
  focus,
}: {
  station: MetroStation | null;
  focus: { id: string; lat: number; lng: number } | null;
}) {
  const map = useMap();
  const tokenRef = useRef(0);
  const lastKey = useRef<string | null>(null);
  const overviewRef = useRef<{
    center: { lat: number; lng: number };
    zoom: number;
  } | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!overviewRef.current) {
      const bounds = new google.maps.LatLngBounds();
      METRO_LINE_PATH.forEach((p) => bounds.extend(p));
      PINK_LINE_PATH.forEach((p) => bounds.extend(p));
      const c = bounds.getCenter();
      overviewRef.current = {
        center: { lat: c.lat(), lng: c.lng() },
        zoom: OVERVIEW_ZOOM,
      };
    }

    if (!station) {
      if (lastKey.current === "overview") return;
      lastKey.current = "overview";
      const token = ++tokenRef.current;
      animateCamera(map, overviewRef.current, tokenRef, token, CAMERA_MS);
      return;
    }

    const point = focus ?? { lat: station.lat, lng: station.lng };
    const key = focus ? `spot:${focus.id}` : `station:${station.id}`;
    // Debounce spot pans so carousel scrolling doesn't thrash the camera
    const delay = focus ? 120 : 0;

    const timer = window.setTimeout(() => {
      if (lastKey.current === key) return;
      const wasSpot = lastKey.current?.startsWith("spot:");
      lastKey.current = key;
      const token = ++tokenRef.current;
      const zoom = map.getZoom() ?? STATION_ZOOM;
      // Keep zoom when hopping spot → spot; settle to station zoom on entry
      const targetZoom = wasSpot && focus ? zoom : STATION_ZOOM;

      animateCamera(
        map,
        {
          center: deckAwareCenter(map, point, targetZoom),
          zoom: targetZoom,
        },
        tokenRef,
        token,
        focus ? FOCUS_MS : CAMERA_MS,
      );
    }, delay);

    return () => window.clearTimeout(timer);
  }, [map, station, focus?.id, focus?.lat, focus?.lng]);

  return null;
}

const CHROME_INSET = "clamp(1.25rem, 4vw, 2.75rem)";
const CHROME_TOP = "clamp(1.25rem, 3.5vh, 2.5rem)";

export default function MapCanvas() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<MetroStation | null>(null);
  const [spotMode, setSpotMode] = useState<SpotMode>("rated");
  const [ratedSpots, setRatedSpots] = useState<Hotspot[]>([]);
  const [closestSpots, setClosestSpots] = useState<Hotspot[]>([]);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [hoveredLine, setHoveredLine] = useState<LineId>(null);

  const hotspots = spotMode === "rated" ? ratedSpots : closestSpots;

  useEffect(() => {
    if (!selected) {
      setRatedSpots([]);
      setClosestSpots([]);
      setActiveHotspotId(null);
      setPlacesError(null);
      setLoadingPlaces(false);
      setSpotMode("rated");
      return;
    }

    const station = selected;
    const controller = new AbortController();
    setLoadingPlaces(true);
    setPlacesError(null);
    setRatedSpots([]);
    setClosestSpots([]);
    setActiveHotspotId(null);
    setSpotMode("rated");

    const url = `/api/places/nearby?lat=${station.lat}&lng=${station.lng}&stationId=${encodeURIComponent(station.id)}&radius=${stationSearchRadius(station)}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as {
          rated?: Hotspot[];
          closest?: Hotspot[];
          hotspots?: Hotspot[];
          error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Failed to load places");
        return {
          rated: data.rated ?? data.hotspots ?? [],
          closest: data.closest ?? data.hotspots ?? [],
        };
      })
      .then(({ rated, closest }) => {
        setRatedSpots(rated);
        setClosestSpots(closest);
        setActiveHotspotId(rated[0]?.id ?? closest[0]?.id ?? null);
        setLoadingPlaces(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Failed to load places";
        setPlacesError(message);
        setRatedSpots([]);
        setClosestSpots([]);
        setLoadingPlaces(false);
      });

    return () => controller.abort();
  }, [selected]);

  const handleSelect = useCallback((station: MetroStation) => {
    setSelected(station);
    setHoveredLine(null);
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
    setRatedSpots([]);
    setClosestSpots([]);
    setActiveHotspotId(null);
    setPlacesError(null);
    setSpotMode("rated");
  }, []);

  const handleHotspotSelect = useCallback((hotspot: Hotspot) => {
    setActiveHotspotId(hotspot.id);
  }, []);

  const handleModeChange = useCallback(
    (mode: SpotMode) => {
      setSpotMode(mode);
      const list = mode === "rated" ? ratedSpots : closestSpots;
      setActiveHotspotId(list[0]?.id ?? null);
    },
    [ratedSpots, closestSpots],
  );

  const activeFocus =
    hotspots.find((h) => h.id === activeHotspotId) ?? null;

  return (
    <div
      ref={pageRef}
      className="comic-page relative h-dvh w-screen overflow-hidden bg-[#FFD54F]"
    >
      <Map
        defaultCenter={KOCHI_MAP_CENTER}
        defaultZoom={KOCHI_MAP_ZOOM}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        backgroundColor="#FFD54F"
        styles={lightMapStyles}
        className="h-full w-full"
        onClick={handleClose}
      >
        <PinkMetroLineFuture
          hovered={hoveredLine === "pink"}
          dimmed={!!selected}
          onHover={setHoveredLine}
        />
        <BlueMetroLine
          hovered={hoveredLine === "blue"}
          dimmed={!!selected}
          onHover={setHoveredLine}
        />
        <MetroLineZap active={!selected} />

        <StationMarkers
          stations={ALL_MAP_STATIONS}
          selectedId={selected?.id ?? null}
          lineTouched={hoveredLine != null && !selected}
          onSelect={handleSelect}
        />

        {selected && hotspots.length > 0 && (
          <>
            <WalkRoutes
              station={selected}
              hotspots={hotspots}
              activeId={activeHotspotId}
            />
            <HotspotMarkers
              hotspots={hotspots}
              activeId={activeHotspotId}
              onSelect={handleHotspotSelect}
            />
          </>
        )}

        <PlaceLabels />
        <SmoothCamera station={selected} focus={activeFocus} />
      </Map>

      <div className="comic-halftone pointer-events-none absolute inset-0 z-[7]" />
      <div className="comic-vignette pointer-events-none absolute inset-0 z-[8]" />

      <MetroLineHoverLabel line={hoveredLine} anchorRef={pageRef} />

      <header
        className="pointer-events-none absolute left-0 top-0 z-10 flex items-start"
        style={{ paddingLeft: CHROME_INSET, paddingTop: CHROME_TOP }}
      >
        <div className="pointer-events-auto flex flex-col items-start gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/metro-logo.png"
            alt="METRO"
            className="metro-logo-glow h-12 w-auto select-none sm:h-14"
            draggable={false}
          />
          {selected && (
            <div className="comic-panel chrome-fade-in bg-[#FFD54F] px-3.5 py-2">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-black">
                {selected.name}
              </span>
            </div>
          )}
        </div>
      </header>

      <div
        className={`pointer-events-none absolute bottom-0 left-0 z-10 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          selected
            ? "translate-y-2 opacity-0"
            : "translate-y-0 opacity-100"
        }`}
        style={{
          paddingLeft: CHROME_INSET,
          paddingBottom: CHROME_TOP,
        }}
        aria-hidden={!!selected}
      >
        <div className="comic-panel bg-[#FFD54F] px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block h-2 w-7 rounded-full bg-[#02B0AF]"
              style={{
                boxShadow: `0 0 0 3px ${hoveredLine === "blue" ? "#7EEAEA" : "transparent"}`,
              }}
            />
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-black">
              Blue · {OPERATIONAL_COUNT} live
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span
              className="inline-block h-2 w-7 rounded-full bg-[#E85A8C] opacity-70"
              style={{
                boxShadow: `0 0 0 3px ${hoveredLine === "pink" ? "#FF8FB8" : "transparent"}`,
              }}
            />
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-black/65">
              Pink · {FUTURE_COUNT} soon
            </span>
          </div>
        </div>
      </div>

      <FactsPanel visible={!selected} inset={CHROME_INSET} top={CHROME_TOP} />

      {selected && (
        <HotspotDeck
          station={selected}
          hotspots={hotspots}
          activeId={activeHotspotId}
          loading={loadingPlaces}
          error={placesError}
          mode={spotMode}
          onModeChange={handleModeChange}
          onActiveChange={handleHotspotSelect}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
