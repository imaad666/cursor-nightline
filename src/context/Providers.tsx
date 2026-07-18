"use client";

import { APIProvider } from "@vis.gl/react-google-maps";
import Image from "next/image";
import { useEffect, useState } from "react";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [googleMapsKey, setGoogleMapsKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchMapsKey() {
      try {
        const response = await fetch("/api/maps/key");
        if (response.ok) {
          const data = await response.json();
          setGoogleMapsKey(data.apiKey);
        } else {
          console.error("Failed to fetch Google Maps API key");
        }
      } catch (error) {
        console.error("Error fetching Google Maps API key:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMapsKey();
  }, []);

  if (isLoading) {
    return (
      <div className="map-loader relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#FFD54F] px-6 text-center text-black">
        <div className="map-loader-halftone pointer-events-none absolute inset-0" />
        <div className="relative flex max-w-sm flex-col items-center">
          <Image
            src="/openai-mark.png"
            alt="OpenAI"
            width={1280}
            height={1280}
            className="map-loader-logo h-24 w-24 object-contain sm:h-28 sm:w-28"
            priority
          />
          <p className="mt-7 text-sm font-bold uppercase tracking-wide">
            Kochi Side Quests Loading..
          </p>
        </div>
      </div>
    );
  }

  if (!googleMapsKey) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#FFD54F] px-6 text-black">
        <div className="max-w-sm border-2 border-black bg-[#FFD54F] p-5 shadow-[4px_4px_0_#000]">
          <h1 className="mb-2 text-xl font-bold tracking-tight">Add your Maps key</h1>
          <p className="text-sm leading-relaxed text-black/70">
            Put{" "}
            <code className="bg-black/10 px-1 py-0.5 text-[13px]">
              GOOGLE_MAPS_KEY
            </code>{" "}
            in{" "}
            <code className="bg-black/10 px-1 py-0.5 text-[13px]">.env.local</code>{" "}
            and restart.
          </p>
        </div>
      </div>
    );
  }

  return <APIProvider apiKey={googleMapsKey}>{children}</APIProvider>;
}
