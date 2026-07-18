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
export const maxDuration = 60;

const PLACE_TYPE_GROUPS = [
  {
    name: "food",
    types: [
      "cafe",
      "coffee_shop",
      "restaurant",
      "bakery",
      "ice_cream_shop",
      "dessert_shop",
      "chocolate_shop",
      "cat_cafe",
      "tea_store",
      "food_court",
      "fine_dining_restaurant",
    ],
  },
  {
    name: "social",
    types: [
      "bar",
      "night_club",
      "live_music_venue",
      "comedy_club",
      "karaoke",
      "cocktail_bar",
      "brewery",
      "brewpub",
      "beer_garden",
      "gastropub",
      "bowling_alley",
      "internet_cafe",
      "event_venue",
    ],
  },
  {
    name: "culture",
    types: [
      "art_gallery",
      "art_museum",
      "art_studio",
      "auditorium",
      "concert_hall",
      "cultural_center",
      "cultural_landmark",
      "history_museum",
      "museum",
      "performing_arts_theater",
      "library",
      "planetarium",
    ],
  },
  {
    name: "activities",
    types: [
      "aquarium",
      "amusement_center",
      "amusement_park",
      "go_karting_venue",
      "indoor_playground",
      "miniature_golf_course",
      "movie_theater",
      "paintball_center",
      "video_arcade",
      "fitness_center",
      "gym",
      "sports_club",
      "sports_complex",
      "swimming_pool",
    ],
  },
  {
    name: "outdoors",
    types: [
      "botanical_garden",
      "city_park",
      "dog_park",
      "garden",
      "hiking_area",
      "national_park",
      "observation_deck",
      "park",
      "picnic_ground",
      "plaza",
      "tourist_attraction",
    ],
  },
  {
    name: "shopping",
    types: [
      "book_store",
      "clothing_store",
      "department_store",
      "farmers_market",
      "flea_market",
      "gift_shop",
      "market",
      "shopping_mall",
      "thrift_store",
    ],
  },
] as const;

const MAX_RESULTS_PER_GROUP = 8;

const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;

type NearbyPayload = {
  rated: Hotspot[];
  closest: Hotspot[];
  all: Hotspot[];
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
    priceLevel?: string;
    regularOpeningHours?: { weekdayDescriptions?: string[] };
    photos?: Array<{
      name?: string;
      authorAttributions?: Array<{ displayName?: string }>;
    }>;
  }>;
  error?: { message?: string; status?: string };
}

type PlaceResult = NonNullable<PlacesNearbyResponse["places"]>[number];

interface RouteMatrixElement {
  destinationIndex?: number;
  duration?: string;
  condition?: string;
}

async function searchNearbyGroup(
  apiKey: string,
  center: { lat: number; lng: number },
  radius: number,
  types: readonly string[],
) {
  const response = await fetchWithTimeout(
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
          "places.priceLevel",
          "places.regularOpeningHours.weekdayDescriptions",
        ].join(","),
      },
      body: JSON.stringify({
        includedTypes: [...types],
        maxResultCount: MAX_RESULTS_PER_GROUP,
        rankPreference: "POPULARITY",
        locationRestriction: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius,
          },
        },
      }),
      cache: "no-store",
    },
  );

  const data = (await response.json()) as PlacesNearbyResponse;
  if (!response.ok) {
    throw new Error(
      data.error?.message ?? "Places Nearby Search failed",
    );
  }
  return data.places ?? [];
}

function parseDurationSeconds(duration?: string) {
  const seconds = Number(duration?.replace(/s$/, ""));
  return Number.isFinite(seconds) ? seconds : null;
}

function normalizePriceLevel(value?: string) {
  const levels: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return value ? levels[value] : undefined;
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

function selectDiverseRated(spots: Hotspot[], limit = 8) {
  const selected: Hotspot[] = [];
  const tagCounts = new globalThis.Map<string, number>();
  const sorted = [...spots].sort((a, b) => {
    const diff = scoreRated(b) - scoreRated(a);
    if (Math.abs(diff) > 0.01) return diff;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });

  for (const spot of sorted) {
    const count = tagCounts.get(spot.tag) ?? 0;
    if (count >= 2) continue;
    selected.push(spot);
    tagCounts.set(spot.tag, count + 1);
    if (selected.length === limit) return selected;
  }

  for (const spot of sorted) {
    if (selected.some((selectedSpot) => selectedSpot.id === spot.id)) continue;
    selected.push(spot);
    if (selected.length === limit) break;
  }
  return selected;
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
    requested != null &&
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
    const groupResults = await Promise.allSettled(
      PLACE_TYPE_GROUPS.map((group) =>
        searchNearbyGroup(apiKey, { lat, lng }, radius, group.types),
      ),
    );
    const placesById = new globalThis.Map<string, PlaceResult>();
    const failures = groupResults.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    for (const result of groupResults) {
      if (result.status !== "fulfilled") continue;
      for (const place of result.value) {
        if (place.id) placesById.set(place.id, place);
      }
    }

    if (placesById.size === 0 && failures.length === PLACE_TYPE_GROUPS.length) {
      const message =
        failures[0]?.reason instanceof Error
          ? failures[0].reason.message
          : "Places Nearby Search failed";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const station = { lat, lng };

    const mapped = [...placesById.values()]
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
          priceLevel: normalizePriceLevel(place.priceLevel),
          openingHours: place.regularOpeningHours?.weekdayDescriptions,
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
    const rated = selectDiverseRated(ratedPool);

    // Closest — nearest walk first, rating as tiebreak
    const closest = [...stationOwned]
      .filter((h) => h.walkMins <= 20)
      .sort((a, b) => {
        const walk = a.walkMins - b.walkMins;
        if (walk !== 0) return walk;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 8);

    const payload: NearbyPayload = {
      rated,
      closest,
      all: stationOwned,
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
