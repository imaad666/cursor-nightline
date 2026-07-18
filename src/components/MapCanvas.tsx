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
import SideQuestChat, { type SideQuestPlan } from "./SideQuestChat";
import WalkRoutes from "./WalkRoutes";
import {
  BlueMetroLine,
  PinkMetroLineFuture,
  type LineId,
} from "./MetroLine";
import MetroLineZap from "./MetroLineZap";

const STATION_ZOOM = 16;
const OVERVIEW_ZOOM = 12;
const CAMERA_MS = 900;
const FOCUS_MS = 560;
const PLACES_CACHE_TTL_MS = 10 * 60 * 1000;
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
  const deckHeight = document
    .querySelector<HTMLElement>(".hotspot-sheet")
    ?.getBoundingClientRect().height;
  const deckPx = deckHeight ?? Math.min(h * 0.42, 380);
  const clearMidFromTop = Math.max(0, (h - Math.min(deckPx, h)) / 2);
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

  const frame = (now: number) => {
    if (tokenRef.current !== token) return;
    const t = Math.min(1, (now - t0) / durationMs);
    const e = easeInOutCubic(t);
    const nextZoom = startZoom + (target.zoom - startZoom) * e;

    map.moveCamera({
      center: {
        lat: from.lat + (target.center.lat - from.lat) * e,
        lng: from.lng + (target.center.lng - from.lng) * e,
      },
      zoom: nextZoom,
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

const CHROME_INSET = "clamp(1.25rem, 7vw, 6rem)";
const CHROME_TOP = "clamp(1.25rem, 6vh, 3.75rem)";

export default function MapCanvas() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<MetroStation | null>(null);
  const [spotMode, setSpotMode] = useState<SpotMode>("rated");
  const [ratedSpots, setRatedSpots] = useState<Hotspot[]>([]);
  const [closestSpots, setClosestSpots] = useState<Hotspot[]>([]);
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(null);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [placesRetry, setPlacesRetry] = useState(0);
  const [hoveredLine, setHoveredLine] = useState<LineId>(null);
  const pendingSideQuestRef = useRef<SideQuestPlan | null>(null);
  const placesCacheRef = useRef(
    new globalThis.Map<
      string,
      {
        expiresAt: number;
        rated: Hotspot[];
        closest: Hotspot[];
      }
    >(),
  );

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
    const pendingPlan = pendingSideQuestRef.current;
    if (pendingPlan?.stationId === station.id) {
      pendingSideQuestRef.current = null;
      setRatedSpots(pendingPlan.spots);
      setClosestSpots(pendingPlan.spots);
      setActiveHotspotId(pendingPlan.spots[0]?.id ?? null);
      setLoadingPlaces(false);
      setPlacesError(null);
      setSpotMode("rated");
      return;
    }

    const cacheKey = `${station.id}:${stationSearchRadius(station)}`;
    const cached = placesCacheRef.current.get(cacheKey);
    if (cached && cached.expiresAt > Date.now() && placesRetry === 0) {
      setRatedSpots(cached.rated);
      setClosestSpots(cached.closest);
      setActiveHotspotId(cached.rated[0]?.id ?? cached.closest[0]?.id ?? null);
      setLoadingPlaces(false);
      setPlacesError(null);
      setSpotMode("rated");
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
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
        placesCacheRef.current.set(cacheKey, {
          expiresAt: Date.now() + PLACES_CACHE_TTL_MS,
          rated,
          closest,
        });
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
      })
      .finally(() => window.clearTimeout(timeout));

    return () => controller.abort();
  }, [selected, placesRetry]);

  const handleSelect = useCallback((station: MetroStation) => {
    setSelected(station);
    setPlacesRetry(0);
    setHoveredLine(null);
  }, []);

  const handleClose = useCallback(() => {
    setSelected(null);
    setRatedSpots([]);
    setClosestSpots([]);
    setActiveHotspotId(null);
    setPlacesError(null);
    setSpotMode("rated");
    setPlacesRetry(0);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !selected) return;
      event.preventDefault();
      handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, selected]);

  const handleHotspotSelect = useCallback((hotspot: Hotspot) => {
    setActiveHotspotId(hotspot.id);
  }, []);

  const handleSideQuestPlan = useCallback(
    (plan: SideQuestPlan) => {
      const station = ALL_MAP_STATIONS.find(
        (candidate) => candidate.id === plan.stationId,
      );
      if (!station) return;

      pendingSideQuestRef.current = plan;
      setPlacesRetry(0);
      setHoveredLine(null);
      if (selected?.id === station.id) {
        pendingSideQuestRef.current = null;
        setRatedSpots(plan.spots);
        setClosestSpots(plan.spots);
        setActiveHotspotId(plan.spots[0]?.id ?? null);
        setLoadingPlaces(false);
        setPlacesError(null);
        setSpotMode("rated");
      }
      setSelected(station);
    },
    [selected],
  );

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
        isFractionalZoomEnabled
        reuseMaps
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
              animationKey={`${selected.id}:${spotMode}:${hotspots.map((hotspot) => hotspot.id).join(",")}`}
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

      {!selected && (
        <div className="station-discovery-hint pointer-events-none absolute bottom-[clamp(1.5rem,10vh,6rem)] left-1/2 z-10 -translate-x-1/2 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-[#FFD54F]/95 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-black shadow-[3px_3px_0_#000] sm:px-4 sm:text-[11px]">
            <span className="station-discovery-dot h-2 w-2 rounded-full bg-[#02B0AF]" />
            Zoom in or touch the glowing line to reveal stops
          </div>
        </div>
      )}

      <SideQuestChat
        selectedStationId={selected?.id ?? null}
        onPlan={handleSideQuestPlan}
      />

      {selected && (
        <HotspotDeck
          station={selected}
          hotspots={hotspots}
          activeId={activeHotspotId}
          loading={loadingPlaces}
          error={placesError}
          onRetry={() => setPlacesRetry((value) => value + 1)}
          mode={spotMode}
          onModeChange={handleModeChange}
          onActiveChange={handleHotspotSelect}
          onClose={handleClose}
        />
      )}
    </div>
  );
}
