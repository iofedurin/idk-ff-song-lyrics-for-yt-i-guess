import type { LyricsResult, Provider, SearchHit } from "./types";

// Genius API returns metadata only. Full lyrics live in HTML on genius.com,
// inside <div data-lyrics-container="true"> blocks. We scrape them.
//
// The provider is constructed lazily with a user-supplied API key. Without
// a key, callers should skip adding it to the provider chain.

interface GeniusSearchResponse {
	response?: {
		hits?: Array<{
			result?: {
				id?: number;
				url?: string;
				title?: string;
				primary_artist?: { name?: string };
			};
		}>;
	};
}

export function makeGeniusProvider(apiKey: string): Provider {
	return {
		id: "genius",

		async fetchByExact(artist, title) {
			if (!artist || !title) return null;
			const hits = await searchHits(`${artist} ${title}`, apiKey);
			if (!hits.length) return null;
			return scrapeLyrics(hits[0].externalId, hits[0]);
		},

		async search(query) {
			return searchHits(query, apiKey);
		},

		async fetchById(externalId) {
			return scrapeLyrics(externalId);
		},
	};
}

async function searchHits(query: string, key: string): Promise<SearchHit[]> {
	const u = new URL("https://api.genius.com/search");
	u.searchParams.set("q", query);
	const res = await fetch(u, {
		headers: { Authorization: `Bearer ${key}` },
	});
	if (!res.ok) return [];
	const j = (await res.json()) as GeniusSearchResponse;
	const raw = j.response?.hits ?? [];
	const hits: SearchHit[] = [];
	for (const h of raw) {
		const url = h.result?.url;
		if (!url) continue;
		hits.push({
			providerId: "genius",
			externalId: url,
			artist: h.result?.primary_artist?.name ?? "",
			title: h.result?.title ?? "",
		});
	}
	return hits.slice(0, 20);
}

async function scrapeLyrics(
	url: string,
	meta?: SearchHit,
): Promise<LyricsResult | null> {
	const res = await fetch(url);
	if (!res.ok) return null;
	const html = await res.text();

	// DOMParser is available in Firefox background pages (MV3 event page).
	const doc = new DOMParser().parseFromString(html, "text/html");
	const containers = doc.querySelectorAll(
		'[data-lyrics-container="true"]',
	) as NodeListOf<HTMLElement>;
	if (!containers.length) return null;

	const parts: string[] = [];
	for (const c of containers) {
		// <br> → newline, then textContent gives reasonable formatting
		const clone = c.cloneNode(true) as HTMLElement;
		for (const br of clone.querySelectorAll("br")) {
			br.replaceWith("\n");
		}
		parts.push(clone.textContent ?? "");
	}
	const text = parts
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	if (!text) return null;

	// Fallback metadata from <meta og:title>: "Song by Artist | Genius"
	let artist = meta?.artist ?? "";
	let title = meta?.title ?? "";
	if (!artist || !title) {
		const og =
			doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
			"";
		const m = og.match(/^(.+?)\s+by\s+(.+?)(?:\s+\|.*)?$/);
		if (m) {
			title ||= m[1];
			artist ||= m[2];
		}
	}

	return {
		artist,
		title,
		plainLyrics: text,
		source: "genius",
		sourceUrl: url,
	};
}
