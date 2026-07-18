"use client";

import { Marker } from "@vis.gl/react-google-maps";
import { MAJOR_PLACES } from "@/data/kochi-metro";

function labelIcon(name: string) {
  const fontSize = 13;
  const padX = 2;
  const width = Math.ceil(name.length * 7.4) + padX * 2;
  const height = 20;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <text
    x="${width / 2}"
    y="${height / 2 + 1}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="system-ui, -apple-system, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="#000000"
    stroke="#FFD54F"
    stroke-width="3.5"
    paint-order="stroke"
  >${name}</text>
</svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: { width, height } as google.maps.Size,
    // Anchor above the point so the label floats beside the corridor
    anchor: { x: width / 2, y: height } as google.maps.Point,
  };
}

/** Fixed major-place labels — same set at every zoom. */
export default function PlaceLabels() {
  return (
    <>
      {MAJOR_PLACES.map((place) => (
        <Marker
          key={place.id}
          position={{ lat: place.lat, lng: place.lng }}
          icon={labelIcon(place.name)}
          clickable={false}
          zIndex={2}
        />
      ))}
    </>
  );
}
