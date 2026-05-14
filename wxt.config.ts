import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
	browser: "firefox",
	manifestVersion: 3,
	modules: ["@wxt-dev/module-react"],
	vite: () => ({
		plugins: [tailwindcss()],
	}),
	manifest: {
		name: "YouTube Lyrics",
		description: "Show lyrics for the currently playing YouTube video.",
		permissions: ["storage"],
		host_permissions: [
			"https://lrclib.net/*",
			"https://api.lyrics.ovh/*",
			"https://api.genius.com/*",
			"https://genius.com/*",
		],
		browser_specific_settings: {
			gecko: {
				id: "yt-lyrics@local",
				strict_min_version: "109.0",
			},
		},
	},
});
