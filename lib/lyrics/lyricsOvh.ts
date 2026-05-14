import type { Provider } from "./types";

// lyrics.ovh has only an exact-match lookup endpoint:
//   GET /v1/{artist}/{title}
// No search, no track IDs. We expose it as a fallback for English songs
// where LRCLib missed.

export const lyricsOvhProvider: Provider = {
	id: "lyricsOvh",

	async fetchByExact(artist, title) {
		if (!artist || !title) return null;
		const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(
			title,
		)}`;
		const res = await fetch(url);
		if (!res.ok) return null;
		const j = (await res.json()) as { lyrics?: string; error?: string };
		const text = j.lyrics?.trim();
		if (!text) return null;
		return {
			artist,
			title,
			plainLyrics: text,
			source: "lyricsOvh",
		};
	},

	async search() {
		return [];
	},

	async fetchById() {
		return null;
	},
};
