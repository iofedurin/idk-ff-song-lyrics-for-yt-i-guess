import { storage } from "wxt/utils/storage";
import type { ProviderId } from "./lyrics/types";

export interface XY {
	x: number;
	y: number;
}
export interface Size {
	width: number;
	height: number;
}

// Floating button position is stored per-host because YT and YT Music have
// different layouts where the user may want the button in different places.
export const buttonPositionYtStorage = storage.defineItem<XY | null>(
	"local:ui.button.position.yt",
	{ fallback: null },
);
export const buttonPositionYtMusicStorage = storage.defineItem<XY | null>(
	"local:ui.button.position.ytm",
	{ fallback: null },
);

export const panelPositionStorage = storage.defineItem<XY | null>(
	"local:ui.panel.position",
	{ fallback: null },
);
export const panelSizeStorage = storage.defineItem<Size>(
	"local:ui.panel.size",
	{ fallback: { width: 400, height: 520 } },
);

export const geniusApiKeyStorage = storage.defineItem<string | null>(
	"local:settings.geniusApiKey",
	{ fallback: null },
);
export const preferredProviderStorage = storage.defineItem<ProviderId>(
	"local:settings.preferredProvider",
	{ fallback: "lrclib" },
);
