import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
	type ButtonStatus,
	FloatingButton,
} from "../../components/FloatingButton";
import { LyricsPanel, type Prefetched } from "../../components/LyricsPanel";
import type { LyricsResult } from "../../lib/lyrics/types";
import { sendMessage } from "../../lib/messaging";
import {
	onVideoChange,
	readCurrentVideoMeta,
	type VideoMeta,
} from "../../lib/youtubeMeta";
import "./style.css";

function App() {
	const [open, setOpen] = useState(false);
	const [meta, setMeta] = useState<VideoMeta | null>(null);
	const [visible, setVisible] = useState(isWatchPage());
	const [btnStatus, setBtnStatus] = useState<ButtonStatus>("idle");
	// Result of the last completed prefetch — handed to the panel so it can
	// render lyrics immediately without a second IPC roundtrip.
	const [prefetched, setPrefetched] = useState<Prefetched | null>(null);
	// Token to discard stale prefetch responses when video changes mid-flight.
	const prefetchToken = useRef(0);

	useEffect(() => {
		// Avoid duplicate prefetches when refresh fires twice mid-poll.
		let lastPrefetchKey = "";
		let pollTimer: ReturnType<typeof setTimeout> | undefined;
		// Closure-scoped record of the DOM-read title at the moment of the
		// last successful refresh. Used as the "previous" anchor when polling
		// after navigation, so we can tell whether YT has actually swapped
		// metadata in the DOM (videoId from the URL is useless here — it
		// updates instantly, way before the DOM does).
		let lastSeenTitle = "";

		const applyMeta = (m: VideoMeta | null) => {
			setVisible(isWatchPage());
			setMeta(m);
			lastSeenTitle = m?.videoTitle ?? "";

			// Always prefetch if we have a parseable artist + title.
			// The earlier `isMusic` gate relied on JSON-LD `genre: "Music"`,
			// but YouTube does NOT inject that microdata on playlist pages
			// — so every video opened inside a playlist false-negatived and
			// prefetch was silently skipped. LRCLib is free and returns
			// quickly (cached as null) for non-music, so always-on is fine.
			if (m?.artist && m.title) {
				const key = `${m.artist}|${m.title}`;
				if (key !== lastPrefetchKey) {
					lastPrefetchKey = key;
					const token = ++prefetchToken.current;
					const artist = m.artist;
					const title = m.title;
					setBtnStatus("loading");
					sendMessage("prefetchLyrics", { artist, title })
						.then((result: LyricsResult | null) => {
							if (token !== prefetchToken.current) return;
							setBtnStatus(result ? "found" : "idle");
							setPrefetched({ key, result });
						})
						.catch(() => {
							if (token !== prefetchToken.current) return;
							setBtnStatus("idle");
						});
				}
			}
		};

		// Poll the DOM every 250ms until its video title differs from the
		// previously-known one. That's the moment YT has actually finished
		// swapping `<ytd-watch-metadata>` for the new track.
		const pollUntilFresh = (previousTitle: string) => {
			if (pollTimer) clearTimeout(pollTimer);
			let attempts = 0;

			const tick = () => {
				const m = readCurrentVideoMeta();
				const currentTitle = m?.videoTitle ?? "";
				const looksFresh =
					currentTitle !== "" && currentTitle !== previousTitle;

				if (looksFresh) {
					applyMeta(m);
					return;
				}
				if (++attempts > 24) {
					// 6 s ceiling. We deliberately do NOT applyMeta(m) here —
					// that would feed the previous track's metadata back into
					// the panel and (cache-hit) display its lyrics under the
					// new video. Better to leave the panel in its loading
					// state until the user refreshes manually.
					return;
				}
				pollTimer = setTimeout(tick, 250);
			};
			tick();
		};

		const onNavigated = () => {
			// New video. Drop everything from the previous track immediately
			// so the panel can't keep showing stale lyrics under a new song.
			prefetchToken.current++;
			setBtnStatus("idle");
			setPrefetched(null);
			setMeta(null);
			lastPrefetchKey = "";
			pollUntilFresh(lastSeenTitle);
		};

		// Initial load: empty `previousTitle` means any non-empty DOM title
		// will be accepted on the first tick.
		pollUntilFresh("");
		const off = onVideoChange(onNavigated);

		return () => {
			if (pollTimer) clearTimeout(pollTimer);
			off();
		};
	}, []);

	if (!visible) return null;

	return (
		<>
			<FloatingButton
				onClick={() => setOpen((v) => !v)}
				active={open}
				status={btnStatus}
			/>
			{open && (
				<LyricsPanel
					meta={meta}
					prefetched={prefetched}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}

function isWatchPage(): boolean {
	return (
		location.hostname === "music.youtube.com" ||
		(location.hostname.endsWith("youtube.com") &&
			location.pathname === "/watch")
	);
}

export default defineContentScript({
	matches: ["*://www.youtube.com/*", "*://music.youtube.com/*"],
	cssInjectionMode: "ui",
	runAt: "document_idle",
	async main(ctx) {
		const ui = await createShadowRootUi(ctx, {
			name: "yt-lyrics-overlay",
			// Overlay mode mounts a 0×0 anchor at top-left, so children with
			// position: absolute resolve their x/y as viewport coordinates.
			position: "overlay",
			alignment: "top-left",
			zIndex: 2147483646,
			anchor: "html",
			onMount(container) {
				const root = ReactDOM.createRoot(container);
				root.render(<App />);
				return root;
			},
			onRemove(root) {
				root?.unmount();
			},
		});
		ui.mount();
	},
});
