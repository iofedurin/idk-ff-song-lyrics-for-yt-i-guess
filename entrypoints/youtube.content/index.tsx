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

		const refresh = () => {
			setVisible(isWatchPage());
			const m = readCurrentVideoMeta();
			setMeta(m);

			// Warm the background cache for music videos so opening the
			// panel later returns instantly. Skip non-music videos to avoid
			// hitting LRCLib for every random clip.
			if (m?.isMusic && m.artist && m.title) {
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

		// Fixed delays missed slow playlist transitions. Instead, poll until
		// the DOM-read videoId matches the URL's `?v=` param — that's the
		// moment YT actually swapped metadata to the new track.
		const pollUntilFresh = () => {
			if (pollTimer) clearTimeout(pollTimer);
			const expectedVideoId = new URLSearchParams(location.search).get("v");
			let attempts = 0;

			const tick = () => {
				refresh();
				const m = readCurrentVideoMeta();
				const done = m
					? expectedVideoId
						? m.videoId === expectedVideoId
						: true // YT Music has no videoId in URL — any non-null meta is "fresh"
					: false;
				if (done) return;
				if (++attempts > 24) return; // 24 × 250ms = 6 s ceiling
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
			pollUntilFresh();
		};

		pollUntilFresh();
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
