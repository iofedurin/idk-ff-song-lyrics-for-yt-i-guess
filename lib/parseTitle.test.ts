import { describe, expect, it } from "vitest";
import { parseTitle } from "./parseTitle";

describe("parseTitle", () => {
	it("splits on hyphen with spaces", () => {
		expect(parseTitle("Radiohead - Creep")).toEqual({
			artist: "Radiohead",
			title: "Creep",
		});
	});

	it("strips (Official Video) suffix", () => {
		expect(parseTitle("Radiohead - Creep (Official Video)")).toEqual({
			artist: "Radiohead",
			title: "Creep",
		});
	});

	it("strips [Lyrics] suffix", () => {
		expect(parseTitle("Imagine Dragons - Believer [Lyrics]")).toEqual({
			artist: "Imagine Dragons",
			title: "Believer",
		});
	});

	it("handles em dash separator", () => {
		expect(parseTitle("Daft Punk — Around the World")).toEqual({
			artist: "Daft Punk",
			title: "Around the World",
		});
	});

	it("handles en dash separator", () => {
		expect(parseTitle("Coldplay – Yellow")).toEqual({
			artist: "Coldplay",
			title: "Yellow",
		});
	});

	it("removes feat. clause", () => {
		expect(parseTitle("Eminem - Stan feat. Dido")).toEqual({
			artist: "Eminem",
			title: "Stan",
		});
	});

	it("removes ft. with parens", () => {
		expect(parseTitle("Drake - One Dance (ft. Wizkid)")).toEqual({
			artist: "Drake",
			title: "One Dance",
		});
	});

	it("removes trailing pipe segment", () => {
		expect(parseTitle("Adele - Hello | Vevo")).toEqual({
			artist: "Adele",
			title: "Hello",
		});
	});

	it("uses Topic channel as artist", () => {
		expect(parseTitle("Bohemian Rhapsody", "Queen - Topic")).toEqual({
			artist: "Queen",
			title: "Bohemian Rhapsody",
		});
	});

	it("falls back to channel when no separator", () => {
		expect(parseTitle("My Cool Song", "Some Artist VEVO")).toEqual({
			artist: "Some Artist",
			title: "My Cool Song",
		});
	});

	it("handles multiple noise tags", () => {
		expect(
			parseTitle("Linkin Park - Numb [Official Music Video] (HD)"),
		).toEqual({
			artist: "Linkin Park",
			title: "Numb",
		});
	});

	it("handles colon separator", () => {
		expect(parseTitle("Bach: Cello Suite No. 1")).toEqual({
			artist: "Bach",
			title: "Cello Suite No. 1",
		});
	});

	it("handles remastered tag", () => {
		expect(parseTitle("The Beatles - Hey Jude (Remastered 2015)")).toEqual({
			artist: "The Beatles",
			title: "Hey Jude",
		});
	});

	it("handles Russian title with hyphen", () => {
		expect(parseTitle("Земфира - Хочешь")).toEqual({
			artist: "Земфира",
			title: "Хочешь",
		});
	});

	it("handles 4K tag", () => {
		expect(parseTitle("Avicii - Wake Me Up (4K)")).toEqual({
			artist: "Avicii",
			title: "Wake Me Up",
		});
	});

	it("strips surrounding quotes from title", () => {
		expect(parseTitle('The Weeknd - "Blinding Lights"')).toEqual({
			artist: "The Weeknd",
			title: "Blinding Lights",
		});
	});

	it("no separator and no channel: artist empty", () => {
		expect(parseTitle("Some Random Title")).toEqual({
			artist: "",
			title: "Some Random Title",
		});
	});

	it("splits on first separator only", () => {
		// Title can contain ' - ' inside, but we always split at the first one.
		// Acceptable trade-off — providers usually find it anyway.
		expect(parseTitle("Pink Floyd - Wish You Were Here - Live")).toEqual({
			artist: "Pink Floyd",
			title: "Wish You Were Here - Live",
		});
	});

	it("collapses multiple spaces", () => {
		expect(parseTitle("Muse  -  Madness   (Official Audio)")).toEqual({
			artist: "Muse",
			title: "Madness",
		});
	});

	it("does not split on single-word hyphenated phrases", () => {
		// no spaces around hyphen — not a separator
		expect(parseTitle("Anti-Hero")).toEqual({
			artist: "",
			title: "Anti-Hero",
		});
	});
});
