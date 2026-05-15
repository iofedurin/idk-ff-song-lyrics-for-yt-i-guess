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

export interface TestResult {
	providerId: ProviderId;
	enabled: boolean;
	ok: boolean;
	latencyMs: number;
	hasPlain: boolean;
	hasSynced: boolean;
	error?: string;
}

export interface ProviderError {
	providerId: ProviderId;
	message: string;
}

export interface SearchOutcome {
	hits: SearchHit[];
	errors: ProviderError[];
	/** Provider IDs that participated in this search (so the UI can say
	 *  "tried lrclib, lyricsOvh" etc.). */
	attempted: ProviderId[];
}
