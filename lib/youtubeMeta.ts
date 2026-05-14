import { type ParsedTitle, parseTitle } from "./parseTitle";

export interface VideoMeta extends ParsedTitle {
	videoTitle: string;
	channelName: string;
	videoId: string | null;
	isYtMusic: boolean;
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
	};
}

function stripYouTubeSuffix(t: string): string {
	return t.replace(/\s+-\s+YouTube(?:\s+Music)?$/, "").trim();
}

// Subscribe to SPA navigation events. YouTube fires `yt-navigate-finish`
// after route changes; YT Music does too. We also watch <title> as a
// fallback for in-page metadata updates.
export function onVideoChange(cb: () => void): () => void {
	let lastHref = location.href;
	const onNav = () => {
		if (location.href !== lastHref) {
			lastHref = location.href;
			cb();
		}
	};
	window.addEventListener("yt-navigate-finish", onNav);

	const titleEl = document.querySelector("title");
	const obs = titleEl
		? new MutationObserver(() => {
				if (location.href !== lastHref) {
					lastHref = location.href;
				}
				cb();
			})
		: null;
	if (titleEl) obs?.observe(titleEl, { childList: true });

	return () => {
		window.removeEventListener("yt-navigate-finish", onNav);
		obs?.disconnect();
	};
}
