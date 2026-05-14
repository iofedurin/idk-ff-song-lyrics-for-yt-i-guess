import { makeGeniusProvider } from "./genius";
import { lrclibProvider } from "./lrclib";
import { lyricsOvhProvider } from "./lyricsOvh";
import type { LyricsResult, Provider, ProviderId, SearchHit } from "./types";

export interface ProviderConfig {
	preferredOrder: ProviderId[];
	geniusApiKey: string | null;
}

function buildProviders(cfg: ProviderConfig): Provider[] {
	const all: Provider[] = [lrclibProvider, lyricsOvhProvider];
	if (cfg.geniusApiKey) all.push(makeGeniusProvider(cfg.geniusApiKey));

	const ordered: Provider[] = [];
	for (const id of cfg.preferredOrder) {
		const p = all.find((x) => x.id === id);
		if (p && !ordered.includes(p)) ordered.push(p);
	}
	// Append any providers not mentioned in preferredOrder (e.g. Genius newly added)
	for (const p of all) if (!ordered.includes(p)) ordered.push(p);
	return ordered;
}

export async function fetchLyrics(
	artist: string,
	title: string,
	cfg: ProviderConfig,
): Promise<LyricsResult | null> {
	for (const p of buildProviders(cfg)) {
		try {
			const r = await p.fetchByExact(artist, title);
			if (r) return r;
		} catch {
			// try next provider
		}
	}
	return null;
}

export async function searchLyrics(
	query: string,
	cfg: ProviderConfig,
): Promise<SearchHit[]> {
	const results = await Promise.all(
		buildProviders(cfg).map(async (p) => {
			try {
				return await p.search(query);
			} catch {
				return [];
			}
		}),
	);
	return results.flat();
}

export async function fetchById(
	hit: SearchHit,
	cfg: ProviderConfig,
): Promise<LyricsResult | null> {
	const provider = buildProviders(cfg).find((p) => p.id === hit.providerId);
	if (!provider) return null;
	try {
		return await provider.fetchById(hit.externalId);
	} catch {
		return null;
	}
}
