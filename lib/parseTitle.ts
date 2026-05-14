// Pure heuristic: turn a YouTube video title (and optional channel name)
// into a best-guess { artist, title } pair for lyrics lookup.
// No browser APIs here — fully unit-testable.

export interface ParsedTitle {
	artist: string;
	title: string;
}

// Bracketed noise: "(Official Video)", "[Lyrics]", "(4K Remastered 2011)" etc.
const NOISE_INNER =
	"official\\s+music\\s+video|official\\s+video|official\\s+audio|" +
	"official\\s+lyric\\s+video|lyric\\s+video|music\\s+video|" +
	"lyrics?|audio|hd|hq|4k|8k|" +
	"remaster(?:ed)?(?:\\s+\\d{4})?|" +
	"live|acoustic|cover|video|visualizer|m\\/v|" +
	"explicit|clean|radio\\s+edit|extended|" +
	"\\d{4}\\s+remaster";

const NOISE_PATTERNS: RegExp[] = [
	new RegExp(`\\s*\\((?:${NOISE_INNER})\\)`, "gi"),
	new RegExp(`\\s*\\[(?:${NOISE_INNER})\\]`, "gi"),
	// feat./ft. clauses anywhere (kept short so we don't eat into title).
	// \b anchors are critical: without them "ft" matches inside "Daft Punk".
	/\s*[([]?\s*\b(?:feat\.?|ft\.?)\s+[^()[\]]+?[)\]]?(?=\s|$)/gi,
	// trailing pipe and everything after it: "Song | Lyrics Channel"
	/\s*\|.*$/,
];

// Ordered: longer/distinctive separators first so " - " doesn't eat " — ".
const SEPARATORS = [" — ", " – ", " - ", ": ", " by "];

export function parseTitle(
	videoTitle: string,
	channelName?: string,
): ParsedTitle {
	let cleaned = videoTitle;
	for (const re of NOISE_PATTERNS) cleaned = cleaned.replace(re, "");
	cleaned = cleaned.replace(/\s+/g, " ").trim();

	// YT Music auto-generated channels are named "Artist - Topic" — that's a
	// reliable artist signal regardless of how the video title is formatted.
	const topic = channelName?.match(/^(.+?)\s*-\s*Topic$/i);
	if (topic) {
		return { artist: topic[1].trim(), title: stripQuotes(cleaned) };
	}

	for (const sep of SEPARATORS) {
		const idx = cleaned.indexOf(sep);
		if (idx > 0) {
			const left = cleaned.slice(0, idx).trim();
			const right = cleaned.slice(idx + sep.length).trim();
			if (left && right) {
				return { artist: left, title: stripQuotes(right) };
			}
		}
	}

	// No separator — fall back to channel as artist (cleaned of "VEVO"/"Music" suffix)
	const fallbackArtist = channelName
		? channelName.replace(/\s*(VEVO|Official|Music|Records)\s*$/i, "").trim()
		: "";
	return { artist: fallbackArtist, title: stripQuotes(cleaned) };
}

function stripQuotes(s: string): string {
	return s.replace(/^["'«„](.+)["'»“]$/u, "$1").trim();
}
