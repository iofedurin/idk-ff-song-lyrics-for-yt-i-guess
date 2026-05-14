/**
 * Renders public/icon/*.png from an inline SVG using @resvg/resvg-js.
 *
 * Run with: bun run scripts/build-icons.ts
 *
 * The SVG below is the source of truth — edit it, re-run, commit the PNGs.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const svg = /* svg */ `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
	<rect width="128" height="128" rx="22" fill="#15101a"/>
	<circle cx="64" cy="64" r="50" fill="#ff527714"/>
	<g fill="#ff5277">
		<ellipse cx="48" cy="92" rx="14" ry="11" transform="rotate(-12 48 92)"/>
		<rect x="60" y="32" width="6" height="60" rx="2"/>
		<path d="M66 32 Q96 38 96 64 Q90 56 66 52 Z"/>
	</g>
</svg>
`.trim();

const sizes = [16, 32, 48, 96, 128];
const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icon");

for (const size of sizes) {
	const resvg = new Resvg(svg, {
		fitTo: { mode: "width", value: size },
		background: "rgba(0, 0, 0, 0)",
	});
	const png = resvg.render().asPng();
	writeFileSync(join(outDir, `${size}.png`), png);
	console.log(`✓ ${size}x${size} → ${size}.png`);
}
