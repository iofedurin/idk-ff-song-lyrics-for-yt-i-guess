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

	// Firefox event-page background has DOMParser; Chrome MV3 service worker
	// does not. Pick the parser that works in this runtime.
	const parsed =
		typeof DOMParser !== "undefined"
			? extractViaDom(html)
			: extractViaRegex(html);
	if (!parsed.text) return null;

	let artist = meta?.artist ?? "";
	let title = meta?.title ?? "";
	if (!artist || !title) {
		// Genius og:title is "<Song> by <Artist> | Genius"
		const m = parsed.ogTitle?.match(/^(.+?)\s+by\s+(.+?)(?:\s+\|.*)?$/);
		if (m) {
			title ||= m[1];
			artist ||= m[2];
		}
	}

	return {
		artist,
		title,
		plainLyrics: parsed.text,
		source: "genius",
		sourceUrl: url,
	};
}

interface Parsed {
	text: string;
	ogTitle: string | null;
}

function extractViaDom(html: string): Parsed {
	const doc = new DOMParser().parseFromString(html, "text/html");
	const containers = doc.querySelectorAll(
		'[data-lyrics-container="true"]',
	) as NodeListOf<HTMLElement>;
	const parts: string[] = [];
	for (const c of containers) {
		const clone = c.cloneNode(true) as HTMLElement;
		// Strip non-lyrics decorations (header, contributors, "Read More" button).
		for (const ex of clone.querySelectorAll(
			'[data-exclude-from-selection="true"]',
		)) {
			ex.remove();
		}
		for (const br of clone.querySelectorAll("br")) {
			br.replaceWith("\n");
		}
		parts.push(clone.textContent ?? "");
	}
	const text = parts
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	const ogTitle =
		doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ??
		null;
	return { text, ogTitle };
}

// Service-worker fallback: no DOM. Walk the raw HTML balancing <div> opens
// and closes so nested divs (Genius packs ~14 inside each lyrics container)
// don't truncate the match. Strip data-exclude-from-selection sub-blocks
// the same way before tag-stripping the remainder.
function extractViaRegex(html: string): Parsed {
	const containerOpen =
		/<div[^>]*\bdata-lyrics-container=(?:"true"|'true'|true)\b[^>]*>/gi;
	const parts: string[] = [];
	let m: RegExpExecArray | null = containerOpen.exec(html);
	while (m !== null) {
		const end = findMatchingDivClose(html, m.index + m[0].length);
		if (end === -1) break;
		let inner = html.slice(m.index + m[0].length, end);
		inner = stripExcludedBlocks(inner);
		inner = inner.replace(/<br\s*\/?>/gi, "\n");
		inner = inner.replace(/<[^>]+>/g, "");
		inner = decodeEntities(inner);
		parts.push(inner);
		containerOpen.lastIndex = end + 6; // past "</div>"
		m = containerOpen.exec(html);
	}
	const text = parts
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();

	const ogMatch = html.match(
		/<meta[^>]+property=["']og:title["'][^>]*\bcontent=["']([^"']+)["']/i,
	);
	return { text, ogTitle: ogMatch?.[1] ?? null };
}

// Given the index just inside an open <div ...>, find the index of the
// matching </div> by counting nested opens/closes. Returns -1 if unmatched.
function findMatchingDivClose(html: string, from: number): number {
	let depth = 1;
	let i = from;
	while (i < html.length) {
		const open = html.indexOf("<div", i);
		const close = html.indexOf("</div", i);
		if (close === -1) return -1;
		if (open !== -1 && open < close) {
			depth++;
			i = open + 4;
		} else {
			depth--;
			if (depth === 0) return close;
			i = close + 5;
		}
	}
	return -1;
}

function stripExcludedBlocks(html: string): string {
	const open =
		/<div[^>]*\bdata-exclude-from-selection=(?:"true"|'true'|true)\b[^>]*>/gi;
	let out = html;
	let m: RegExpExecArray | null = open.exec(out);
	while (m !== null) {
		const end = findMatchingDivClose(out, m.index + m[0].length);
		if (end === -1) break;
		out = out.slice(0, m.index) + out.slice(end + 6);
		open.lastIndex = m.index;
		m = open.exec(out);
	}
	return out;
}

function decodeEntities(s: string): string {
	return s
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
		.replace(/&#x([0-9a-f]+);/gi, (_, n) =>
			String.fromCodePoint(parseInt(n, 16)),
		);
}
