import type { SearchHit } from "../lib/lyrics/types";

interface Props {
	hits: SearchHit[];
	onPick: (h: SearchHit) => void;
}

export function ResultsList({ hits, onPick }: Props) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			<div style={{ opacity: 0.6, fontSize: 12, marginBottom: 4 }}>
				{hits.length} candidates — pick one:
			</div>
			{hits.map((h) => (
				<button
					key={`${h.providerId}:${h.externalId}`}
					type="button"
					onClick={() => onPick(h)}
					style={{
						textAlign: "left",
						background: "rgba(255,255,255,0.04)",
						border: "1px solid rgba(255,255,255,0.08)",
						borderRadius: 4,
						padding: "8px 10px",
						color: "#eee",
						cursor: "pointer",
						fontSize: 13,
						fontFamily: "inherit",
					}}
				>
					<div style={{ fontWeight: 600 }}>{h.title || "(untitled)"}</div>
					<div
						style={{
							opacity: 0.7,
							fontSize: 12,
							display: "flex",
							justifyContent: "space-between",
							gap: 8,
						}}
					>
						<span>
							{h.artist}
							{h.album ? ` · ${h.album}` : ""}
							{h.durationSec ? ` · ${formatDuration(h.durationSec)}` : ""}
						</span>
						<span style={{ opacity: 0.5 }}>{h.providerId}</span>
					</div>
				</button>
			))}
		</div>
	);
}

function formatDuration(sec: number): string {
	const m = Math.floor(sec / 60);
	const s = Math.floor(sec % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}
