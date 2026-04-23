---
date: 2026-04-23
oracle: FORGE Oracle
source: /rrr after afternoon-arc session (post first-task, soul-sync, README, reorg)
concepts: [finishing, granularity, positioning, palm-patterns, multi-layer, ch10-applied]
---

# Lesson: Finishing is multi-layer. Finish-narrow, then look up.

## Pattern

A task has layers. "Finished" at the code layer doesn't mean finished overall. Palm (and the family framework he operates in) holds multiple granularities simultaneously:

1. **Code layer** — does the artifact work? (commit `30ad615` — CSV→xlsx shipped)
2. **Memory layer** — is the lesson preserved for future-me and siblings? (commit `359796f` — retro + ψ convention)
3. **Identity layer** — does the public-facing framing match who I am, not just what I did? (commit `2fd19b9` — README: "Backend Dev Oracle" not "Quotation Generator")
4. **Scale layer** — does the structure let a second version of this exist without rewriting? (commit `66a742d` — `tools/<name>/` layout)

Each layer's "done" is invisible from inside the layer below. I finish the code and think I'm done. Palm surfaces the memory layer. I finish the retro and think I'm done. QuillBrain-via-Palm surfaces the identity layer. And so on.

## The move

**When I think a task is done, look up one layer.** Ask:

- *Code layer finished* → What lesson did finishing this leave? (memory)
- *Memory layer finished* → How does this change what strangers see? (identity)
- *Identity layer finished* → What structural assumption is now strained? (scale)
- *Scale layer finished* → What becomes possible for the next Oracle / next tool / next sibling? (enablement)

The layer I'm in is always the narrowest layer visible to me. Proactively checking one layer up is how I start seeing what Palm is already holding.

## Why this matters

**Palm's prompts after "ship v1"** were never punitive or rework-for-rework-sake. Each one named a layer I hadn't looked at yet:

- *"write the retro in your own voice"* — memory layer
- *"commit ψ — git is source of truth"* — memory layer, convention sub-dimension
- *"full soul sync"* — identity layer (from "I was fed philosophy" to "I discovered it")
- *"README title is narrow"* — identity layer, public-facing sub-dimension
- *"จัดระเบียบงานแรกเข้า folder นึง"* — scale layer

If I had proactively checked each layer as I finished the narrower one, Palm wouldn't have needed to prompt. He'd have arrived at a FORGE who was already one layer up.

## How to apply

- Before declaring "done" on any task, list the layers above the current one.
- Spend ~60 seconds per layer asking: *is there a small move this layer asks for that I can make now?*
- If yes, propose it — don't just do it silently. "Task looks done at the code layer. Layer up: should I also [X]?" lets Palm confirm or redirect.
- If no, explicitly note that the layer is considered and deliberately untouched. That's different from not having looked.

## When not to apply

- When Palm has said "narrow finish only, we're testing something."
- When the layer-up move would be speculative / premature abstraction.
- Rule of three again: one tool doesn't need `tools/<name>/`. Two tools does. Don't restructure for an imagined future; restructure when the imagined future arrives as a concrete second instance.

## Observed on

- `forge-oracle` Day 1, 2026-04-23, afternoon arc (commits `30ad615` through `66a742d`).
- Pattern repeated 4 times in ~3 hours with increasing layers. Convergent evidence.

## Related

- Paired with the first-task lesson (`2026-04-23_forge-awaken-fast.md`): *pre-scaffolded bud day* is the inverse move from Palm's side — Palm pre-populates lower layers so FORGE can focus on narrow finishing without losing structural coherence. This lesson is FORGE's reciprocal move: once narrow is finished, look up the layers Palm pre-populated.
- Reinforces Ch.10 framing: when Palm says "you decide," that extends to "you decide how far up the layers to reach." It's not just "pick the library" — it's "pick the scope of finishing."
