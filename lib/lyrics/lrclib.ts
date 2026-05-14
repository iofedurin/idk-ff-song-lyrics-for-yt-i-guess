import type { LyricsResult, Provider, SearchHit } from "./types";

const BASE = "https://lrclib.net/api";

interface LrcLibTrack {
	id: number;
	artistName: string;
	trackName: string;
	albumName: string | null;
	duration: number | null;
	plainLyrics: string | null;
	syncedLyrics: string | null;
	instrumental?: boolean;
}

export const lrclibProvider: Provider = {
	id: "lrclib",

	async fetchByExact(artist, title) {
		if (!artist || !title) return null;
		const u = new URL(`${BASE}/get`);
		u.searchParams.set("artist_name", artist);
		u.searchParams.set("track_name", title);
		const res = await fetch(u);
		if (!res.ok) return null;
		const t = (await res.json()) as LrcLibTrack;
		return toResult(t);
	},

	async search(query) {
		const u = new URL(`${BASE}/search`);
		u.searchParams.set("q", query);
		const res = await fetch(u);
		if (!res.ok) return [];
		const arr = (await res.json()) as LrcLibTrack[];
		return arr.slice(0, 25).map(
			(t): SearchHit => ({
				providerId: "lrclib",
				externalId: String(t.id),
				artist: t.artistName,
				title: t.trackName,
				album: t.albumName ?? undefined,
				durationSec: t.duration ?? undefined,
			}),
		);
	},

	async fetchById(externalId) {
		const res = await fetch(`${BASE}/get/${encodeURIComponent(externalId)}`);
		if (!res.ok) return null;
		const t = (await res.json()) as LrcLibTrack;
		return toResult(t);
	},
};

function toResult(t: LrcLibTrack): LyricsResult | null {
	const plain = t.plainLyrics ?? syncedToPlain(t.syncedLyrics ?? "");
	if (!plain.trim()) return null;
	return {
		artist: t.artistName,
		title: t.trackName,
		album: t.albumName ?? undefined,
		plainLyrics: plain,
		syncedLyrics: t.syncedLyrics ?? undefined,
		source: "lrclib",
		sourceUrl: `https://lrclib.net/track/${t.id}`,
	};
}

function syncedToPlain(synced: string): string {
	return synced.replace(/^\[\d+:\d+(?:\.\d+)?\]\s*/gm, "").trim();
}
