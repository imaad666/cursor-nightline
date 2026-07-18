import { NextRequest, NextResponse } from "next/server";
import {
  distanceMetersBetween,
  kindFromTag,
  tagFromPlaceTypes,
  walkMinsBetween,
  type Hotspot,
} from "@/data/hotspots";
import {
  ALL_MAP_STATIONS,
  stationSearchRadius,
} from "@/data/kochi-metro";

export const runtime = "nodejs";

const DATE_TYPES = [
  "cafe",
  "coffee_shop",
  "restaurant",
  "movie_theater",
  "park",
  "bakery",
  "ice_cream_shop",
  "dessert_shop",
  "bar",
  "museum",
  "art_gallery",
  "book_store",
  "tourist_attraction",
  "shopping_mall",
  "amusement_center",
  "bowling_alley",
] as const;

const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;

type NearbyPayload = {
  rated: Hotspot[];
  closest: Hotspot[];
  hotspots: Hotspot[];
};

const nearbyCache = new Map<
  string,
  { expiresAt: number; payload: NearbyPayload }
>();
const rateLimit = new Map<string, { startedAt: number; count: number }>();

interface PlacesNearbyResponse {
  places?: Array<{
    id?: string;
    types?: string[];
    primaryType?: string;
    location?: { latitude?: number; longitude?: number };
    rating?: number;
    userRatingCount?: number;
    displayName?: { text?: string };
    shortFormattedAddress?: string;
    editorialSummary?: { text?: string };
    googleMapsUri?: string;
    photos?: Array<{
      name?: string;
      authorAttributions?: Array<{ displayName?: string }>;
    }>;
  }>;
  error?: { message?: string; status?: string };
}

interface RouteMatrixElement {
  destinationIndex?: number;
  duration?: string;
  condition?: string;
}

function parseDurationSeconds(duration?: string) {
  const seconds = Number(duration?.replace(/s$/, ""));
  return Number.isFinite(seconds) ? seconds : null;
}

