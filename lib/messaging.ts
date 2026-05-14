import { defineExtensionMessaging } from "@webext-core/messaging";
import type { LyricsResult, SearchHit } from "./lyrics/types";

// Protocol for content script ↔ background communication.
// Background does the fetching (CORS-free, central cache, hides API keys
// from the page context).
interface ProtocolMap {
	fetchLyrics(data: { artist: string; title: string }): LyricsResult | null;
	searchLyrics(data: { query: string }): SearchHit[];
	fetchById(data: { hit: SearchHit }): LyricsResult | null;
	// Fire-and-forget warm-up. Caller doesn't await the network roundtrip,
	// but the background populates its cache so a subsequent fetchLyrics
	// returns instantly.
	prefetchLyrics(data: { artist: string; title: string }): void;
}

export const { sendMessage, onMessage } =
	defineExtensionMessaging<ProtocolMap>();
