import { NextRequest, NextResponse } from "next/server";
import {
  ALL_MAP_STATIONS,
  stationSearchRadius,
} from "@/data/kochi-metro";
import {
  mapsWalkingPlanUrl,
  type Hotspot,
} from "@/data/hotspots";

export const runtime = "nodejs";

const REQUEST_TIMEOUT_MS = 12000;
const INTERESTS = [
  "any",
  "food",
  "social",
  "culture",
  "outdoors",
  "shopping",
  "entertainment",
  "sports",
  "wellness",
] as const;

type Interest = (typeof INTERESTS)[number];

interface SideQuestIntent {
  stationId: string;
  interests: Interest[];
  maxWalkMinutes: number | null;
  maxPriceLevel: number | null;
  openByHour: number | null;
  needsClarification: boolean;
  reply: string;
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface NearbyResponse {
  all?: Hotspot[];
  rated?: Hotspot[];
  closest?: Hotspot[];
  error?: string;
}

const intentSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    stationId: { type: "string" },
    interests: {
      type: "array",
      items: { type: "string", enum: INTERESTS },
      minItems: 1,
      maxItems: 4,
    },
    maxWalkMinutes: { type: ["integer", "null"] },
    maxPriceLevel: { type: ["integer", "null"] },
    openByHour: { type: ["integer", "null"] },
    needsClarification: { type: "boolean" },
    reply: { type: "string" },
  },
  required: [
    "stationId",
    "interests",
    "maxWalkMinutes",
    "maxPriceLevel",
    "openByHour",
    "needsClarification",
    "reply",
  ],
} as const;

function stationContext() {
  return ALL_MAP_STATIONS.filter((station) => station.status === "operational")
    .map((station) => `${station.id}: ${station.name}`)
    .join("\n");
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

async function parseIntent(
  apiKey: string,
  message: string,
  selectedStationId: string | null,
  history: HistoryMessage[],
) {
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      store: false,
      max_output_tokens: 450,
      instructions: `You are the Side Quests planner for a Kochi Metro discovery map.
Translate the user's request into strict filters. Never invent a station ID.
Use only the station IDs listed below. If the user does not provide a station,
use the selected station when one exists. If neither exists, set stationId to
an empty string and needsClarification to true.

Interest meanings:
- food: cafes, restaurants, bakeries, dessert
- social: bars, nightlife, karaoke, live music, comedy, breweries
- culture: museums, galleries, libraries, theaters, concerts
- outdoors: parks, gardens, plazas, viewpoints, attractions
- shopping: malls, markets, thrift, gift, clothing, bookstores
- entertainment: movies, bowling, arcades, aquariums, amusement
- sports: gyms, fitness, sports clubs, pools, active experiences
- wellness: gyms, fitness, spas, calm restorative places

Price levels are 0 free, 1 cheap, 2 moderate, 3 expensive, 4 very expensive.
Convert phrases such as cheap, budget, and low-cost to 1. Convert “open until
9pm” to openByHour 21. Keep reply short, friendly, and specific to the request.
Station IDs:
${stationContext()}

Selected station ID: ${selectedStationId ?? "none"}`,
      input: [
        ...history.slice(-6),
        { role: "user", content: message },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "side_quest_intent",
          strict: true,
          schema: intentSchema,
        },
      },
    }),
  });

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Side Quests AI request failed");
  }

  const outputText =
    data.output_text ??
    data.output
      ?.flatMap((item) => item.content ?? [])
      .find((part) => part.type === "output_text")?.text;
  if (!outputText) throw new Error("Side Quests AI returned no plan");
  return JSON.parse(outputText) as SideQuestIntent;
}

function interestMatches(hotspot: Hotspot, interests: Interest[]) {
  if (interests.includes("any")) return true;
  const tag = hotspot.tag;
  const kind = hotspot.kind;
  return interests.some((interest) => {
    if (interest === "food") {
      return ["cafe", "restaurant", "dessert"].includes(kind);
    }
    if (interest === "social") {
      return kind === "music" || tag === "Social Spot" || tag === "Live Music";
    }
    if (interest === "culture") {
      return ["art", "books"].includes(kind) || tag === "Culture Fix";
    }
    if (interest === "outdoors") {
      return kind === "park" || tag === "Outdoor Hang" || tag === "Rooftop Views";
    }
    if (interest === "shopping") {
      return kind === "shop";
    }
    if (interest === "entertainment") {
      return kind === "movie" || tag === "Play Time";
    }
    if (interest === "sports" || interest === "wellness") {
      return tag === "Wellness" || tag === "Play Time";
    }
    return true;
  });
}

