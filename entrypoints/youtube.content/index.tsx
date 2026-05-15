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
		// Track what we last successfully applied. videoId is the canonical
		// identity (from the URL — instantly correct after navigation); title
		// is used as the "DOM has caught up" signal during polling.
		let lastAppliedVideoId: string | null = null;
		let lastAppliedTitle = "";

		const applyMeta = (m: VideoMeta | null) => {
			setVisible(isWatchPage());
			setMeta(m);
			lastAppliedVideoId = m?.videoId ?? null;
			lastAppliedTitle = m?.videoTitle ?? "";

			// Always prefetch if we have a parseable artist + title. LRCLib is
			// free and returns quickly (cached as null) for non-music.
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

		// Wait for the DOM to reflect the new video. Two completion signals:
		// 1. Same videoId as last applied — DOM is already right (e.g. URL
		//    only changed playlist `index=`, video itself is the same).
		// 2. Different videoId — wait until DOM title differs from the
		//    previously-applied one. That's when YT swapped the metadata.
		const pollUntilFresh = () => {
			if (pollTimer) clearTimeout(pollTimer);
			const expectedVideoId = new URL(location.href).searchParams.get("v");
			let attempts = 0;

			const tick = () => {
				const m = readCurrentVideoMeta();
				if (!m) {
					// DOM not ready yet (no title or all placeholders).
					if (++attempts > 24) return; // 6 s ceiling
					pollTimer = setTimeout(tick, 250);
					return;
				}
				const sameVideo =
					expectedVideoId !== null && expectedVideoId === lastAppliedVideoId;
				const titleChanged = m.videoTitle !== lastAppliedTitle;
				if (sameVideo || titleChanged) {
					applyMeta(m);
					return;
				}
				if (++attempts > 24) return;
				pollTimer = setTimeout(tick, 250);
			};
			tick();
		};

		const onNavigated = () => {
			// Same video, just URL params changed (e.g. playlist index bump).
			// Nothing to refresh — the current meta is still correct.
			const newVideoId = new URL(location.href).searchParams.get("v");
			if (newVideoId !== null && newVideoId === lastAppliedVideoId) {
				return;
			}
			prefetchToken.current++;
			setBtnStatus("idle");
			setPrefetched(null);
			setMeta(null);
			lastPrefetchKey = "";
			pollUntilFresh();
		};

		// Initial mount: lastApplied* are empty, so any non-empty parsed meta
		// will be accepted on the first tick.
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
			// Stop keydown/keyup/keypress from bubbling out of the shadow root
			// into YouTube's document-level listeners. Without this, typing
			// "m" in our search input mutes the player; "k" pauses; "j"/"l"
			// seek; "f" goes fullscreen; etc.
			isolateEvents: true,
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
