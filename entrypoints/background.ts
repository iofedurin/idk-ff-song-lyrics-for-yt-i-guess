import { fetchById, fetchLyrics, searchLyrics } from "../lib/lyrics";
import type { ProviderId } from "../lib/lyrics/types";
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

export default defineBackground(() => {
	onMessage("fetchLyrics", async ({ data }) => {
		const cfg = await loadConfig();
		return fetchLyrics(data.artist, data.title, cfg);
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
