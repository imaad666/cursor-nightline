"use client";

import { useMap } from "@vis.gl/react-google-maps";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { METRO_LINE_PATH } from "@/data/kochi-metro";

const CYCLE_MS = 5200;
const ZAP_LEN = 56;

type Pt = { x: number; y: number };

function pathD(pts: Pt[]) {
  if (!pts.length) return "";
  return pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
}

/**
 * Idle-only glowy zap that rides the Blue Line start → end → back.
 */
export default function MetroLineZap({ active }: { active: boolean }) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const measureRef = useRef<SVGPathElement | null>(null);
  const strokeRefs = useRef<SVGPathElement[]>([]);
  const lenRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [d, setD] = useState("");

  useEffect(() => {
    if (!map) return;

    const container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;";
    containerRef.current = container;

    const overlay = new google.maps.OverlayView();
    overlayRef.current = overlay;

    const sync = () => {
      const projection = overlay.getProjection();
      if (!projection) return;
      const pts: Pt[] = [];
      for (const p of METRO_LINE_PATH) {
        const px = projection.fromLatLngToDivPixel(
          new google.maps.LatLng(p.lat, p.lng),
        );
        if (px) pts.push({ x: px.x, y: px.y });
      }
      setD(pathD(pts));
    };

    overlay.onAdd = () => {
      overlay.getPanes()?.overlayLayer.appendChild(container);
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
    const el = measureRef.current;
    if (!el || !d) return;
    const L = el.getTotalLength();
    lenRef.current = L;
    const dash = `${ZAP_LEN} ${Math.max(L * 2, 4000)}`;
    for (const stroke of strokeRefs.current) {
      stroke.setAttribute("stroke-dasharray", dash);
    }
  }, [d]);

  useEffect(() => {
    if (!active) return;

    let raf = 0;
    const t0 = performance.now();

    const tick = (now: number) => {
      const L = lenRef.current;
      if (L > 0) {
        const cycle = ((now - t0) % CYCLE_MS) / CYCLE_MS;
        const raw = cycle < 0.5 ? cycle * 2 : 2 - cycle * 2;
        const eased =
          raw < 0.5 ? 2 * raw * raw : 1 - (-2 * raw + 2) ** 2 / 2;
        const offset = String(-(eased * L));
        for (const stroke of strokeRefs.current) {
          stroke.setAttribute("stroke-dashoffset", offset);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, d]);

  if (!ready || !containerRef.current || !d) return null;

  const setStroke = (el: SVGPathElement | null, i: number) => {
    if (el) strokeRefs.current[i] = el;
  };

  return createPortal(
    <svg
      className={`metro-zap ${active ? "is-on" : "is-off"}`}
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      <path
        ref={(el) => setStroke(el, 0)}
        d={d}
        fill="none"
        stroke="#7EEAEA"
        strokeWidth={18}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.22}
        style={{ filter: "blur(4px)" }}
      />
      <path
        ref={(el) => setStroke(el, 1)}
        d={d}
        fill="none"
        stroke="#5DE8E6"
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.55}
        style={{ filter: "blur(1.5px)" }}
      />
      <path
        ref={(el) => {
          measureRef.current = el;
          setStroke(el, 2);
        }}
        d={d}
        fill="none"
        stroke="#E8FFFF"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity={0.95}
      />
    </svg>,
    containerRef.current,
  );
}
