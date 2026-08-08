/**
 * useAuctionSSE — Phase 22.3
 *
 * Connects to the SSE stream for a specific auction and patches
 * the local auction state on every bid_placed / auction_updated /
 * auction_ended event.
 *
 * Token is passed as ?token= query param because browsers'
 * EventSource API does not support custom headers.
 *
 * Returns:
 *   connected  — whether SSE is established
 *   lastEvent  — the most recent raw event (for debugging / bid feed)
 *   bids       — live bid feed (newest first, capped at 50)
 */

import { useState, useEffect, useRef, useCallback } from "react";

const API = import.meta.env.VITE_API_URL ?? "";

export interface LiveBidEvent {
  bidNumber: number;
  amount: number;
  userMasked: string;
  currentPool: number;
  bidCount: number;
  participantCount: number;
  currentLeaderMasked: string;
  endsAt: string | null;
  extensionCount: number;
  wasExtended: boolean;
  timestamp: string;
}

export interface AuctionLiveState {
  currentPool: number;
  bidCount: number;
  participantCount: number;
  currentLeaderMasked: string | null;
  endsAt: string | null;
  extensionCount: number;
  status: string;
}

interface UseAuctionSSEOptions {
  auctionId: string | undefined;
  /** Only connect when auction is live */
  enabled?: boolean;
  onBid?: (event: LiveBidEvent) => void;
  onEnded?: () => void;
}

export function useAuctionSSE({
  auctionId,
  enabled = true,
  onBid,
  onEnded,
}: UseAuctionSSEOptions) {
  const [connected, setConnected]     = useState(false);
  const [liveState, setLiveState]     = useState<AuctionLiveState | null>(null);
  const [bids, setBids]               = useState<LiveBidEvent[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);

  const connect = useCallback(() => {
    if (!auctionId || !enabled) return;

    const token = localStorage.getItem("bitzimi_access_token") ?? "";
    const url   = `${API}/api/v1/auctions/${auctionId}/events?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retryCount.current = 0;
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        const type: string = data.type;

        if (type === "initial_state") {
          setLiveState({
            currentPool:         data.currentPool ?? 0,
            bidCount:            data.bidCount ?? 0,
            participantCount:    data.participantCount ?? 0,
            currentLeaderMasked: data.currentLeaderMasked ?? null,
            endsAt:              data.endsAt ?? null,
            extensionCount:      data.extensionCount ?? 0,
            status:              data.status ?? "live",
          });
          return;
        }

        if (type === "bid_placed") {
          const event: LiveBidEvent = {
            bidNumber:           data.bidNumber,
            amount:              data.amount,
            userMasked:          data.currentLeaderMasked,
            currentPool:         data.currentPool,
            bidCount:            data.bidCount,
            participantCount:    data.participantCount,
            currentLeaderMasked: data.currentLeaderMasked,
            endsAt:              data.endsAt,
            extensionCount:      data.extensionCount,
            wasExtended:         data.wasExtended,
            timestamp:           data.timestamp,
          };

          setLiveState((prev) => ({
            ...( prev ?? { status: "live", extensionCount: 0 }),
            currentPool:         event.currentPool,
            bidCount:            event.bidCount,
            participantCount:    event.participantCount,
            currentLeaderMasked: event.currentLeaderMasked,
            endsAt:              event.endsAt,
            extensionCount:      event.extensionCount,
          }));

          setBids((prev) => [event, ...prev].slice(0, 50));
          onBid?.(event);
        }

        if (type === "auction_ended" || data.status === "ended") {
          setLiveState((prev) => prev ? { ...prev, status: "ended" } : null);
          onEnded?.();
        }
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;

      // Exponential back-off: 2s, 4s, 8s, max 30s
      const delay = Math.min(2000 * Math.pow(2, retryCount.current), 30_000);
      retryCount.current++;
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [auctionId, enabled, onBid, onEnded]);

  useEffect(() => {
    if (!auctionId || !enabled) return;

    connect();

    return () => {
      esRef.current?.close();
      esRef.current = null;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      setConnected(false);
    };
  }, [auctionId, enabled, connect]);

  return { connected, liveState, bids };
}
