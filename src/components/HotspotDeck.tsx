"use client";

import { useEffect, useRef } from "react";
import type { MetroStation } from "@/data/kochi-metro";
import { kindFromTag, mapsWalkingRouteUrl, type Hotspot } from "@/data/hotspots";
import PlaceKindIcon from "./PlaceKindIcon";

export type SpotMode = "rated" | "closest";

interface HotspotDeckProps {
  station: MetroStation;
  hotspots: Hotspot[];
  activeId: string | null;
  loading: boolean;
  error: string | null;
  mode: SpotMode;
  onModeChange: (mode: SpotMode) => void;
  onActiveChange: (hotspot: Hotspot) => void;
  onClose: () => void;
}

export default function HotspotDeck({
  station,
  hotspots,
  activeId,
  loading,
  error,
  mode,
  onModeChange,
  onActiveChange,
  onClose,
}: HotspotDeckProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const onActiveChangeRef = useRef(onActiveChange);
  onActiveChangeRef.current = onActiveChange;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const lockSyncRef = useRef(false);
  const fromScrollRef = useRef(false);

  const centerCard = (id: string, behavior: ScrollBehavior) => {
    const root = scrollerRef.current;
    if (!root) return;
    const card = root.querySelector<HTMLElement>(`[data-hotspot-id="${id}"]`);
    if (!card) return;

    lockSyncRef.current = true;
    const left =
      card.offsetLeft - (root.clientWidth - card.offsetWidth) / 2;
    root.scrollTo({ left: Math.max(0, left), behavior });

    const unlock = () => {
      lockSyncRef.current = false;
    };

    if (behavior === "smooth") {
      const onEnd = () => {
        root.removeEventListener("scrollend", onEnd);
        unlock();
      };
      root.addEventListener("scrollend", onEnd, { once: true });
      window.setTimeout(unlock, 600);
    } else {
      unlock();
    }
  };

  useEffect(() => {
    if (!activeId || hotspots.length === 0) return;
    if (fromScrollRef.current) {
      fromScrollRef.current = false;
      return;
    }
    const t = window.setTimeout(() => centerCard(activeId, "smooth"), 30);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, hotspots.length, mode]);

  useEffect(() => {
    const root = scrollerRef.current;
    if (!root || hotspots.length === 0) return;

    const sync = () => {
      if (lockSyncRef.current) return;
      const list = Array.from(
        root.querySelectorAll<HTMLElement>("[data-hotspot-id]"),
      );
      if (!list.length) return;
      const mid = root.scrollLeft + root.clientWidth / 2;
      let best: HTMLElement | null = null;
      let bestDist = Infinity;
      for (const card of list) {
        const center = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(center - mid);
        if (dist < bestDist) {
          bestDist = dist;
          best = card;
        }
      }
      if (!best) return;
      const id = best.dataset.hotspotId;
      if (!id || id === activeIdRef.current) return;
      const spot = hotspots.find((h) => h.id === id);
      if (!spot) return;
      fromScrollRef.current = true;
      onActiveChangeRef.current(spot);
    };

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        sync();
        ticking = false;
      });
    };

    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [hotspots]);

  const selectCard = (spot: Hotspot) => {
    fromScrollRef.current = false;
    onActiveChange(spot);
  };

  const openRoute = (spot: Hotspot) => {
    const url = mapsWalkingRouteUrl(
      { lat: station.lat, lng: station.lng },
      { lat: spot.lat, lng: spot.lng },
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="hotspot-sheet pointer-events-none absolute inset-x-0 bottom-0 z-20">
      <div className="pointer-events-auto w-full pb-[max(0.85rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-3 grid w-[calc(100%-2rem)] max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-3 sm:w-[calc(100%-4rem)]">
          <div
            className="comic-panel col-start-2 flex shrink-0 overflow-hidden bg-[#FFD54F] p-1"
            role="tablist"
            aria-label="Spot ranking"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "rated"}
              onClick={() => onModeChange("rated")}
              className={`min-w-[7.5rem] px-3.5 py-2.5 text-[12px] font-black uppercase tracking-[0.1em] transition ${
                mode === "rated"
                  ? "bg-black text-[#FFD54F]"
                  : "bg-transparent text-black/55 hover:text-black"
              }`}
            >
              Top rated
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "closest"}
              onClick={() => onModeChange("closest")}
              className={`min-w-[7.5rem] px-3.5 py-2.5 text-[12px] font-black uppercase tracking-[0.1em] transition ${
                mode === "closest"
                  ? "bg-black text-[#FFD54F]"
                  : "bg-transparent text-black/55 hover:text-black"
              }`}
            >
              Closest
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="comic-panel col-start-3 justify-self-end bg-black px-3.5 py-2.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#FFD54F] transition hover:bg-[#FFD54F] hover:text-black"
          >
            Close
          </button>
        </div>

        {loading && (
          <div className="hotspot-scroller flex gap-4 overflow-hidden pb-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="comic-panel h-48 w-[min(76vw,300px)] shrink-0 animate-pulse bg-black/80"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="mx-5 comic-panel bg-[#FFD54F] px-4 py-3 text-[13px] font-semibold text-black sm:mx-8">
            Couldn’t load Google places: {error}
          </div>
        )}

        {!loading && !error && hotspots.length === 0 && (
          <div className="mx-5 comic-panel bg-[#FFD54F] px-4 py-3 text-[13px] font-semibold text-black sm:mx-8">
            No {mode === "rated" ? "top-rated" : "nearby"} spots for this stop
            yet.
          </div>
        )}

        {!loading && hotspots.length > 0 && (
          <div
            ref={scrollerRef}
            className="hotspot-scroller flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
          >
            {hotspots.map((spot) => {
              const active = spot.id === activeId;
              return (
                <article
                  key={`${mode}-${spot.id}`}
                  data-hotspot-id={spot.id}
                  className={`hotspot-card comic-panel shrink-0 snap-center overflow-hidden bg-black ${
                    active ? "is-active" : "is-side"
                  }`}
                  onClick={() => selectCard(spot)}
                >
                  <div className="hotspot-card-media relative h-36 w-full overflow-hidden bg-[#1a1a1a] sm:h-40">
                    {spot.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={spot.image}
                        alt=""
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[11px] font-black uppercase tracking-wide text-[#FFD54F]/40">
                        No photo
                      </div>
                    )}
                    <span className="hotspot-card-badge absolute left-2 top-2 border-2 border-black bg-[#FFD54F] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-black">
                      {spot.walkMins} min
                    </span>
                    {spot.rating != null && (
                      <span className="hotspot-card-badge absolute right-2 top-2 border-2 border-black bg-black px-2 py-0.5 text-[10px] font-black text-[#FFD54F]">
                        ★ {spot.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="px-3.5 py-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#02B0AF]">
                      <PlaceKindIcon
                        kind={spot.kind ?? kindFromTag(spot.tag)}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      {spot.tag}
                    </p>
                    <p
                      className="mt-1 line-clamp-2 text-[1.2rem] leading-tight tracking-[-0.03em] text-[#FFD54F]"
                      style={{
                        fontFamily: "var(--font-fraunces), Georgia, serif",
                      }}
                    >
                      {spot.name}
                    </p>
                    <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-white/55">
                      {spot.blurb}
                    </p>
                    <button
                      type="button"
                      className="mt-3 w-full border-2 border-black bg-[#FFD54F] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-black transition hover:bg-[#02B0AF] hover:text-black"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRoute(spot);
                      }}
                    >
                      Create Route
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
