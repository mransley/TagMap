# TagMap

Automatically tag your Obsidian notes based on which folder they live in. Define glob-style rules once, and TagMap applies the matching tags whenever a note is created, moved, or renamed into a matching folder.

## Features

- **Glob-based rules** — map folder paths (e.g. `Projects/**`, `08 Books/*`) to one or more tags.
- **Multiple tags per note** — a single note can pick up tags from several overlapping rules at once.
- **Automatic on creation** — new notes are tagged the moment they're created in a matching folder.
- **Automatic on move** — moving or renaming a note into (or out of) a matching folder updates its tags.
- **Bulk apply** — a command to retroactively apply configured tags to every existing note in a folder.
- **Frontmatter-first** — tags are written to YAML frontmatter (`tags: [...]`) rather than inline `#tags`, so they stay out of your note body.

## Installation

1. Open Obsidian and go to **Settings → Community plugins → Browse**.
2. Search for **TagMap**.
3. Click **Install**, then **Enable**.

### Manual installation

1. Download the latest release from the [Releases](../../releases) page.
2. Extract `main.js`, `manifest.json`, and `styles.css` into `<your vault>/.obsidian/plugins/tagmap/`.
3. Reload Obsidian and enable **TagMap** under **Settings → Community plugins**.

## Configuration

Open **Settings → TagMap** to manage your folder-to-tag rules. Each rule has two parts:

| Field | Description |
|---|---|
| **Glob pattern** | A glob-style path pattern matched against the note's folder path. |
| **Tags** | One or more tags to apply when a note's path matches the pattern. |

### Glob syntax

| Pattern | Matches |
|---|---|
| `Projects/*` | Notes directly inside `Projects/`, not subfolders |
| `Projects/**` | Notes inside `Projects/` and any nested subfolder |
| `*/Archive` | Any top-level folder's `Archive` subfolder |
| `08 Books/*` | Notes directly inside `08 Books/` |

### Example configuration

```yaml
rules:
  - pattern: "Projects/**"
    tags: ["project"]
  - pattern: "Projects/Client Work/**"
    tags: ["client", "billable"]
  - pattern: "08 Books/*"
    tags: ["book", "reading"]
  - pattern: "07 People/*"
    tags: ["person"]
```

With the config above, a note at `Projects/Client Work/Acme Redesign.md` would receive **all** matching tags: `project`, `client`, and `billable` — since it matches both the `Projects/**` rule and the more specific `Projects/Client Work/**` rule.

## Applying tags to existing notes

New rules only affect notes going forward by default. To backfill tags onto notes that already exist:

1. Open the Command Palette (`Ctrl/Cmd + P`).
2. Run **TagMap: Apply tags to folder**.
3. Choose a folder — TagMap will apply any matching rules to every markdown file inside it (including subfolders, if the rule's pattern covers them).

This will not remove tags a note already has; it only adds tags that are missing.

## How tags are written

TagMap adds tags to a note's YAML frontmatter:

```yaml
---
tags:
  - project
  - client
  - billable
---
```

If a note has no frontmatter yet, TagMap creates it. If frontmatter already exists, TagMap merges new tags into the existing `tags` list without disturbing other properties.

## Settings

| Setting | Description | Default |
|---|---|---|
| **Tag on create** | Apply matching tags when a new note is created | On |
| **Tag on move/rename** | Re-evaluate and update tags when a note changes folder | On |
| **Remove tags on move** | Strip tags from the old folder's rule(s) if a note is moved out of a matching path | Off |
| **Case-sensitive matching** | Match folder paths case-sensitively | Off |

## FAQ

**What happens if two rules give conflicting tags?**
Nothing conflicts — TagMap is additive. A note can carry tags from every rule whose pattern matches its path.

**Can I use nested/hierarchical tags like `project/client`?**
Yes, any valid Obsidian tag string works in the `tags` field, including nested tags.

**Does this work with the `#tag` inline style instead of frontmatter?**
Not currently — TagMap manages the frontmatter `tags` field only, to avoid cluttering note content.

## Contributing

Issues and pull requests are welcome. Please open an issue describing the bug or feature before submitting a large PR.

## License

MIT