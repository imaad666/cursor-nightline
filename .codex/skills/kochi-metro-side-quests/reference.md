# Kochi Metro Side Quests — Project Skills Guide

This document is the operating guide for building and evolving the Kochi Metro Side Quest maxxing experience. Use it whenever you make product, design, map, data, or
API decisions in this repository.

## Product north star

The landing experience must feel unmistakably like Kochi Metro, even before a
visitor reads the name. The map is the first-screen hero; the interface around
it exists to support exploration, not compete with it. the map will of course take a second or two to load so we can show the codex logo and the text Side Quests Map Loading.

The intended journey is simple:

1. Arrive to an atmospheric metro corridor with a moving live-line signal.
2. Discover stations naturally by zooming or interacting with the line.
3. Select a station and immediately explore worthwhile nearby places.
4. Compare the highest-rated places with the closest places.
5. Open walking directions in Google Maps.

If removing the logo makes the first viewport feel like it could belong to a
generic city, redesign it before adding more features.

## Technology baseline

Build on the following stack unless a task explicitly changes it:

- Next.js 15 with the App Router and Turbopack.
- React 19.
- Tailwind CSS 4.
- `@vis.gl/react-google-maps` for the base map, polylines, overlays, and map
  lifecycle integration.
- Google Maps Places APIs for nearby-place discovery and walking directions.

Useful project commands:

```bash
npm run dev
npm run build
npm run lint
```

Store the Maps key only in `.env.local` as `GOOGLE_MAPS_KEY`. Read it through
`/api/maps/key`; never commit the key or place a secret directly in source
code, a client bundle, a test fixture, or a screenshot.

## Visual system

### Core palette

| Token | Value | Purpose |
| --- | --- | --- |
| Land | `#FFD54F` | The comic-yellow map world |
| Water | Purple or magenta | Map water only |
| Blue Line | `#02B0AF` | The active metro ribbon |
| Blue glow | `#7EEAEA` | Restrained active-line bloom |
| Pink Line | `#E85A8C` | Quieter, future-service line |
| Ink | `#000000` | Borders, text punch, and hard shadows |

Use **Fraunces** for display moments and **Outfit** for controls, labels, and
body UI. Do not substitute Inter, Roboto, or system fonts.

### Component language

- Treat the map as a comic world, not a neutral mapping tool.
- A comic panel has a thick black border and a hard offset shadow. Use the
  shared `comic-panel` treatment rather than inventing competing card styles.
- Prefer expressive linework, bold type, and deliberate empty space.
- Keep interface chrome sparse in the home state.
- Use panels only where an interaction needs a container. Do not turn the hero
  into a grid of cards.

### Things to avoid

- Purple-on-white generic AI styling.
- Cream serif with terracotta “editorial” styling.
- Broadsheet-style grid layouts.
- Excessive glows or decorative effects without an interaction purpose.
- Emoji used as a visual system.
- Large billboard-style markers that make the map unreadable.

## Page and component model

Keep responsibilities clear. `MapCanvas` owns experience state; presentational
components should receive focused props and emit user actions.

```text
page.tsx
  └─ MapCanvas
       ├─ Map
       │    ├─ MetroLine and idle MetroLineZap
       │    ├─ StationMarkers
       │    ├─ WalkRoutes and HotspotMarkers
       │    ├─ PlaceLabels
       │    └─ SmoothCamera
       ├─ FactsPanel
       └─ HotspotDeck
```

### Ownership rules

- `MapCanvas` manages the selected station, loaded places, active place,
  ranking mode, camera intent, and home-versus-selected chrome.
- `MetroLine` renders route geometry and its layered visual treatment.
- `StationMarkers` decides whether station affordances are visible and renders
  the selected-station state.
- `WalkRoutes` and `HotspotMarkers` appear only once nearby places are loaded.
- `SmoothCamera` owns eased camera updates so that map movement stays
  predictable and interruptible.
- `FactsPanel` belongs to the idle/home experience only.
- `HotspotDeck` is the selected-station experience, with a mode toggle and
  horizontally browsable place cards.

Avoid duplicating selection state inside marker, deck, or camera components.

## Data model

Keep stable local data separate from API-derived place data.

### Metro data

Use `src/data/kochi-metro.ts` for stations and route geometry. Each station
must include a per-station `searchRadiusM`; a single radius is not accurate
enough for the corridor.

Suggested radius ranges:

| Station context | Radius |
| --- | --- |
| Dense core | About 1,400 m |
| Interchange or city hub | 1,700–1,900 m |
| Outer station | 2,300–2,600 m |

Build `METRO_LINE_PATH` from station data whenever practical so station edits
flow through to the displayed route.

### Hotspot data

Use `src/data/hotspots.ts` for the client-facing `Hotspot` shape, place kinds,
tags, and `mapsWalkingRouteUrl` generation. A hotspot should retain the real
place coordinates returned by the source; never fabricate latitude/longitude
to make a visual look better.

Define a controlled set of place kinds and render them through
`PlaceKindIcon`. Keep pins small, approximately 22 px, so a selected station
and its routes remain legible.

### Facts data

Use `src/data/metro-facts.ts` for the rotating facts in the home state. Facts
should be brief, verifiable, and visually secondary to the map.

## API contracts

### Nearby places

`GET /api/places/nearby` must return both ranking views from one Places fetch:

```ts
{
  rated: Hotspot[];
  closest: Hotspot[];
}
```

- Rank `rated` by a rating-aware score such as `rating × log(reviewCount)`.
- Rank `closest` by walking minutes, not straight-line distance.
- Keep the two arrays distinct; they answer different user questions.
- The client switches between the already-loaded arrays using `spotMode`.
- Do not trigger another network request just because the user changes tabs.