async function walkingMinutesFromRoutes(
  apiKey: string,
  origin: { lat: number; lng: number },
  destinations: Array<{ lat: number; lng: number }>,
) {
  if (destinations.length === 0) return new Map<number, number>();

  const waypoint = (point: { lat: number; lng: number }) => ({
    waypoint: {
      location: {
        latLng: {
          latitude: point.lat,
          longitude: point.lng,
        },
      },
    },
  });

  const response = await fetchWithTimeout(
    "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "destinationIndex,duration,condition",
      },
      body: JSON.stringify({
        origins: [waypoint(origin)],
        destinations: destinations.map(waypoint),
        travelMode: "WALK",
      }),
      cache: "no-store",
    },
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `Routes API returned ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const elements: RouteMatrixElement[] = body.trim().startsWith("[")
    ? (JSON.parse(body) as RouteMatrixElement[])
    : body
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as RouteMatrixElement);

  return new Map(
    elements.flatMap((element) => {
      const index = element.destinationIndex;
      const seconds = parseDurationSeconds(element.duration);
      if (
        index == null ||
        seconds == null ||
        element.condition !== "ROUTE_EXISTS"
      ) {
        return [];
      }
      return [[index, Math.max(1, Math.ceil(seconds / 60))] as const];
    }),
  );
}

function scoreRated(h: Hotspot) {
  const rating = h.rating ?? 0;
  const reviews = h.ratingCount ?? 0;
  const quality = rating * Math.log10(reviews + 12);
  const photo = h.image ? 0.35 : 0;
  const walkSweet =
    h.walkMins >= 5 && h.walkMins <= 22 ? 0.2 : h.walkMins < 4 ? -0.35 : 0;
  return quality + photo + walkSweet;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function requestKey(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}

function rateLimited(key: string) {
  const now = Date.now();
  const current = rateLimit.get(key);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateLimit.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

function belongsToStation(hotspot: Hotspot, stationId: string) {
  const operationalStations = ALL_MAP_STATIONS.filter(
    (station) => station.status === "operational",
  );
  const nearest = operationalStations.reduce<{
    id: string;
    distance: number;
  } | null>((closest, station) => {
    const distance = distanceMetersBetween(hotspot, station);
    return !closest || distance < closest.distance
      ? { id: station.id, distance }
      : closest;
  }, null);

  return nearest?.id === stationId;
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = request.nextUrl;
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const stationId = searchParams.get("stationId");
  const stationMeta = ALL_MAP_STATIONS.find(
    (station) => station.id === stationId && station.status === "operational",
  );
  const radiusParam = searchParams.get("radius");
  const requested = radiusParam == null ? null : Number(radiusParam);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return NextResponse.json(
      { error: "Valid lat and lng are required" },
      { status: 400 },
    );
  }

  if (!stationMeta || !stationId) {
    return NextResponse.json(
      { error: "A valid operational stationId is required" },
      { status: 400 },
    );
  }

  if (
    radiusParam != null &&
    (!Number.isInteger(requested) || requested < 900 || requested > 3000)
  ) {
    return NextResponse.json(
      { error: "radius must be an integer between 900 and 3000" },
      { status: 400 },
    );
  }

  if (distanceMetersBetween({ lat, lng }, stationMeta) > 100) {
    return NextResponse.json(
      { error: "Coordinates must match the selected station" },
      { status: 400 },
    );
  }

  const radius = requested ?? stationSearchRadius(stationMeta);
  const cacheKey = `${stationId}:${radius}`;
  const cached = nearbyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  }

  if (rateLimited(requestKey(request))) {
    return NextResponse.json(
      { error: "Too many nearby-place requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  try {
    const res = await fetchWithTimeout(
      "https://places.googleapis.com/v1/places:searchNearby",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "places.id",
            "places.displayName",
            "places.location",
            "places.types",
            "places.primaryType",
            "places.photos",
            "places.rating",
            "places.userRatingCount",
            "places.shortFormattedAddress",
            "places.editorialSummary",
            "places.googleMapsUri",
          ].join(","),
        },
        body: JSON.stringify({
          includedTypes: [...DATE_TYPES],
          maxResultCount: 20,
          rankPreference: "POPULARITY",
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius,
            },
          },
        }),
        cache: "no-store",
      },
    );

    const data = (await res.json()) as PlacesNearbyResponse;

    if (!res.ok) {
      return NextResponse.json(
        {
          error: data.error?.message ?? "Places Nearby Search failed",
          status: data.error?.status,
        },
        { status: res.status },
      );
    }

    const station = { lat, lng };

    const mapped = (data.places ?? [])
      .map((place) => {
        const placeLat = place.location?.latitude;
        const placeLng = place.location?.longitude;
        if (
          !place.id ||
          placeLat == null ||
          placeLng == null ||
          !place.displayName?.text
        ) {
          return null;
        }

        const photo = place.photos?.[0];
        const image = photo?.name
          ? `/api/places/photo?name=${encodeURIComponent(photo.name)}&maxWidthPx=800`
          : "";

        const tag = tagFromPlaceTypes(place.primaryType, place.types ?? []);
        const blurb =
          place.editorialSummary?.text ??
          place.shortFormattedAddress ??
          `Popular ${tag.toLowerCase()} near the station.`;

        const hotspot: Hotspot = {
          id: place.id,
          stationId,
          name: place.displayName.text,
          tag,
          kind: kindFromTag(tag),
          walkMins: walkMinsBetween(station, { lat: placeLat, lng: placeLng }),
          lat: placeLat,
          lng: placeLng,
          image,
          blurb,
          rating: place.rating,
          ratingCount: place.userRatingCount,
          address: place.shortFormattedAddress,
          mapsUri: place.googleMapsUri,
          photoAttribution: photo?.authorAttributions?.[0]?.displayName,
        };
        return hotspot;
      })
      .filter((h): h is Hotspot => h != null);

    const stationOwned = stationMeta
      ? mapped.filter((hotspot) => belongsToStation(hotspot, stationId))
      : mapped;

    try {
      const routeMinutes = await walkingMinutesFromRoutes(
        apiKey,
        station,
        stationOwned.map((hotspot) => ({ lat: hotspot.lat, lng: hotspot.lng })),
      );
      for (const [index, minutes] of routeMinutes) {
        const hotspot = stationOwned[index];
        if (hotspot) hotspot.walkMins = minutes;
      }
    } catch (err) {
      console.warn("Routes API walking matrix unavailable", err);
    }

    // Top rated — quality first, real short walk preferred
    let ratedPool = stationOwned.filter(
      (h) => h.walkMins >= 3 && h.walkMins <= 28,
    );
    if (ratedPool.length < 3) {
      ratedPool = stationOwned.filter((h) => h.walkMins <= 28);
    }
    const rated = [...ratedPool]
      .sort((a, b) => {
        const diff = scoreRated(b) - scoreRated(a);
        if (Math.abs(diff) > 0.01) return diff;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 5);

    // Closest — nearest walk first, rating as tiebreak
    const closest = [...stationOwned]
      .filter((h) => h.walkMins <= 20)
      .sort((a, b) => {
        const walk = a.walkMins - b.walkMins;
        if (walk !== 0) return walk;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 5);

    const payload: NearbyPayload = {
      rated,
      closest,
      // Back-compat for anything still reading hotspots
      hotspots: rated,
    };
    nearbyCache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=600",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
