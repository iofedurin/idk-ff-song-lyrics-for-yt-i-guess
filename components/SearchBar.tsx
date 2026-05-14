import type { CSSProperties, KeyboardEvent } from "react";

interface Props {
	query: string;
	onQueryChange: (v: string) => void;
	onSubmit: () => void;
	onReset: () => void;
}

export function SearchBar({ query, onQueryChange, onSubmit, onReset }: Props) {
	function onKey(e: KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Enter") {
			e.preventDefault();
			onSubmit();
		}
	}
	return (
		<div
			style={{
				display: "flex",
				gap: 6,
				padding: "8px 10px",
				borderBottom: "1px solid rgba(255,255,255,0.06)",
			}}
		>
			<input
				value={query}
				onChange={(e) => onQueryChange(e.target.value)}
				onKeyDown={onKey}
				placeholder="Artist — title"
				style={{
					flex: 1,
					padding: "6px 10px",
					background: "rgba(255,255,255,0.06)",
					border: "1px solid rgba(255,255,255,0.1)",
					borderRadius: 4,
					color: "#eee",
					fontSize: 13,
					outline: "none",
				}}
			/>
			<button type="button" onClick={onSubmit} style={primaryBtn}>
				Search
			</button>
			<button
				type="button"
				onClick={onReset}
				style={ghostBtn}
				title="Reset to current video"
			>
				↺
			</button>
		</div>
	);
}

const primaryBtn: CSSProperties = {
	background: "rgba(255,82,119,0.2)",
	border: "1px solid rgba(255,82,119,0.45)",
	color: "#ff5277",
	padding: "6px 12px",
	borderRadius: 4,
	cursor: "pointer",
	fontSize: 12,
	fontWeight: 500,
};

const ghostBtn: CSSProperties = {
	background: "rgba(255,255,255,0.04)",
	border: "1px solid rgba(255,255,255,0.1)",
	color: "#aaa",
	padding: "6px 10px",
	borderRadius: 4,
	cursor: "pointer",
	fontSize: 14,
};
