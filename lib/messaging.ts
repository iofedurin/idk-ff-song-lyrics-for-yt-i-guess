import { defineExtensionMessaging } from "@webext-core/messaging";
import type { LyricsResult, SearchHit } from "./lyrics/types";

// Protocol for content script ↔ background communication.
// Background does the fetching (CORS-free, central cache, hides API keys
// from the page context).
interface ProtocolMap {
	fetchLyrics(data: { artist: string; title: string }): LyricsResult | null;
	searchLyrics(data: { query: string }): SearchHit[];
	fetchById(data: { hit: SearchHit }): LyricsResult | null;
}

export const { sendMessage, onMessage } =
	defineExtensionMessaging<ProtocolMap>();
