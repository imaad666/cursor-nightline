"use client";

import { useEffect, useState } from "react";
import type { Hotspot } from "@/data/hotspots";

export interface SideQuestPlan {
  stationId: string;
  spots: Hotspot[];
  planUrl: string | null;
  assistantMessage: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SideQuestChatProps {
  selectedStationId: string | null;
  openRequest?: number;
  onPlan: (plan: SideQuestPlan) => void;
}

const STARTER_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Tell me your vibe, budget, walking limit, or closing time. I’ll turn it into a Kochi side quest.",
};

export default function SideQuestChat({
  selectedStationId,
  openRequest = 0,
  onPlan,
}: SideQuestChatProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER_MESSAGE]);
  const [lastPlanUrl, setLastPlanUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (openRequest > 0) setOpen(true);
  }, [openRequest]);

  useEffect(() => {
    if (selectedStationId) setOpen(false);
  }, [selectedStationId]);

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/side-quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          selectedStationId,
          history: messages.slice(-6),
        }),
      });
      const data = (await response.json()) as {
        assistantMessage?: string;
        stationId?: string | null;
        spots?: Hotspot[];
        planUrl?: string | null;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Side Quest failed");

      const assistantMessage =
        data.assistantMessage ?? "I couldn’t shape that into a side quest yet.";
      setMessages((current) => [
        ...current,
        { role: "assistant", content: assistantMessage },
      ]);
      setLastPlanUrl(data.planUrl ?? null);
      if (data.stationId && data.spots?.length) {
        onPlan({
          stationId: data.stationId,
          spots: data.spots,
          planUrl: data.planUrl ?? null,
          assistantMessage,
        });
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Side Quest failed",
      );
    } finally {
      setLoading(false);
    }
  };

  if (selectedStationId) return null;

  return (
    <div className={`sidequest-shell ${open ? "is-open" : ""}`}>
      {open && (
        <section className="sidequest-panel comic-panel" aria-label="Side Quests chat">
          <header className="sidequest-header">
            <div>
              <p className="sidequest-kicker">Side Quests planner</p>
              <h2>Make a move.</h2>
            </div>
            <button
              type="button"
              className="sidequest-close"
              onClick={() => setOpen(false)}
              aria-label="Close Side Quests chat"
            >
              ×
            </button>
          </header>

          <div className="sidequest-messages" aria-live="polite">
            {messages.map((item, index) => (
              <div
                key={`${item.role}-${index}`}
                className={`sidequest-message ${item.role === "user" ? "is-user" : "is-assistant"}`}
              >
                {item.content}
              </div>
            ))}
            {loading && (
              <div className="sidequest-message is-assistant sidequest-thinking">
                Searching the line…
              </div>
            )}
          </div>

          {lastPlanUrl && (
            <a
              href={lastPlanUrl}
              target="_blank"
              rel="noreferrer"
              className="sidequest-plan-link"
            >
              Open generated Google Maps plan
            </a>
          )}

          {error && <p className="sidequest-error">{error}</p>}

          <form className="sidequest-form" onSubmit={sendMessage}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Try: cheap sports near Kaloor, open till 9"
              aria-label="Describe your side quest"
              maxLength={1200}
            />
            <button type="submit" disabled={loading || !message.trim()}>
              {loading ? "…" : "Go"}
            </button>
          </form>
        </section>
      )}

      {!open && (
        <button
          type="button"
          className="sidequest-launcher comic-panel"
          onClick={() => setOpen(true)}
          aria-label="Open Customize your own sidequest chat"
        >
          <span className="sidequest-launcher-dot" />
          Customize your own sidequest
        </button>
      )}
    </div>
  );
}
