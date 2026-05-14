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

		const onNavigated = () => {
			// New video — drop any prior prefetch state immediately so the
			// stale "found" badge doesn't linger on the new video.
			prefetchToken.current++;
			setBtnStatus("idle");
			setPrefetched(null);
			lastPrefetchKey = "";
			setTimeout(refresh, 400);
			setTimeout(refresh, 1500);
		};

		// YT renders the metadata asynchronously after navigation. Hit it
		// twice: once early (cache-warm load) and once after YT has settled.
		const t1 = setTimeout(refresh, 400);
		const t2 = setTimeout(refresh, 1500);
		const off = onVideoChange(onNavigated);

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
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