function priceMatches(hotspot: Hotspot, maxPriceLevel: number | null) {
  return maxPriceLevel == null ||
    (hotspot.priceLevel != null && hotspot.priceLevel <= maxPriceLevel);
}

function toMinutes(hour: number, meridiem: string) {
  const normalized = hour % 12;
  return normalized + (meridiem.toUpperCase() === "PM" ? 12 : 0);
}

function openByMatches(hotspot: Hotspot, openByHour: number | null) {
  if (openByHour == null) return true;
  if (!hotspot.openingHours?.length) return false;

  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date());
  const today = hotspot.openingHours.find((line) =>
    line.toLowerCase().startsWith(weekday.toLowerCase()),
  );
  if (!today || /open 24 hours/i.test(today)) return Boolean(today);
  if (/closed/i.test(today)) return false;

  const times = [...today.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)];
  if (times.length < 2) return false;
  const first = toMinutes(Number(times[0][1]), times[0][3]);
  let closing = toMinutes(
    Number(times[times.length - 1][1]),
    times[times.length - 1][3],
  );
  if (closing < first) closing += 24 * 60;
  return closing >= openByHour * 60;
}

function rankMatches(spots: Hotspot[]) {
  return [...spots]
    .sort((a, b) => {
      const aScore = (a.rating ?? 0) * Math.log10((a.ratingCount ?? 0) + 12);
      const bScore = (b.rating ?? 0) * Math.log10((b.ratingCount ?? 0) + 12);
      return bScore - aScore || a.walkMins - b.walkMins;
    })
    .slice(0, 6);
}

function stationById(id: string) {
  return ALL_MAP_STATIONS.find(
    (station) => station.id === id && station.status === "operational",
  );
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server" },
      { status: 500 },
    );
  }

  try {
    const body = (await request.json()) as {
      message?: string;
      selectedStationId?: string | null;
      history?: HistoryMessage[];
    };
    const message = body.message?.trim();
    if (!message || message.length > 1200) {
      return NextResponse.json(
        { error: "Message is required and must be under 1200 characters" },
        { status: 400 },
      );
    }

    const selectedStation = body.selectedStationId
      ? stationById(body.selectedStationId)
      : undefined;
    const history = Array.isArray(body.history)
      ? body.history.filter(
          (item): item is HistoryMessage =>
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string",
        )
      : [];
    const intent = await parseIntent(
      apiKey,
      message,
      selectedStation?.id ?? null,
      history,
    );
    const station = stationById(intent.stationId) ?? selectedStation;

    if (!station || intent.needsClarification) {
      return NextResponse.json({
        intent,
        stationId: station?.id ?? null,
        spots: [],
        planUrl: null,
        assistantMessage:
          intent.reply || "Which Kochi Metro station should we start from?",
      });
    }

    const nearbyUrl = new URL("/api/places/nearby", request.url);
    nearbyUrl.searchParams.set("lat", String(station.lat));
    nearbyUrl.searchParams.set("lng", String(station.lng));
    nearbyUrl.searchParams.set("stationId", station.id);
    nearbyUrl.searchParams.set("radius", String(stationSearchRadius(station)));
    const nearbyResponse = await fetchWithTimeout(nearbyUrl, {
      headers: { "x-side-quest-request": "1" },
    });
    const nearby = (await nearbyResponse.json()) as NearbyResponse;
    if (!nearbyResponse.ok) {
      throw new Error(nearby.error ?? "Could not load nearby places");
    }

    const candidates = nearby.all ?? nearby.rated ?? nearby.closest ?? [];
    const matches = rankMatches(
      candidates.filter(
        (spot) =>
          interestMatches(spot, intent.interests) &&
          (intent.maxWalkMinutes == null ||
            spot.walkMins <= intent.maxWalkMinutes) &&
          priceMatches(spot, intent.maxPriceLevel) &&
          openByMatches(spot, intent.openByHour),
      ),
    );
    const planUrl = mapsWalkingPlanUrl(
      { lat: station.lat, lng: station.lng },
      matches,
    );
    const assistantMessage = matches.length
      ? `${intent.reply} I found ${matches.length} ${matches.length === 1 ? "spot" : "spots"} near ${station.name}: ${matches.map((spot) => spot.name).join(", ")}.`
      : `I couldn't find a match near ${station.name} with those filters. Try widening the walk, price, or opening-time limit.`;

    return NextResponse.json({
      intent,
      stationId: station.id,
      spots: matches,
      planUrl: matches.length ? planUrl : null,
      assistantMessage,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Side Quest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
