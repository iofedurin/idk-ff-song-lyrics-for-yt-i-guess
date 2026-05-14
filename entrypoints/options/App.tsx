import { useEffect, useState } from "react";
import type { ProviderId, TestResult } from "../../lib/lyrics/types";
import { sendMessage } from "../../lib/messaging";
import {
	buttonPositionYtMusicStorage,
	buttonPositionYtStorage,
	geniusApiKeyStorage,
	panelPositionStorage,
	panelSizeStorage,
	preferredProviderStorage,
} from "../../lib/storage";

const TEST_TRACK = { artist: "Coldplay", title: "Yellow" };

export default function App() {
	const [geniusKey, setGeniusKey] = useState("");
	const [provider, setProvider] = useState<ProviderId>("lrclib");
	const [savedAt, setSavedAt] = useState<number | null>(null);

	const [testResults, setTestResults] = useState<TestResult[] | null>(null);
	const [testing, setTesting] = useState(false);

	useEffect(() => {
		geniusApiKeyStorage.getValue().then((v) => setGeniusKey(v ?? ""));
		preferredProviderStorage.getValue().then(setProvider);
	}, []);

	function flashSaved() {
		setSavedAt(Date.now());
		setTimeout(() => setSavedAt(null), 1500);
	}

	function saveGeniusKey() {
		geniusApiKeyStorage.setValue(geniusKey.trim() || null).then(flashSaved);
	}

	function changeProvider(v: ProviderId) {
		setProvider(v);
		preferredProviderStorage.setValue(v).then(flashSaved);
	}

	function resetPositions() {
		Promise.all([
			buttonPositionYtStorage.setValue(null),
			buttonPositionYtMusicStorage.setValue(null),
			panelPositionStorage.setValue(null),
			panelSizeStorage.setValue({ width: 400, height: 520 }),
		]).then(flashSaved);
	}

	async function runTest() {
		setTesting(true);
		setTestResults(null);
		try {
			const r = await sendMessage("testProviders", TEST_TRACK);
			setTestResults(r);
		} finally {
			setTesting(false);
		}
	}

	return (
		<div className="min-h-screen bg-neutral-900 text-neutral-100">
			<div className="max-w-xl mx-auto p-6">
				<h1 className="text-2xl font-semibold mb-1">YouTube Lyrics</h1>
				<p className="text-sm text-neutral-400 mb-6">Options</p>

				<section className="mb-6">
					<label htmlFor="provider" className="block text-sm font-medium mb-1">
						Preferred lyrics provider
					</label>
					<select
						id="provider"
						value={provider}
						onChange={(e) => changeProvider(e.target.value as ProviderId)}
						className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm"
					>
						<option value="lrclib">LRCLib (recommended)</option>
						<option value="lyricsOvh">lyrics.ovh</option>
						<option value="genius">Genius (needs API key below)</option>
					</select>
					<p className="text-xs text-neutral-500 mt-1">
						The preferred provider is tried first; the others are fallbacks.
					</p>
				</section>

				<section className="mb-6">
					<label
						htmlFor="genius-key"
						className="block text-sm font-medium mb-1"
					>
						Genius API key
					</label>
					<p className="text-xs text-neutral-500 mb-2">
						Optional. Get a free key at{" "}
						<a
							className="text-pink-400 underline"
							href="https://genius.com/api-clients"
							target="_blank"
							rel="noreferrer"
						>
							genius.com/api-clients
						</a>
						. Without it, Genius is disabled.
					</p>
					<div className="flex gap-2">
						<input
							id="genius-key"
							type="password"
							value={geniusKey}
							onChange={(e) => setGeniusKey(e.target.value)}
							className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-2 font-mono text-sm"
							placeholder="paste your key"
						/>
						<button
							type="button"
							onClick={saveGeniusKey}
							className="bg-pink-600 hover:bg-pink-500 rounded px-4 py-2 text-sm font-medium"
						>
							Save
						</button>
					</div>
				</section>

				<section className="mb-6">
					<div className="flex items-baseline justify-between mb-2">
						<h2 className="text-sm font-medium">Test sources</h2>
						<span className="text-xs text-neutral-500">
							query: {TEST_TRACK.artist} — {TEST_TRACK.title}
						</span>
					</div>
					<p className="text-xs text-neutral-500 mb-2">
						Probes each provider in parallel with the same well-known track to
						show latency and whether plain / synced lyrics are returned.
					</p>
					<button
						type="button"
						onClick={runTest}
						disabled={testing}
						className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 border border-neutral-700 rounded px-4 py-2 text-sm"
					>
						{testing ? "Testing…" : "Run test"}
					</button>

					{testResults && (
						<table className="w-full mt-3 text-sm border border-neutral-800">
							<thead className="bg-neutral-800/60 text-neutral-400 text-xs">
								<tr>
									<th className="text-left px-3 py-2 font-medium">Provider</th>
									<th className="text-right px-3 py-2 font-medium">Latency</th>
									<th className="text-center px-3 py-2 font-medium">Plain</th>
									<th className="text-center px-3 py-2 font-medium">Synced</th>
								</tr>
							</thead>
							<tbody>
								{testResults.map((r) => (
									<tr
										key={r.providerId}
										className="border-t border-neutral-800"
									>
										<td className="px-3 py-2">
											{r.providerId}
											{!r.enabled && (
												<span className="text-neutral-500 text-xs ml-1">
													(disabled)
												</span>
											)}
											{r.enabled && r.error && (
												<span className="text-red-400 text-xs ml-1">
													error: {r.error}
												</span>
											)}
										</td>
										<td
											className={`text-right px-3 py-2 tabular-nums ${
												!r.enabled
													? "text-neutral-600"
													: r.latencyMs > 800
														? "text-amber-400"
														: "text-neutral-200"
											}`}
										>
											{r.enabled ? `${r.latencyMs} ms` : "—"}
										</td>
										<td className="text-center px-3 py-2">
											{r.hasPlain ? (
												<span className="text-emerald-400">✓</span>
											) : (
												<span className="text-neutral-600">✗</span>
											)}
										</td>
										<td className="text-center px-3 py-2">
											{r.hasSynced ? (
												<span className="text-emerald-400">✓</span>
											) : (
												<span className="text-neutral-600">✗</span>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</section>

				<section className="mb-6">
					<button
						type="button"
						onClick={resetPositions}
						className="bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-4 py-2 text-sm"
					>
						Reset floating button & panel positions
					</button>
				</section>

				<div className="h-6 text-sm text-emerald-400">
					{savedAt && "Saved ✓"}
				</div>
			</div>
		</div>
	);
}
