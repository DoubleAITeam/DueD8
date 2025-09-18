# Contributing Guide

This project uses a **single rolling integration branch** (`codex/trunk`) for all AI-assisted development.  
The goal is to avoid branch sprawl and repeated conflict resolution.

---

## Purpose

- Keep **`main`** stable and release-ready at all times.
- Have **one continuously updated branch** (`codex/trunk`) where Codex and developers push changes.
- Use a **single always-open Pull Request** (PR) from `codex/trunk` → `main` to review, test, and merge work.

---

## Workflow for Codex Tasks

Before starting a new Codex task:

```bash
git checkout codex/trunk
git fetch origin
git merge origin/main   # keep codex/trunk current
git push
```

Then instruct Codex:

> **Always commit and push changes directly to `codex/trunk`. Do not create new branches.**

This keeps all tasks flowing into the same PR.

---

## Refreshing `codex/trunk`

If `main` receives updates outside of Codex tasks:

```bash
git checkout codex/trunk
git fetch origin
git merge origin/main
git push
```

This ensures new work starts from the latest `main` state.

---

## Shipping to `main`

When the rolling PR is green and approved:

1. **Merge the PR** on GitHub (preferably squash-merge).
2. Locally, reset `codex/trunk` to `main` so it stays clean:

```bash
git checkout codex/trunk
git fetch origin
git reset --hard origin/main
git push --force-with-lease
```

This clears merged commits and prepares the branch for the next cycle.

---

## Branch Protections

Recommended settings:

- Protect `main` (require PR, require checks).
- Optionally protect `codex/trunk` from deletion but allow direct pushes.

---

## Summary

- **`main`** = stable release branch.
- **`codex/trunk`** = rolling branch for all Codex and development tasks.
- **One always-open PR** connects them.
- Refresh before each task, merge to `main` when stable, reset `codex/trunk` after merge.

This workflow keeps history clean, avoids constant conflict resolution, and ensures every commit is reviewed in a single place.
