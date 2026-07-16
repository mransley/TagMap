import {
	App,
	FuzzySuggestModal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFile,
	TFolder,
} from "obsidian";
import { matchingRules, normalizeExistingTags, TagRule } from "./tag-rules";

interface TagMapSettings {
	rules: TagRule[];
	tagOnCreate: boolean;
	tagOnMove: boolean;
	removeTagsOnMove: boolean;
	caseSensitive: boolean;
	debugLogging: boolean;
}

const DEFAULT_SETTINGS: TagMapSettings = {
	rules: [],
	tagOnCreate: true,
	tagOnMove: true,
	removeTagsOnMove: false,
	caseSensitive: false,
	debugLogging: false,
};

function describeMatches(matches: { rule: TagRule; tags: string[] }[]): string {
	if (matches.length === 0) return "no rules matched";
	return matches.map(({ rule, tags }) => `"${rule.pattern}" -> [${tags.join(", ")}]`).join("; ");
}

export default class TagMapPlugin extends Plugin {
	settings: TagMapSettings;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new TagMapSettingTab(this.app, this));

		this.addCommand({
			id: "apply-tags-to-folder",
			name: "Apply tags to folder",
			callback: () => {
				new FolderSuggestModal(this.app, (folder) => {
					this.applyTagsToFolder(folder);
				}).open();
			},
		});

		this.app.workspace.onLayoutReady(() => {
			this.registerEvent(
				this.app.vault.on("create", (file) => {
					if (this.settings.tagOnCreate && file instanceof TFile && file.extension === "md") {
						this.tagFile(file);
					}
				})
			);

			this.registerEvent(
				this.app.vault.on("rename", (file, oldPath) => {
					if (this.settings.tagOnMove && file instanceof TFile && file.extension === "md") {
						this.handleRename(file, oldPath);
					}
				})
			);
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	private log(message: string): void {
		if (this.settings.debugLogging) {
			console.log(`[TagMap] ${message}`);
		}
	}

	async tagFile(file: TFile, additionalTags?: Set<string>) {
		const matches = matchingRules(file.path, this.settings.rules, this.settings.caseSensitive);
		this.log(`"${file.path}": ${describeMatches(matches)}`);

		const tags = new Set<string>();
		for (const { tags: ruleTags } of matches) {
			for (const tag of ruleTags) tags.add(tag);
		}
		if (additionalTags) {
			for (const tag of additionalTags) tags.add(tag);
		}
		if (tags.size === 0) {
			this.log(`"${file.path}": no tags to apply, skipping`);
			return;
		}

		this.log(`"${file.path}": applying tags [${Array.from(tags).join(", ")}]`);
		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const existing = normalizeExistingTags(frontmatter.tags);
			const merged = new Set(existing);
			for (const tag of tags) merged.add(tag);
			frontmatter.tags = Array.from(merged);
		});
	}

	async handleRename(file: TFile, oldPath: string) {
		this.log(`rename detected: "${oldPath}" -> "${file.path}"`);

		const newMatches = matchingRules(file.path, this.settings.rules, this.settings.caseSensitive);
		const newTags = new Set<string>();
		for (const { tags } of newMatches) {
			for (const tag of tags) newTags.add(tag);
		}

		if (!this.settings.removeTagsOnMove) {
			await this.tagFile(file, newTags);
			return;
		}

		const oldMatches = matchingRules(oldPath, this.settings.rules, this.settings.caseSensitive);
		const oldTags = new Set<string>();
		for (const { tags } of oldMatches) {
			for (const tag of tags) oldTags.add(tag);
		}
		const staleTags = new Set([...oldTags].filter((tag) => !newTags.has(tag)));

		this.log(`"${file.path}": old path ${describeMatches(oldMatches)}`);
		this.log(`"${file.path}": new path ${describeMatches(newMatches)}`);
		if (staleTags.size > 0) {
			this.log(`"${file.path}": removing stale tags [${Array.from(staleTags).join(", ")}]`);
		}

		await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
			const existing = normalizeExistingTags(frontmatter.tags);
			const merged = new Set(existing);
			for (const tag of staleTags) merged.delete(tag);
			for (const tag of newTags) merged.add(tag);
			frontmatter.tags = Array.from(merged);
		});
	}

	async applyTagsToFolder(folder: TFolder) {
		const prefix = folder.path === "/" ? "" : folder.path + "/";
		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => folder.path === "/" || file.path === prefix.slice(0, -1) || file.path.startsWith(prefix));

		this.log(`applying tags to folder "${folder.path || "/"}" (${files.length} note(s) to scan)`);

		let tagged = 0;
		for (const file of files) {
			const matches = matchingRules(file.path, this.settings.rules, this.settings.caseSensitive);
			if (matches.every(({ tags }) => tags.length === 0)) continue;
			await this.tagFile(file);
			tagged++;
		}

		this.log(`applied tags to ${tagged} of ${files.length} note(s) in "${folder.path || "/"}"`);
		new Notice(`TagMap: applied tags to ${tagged} of ${files.length} note(s) in "${folder.path || "/"}"`);
	}
}

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
	constructor(app: App, private onChoose: (folder: TFolder) => void) {
		super(app);
		this.setPlaceholder("Choose a folder to apply tags to");
	}

	getItems(): TFolder[] {
		const folders: TFolder[] = [this.app.vault.getRoot()];
		for (const file of this.app.vault.getAllLoadedFiles()) {
			if (file instanceof TFolder) folders.push(file);
		}
		return folders;
	}

	getItemText(folder: TFolder): string {
		return folder.path === "/" ? "/ (vault root)" : folder.path;
	}

	onChooseItem(folder: TFolder): void {
		this.onChoose(folder);
	}
}

