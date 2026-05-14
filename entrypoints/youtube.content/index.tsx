import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { FloatingButton } from "../../components/FloatingButton";
import { LyricsPanel } from "../../components/LyricsPanel";
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

	useEffect(() => {
		// Avoid duplicate prefetches when refresh fires twice (early + late).
		let lastPrefetchKey = "";

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
					sendMessage("prefetchLyrics", {
						artist: m.artist,
						title: m.title,
					}).catch(() => {
						// prefetch must never throw into the UI
					});
				}
			}
		};

		// YT renders the metadata asynchronously after navigation. Hit it
		// twice: once early (cache-warm load) and once after YT has settled.
		const t1 = setTimeout(refresh, 400);
		const t2 = setTimeout(refresh, 1500);
		const off = onVideoChange(() => {
			setTimeout(refresh, 400);
			setTimeout(refresh, 1500);
		});

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			off();
		};
	}, []);

	if (!visible) return null;

	return (
		<>
			<FloatingButton onClick={() => setOpen((v) => !v)} active={open} />
			{open && <LyricsPanel meta={meta} onClose={() => setOpen(false)} />}
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
