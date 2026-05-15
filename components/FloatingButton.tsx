import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import {
	buttonPositionYtMusicStorage,
	buttonPositionYtStorage,
	type XY,
} from "../lib/storage";

export type ButtonStatus = "idle" | "loading" | "found";

// Pixel distance below which a mousedown/up is treated as a click,
// not a drag. Defends against sub-pixel hand jitter from rapid clicks.
const DRAG_THRESHOLD = 5;

interface Props {
	onClick: () => void;
	active: boolean;
	status: ButtonStatus;
}

export function FloatingButton({ onClick, active, status }: Props) {
	const storageItem =
		location.hostname === "music.youtube.com"
			? buttonPositionYtMusicStorage
			: buttonPositionYtStorage;

	const [pos, setPos] = useState<XY | null>(null);
	// Distinguish a click from a real drag by measuring how far the pointer
	// moved between mousedown and mouseup. react-rnd's `dragged` boolean
	// flips on the first onDrag event even from sub-pixel hand jitter, so
	// rapid clicks end up writing tiny offsets back to storage every time.
	// Anything under DRAG_THRESHOLD px counts as a click.
	const dragStartRef = useRef<XY>({ x: 0, y: 0 });

	useEffect(() => {
		storageItem.getValue().then((v) => setPos(v ?? defaultPos()));
	}, [storageItem]);

	if (!pos) return null;

	const ringClass =
		status === "loading"
			? "yt-lyrics-btn-ring yt-lyrics-btn-ring--loading"
			: status === "found"
				? "yt-lyrics-btn-ring yt-lyrics-btn-ring--found"
				: null;

	return (
		<Rnd
			position={pos}
			enableResizing={false}
			bounds="window"
			onDragStart={(_, d) => {
				dragStartRef.current = { x: d.x, y: d.y };
			}}
			onDragStop={(_, d) => {
				const dx = d.x - dragStartRef.current.x;
				const dy = d.y - dragStartRef.current.y;
				if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
					return; // click, not a drag
				}
				const np = { x: d.x, y: d.y };
				setPos(np);
				storageItem.setValue(np);
			}}
			style={{ zIndex: 2147483647, pointerEvents: "auto" }}
		>
			<button
				type="button"
				onClick={() => {
					// Suppress the click that fires at the end of a real drag.
					if (
						Math.abs(pos.x - dragStartRef.current.x) >= DRAG_THRESHOLD ||
						Math.abs(pos.y - dragStartRef.current.y) >= DRAG_THRESHOLD
					) {
						return;
					}
					onClick();
				}}
				onDoubleClick={() => {
					const def = defaultPos();
					setPos(def);
					storageItem.setValue(null);
				}}
				title="YouTube Lyrics — drag to move, double-click to reset"
				style={{
					position: "relative",
					width: 40,
					height: 40,
					borderRadius: "50%",
					background: "rgba(20, 20, 28, 0.85)",
					// When panel is open, only the icon tints — no aggressive fill.
					color: active ? "#7dd3fc" : "white",
					border: "1px solid rgba(255,255,255,0.18)",
					cursor: "grab",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
					padding: 0,
					transition: "color 0.15s ease",
				}}
			>
				{/* SVG (rather than the ♪ glyph) so the icon honors `color`.
				    On macOS the Unicode music note renders via the system
				    emoji font, which ignores CSS color. */}
				<svg
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="currentColor"
					aria-hidden="true"
					style={{ display: "block" }}
				>
					<path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
				</svg>
				{ringClass && <span className={ringClass} />}
			</button>
		</Rnd>
	);
}

function defaultPos(): XY {
	return {
		x: Math.max(0, window.innerWidth - 64),
		y: Math.max(0, window.innerHeight - 96),
	};
}