class TagMapSettingTab extends PluginSettingTab {
	plugin: TagMapPlugin;

	constructor(app: App, plugin: TagMapPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Tag on create")
			.setDesc("Apply matching tags when a new note is created")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.tagOnCreate).onChange(async (value) => {
					this.plugin.settings.tagOnCreate = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Tag on move/rename")
			.setDesc("Re-evaluate and update tags when a note changes folder")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.tagOnMove).onChange(async (value) => {
					this.plugin.settings.tagOnMove = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Remove tags on move")
			.setDesc("Strip tags from the old folder's rule(s) if a note is moved out of a matching path")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.removeTagsOnMove).onChange(async (value) => {
					this.plugin.settings.removeTagsOnMove = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Case-sensitive matching")
			.setDesc("Match folder paths case-sensitively")
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.caseSensitive).onChange(async (value) => {
					this.plugin.settings.caseSensitive = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName("Debug logging")
			.setDesc(
				"Log tagging decisions (which rules matched, which tags were applied or removed) to the developer console"
			)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings.debugLogging).onChange(async (value) => {
					this.plugin.settings.debugLogging = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl).setName("Rules").setHeading();

		this.plugin.settings.rules.forEach((rule, index) => {
			const setting = new Setting(containerEl)
				.addText((text) =>
					text
						.setPlaceholder("Glob pattern, e.g. Projects/**")
						.setValue(rule.pattern)
						.onChange(async (value) => {
							rule.pattern = value;
							await this.plugin.saveSettings();
						})
				)
				.addText((text) =>
					text
						.setPlaceholder("Tags, comma-separated")
						.setValue(rule.tags.join(", "))
						.onChange(async (value) => {
							rule.tags = value
								.split(",")
								.map((tag) => tag.trim())
								.filter((tag) => tag.length > 0);
							await this.plugin.saveSettings();
						})
				)
				.addExtraButton((button) =>
					button
						.setIcon("trash")
						.setTooltip("Remove rule")
						.onClick(async () => {
							this.plugin.settings.rules.splice(index, 1);
							await this.plugin.saveSettings();
							this.display();
						})
				);
			setting.settingEl.addClass("tagmap-rule");
		});

		new Setting(containerEl).addButton((button) =>
			button
				.setButtonText("Add rule")
				.setCta()
				.onClick(async () => {
					this.plugin.settings.rules.push({ pattern: "", tags: [] });
					await this.plugin.saveSettings();
					this.display();
				})
		);
	}
}
