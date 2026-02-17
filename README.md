# kami

**Knowledge Agent Markdown Interface** — AI-friendly personal knowledge base

[日本語](README.ja.md)

kami is a local-first personal knowledge base CLI that manages Markdown + YAML frontmatter articles on the filesystem. Designed to be naturally usable by both AI coding agents (via CLI/JSON) and humans (via Web UI).

## Features

- **Markdown + YAML frontmatter** — Standard format, works with any editor
- **Multi-scope architecture** — Global (`~/.kami/`) and local (`./.kami/`) scopes
- **Full-text search** — MiniSearch with BudouX Japanese tokenization
- **Wiki links** — `[[slug]]` cross-references with backlink tracking
- **Web UI** — Browse, search, create, and edit articles in a browser (React SSR + Hono)
- **Static site generation** — Build a static HTML site from your knowledge base
- **Hook system** — Run custom scripts on article lifecycle events (pre/post create, update, delete, build)
- **Template system** — Customizable article templates with variable expansion
- **AI tool integration** — `kami install` sets up skills for Claude Code, Codex, and Gemini
- **JSON output** — `--json` flag on all commands for machine-readable output

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

kami uses a multi-scope architecture to separate project-specific and shared knowledge:

| Scope  | Path       | Purpose                                 |
| ------ | ---------- | --------------------------------------- |
| global | `~/.kami/` | Knowledge shared across all projects    |
| local  | `./.kami/` | Project-specific knowledge (ADRs, etc.) |

- **Read**: Local scope first, falls back to global
- **Write**: Local scope if present, otherwise global
- **`--scope`** flag: Explicitly specify `local`, `global`, or `all`

## CLI Commands

| Command     | Description                              |
| ----------- | ---------------------------------------- |
| `init`      | Initialize a new scope                   |
| `create`    | Create a new article                     |
| `read`      | Read article content                     |
| `edit`      | Edit an existing article                 |
| `delete`    | Delete an article                        |
| `list`      | List articles with filters and sorting   |
| `search`    | Full-text search                         |
| `links`     | Show forward links from an article       |
| `backlinks` | Show backlinks to an article             |
| `template`  | Manage templates (list, show, create)    |
| `export`    | Export articles as Markdown or HTML      |
| `reindex`   | Rebuild search index and link graph      |
| `build`     | Build static HTML site                   |
| `serve`     | Start the web server                     |
| `install`   | Install kami skill for AI coding tools   |

Use `kami <command> --help` for detailed usage of each command.

## JSON Mode

All commands support `--json` for machine-readable output, making kami ideal for integration with AI coding agents:

```sh
kami list --json
kami search "query" --json
kami read my-article --json
```

## Wiki Links

Use `[[slug]]` syntax in article bodies to create cross-references between articles. kami automatically tracks forward links and backlinks:

```sh
kami links my-article       # Show outgoing links
kami backlinks my-article   # Show incoming links
```

## Templates

kami ships with built-in templates (`note`, `daily`) and supports custom templates:

```sh
kami template list             # List available templates
kami template show note        # Show template content
kami create "Title" -T daily   # Create article from template
```

Templates support variable expansion: `{{title}}`, `{{date}}`, `{{datetime}}`.

## Hooks

Run custom scripts on article lifecycle events. Configure hooks in `hooks.json` within a scope directory:

**Supported events**: `article:pre-create`, `article:post-create`, `article:pre-update`, `article:post-update`, `article:pre-delete`, `article:post-delete`, `build:pre`, `build:post`

Pre-event hooks can block operations; post-event hooks run as notifications.

## Web UI

Start a web server to browse, search, and edit articles in the browser:

```sh
kami serve              # Start on default port 3000
kami serve --port 8080  # Custom port
```

## Static Site Generation

Build a static HTML site from your knowledge base:

```sh
kami build              # Full build
kami build --clean      # Clean and rebuild
```

## AI Tool Integration

Install kami as a skill for AI coding tools:

```sh
kami install                                    # Interactive setup
kami install --target claude-code --level project  # Non-interactive
```

Supported targets: `claude-code`, `codex`, `gemini`

## Development

```sh
bun install
bun test           # Run tests
bun run typecheck  # Type check
```

## License

[MIT](LICENSE)
