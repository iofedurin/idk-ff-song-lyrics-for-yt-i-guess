import { useEffect, useState } from "react";
import { Rnd } from "react-rnd";
import {
	buttonPositionYtMusicStorage,
	buttonPositionYtStorage,
	type XY,
} from "../lib/storage";

export type ButtonStatus = "idle" | "loading" | "found";

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
	// Distinguish a click from the click event fired at the end of a drag.
	const [dragged, setDragged] = useState(false);

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
			onDragStart={() => setDragged(false)}
			onDrag={() => setDragged(true)}
			onDragStop={(_, d) => {
				const np = { x: d.x, y: d.y };
				setPos(np);
				storageItem.setValue(np);
			}}
			style={{ zIndex: 2147483647, pointerEvents: "auto" }}
		>
			<button
				type="button"
				onClick={() => {
					if (!dragged) onClick();
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
					background: active ? "#ff5277" : "rgba(20, 20, 28, 0.85)",
					color: "white",
					border: "1px solid rgba(255,255,255,0.18)",
					cursor: "grab",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					boxShadow: "0 4px 12px rgba(0,0,0,0.45)",
					fontSize: 20,
					lineHeight: 1,
					padding: 0,
					transition: "background 0.15s ease",
				}}
			>
				♪{ringClass && <span className={ringClass} />}
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
