import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

// Cross-browser: pick target via `-b firefox` / `-b chrome` on the CLI.
// Firefox is the primary release target (signed via AMO). Chrome support
// exists for dev/debug only — see README.

export default defineConfig({
	manifestVersion: 3,
	modules: ["@wxt-dev/module-react"],
	vite: () => ({
		plugins: [tailwindcss()],
	}),
	manifest: ({ browser }) => ({
		name: "YouTube Lyrics",
		description: "Show lyrics for the currently playing YouTube video.",
		permissions: ["storage"],
		host_permissions: [
			"https://lrclib.net/*",
			"https://api.lyrics.ovh/*",
			"https://api.genius.com/*",
			"https://genius.com/*",
		],
		// `browser_specific_settings` is a Firefox/Gecko-only field. Chrome
		// MV3 validation warns on unknown keys, so emit it only for FF.
		...(browser === "firefox" && {
			browser_specific_settings: {
				gecko: {
					id: "yt-lyrics@local",
					strict_min_version: "109.0",
				},
			},
		}),
	}),
});
