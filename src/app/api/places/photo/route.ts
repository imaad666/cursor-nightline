import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Maps API key not configured" },
      { status: 500 },
    );
  }

  const name = request.nextUrl.searchParams.get("name");
  const maxWidthPx = Math.min(
    1600,
    Math.max(100, Number(request.nextUrl.searchParams.get("maxWidthPx") ?? 800)),
  );

  if (!name || !name.startsWith("places/")) {
    return NextResponse.json({ error: "Invalid photo name" }, { status: 400 });
  }

  // Photo resource names contain / — fetch media with key server-side
  const url = new URL(
    `https://places.googleapis.com/v1/${name}/media`,
  );
  url.searchParams.set("maxWidthPx", String(maxWidthPx));
  url.searchParams.set("key", apiKey);

  try {
    const res = await fetch(url.toString(), {
      redirect: "follow",
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Photo fetch failed", detail: text.slice(0, 200) },
        { status: res.status },
      );
    }

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