Handle missing photos, ratings, review counts, or walking data gracefully.
Omit or de-emphasize incomplete values instead of displaying invented values.

### Photo proxy

`GET /api/places/photo` proxies place images so the client uses a stable,
controlled URL. Validate incoming photo references, avoid exposing secrets,
and return an intentional fallback for unavailable images.

### Maps key route

`GET /api/maps/key` is the only route that supplies the Maps JavaScript key to
the browser. Keep it narrowly scoped and ensure environment files remain
ignored by Git.

## Interaction behavior

### Home and idle state

- Make the map the dominant composition.
- Show the blue line as a soft, living ribbon.
- Run a small idle zap from the start of the blue line to the end and back.
- Keep stations tucked into the line until the map reaches approximately zoom
  13.2 or the user interacts with the line.
- Show home facts and brand chrome without obscuring important map geography.

### Selecting a station

- Softly hide home chrome rather than abruptly removing it.
- Fade the blue line enough to make the selected station and nearby pins easy
  to locate.
- Add radiating waves and a stronger glow to the selected station.
- Open the hotspot deck and its `Top rated` / `Closest` mode toggle without a
  theatrical loading or route-animation delay.
- On dismissal or a safe click-away, return to the corridor overview with a
  smooth camera transition and restore home chrome softly.

### Camera behavior

- Use eased center and zoom changes, such as `easeInOutCubic`.
- Never use a hard `fitBounds` cut for normal station selection.
- Zoom to roughly 16 for a selected station.
- Apply deck-aware camera padding: the selected focus must sit above the
  bottom carousel, not behind it.
- When the active card changes, debounce a pan to its pin. Do not restart a
  zoom animation for every update or Places response.
- Do not re-zoom when nearby places finish loading; that double jump feels
  broken.

### Deck behavior

- `Top rated` and `Closest` are modes over the same loaded result set.
- The active card stays crisp; adjacent cards may be subtly blurred.
- Avoid scaling cards in a way that clips or displaces badges.
- Synchronize scrolling carefully. While centering a card programmatically,
  temporarily lock scroll-derived state so `scrollIntoView` and manual swipes
  do not fight each other.
- `Create Route` opens Google Maps walking directions in a new tab.

## Map rendering practices

### Metro lines

- Render the blue line in layers: aura, mid, core, and highlight.
- Keep its glow legible but controlled; the ribbon should feel alive, not
  fluorescent.
- Render the pink line as a softer future-service element.
- Fade the active line on station selection, then restore it on dismissal.
- Animate the idle zap along the blue line and fade it out on selection.

### Overlays and animation

- Put overlay styling in `src/app/globals.css` when it is shared by station
  markers, pins, zaps, or beams.
- Use `OverlayView` with `createPortal` for visuals that must follow a
  latitude/longitude position, including station markers, place pins, walking
  routes, and the line zap.
- Google map polylines do not receive useful CSS transitions. Animate opacity
  through a hook such as `useLineFade` or with `requestAnimationFrame`.
- Clean up animation frames, timeouts, listeners, and debounced work when a
  component unmounts or selection changes.

## Common implementation workflows

### Add or tune a station

1. Update `KOCHI_METRO_STATIONS` in `src/data/kochi-metro.ts`.
2. Confirm its coordinate comes from a reliable source.
3. Set `searchRadiusM` based on local density and walking context.
4. Verify the station appears correctly in `METRO_LINE_PATH`.
5. Check that its selected camera position clears the deck.

### Change nearby-place ranking

1. Update `src/app/api/places/nearby/route.ts`.
2. Preserve the `rated` and `closest` response fields.
3. Keep one request per selected station context.
4. Verify changing the mode in `MapCanvas` uses existing results.
5. Check the order with real results containing both high-review and nearby
   places.

### Modify map UI

1. Start with existing shared styles in `src/app/globals.css`.
2. Use a coordinate-aware overlay for map-bound elements.
3. Keep marker footprints small and preserve route readability.
4. Test home, zoomed, station-selected, and deck-open states.
5. Test both pointer and touch interaction before considering the change done.

## Quality checklist

Before handing off a map-related change, verify the following:

- The idle screen shows a soft blue line and a moving zap.
- Stations remain visually quiet until zoom or line interaction.
- Selecting a station fades the line and highlights that station with waves.
- The deck and ranking toggle appear without blocking the selected map focus.
- `Top rated` and `Closest` show different, correctly ranked lists.
- Swiping cards pans the map to the related pin without camera thrashing.
- The selected pin stays visible above the deck.
- `Create Route` opens walking directions in a new tab.
- Dismissal restores the home experience smoothly.
- No Maps key or other secret appears in source control or browser-visible
  application data beyond the intended key endpoint.
- `npm run lint` passes; run `npm run build` before broader releases.

## Git and commit conventions

Use short, sentence-case commits that express one intent. When asked to commit
changes “one by one,” make one-file commits rather than bundling unrelated
work.

Example:

```text
Add idle glowing zap that rides the Blue Line end to end.
```

If a push is rejected because the remote has an initial README commit, rebase
onto `origin/main` with `git pull --rebase origin main`, resolve only the
relevant conflict, and then push. Do not force-push `main` unless explicitly
asked.

## Decision filter

When the specification does not answer a design or implementation question,
choose the option that best satisfies these priorities, in order:

1. Makes the experience feel specific to Kochi Metro.
2. Keeps map geography and the selected station readable.
3. Makes exploration feel calm, direct, and responsive.
4. Preserves real place data and protects secrets.
5. Adds the least complexity consistent with the above.
