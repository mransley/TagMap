export interface TagRule {
	pattern: string;
	tags: string[];
}

// Patterns not already ending in a wildcard (e.g. "*/Archive") mean "this folder and everything inside it".
export function normalizePattern(pattern: string): string {
	let trimmed = pattern.trim().replace(/^\/+/, "").replace(/\/+$/, "");
	if (!trimmed.endsWith("*")) {
		trimmed += "/**";
	}
	return trimmed;
}

export function patternToRegex(pattern: string, caseSensitive: boolean): RegExp {
	const normalized = normalizePattern(pattern);
	const escaped = normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&");
	const DOUBLE_STAR = " ";
	const withPlaceholder = escaped.replace(/\*\*/g, DOUBLE_STAR);
	const withSingleStar = withPlaceholder.replace(/\*/g, "[^/]*");
	const source = withSingleStar.split(DOUBLE_STAR).join(".*");
	return new RegExp(`^${source}$`, caseSensitive ? "" : "i");
}

export interface RuleMatch {
	rule: TagRule;
	tags: string[];
}

// Like matchingTags, but reports which rule(s) contributed which tags, for debug logging.
export function matchingRules(path: string, rules: TagRule[], caseSensitive: boolean): RuleMatch[] {
	const matches: RuleMatch[] = [];
	for (const rule of rules) {
		if (!rule.pattern.trim()) continue;
		const regex = patternToRegex(rule.pattern, caseSensitive);
		if (regex.test(path)) {
			const tags = rule.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0);
			matches.push({ rule, tags });
		}
	}
	return matches;
}

export function matchingTags(path: string, rules: TagRule[], caseSensitive: boolean): Set<string> {
	const tags = new Set<string>();
	for (const { tags: ruleTags } of matchingRules(path, rules, caseSensitive)) {
		for (const tag of ruleTags) tags.add(tag);
	}
	return tags;
}

export function normalizeExistingTags(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((v) => String(v));
	}
	if (typeof value === "string") {
		return value
			.split(",")
			.map((v) => v.trim())
			.filter((v) => v.length > 0);
	}
	return [];
}
