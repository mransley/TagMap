import { describe, expect, it } from "vitest";
import { matchingTags, normalizeExistingTags, normalizePattern, patternToRegex, TagRule } from "./tag-rules";

describe("normalizePattern", () => {
	it("leaves patterns that already end in a wildcard untouched", () => {
		expect(normalizePattern("Projects/*")).toBe("Projects/*");
		expect(normalizePattern("Projects/**")).toBe("Projects/**");
	});

	it("appends /** to patterns that don't end in a wildcard", () => {
		expect(normalizePattern("*/Archive")).toBe("*/Archive/**");
		expect(normalizePattern("07 People")).toBe("07 People/**");
	});

	it("trims surrounding slashes and whitespace", () => {
		expect(normalizePattern("  /Projects/** ")).toBe("Projects/**");
	});
});

describe("patternToRegex", () => {
	const matches = (pattern: string, path: string, caseSensitive = false) =>
		patternToRegex(pattern, caseSensitive).test(path);

	it("matches a single * only to files directly inside the folder", () => {
		expect(matches("Projects/*", "Projects/Note.md")).toBe(true);
		expect(matches("Projects/*", "Projects/Sub/Note.md")).toBe(false);
	});

	it("matches ** at any depth, including directly inside the folder", () => {
		expect(matches("Projects/**", "Projects/Note.md")).toBe(true);
		expect(matches("Projects/**", "Projects/Sub/Note.md")).toBe(true);
		expect(matches("Projects/**", "Projects/Sub/Deeper/Note.md")).toBe(true);
	});

	it("does not match a sibling folder with a similar name", () => {
		expect(matches("Projects/**", "ProjectsArchive/Note.md")).toBe(false);
		expect(matches("Projects/*", "OtherProjects/Note.md")).toBe(false);
	});

	it("treats a bare folder name as matching any top-level occurrence of that subfolder", () => {
		expect(matches("*/Archive", "Notes/Archive/SomeNote.md")).toBe(true);
		expect(matches("*/Archive", "Notes/Sub/Archive/SomeNote.md")).toBe(false);
	});

	it("matches direct children for a literal folder segment", () => {
		expect(matches("08 Books/*", "08 Books/SomeBook.md")).toBe(true);
		expect(matches("08 Books/*", "08 Books/Sub/Book.md")).toBe(false);
	});

	it("is case-insensitive by default and case-sensitive when requested", () => {
		expect(matches("projects/**", "Projects/Note.md")).toBe(true);
		expect(matches("projects/**", "Projects/Note.md", true)).toBe(false);
	});
});

describe("matchingTags", () => {
	const rules: TagRule[] = [
		{ pattern: "Projects/**", tags: ["project"] },
		{ pattern: "Projects/Client Work/**", tags: ["client", "billable"] },
		{ pattern: "08 Books/*", tags: ["book", "reading"] },
	];

	it("collects tags from every rule whose pattern matches, deduplicated", () => {
		const tags = matchingTags("Projects/Client Work/Acme Redesign.md", rules, false);
		expect(tags).toEqual(new Set(["project", "client", "billable"]));
	});

	it("returns an empty set when no rule matches", () => {
		const tags = matchingTags("Daily Notes/2026-07-16.md", rules, false);
		expect(tags.size).toBe(0);
	});

	it("ignores rules with a blank pattern", () => {
		const tags = matchingTags("Anything/Note.md", [{ pattern: "   ", tags: ["should-not-appear"] }], false);
		expect(tags.size).toBe(0);
	});

	it("ignores blank tags within a matching rule", () => {
		const tags = matchingTags("08 Books/Dune.md", [{ pattern: "08 Books/*", tags: ["book", "  ", ""] }], false);
		expect(tags).toEqual(new Set(["book"]));
	});
});

describe("normalizeExistingTags", () => {
	it("passes through an array of strings", () => {
		expect(normalizeExistingTags(["a", "b"])).toEqual(["a", "b"]);
	});

	it("coerces non-string array items to strings", () => {
		expect(normalizeExistingTags([1, true])).toEqual(["1", "true"]);
	});

	it("splits a comma-separated string and trims whitespace", () => {
		expect(normalizeExistingTags("a, b ,c")).toEqual(["a", "b", "c"]);
	});

	it("drops empty entries from a comma-separated string", () => {
		expect(normalizeExistingTags("a, , b")).toEqual(["a", "b"]);
	});

	it("returns an empty array for undefined or unsupported values", () => {
		expect(normalizeExistingTags(undefined)).toEqual([]);
		expect(normalizeExistingTags(42)).toEqual([]);
	});
});
