import { fetchById, fetchLyrics, searchLyrics } from "../lib/lyrics";
import type { LyricsResult, ProviderId } from "../lib/lyrics/types";
import { onMessage } from "../lib/messaging";
import { geniusApiKeyStorage, preferredProviderStorage } from "../lib/storage";

async function loadConfig() {
	const [geniusApiKey, preferred] = await Promise.all([
		geniusApiKeyStorage.getValue(),
		preferredProviderStorage.getValue(),
	]);
	const all: ProviderId[] = ["lrclib", "lyricsOvh", "genius"];
	const preferredOrder = [preferred, ...all.filter((p) => p !== preferred)];
	return { geniusApiKey, preferredOrder };
}

// LRU cache for exact-match results across the extension's lifetime.
// `null` is cached too — that's a successful "no lyrics available" answer,
// not a transient failure, so we don't want to retry it.
const CACHE_MAX = 50;
const cache = new Map<string, LyricsResult | null>();
// Dedupe concurrent requests for the same key. Without this, opening the
// panel while prefetch is still in flight would double-fetch.
const inflight = new Map<string, Promise<LyricsResult | null>>();

function cacheKey(artist: string, title: string): string {
	return `${artist.toLowerCase()}|${title.toLowerCase()}`;
}

function cacheGet(key: string): LyricsResult | null | undefined {
	if (!cache.has(key)) return undefined;
	const v = cache.get(key);
	// touch (move to MRU end)
	cache.delete(key);
	cache.set(key, v ?? null);
	return v ?? null;
}

function cacheSet(key: string, value: LyricsResult | null) {
	if (cache.has(key)) cache.delete(key);
	cache.set(key, value);
	while (cache.size > CACHE_MAX) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

async function getOrFetch(
	artist: string,
	title: string,
): Promise<LyricsResult | null> {
	const key = cacheKey(artist, title);
	const cached = cacheGet(key);
	if (cached !== undefined) return cached;

	const pending = inflight.get(key);
	if (pending) return pending;

	const cfg = await loadConfig();
	const promise = fetchLyrics(artist, title, cfg)
		.then((r) => {
			cacheSet(key, r);
			return r;
		})
		.finally(() => {
			inflight.delete(key);
		});
	inflight.set(key, promise);
	return promise;
}

export default defineBackground(() => {
	onMessage("fetchLyrics", async ({ data }) => {
		if (!data.artist || !data.title) return null;
		return getOrFetch(data.artist, data.title);
	});

	onMessage("prefetchLyrics", async ({ data }) => {
		if (!data.artist || !data.title) return;
		// Fire-and-forget from the caller's perspective; we still wait here
		// so errors are logged and we don't leave dangling promises.
		try {
			await getOrFetch(data.artist, data.title);
		} catch {
			// swallow — prefetch must not break the foreground UI
		}
	});

	onMessage("searchLyrics", async ({ data }) => {
		const cfg = await loadConfig();
		return searchLyrics(data.query, cfg);
	});

	onMessage("fetchById", async ({ data }) => {
		const cfg = await loadConfig();
		return fetchById(data.hit, cfg);
	});
});
