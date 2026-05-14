export type ProviderId = "lrclib" | "lyricsOvh" | "genius";

export interface LyricsResult {
	artist: string;
	title: string;
	album?: string;
	plainLyrics: string;
	syncedLyrics?: string;
	source: ProviderId;
	sourceUrl?: string;
}

export interface SearchHit {
	providerId: ProviderId;
	// Opaque to the caller — meaningful only to the provider that emitted it.
	externalId: string;
	artist: string;
	title: string;
	album?: string;
	durationSec?: number;
}

export interface Provider {
	id: ProviderId;
	fetchByExact(artist: string, title: string): Promise<LyricsResult | null>;
	search(query: string): Promise<SearchHit[]>;
	fetchById(externalId: string): Promise<LyricsResult | null>;
}
