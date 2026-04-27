---
name: Re-entry orientation after context compaction
description: Summary says "done" doesn't mean the file is done — always re-read actual files after compaction
type: feedback
---

After a context compaction event, the summary is a frozen snapshot written by the previous session. It may claim files were fixed that haven't been saved, or describe field names that changed. Ground truth is the current file state, not the summary.

**Why:** On Day 2 Soraphop, re-entered a compacted context where the summary said "b2c-signup.ts tx errors are fixed" — but the actual file still had the old code. Also worked on `main` instead of the feature branch because orientation skipped `git branch`.

**How to apply:** Re-entry checklist after compaction:
1. `git branch` — verify current branch
2. `git status` — what's actually staged/modified
3. Re-read any files the summary claims were partially fixed before continuing work on them
