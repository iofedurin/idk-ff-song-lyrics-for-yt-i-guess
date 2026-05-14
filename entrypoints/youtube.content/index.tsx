import { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { FloatingButton } from "../../components/FloatingButton";
import { LyricsPanel } from "../../components/LyricsPanel";
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
		const refresh = () => {
			setVisible(isWatchPage());
			setMeta(readCurrentVideoMeta());
		};

		// YT renders the metadata asynchronously after navigation. Two
		// passes (early + delayed) covers both fast cache hits and slow loads.
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
	async main(ctx) {
		const ui = await createShadowRootUi(ctx, {
			name: "yt-lyrics-overlay",
			position: "inline",
			anchor: "body",
			onMount(container) {
				// Full-viewport transparent wrapper so absolutely-positioned
				// Rnd children resolve x/y against the viewport.
				const wrapper = document.createElement("div");
				wrapper.style.cssText =
					"position: fixed; inset: 0; pointer-events: none; z-index: 2147483646;";
				container.append(wrapper);
				const root = ReactDOM.createRoot(wrapper);
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
