---
description: Set up cutroom (calm look, safety rails, your editing folders), or re-run any time to check everything is OK
argument-hint: "[check]"
allowed-tools: Bash(cutroom-doctor), Bash(cutroom-apply-settings --diff), Bash(cutroom-apply-settings --config:*), Bash(cutroom-text:*), Bash(ls:*), AskUserQuestion
---

You are setting up **cutroom** for a video editor. Speak plain English, keep it short, and follow these steps in order. If `$ARGUMENTS` is `check`, do only step 1 and stop.

1. **Health check.** Run `cutroom-doctor`. Turn its checklist into two short lists for the editor: *Ready* and *Needs attention* (one line each, with what to do). Don't fix anything yet.

2. **Folders.** Find likely folders first, without changing anything: run `ls -d ~/AI-edits ~/Movies/AI-edits ~/Desktop/AI-edits /Volumes/*/AI-edits 2>/dev/null` and `ls /Volumes 2>/dev/null`. Then ask with AskUserQuestion:
   - Where is the **AI-edits** folder (one folder per video, each with `raw/`, `clips/`, `renders/`)? Offer the folders you found. If none exists, suggest `~/Movies/AI-edits` and offer to create it.
   - Which **drives or folders hold media** (multi-select from `/Volumes`)? Leave out the Mac's own disk unless they keep footage on it.

3. **Save the folders.** Run `cutroom-apply-settings --config '{"projectRoots":["<AI-edits path>"],"mediaRoots":["<drive>", "..."]}'` using full paths. If AI-edits didn't exist and they agreed, create it with `mkdir -p`.

4. **Show the look changes.** Run `cutroom-apply-settings --diff` and explain in one or two lines what changes (a calmer colour theme, a status line with folder, Resolve, drive space and usage, editing words on the spinner, no spinner tips). Everything else stays as it is and a backup is kept.

5. **Apply them.** Run `cutroom-apply-settings --write`. cutroom will ask the editor to confirm; that is expected.

6. **Text size.** Run `cutroom-text` to read the current size, then ask with AskUserQuestion: "Make the text bigger?" with options *18 pt, large (Recommended)*, *16 pt, comfortable*, *20 pt, very large*, and *Keep it as it is*. Run `cutroom-text <size>` for their pick. macOS may ask once whether Terminal may control Terminal; tell them to click **OK**. (Only Mac's Terminal can be changed this way; in any other terminal app, tell them to use that app's settings or ⌘+.)

7. **Missing pieces.** For each *Needs attention* item from step 1, offer to help, one at a time, in this order: ffmpeg (`brew install ffmpeg`), MakeMyClip, the Resolve connection, Higgsfield, animation tools. Installs ask the editor first. **Homebrew itself**: don't run its installer; tell them to open https://brew.sh and paste the install line into Terminal themselves (it needs their Mac password).

8. **Finish.** Tell them to restart Claude so the new look appears (type `/exit`, then `claude`). Then try `/cutroom-help`. Remind them of two things:
   - Say **"undo that"** after any move.
   - Type **`/what-happened`** whenever something looks off.
   - Each action shows as one plain line. Pressing **ctrl+o** shows the full details, and pressing it again hides them.
