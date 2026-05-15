import { defineExtensionMessaging } from "@webext-core/messaging";
import type {
	LyricsResult,
	SearchHit,
	SearchOutcome,
	TestResult,
} from "./lyrics/types";

// Protocol for content script ↔ background communication.
// Background does the fetching (CORS-free, central cache, hides API keys
// from the page context).
interface ProtocolMap {
	fetchLyrics(data: { artist: string; title: string }): LyricsResult | null;
	searchLyrics(data: { query: string }): SearchOutcome;
	fetchById(data: { hit: SearchHit }): LyricsResult | null;
	// Warm-up the background cache so a subsequent fetchLyrics returns
	// instantly. Returns the full result (or null) so the content script
	// can keep it in memory and hand it to the panel on open without a
	// second IPC roundtrip.
	prefetchLyrics(data: { artist: string; title: string }): LyricsResult | null;
	// Probe every available provider with the same test track. Used by the
	// options page to surface per-source latency / availability.
	testProviders(data: { artist: string; title: string }): TestResult[];
}

export const { sendMessage, onMessage } =
	defineExtensionMessaging<ProtocolMap>();
