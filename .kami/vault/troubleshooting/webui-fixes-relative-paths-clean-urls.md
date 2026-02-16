---
title: 'WebUI fixes: relative paths, clean URLs, slug rules'
tags:
  - bug-fix
created: '2026-02-16T14:15:20.162Z'
updated: '2026-02-16T14:15:20.162Z'
template: note
---

## What was done

Three WebUI-related issues were fixed:

1. **SKILL.md**: Added instruction for agents to use URL-safe slugs via --slug flag.

2. **index.json filePath**: Changed from absolute to relative paths. Conversion happens transparently in loadIndex()/saveIndex().

3. **serve output**: Changed from slug.html to slug/index.html for clean URLs.

## Key insight

resolveSlug() in article.ts bypassed loadIndex(). Fixed by replacing inline JSON.parse with loadIndex().

