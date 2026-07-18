"use client";

import { Polyline } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState, type RefObject } from "react";
import { METRO_LINE_PATH, PINK_LINE_PATH } from "@/data/kochi-metro";
import { METRO_LINE_COLOR, METRO_LINE_GLOW } from "@/lib/map-styles";

export type LineId = "blue" | "pink" | null;

function easeOutQuad(t: number) {
  return 1 - (1 - t) * (1 - t);
}

/** Soft opacity tween for Google Polylines (no CSS transitions). */
function useLineFade(bright: boolean, on = 1, off = 0.2, ms = 480) {
  const [value, setValue] = useState(bright ? on : off);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const target = bright ? on : off;
    const from = valueRef.current;
    if (Math.abs(from - target) < 0.001) {
      setValue(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      setValue(from + (target - from) * easeOutQuad(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [bright, on, off, ms]);

  return value;
}

/** Smooth multi-glow Blue Line — soft bloom, fades when a station is open. */
export function BlueMetroLine({
  hovered,
  dimmed,
  onHover,
}: {
  hovered: boolean;
  dimmed: boolean;
  onHover: (id: LineId) => void;
}) {
  const fade = useLineFade(!dimmed, 1, 0.18, 520);
  const hot = hovered && !dimmed;

  // Soft-edged ribbon: wide bloom, gentle mid, slim luminous core
  const coreW = hot ? 6.5 : 5;
  const midW = hot ? 18 : 14;
  const auraW = hot ? 36 : 28;

  const hover = !dimmed
    ? {
        onMouseOver: () => onHover("blue"),
        onMouseOut: () => onHover(null),
      }
    : {};

  return (
    <>
      {/* Soft outer bloom */}
      <Polyline
        path={METRO_LINE_PATH}
        strokeColor={METRO_LINE_GLOW}
        strokeOpacity={0.12 * fade * (hot ? 1.4 : 1)}
        strokeWeight={auraW}
        geodesic={false}
        zIndex={1}
        {...hover}
      />
      {/* Mid glow — soft edge */}
      <Polyline
        path={METRO_LINE_PATH}
        strokeColor={METRO_LINE_GLOW}
        strokeOpacity={0.32 * fade * (hot ? 1.3 : 1)}
        strokeWeight={midW}
        geodesic={false}
        zIndex={2}
        {...hover}
      />
      {/* Crisp core */}
      <Polyline
        path={METRO_LINE_PATH}
        strokeColor={METRO_LINE_COLOR}
        strokeOpacity={0.95 * fade}
        strokeWeight={coreW}
        geodesic={false}
        zIndex={3}
        {...hover}
      />
      {/* Thin highlight edge */}
      <Polyline
        path={METRO_LINE_PATH}
        strokeColor="#DFFFFF"
        strokeOpacity={0.4 * fade * (hot ? 1.25 : 1)}
        strokeWeight={hot ? 2 : 1.4}
        geodesic={false}
        zIndex={4}
        {...hover}
      />
    </>
  );
}

/** Pink Line — soft bloom, quieter until hover; fades with station select. */
export function PinkMetroLineFuture({
  hovered,
  dimmed,
  onHover,
}: {
  hovered: boolean;
  dimmed: boolean;
  onHover: (id: LineId) => void;
}) {
  const fade = useLineFade(!dimmed, 1, 0.14, 520);
  const hot = hovered && !dimmed;

  const hover = !dimmed
    ? {
        onMouseOver: () => onHover("pink"),
        onMouseOut: () => onHover(null),
      }
    : {};

  return (
    <>
      <Polyline
        path={PINK_LINE_PATH}
        strokeColor="#FF8FB8"
        strokeOpacity={0.16 * fade * (hot ? 1.4 : 1)}
        strokeWeight={hot ? 26 : 18}
        geodesic={false}
        zIndex={0}
        {...hover}
      />
      <Polyline
        path={PINK_LINE_PATH}
        strokeColor="#FF8FB8"
        strokeOpacity={0.32 * fade * (hot ? 1.2 : 1)}
        strokeWeight={hot ? 12 : 9}
        geodesic={false}
        zIndex={1}
        {...hover}
      />
      <Polyline
        path={PINK_LINE_PATH}
        strokeColor="#E85A8C"
        strokeOpacity={(hot ? 0.92 : 0.55) * fade}
        strokeWeight={hot ? 6 : 4.2}
        geodesic={false}
        zIndex={2}
        {...hover}
      />
    </>
  );
}

export function MetroLineHoverLabel({
  line,
  anchorRef,
}: {
  line: LineId;
  anchorRef: RefObject<HTMLElement | null>;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const root = anchorRef.current;
    if (!root || !line) {
      setPos(null);
      return;
    }
    const onMove = (ev: MouseEvent) => {
      const rect = root.getBoundingClientRect();
      setPos({ x: ev.clientX - rect.left, y: ev.clientY - rect.top });
    };
    root.addEventListener("mousemove", onMove);
    return () => root.removeEventListener("mousemove", onMove);
  }, [anchorRef, line]);

  if (!line || !pos) return null;

  return (
    <div
      className="pointer-events-none absolute z-[15] -translate-x-1/2 -translate-y-[140%]"
      style={{ left: pos.x, top: pos.y }}
    >
      <div
        className={`rounded-full px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] shadow-[0_8px_24px_rgba(0,0,0,0.18)] ${
          line === "blue"
            ? "bg-[#02B0AF] text-white"
            : "bg-[#E85A8C] text-white"
        }`}
      >
        {line === "blue" ? "Blue Line · live" : "Pink Line · coming soon"}
      </div>
    </div>
  );
}
