import type { LyricsResult } from "../lib/lyrics/types";

interface Props {
	result: LyricsResult;
}

export function LyricsView({ result }: Props) {
	return (
		<div>
			<div
				style={{
					marginBottom: 10,
					paddingBottom: 8,
					borderBottom: "1px solid rgba(255,255,255,0.08)",
				}}
			>
				<div style={{ fontWeight: 600, fontSize: 14 }}>{result.title}</div>
				<div style={{ opacity: 0.75, fontSize: 12 }}>
					{result.artist}
					{result.album ? ` · ${result.album}` : ""}
				</div>
				<div style={{ opacity: 0.5, fontSize: 11, marginTop: 4 }}>
					via {result.source}
					{result.sourceUrl && (
						<>
							{" "}
							<a
								href={result.sourceUrl}
								target="_blank"
								rel="noreferrer"
								style={{ color: "#ff5277" }}
							>
								↗
							</a>
						</>
					)}
				</div>
			</div>
			<pre
				style={{
					whiteSpace: "pre-wrap",
					fontFamily: "inherit",
					margin: 0,
					lineHeight: 1.55,
					fontSize: 14,
					color: "#e8e8e8",
				}}
			>
				{result.plainLyrics}
			</pre>
		</div>
	);
}
