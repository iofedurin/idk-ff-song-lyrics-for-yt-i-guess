import { useCallback, useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import type { LyricsResult, SearchHit } from "../lib/lyrics/types";
import { sendMessage } from "../lib/messaging";
import {
	panelPositionStorage,
	panelSizeStorage,
	type Size,
	type XY,
} from "../lib/storage";
import type { VideoMeta } from "../lib/youtubeMeta";
import { LyricsView } from "./LyricsView";
import { ResultsList } from "./ResultsList";
import { SearchBar } from "./SearchBar";

/** Snapshot of a finished prefetch, handed from the content script to the
 * panel so opening it doesn't need to make another IPC roundtrip. */
export interface Prefetched {
	/** `${artist}|${title}` — must match the panel's current meta to be used. */
	key: string;
	result: LyricsResult | null;
}

interface Props {
	meta: VideoMeta | null;
	prefetched: Prefetched | null;
	onClose: () => void;
}

type State =
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "lyrics"; result: LyricsResult }
	| { kind: "results"; hits: SearchHit[] }
	| { kind: "empty" }
	| { kind: "error"; message: string };

export function LyricsPanel({ meta, prefetched, onClose }: Props) {
	const [pos, setPos] = useState<XY | null>(null);
	const [size, setSize] = useState<Size>({ width: 400, height: 520 });
	const [ready, setReady] = useState(false);

	const [state, setState] = useState<State>({ kind: "idle" });
	const [query, setQuery] = useState("");
	// Ignore late responses when a newer request has fired.
	const seqRef = useRef(0);

	// Pull primitives out so useEffect deps match what the closure actually
	// captures. Object identity of `meta` changes on every refresh poll, so
	// we narrow to the fields we care about.
	const videoTitle = meta?.videoTitle ?? "";
	const artist = meta?.artist ?? "";
	const title = meta?.title ?? "";

	useEffect(() => {
		Promise.all([
			panelPositionStorage.getValue(),
			panelSizeStorage.getValue(),
		]).then(([p, s]) => {
			setSize(s);
			setPos(p ?? defaultPos(s));
			setReady(true);
		});
	}, []);

	const runSearch = useCallback(async (q: string) => {
		const seq = ++seqRef.current;
		setState({ kind: "loading" });
		try {
			const hits = await sendMessage("searchLyrics", { query: q });
			if (seq !== seqRef.current) return;
			if (hits.length === 0) {
				setState({ kind: "empty" });
				return;
			}
			if (hits.length === 1) {
				const r = await sendMessage("fetchById", { hit: hits[0] });
				if (seq !== seqRef.current) return;
				setState(r ? { kind: "lyrics", result: r } : { kind: "empty" });
				return;
			}
			setState({ kind: "results", hits });
		} catch (e) {
			if (seq !== seqRef.current) return;
			setState({ kind: "error", message: String(e) });
		}
	}, []);

	const pickHit = useCallback(async (hit: SearchHit) => {
		const seq = ++seqRef.current;
		setState({ kind: "loading" });
		try {
			const r = await sendMessage("fetchById", { hit });
			if (seq !== seqRef.current) return;
			setState(r ? { kind: "lyrics", result: r } : { kind: "empty" });
		} catch (e) {
			if (seq !== seqRef.current) return;
			setState({ kind: "error", message: String(e) });
		}
	}, []);

	// Match key against the content script's prefetched snapshot.
	const metaKey = artist && title ? `${artist}|${title}` : "";
	const prefetchedKey = prefetched?.key ?? "";
	const prefetchedResult = prefetched?.result ?? null;

	// Auto-fetch when meta changes (or first becomes available).
	useEffect(() => {
		if (!videoTitle) {
			// Meta was cleared (likely a SPA navigation in progress). Reset
			// to loading so we don't keep showing the previous video's lyrics.
			setState({ kind: "loading" });
			return;
		}
		const q = `${artist} ${title}`.trim() || videoTitle;
		setQuery(q);

		// Fast path: prefetch already completed and lyrics are sitting in the
		// content script's memory. Skip the IPC roundtrip entirely so the
		// panel doesn't flash a "Loading…" spinner on open.
		if (
			metaKey !== "" &&
			prefetchedKey === metaKey &&
			prefetchedResult !== null
		) {
			setState({ kind: "lyrics", result: prefetchedResult });
			return;
		}

		const seq = ++seqRef.current;
		setState({ kind: "loading" });

		(async () => {
			if (artist && title) {
				try {
					const r = await sendMessage("fetchLyrics", { artist, title });
					if (seq !== seqRef.current) return;
					if (r) {
						setState({ kind: "lyrics", result: r });
						return;
					}
				} catch (e) {
					if (seq !== seqRef.current) return;
					setState({ kind: "error", message: String(e) });
					return;
				}
			}
			await runSearch(q);
		})();
	}, [
		videoTitle,
		artist,
		title,
		metaKey,
		prefetchedKey,
		prefetchedResult,
		runSearch,
	]);

	function resetToCurrentVideo() {
		if (!videoTitle) return;
		const q = `${artist} ${title}`.trim() || videoTitle;
		setQuery(q);
		if (artist && title) {
			const seq = ++seqRef.current;
			setState({ kind: "loading" });
			sendMessage("fetchLyrics", { artist, title }).then((r) => {
				if (seq !== seqRef.current) return;
				if (r) setState({ kind: "lyrics", result: r });
				else runSearch(q);
			});
		} else {
			runSearch(q);
		}
	}

	if (!ready || !pos) return null;

	return (
		<Rnd
			position={pos}
			size={size}
			minWidth={320}
			minHeight={280}
			bounds="window"
			dragHandleClassName="yt-lyrics-drag"
			onDragStop={(_, d) => {
				const np = { x: d.x, y: d.y };
				setPos(np);
				panelPositionStorage.setValue(np);
			}}
			onResizeStop={(_, __, ref, ___, p) => {
				const ns = {
					width: ref.offsetWidth,
					height: ref.offsetHeight,
				};
				setSize(ns);
				panelSizeStorage.setValue(ns);
				setPos(p);
				panelPositionStorage.setValue(p);
			}}
			style={{ zIndex: 2147483646, pointerEvents: "auto" }}
		>
			<div
				style={{
					width: "100%",
					height: "100%",
					background: "rgba(20,20,28,0.97)",
					color: "#eee",
					border: "1px solid rgba(255,255,255,0.12)",
					borderRadius: 8,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					fontFamily:
						"system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
					fontSize: 14,
					boxShadow: "0 10px 28px rgba(0,0,0,0.55)",
					backdropFilter: "blur(6px)",
				}}
			>
				<div
					className="yt-lyrics-drag"
					style={{
						padding: "8px 12px",
						background: "rgba(255,255,255,0.05)",
						borderBottom: "1px solid rgba(255,255,255,0.08)",
						cursor: "move",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						userSelect: "none",
					}}
				>
					<strong style={{ fontSize: 13, letterSpacing: 0.2 }}>♪ Lyrics</strong>
					<button
						type="button"
						onClick={onClose}
						style={{
							background: "transparent",
							border: "none",
							color: "#aaa",
							cursor: "pointer",
							fontSize: 20,
							lineHeight: 1,
							padding: "0 4px",
						}}
						aria-label="Close"
					>
						×
					</button>
				</div>

				<SearchBar
					query={query}
					onQueryChange={setQuery}
					onSubmit={() => runSearch(query)}
					onReset={resetToCurrentVideo}
				/>

				<div style={{ flex: 1, overflow: "auto", padding: 12 }}>
					{state.kind === "idle" && !meta && (
						<div style={{ opacity: 0.6 }}>
							Waiting for video info… you can also search manually above.
						</div>
					)}
					{state.kind === "loading" && (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								gap: 10,
								padding: "32px 0",
								opacity: 0.75,
							}}
						>
							<span className="yt-lyrics-spinner" />
							<span>Loading…</span>
						</div>
					)}
					{state.kind === "empty" && (
						<div style={{ opacity: 0.6 }}>
							Nothing found. Try editing the search above.
						</div>
					)}
					{state.kind === "error" && (
						<div style={{ color: "#ff5277" }}>Error: {state.message}</div>
					)}
					{state.kind === "results" && (
						<ResultsList hits={state.hits} onPick={pickHit} />
					)}
					{state.kind === "lyrics" && <LyricsView result={state.result} />}
				</div>
			</div>
		</Rnd>
	);
}

function defaultPos(size: Size): XY {
	return {
		x: Math.max(0, window.innerWidth - size.width - 24),
		y: 80,
	};
}
