import { NextRequest, NextResponse } from "next/server";
import {
  kindFromTag,
  tagFromPlaceTypes,
  walkMinsBetween,
  type Hotspot,
} from "@/data/hotspots";
import {
  ALL_MAP_STATIONS,
  DEFAULT_SEARCH_RADIUS_M,
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

function scoreRated(h: Hotspot) {
  const rating = h.rating ?? 0;
  const reviews = h.ratingCount ?? 0;
  const quality = rating * Math.log10(reviews + 12);
  const photo = h.image ? 0.35 : 0;
  const walkSweet =
    h.walkMins >= 5 && h.walkMins <= 22 ? 0.2 : h.walkMins < 4 ? -0.35 : 0;
  return quality + photo + walkSweet;
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
  const stationId = searchParams.get("stationId") ?? "station";
  const stationMeta = ALL_MAP_STATIONS.find((s) => s.id === stationId);
  const requested = Number(searchParams.get("radius"));
  const fallback = stationMeta
    ? stationSearchRadius(stationMeta)
    : DEFAULT_SEARCH_RADIUS_M;
  const radius = Math.min(
    3000,
    Math.max(900, Number.isFinite(requested) ? requested : fallback),
  );

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
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
        next: { revalidate: 3600 },
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

    // Top rated — quality first, real short walk preferred
    let ratedPool = mapped.filter(
      (h) => h.walkMins >= 3 && h.walkMins <= 28,
    );
    if (ratedPool.length < 3) {
      ratedPool = mapped.filter((h) => h.walkMins <= 28);
    }
    const rated = [...ratedPool]
      .sort((a, b) => {
        const diff = scoreRated(b) - scoreRated(a);
        if (Math.abs(diff) > 0.01) return diff;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 5);

    // Closest — nearest walk first, rating as tiebreak
    const closest = [...mapped]
      .filter((h) => h.walkMins <= 20)
      .sort((a, b) => {
        const walk = a.walkMins - b.walkMins;
        if (walk !== 0) return walk;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 5);

    return NextResponse.json({
      rated,
      closest,
      // Back-compat for anything still reading hotspots
      hotspots: rated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
