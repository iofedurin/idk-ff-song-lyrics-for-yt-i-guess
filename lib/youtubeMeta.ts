import { type ParsedTitle, parseTitle } from "./parseTitle";

export interface VideoMeta extends ParsedTitle {
	videoTitle: string;
	channelName: string;
	videoId: string | null;
	isYtMusic: boolean;
	/** True when we can confidently say this is a music video. */
	isMusic: boolean;
}

export function readCurrentVideoMeta(): VideoMeta | null {
	if (location.hostname === "music.youtube.com") return readYtMusic();
	return readYouTube();
}

function readYouTube(): VideoMeta | null {
	if (location.pathname !== "/watch") return null;

	const titleEl =
		document.querySelector("ytd-watch-metadata h1 yt-formatted-string") ??
		document.querySelector("ytd-watch-metadata h1");
	const channelEl =
		document.querySelector("ytd-watch-metadata ytd-channel-name a") ??
		document.querySelector(
			"ytd-watch-metadata ytd-channel-name yt-formatted-string",
		);

	const videoTitle =
		titleEl?.textContent?.trim() || stripYouTubeSuffix(document.title);
	const channelName = channelEl?.textContent?.trim() ?? "";
	const videoId = new URL(location.href).searchParams.get("v");
	if (!videoTitle) return null;

	const parsed = parseTitle(videoTitle, channelName);
	return {
		...parsed,
		videoTitle,
		channelName,
		videoId,
		isYtMusic: false,
		isMusic: detectMusic(channelName),
	};
}

function readYtMusic(): VideoMeta | null {
	// YT Music exposes title and artist explicitly in the player bar.
	const titleEl = document.querySelector(
		"ytmusic-player-bar yt-formatted-string.title",
	);
	const bylineEl = document.querySelector(
		"ytmusic-player-bar yt-formatted-string.byline",
	);
	const videoTitle = titleEl?.textContent?.trim() ?? "";
	if (!videoTitle) return null;

	// byline format: "Artist • Album • Year" — first segment is artist
	const channelName = bylineEl?.textContent?.split("•")[0]?.trim() ?? "";

	return {
		artist: channelName,
		title: videoTitle,
		videoTitle,
		channelName,
		videoId: null,
		isYtMusic: true,
		isMusic: true,
	};
}

// Reliable music-video signals, in order of confidence:
// 1. YT Music host                                   → handled at top of readCurrentVideoMeta
// 2. Channel named "<Artist> - Topic" (YT-generated)
// 3. JSON-LD with @type=VideoObject and genre=Music  (Google's own microdata)
function detectMusic(channelName: string): boolean {
	if (/\s-\s*Topic$/i.test(channelName)) return true;

	const scripts = document.querySelectorAll(
		'script[type="application/ld+json"]',
	);
	for (const s of scripts) {
		try {
			const j = JSON.parse(s.textContent ?? "null") as {
				"@type"?: string;
				genre?: string;
			} | null;
			if (
				j &&
				typeof j === "object" &&
				j["@type"] === "VideoObject" &&
				j.genre?.toLowerCase() === "music"
			) {
				return true;
			}
		} catch {
			// ignore malformed JSON-LD blocks
		}
	}
	return false;
}

function stripYouTubeSuffix(t: string): string {
	return t.replace(/\s+-\s+YouTube(?:\s+Music)?$/, "").trim();
}

// Subscribe to SPA navigation. YouTube fires `yt-navigate-finish` after route
// changes (it bubbles, but listening on both window and document is safer).
// A 600ms URL poll is a belt-and-suspenders fallback for cases where the
// event doesn't fire — e.g. some playlist auto-advance paths.
export function onVideoChange(cb: () => void): () => void {
	let lastHref = location.href;

	const fireIfChanged = () => {
		if (location.href === lastHref) return;
		lastHref = location.href;
		cb();
	};

	const onNav = () => fireIfChanged();
	window.addEventListener("yt-navigate-finish", onNav);
	document.addEventListener("yt-navigate-finish", onNav);
	const interval = window.setInterval(fireIfChanged, 600);

	return () => {
		window.removeEventListener("yt-navigate-finish", onNav);
		document.removeEventListener("yt-navigate-finish", onNav);
		window.clearInterval(interval);
	};
}
