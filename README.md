# kami

**Knowledge Agent Markdown Interface** - AI-friendly personal knowledge base

kami is a local-first personal knowledge base CLI that manages Markdown + YAML frontmatter articles on the filesystem. It is designed to be naturally usable by both AI coding agents (via CLI/JSON) and humans (via Web UI).

## Features

- **Markdown + YAML frontmatter** - Standard format, works with any editor
- **Multi-scope architecture** - Global (`~/.kami/`) and local (`./.kami/`) scopes
- **Full-text search** - MiniSearch with BudouX Japanese tokenization
- **Wiki links** - `[[slug]]` cross-references with backlink tracking
- **Web UI** - Browse and edit articles in a browser
- **Hook system** - Run custom scripts on article lifecycle events
- **Template system** - Customizable article templates
- **JSON output** - `--json` flag for machine-readable output, ideal for AI agents

## Requirements

- [Bun](https://bun.sh) >= 1.0.0

## Installation

```sh
bun install -g @kami-pkm/kami
```

## Quick Start

```sh
# Initialize a knowledge base in the current project
kami init

# Create an article
kami create "My First Article" --folder notes --tag getting-started

# List articles
kami list

# Search
kami search "keyword"

# Read an article
kami read my-first-article

# Start the Web UI
kami serve
```

## Scopes

| Scope  | Path       | Purpose                                    |
| ------ | ---------- | ------------------------------------------ |
| global | `~/.kami/` | Knowledge shared across all projects       |
| local  | `./.kami/` | Project-specific knowledge (ADRs, etc.)    |

- **Read**: Local scope first, falls back to global
- **Write**: Local scope if present, otherwise global
- **`--scope`** flag: Explicitly specify `local`, `global`, or `all`

## CLI Commands

| Command      | Description                     |
| ------------ | ------------------------------- |
| `init`       | Initialize a new scope          |
| `create`     | Create a new article            |
| `read`       | Read article content            |
| `edit`       | Edit an existing article        |
| `delete`     | Delete an article               |
| `list`       | List articles with filters      |
| `search`     | Full-text search                |
| `links`      | Show forward links from article |
| `backlinks`  | Show backlinks to article       |
| `template`   | Manage templates                |
| `export`     | Export articles                 |
| `reindex`    | Rebuild search index            |
| `build`      | Build static HTML site          |
| `serve`      | Start Web UI server             |

Use `kami <command> --help` for detailed usage of each command.

## JSON Mode

All commands support `--json` for machine-readable output, making kami ideal for integration with AI coding agents:

```sh
kami list --json
kami search "query" --json
kami read my-article --json
```

## License

[MIT](LICENSE)
