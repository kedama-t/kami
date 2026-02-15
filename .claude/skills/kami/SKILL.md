---
name: kami
description: >
  Persistent long-term knowledge base for the coding agent.
  Workflow policy:
  1. Before any substantial implementation or design decision,
     search kami for related knowledge.
  2. If relevant knowledge exists, incorporate it into planning.
  3. After completing significant work (features, refactors, bug fixes,
     architectural decisions, investigations), record:
       - What was done
       - Why it was done
       - Key insights or trade-offs
       - Reusable patterns
  Use this skill whenever memory, prior context, or knowledge persistence
  would improve correctness, consistency, or efficiency.
---

# kami CLI

kami (Knowledge Agent Markdown Interface) — a local-first personal knowledge base CLI. Manages articles as Markdown files with YAML frontmatter.

## Rules for agents

- Always use `--json` flag to get structured output
- Use `--force --json` for delete (avoids interactive prompt)
- Pipe body content via `--body -` with stdin
- Check `error.code` in JSON on failure (see [reference/error-codes.md](reference/error-codes.md))

## Scopes

| Scope  | Path       | Purpose                    |
| ------ | ---------- | -------------------------- |
| global | `~/.kami/` | User-wide shared knowledge |
| local  | `./.kami/` | Project-specific knowledge |

- Read: local-first, falls back to global
- Write: local if exists, otherwise global
- `--scope all` spans both scopes

## Commands

### Article CRUD

```bash
# Create
kami create <title> [-f <folder>] [-t <tag>]... [-T <template>] [--slug <slug>] [-b <path|->] [--draft] [-s local|global] [--json]

# Read
kami read <slug> [-m|--meta-only] [--no-frontmatter] [-s <scope>] [--json]

# Edit (--body: replace body, --append: append to body. Cannot use both)
kami edit <slug> [--title <t>] [--add-tag <tag>]... [--remove-tag <tag>]... [-b <path|->] [-a <path|->] [--draft <bool>] [--add-alias <a>] [--remove-alias <a>] [-s <scope>] [--json]

# Delete
kami delete <slug> [-F|--force] [-s <scope>] [--json]
```

### List and search

```bash
# List
kami list [-f <folder>] [-t <tag>]... [--sort created|updated|title] [--order asc|desc] [-n <limit>] [--offset <num>] [-s local|global|all] [--draft <bool>] [--json]

# Full-text search (BM25, Japanese-aware, prefix and fuzzy matching)
kami search <query> [-t <tag>]... [-f <folder>] [-s local|global|all] [-n <limit>] [--json]
```

### Links

```bash
kami links <slug> [-s <scope>] [--json]       # Forward links
kami backlinks <slug> [-s <scope>] [--json]   # Backlinks
```

### Templates

```bash
kami template list [-s <scope>] [--json]
kami template show <name> [-s <scope>] [--json]
kami template create <name> [-b <path|->] [-s <scope>] [--json]
```

### Other

```bash
kami export <slug> [-F md|html] [-o <path>] [-s <scope>]
kami reindex [-s local|global|all] [--json]
kami init [--force]   # Create .kami/ in current directory
```

## JSON output structure

Success: `{ "ok": true, "data": { ... }, "error": null }`
Error: `{ "ok": false, "data": null, "error": { "code": "...", "message": "..." } }`

## Exit codes

0=success, 1=general error, 2=article not found, 3=ambiguous slug, 4=hook blocked

## Wiki links

Use `[[slug]]` in article body to reference other articles. `[[global:slug]]` / `[[local:slug]]` for explicit scope. `[[slug|display text]]` for custom display text.

## Reference

- [JSON output examples](reference/json-examples.md) — Response examples for each command
- [Article format](reference/article-format.md) — Frontmatter spec, slug resolution, template variables
- [Error codes](reference/error-codes.md) — Exit codes and JSON error codes
