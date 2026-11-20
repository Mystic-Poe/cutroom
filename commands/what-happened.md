---
description: Replay what Claude did here, in plain English, and help find why something looks wrong
argument-hint: "[what looks wrong, or: today | everything]"
allowed-tools: Bash(cutroom-activity:*), Bash(ffprobe:*), Bash(ls:*), Bash(cutroom-undo-move:*)
---

The editor wants to understand what happened. They are not a programmer: be calm, short and concrete.

1. Run `cutroom-activity` (add `--all` if `$ARGUMENTS` mentions everything or another folder, `--hours 72` if it mentions days).
2. Tell the story in plain English, oldest first, grouped into a few steps. For each step, say what was done and what changed on disk (where new files went, what moved). Say clearly anything cutroom **blocked** or **asked** about, and that this was the safety rail working. Don't paste the raw log.
3. If they described a problem (`$ARGUMENTS`), match it against the log and these known causes. Then propose the fix, and do the safe parts once they agree:
   - **Clips red / "Media Offline" in Resolve**: footage was moved after Resolve linked it. If a move in the log matches, offer `cutroom-undo-move`. Otherwise, explain how to relink: Media Pool → right-click → Relink → pick the folder.
   - **Out of sync, or the wrong speed**: a frame-rate mismatch or variable frame rate. Check with `ffprobe` and offer constant-frame-rate copies as new files.
   - **Choppy graphics**: the graphic's frame rate differs from the timeline's. Offer to re-render at the timeline's rate.
   - **Captions drift**: they were timed to the raw clip instead of the cut. Offer to re-time them to the edited cut.
   - **"It said it looked fine, but it doesn't"**: Claude can't see motion or hear sound. Their watch-through wins.
   - **A failed job**: read its reason in the log and explain the next step.
4. If nothing in the log explains it, say so honestly and ask one question that would narrow it down.
