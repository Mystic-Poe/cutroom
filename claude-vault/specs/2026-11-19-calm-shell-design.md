---
type: spec
project: cutroom
created: 2026-11-19
revised: 2026-11-19 (r2, aligned with ai-editing-guide)
status: approved, v0.1.0 shipped 2026-11-19
tags: [claude-code, plugin, video-editing, davinci-resolve, safety]
---
# cutroom: Project 1, Calm shell (design, r2)

`cutroom` is a Claude Code plugin for Poe's friend, a video editor (non-developer) using **DaVinci Resolve Studio on a Mac** and **Claude Code in the terminal (Pro plan)**. It makes the terminal calm, safe and useful.

It **builds on the live setup guide**: https://ai-editing-guide.cellestial-studio.workers.dev (source: `~/Projects/ai-editing-guide/`, research: [[2026-11-19-animator-stack-higgsfield-resolve-studio]]).

The guide's house rules are currently promises Claude makes. cutroom turns them into rails, so he **reviews results instead of approving prompts**.

This spec covers **Project 1 only**. Projects 2–4 are in the [[#Roadmap]].

## Goals
- The terminal looks clean and calm, and keeps all of Claude Code's power.
- Useful information is always visible: video folder, Resolve state, drive space, running jobs, usage limit, Higgsfield credits.
- Claude works **mostly autonomously**.
  - It says in plain English what it is doing and why, and teaches as it goes.
  - It stops for his input only at **creative decisions** and **hard safety stops**.
- **He reviews results, not commands.** When something is off, `/what-happened` walks him through what Claude did and helps find why.
- Nothing can destroy footage:
  - deletes always go to the Trash;
  - existing media is never overwritten;
  - files already in `raw/` don't move without asking.

## Non-goals (Project 1)
- Resolve control, cutting/transcription, generative tools (Projects 2–4).
- The Desktop app or VS Code. The plugin must not break them, but they get no polish.
- Windows/Linux for the friend. Poe develops on Linux; **macOS is the target**.

## Fit with the guide

### What the guide sets up, and what cutroom changes about it
| Guide today | cutroom |
|---|---|
| He writes house rules into `AI-edits/CLAUDE.md` (step 6.1) | Shipped in the Editor style. Safety rules are enforced by the guard. His own CLAUDE.md still works on top |
| "Never change, rename or move anything inside a raw folder" | Enforced: anything already in `raw/` asks before being moved, renamed or deleted |
| "Read each command, then allow it" | Replaced by rails plus review: the guard blocks danger, Claude stops at decisions, `/what-happened` explains afterwards |
| "Before any Higgsfield generation, tell me the cost and wait" | Enforced: Higgsfield generation tools (connector and CLI) always ask, with the cost |
| "Watch `/usage`" | Usage limit % is always in the status line |
| "What's my Higgsfield balance?" | Credits are in the status line (Project 4 keeps them fresh) |
| Troubleshooting "Claude can't see Resolve" | The status line shows Resolve open/closed, and `/cutroom-setup` checks the connection |
| Paste-in install prompts (Node, FFmpeg, MakeMyClip, HyperFrames…) | `/cutroom-setup` checks what is there and reports what is missing. Installing still asks the first time |
| `/roughcut` and the overnight batch, which he creates himself (step 6.2–6.3) | Shipped as plugin commands in **Project 3** |

### Contradictions found and how they're resolved
1. **Free moves vs. "never move raw".** `raw/` is locked (asks); moves are free everywhere else. Bringing new footage *into* `raw/` is free.
2. **"Read each command" vs. autonomy.** Poe's call: he reviews results. The guide's safety text gets rewritten after cutroom ships.
3. **New tooling vs. MakeMyClip.** Project 3 builds on **MakeMyClip/editor**, which he already has (local, FCPXML export), after an audit. It does not replace it.
4. **The Homebrew install pipes curl into bash.** The guard keeps blocking that. `/cutroom-setup` gives him the official one-liner to paste himself if Homebrew is missing.
5. **Higgsfield tool naming.** Connector tools are `mcp__claude_ai_Higgsfield__*` (mixed case), and the optional `higgsfield` CLI exists. The guard matches case-insensitively and covers the CLI too.
6. **Parallel sessions** (step 6.4). Jobs are tagged with their folder; each window's band shows only its own.
7. **Overnight batch with `claude -p`.** With no-one to answer, "ask" means "don't". That's intended, since the batch only reads and writes cut lists.
8. **Node version.** The guide says 24+ (main) and 22+ (Tonight). Setup checks for **24+**.

## Decisions made in brainstorming
| Question | Decision |
|---|---|
| Editing software | DaVinci Resolve Studio 21.1+, macOS |
| Surface | Terminal, made calm |
| Layout | "Quiet strip": clean chat, a band above the prompt for live activity, a status line for everything else |
| Info shown | Video folder and Resolve state · drives and jobs · plain-English "what Claude is doing" · usage limit, context, Higgsfield credits |
| Autonomy | Mostly autonomous. Narrates and teaches. Asks at creative decisions. Hard stops: delete, spending credits, sending data off the Mac, acting outside AI-edits and the media drives, touching files already in `raw/` |
| Review model | **He reviews results, not prompts.** Activity log plus `/what-happened` for when something is off |
| Moves/renames | Free outside `raw/`. Claude says what moved where; every move is logged and undoable |
| Folder layout | The guide's: `AI-edits/<video>/raw/`, `clips/`, `renders/`, plus `cutlist.md`. One folder per video, one session per folder |
| Packaging | One plugin, one GitHub repo, `/plugin marketplace add`. Later projects add to it |
| Status line | Our own script; no third-party code |

## Components

```
cutroom/
├── .claude-plugin/
│   ├── plugin.json
│   └── marketplace.json        # the repo is its own marketplace
├── themes/cutroom.json         # muted "grading suite" palette
├── output-styles/editor.md     # force-for-plugin: true
├── hooks/hooks.json            # PreToolUse guard, PostToolUse activity log, band mod module
├── mod/band.js                 # band above the prompt
├── bin/
│   ├── cutroom-guard           # safety guard (Node, no deps)
│   ├── cutroom-log             # PostToolUse: appends to the activity log
│   ├── cutroom-status          # status line
│   ├── cutroom-job             # start/progress/done/fail → jobs.json
│   ├── cutroom-mv              # move/rename: never overwrites, logs, respects raw/
│   ├── cutroom-trash           # move to macOS Trash via Finder, logs
│   └── cutroom-undo-move       # reverse the last batch of moves
├── commands/
│   ├── cutroom-setup.md        # setup and health check
│   ├── cutroom-help.md         # one screen of what he can ask for
│   └── what-happened.md        # plain-English replay of what Claude did, plus help diagnosing
├── tests/
└── claude-vault/
```

**Runtime: Node ≥ 24, no npm dependencies.** He already has Node for HyperFrames, Remotion and MakeMyClip. The hook entry is a tiny shell shim; if Node is missing or the guard crashes, it **fails closed** (asks).

### 1. Theme (`themes/cutroom.json`)
- Base `dark`, overridden to a muted, low-contrast palette: warm greys, one soft accent.
- Red is kept for real errors.
- Set by setup as `custom:cutroom`.

### 2. Editor output style (`output-styles/editor.md`)
`force-for-plugin: true`.

**Voice**
- Plain English. No raw tool dumps; any jargon gets a five-word gloss.
- Before a multi-step action: one line on what and why.
- After: what changed, where it went, that the originals are untouched, and how to undo. Example: "Moved 14 clips into `clips/interviews/`. Say *undo that* to put them back."
- Teach lightly: at most one "here's the trick" line, e.g. the Resolve menu that does it by hand.

**Stop only at creative decisions**
- Pacing, look, which take, music, titles, and **approving a cut list before cutting**.
- Give 2–3 concrete options and a recommendation, then keep going.

**House rules (from the guide)**
- **Frame rate**
  - Check frame rate first; warn about variable frame rate and offer a constant-frame-rate copy as **new files**.
  - Render graphics at the footage's frame rate.
- **Cutting and exporting**
  - Show the cut list and wait for OK before cutting.
  - Export FCPXML for Resolve at the footage's frame rate.
  - Don't render a video unless asked; preview with still frames first.
- **Higgsfield**
  - Cheapest model that could work; one clip before any batch.
  - Download results into `clips/` with numbered names (`clip01.mp4`…) right away.
- **Resolve**: before any Resolve edit, duplicate the timeline and work on the copy (enforced in Project 2).
- **Watch-through**: remind him once per deliverable that the AI can't see motion or hear sound; he watches the export once in real time.

**Mechanics**
- Long jobs report progress through `cutroom-job`.
- Moves go through `cutroom-mv`, deletes through `cutroom-trash`.
- When the guard blocks something, don't retry it. Take the safe route the guard names and tell him in one line.

A style is guidance, not enforcement. Anything safety-critical lives in the guard.

### 3. Band (`mod/band.js`)
- One line above the prompt. Shows the newest running job **for the current folder** from `~/.cutroom/jobs.json`, e.g. `◐ Transcribing 4/14 · interview_A03.mov · 2m left`.
- Empty when idle.
  - A finished job shows for 30 s: `✓ Proxies 14/14`.
  - A failed job shows until the next one starts: `✕ Proxy failed on A07. Ask "what happened?"`.
- Needs Claude Code ≥ 2.1.287 (mods). If mods are unavailable, the status line shows the job instead.
- The mod only draws. It never approves or blocks anything.

### 4. Status line (`bin/cutroom-status`)
```
▸ nike_spot · Resolve ● Timeline v3 · Media 1.2TB free
  limit 22% · memory 34% · Higgsfield 820 cr
```
| Field | Source |
|---|---|
| Video folder | basename of `workspace.project_dir`, or `AI-edits` at the root |
| Resolve open/closed | `pgrep -x Resolve` ⚠️ verify the process name on his Mac |
| Timeline | `state.json` (Project 2), hidden if older than 2 min |
| Drive free space | `df -k` on each `mediaRoots` entry (and AI-edits' volume) |
| limit % | `rate_limits.five_hour.used_percentage`. Turns amber at 80%, with the reset time |
| memory % | `context_window.used_percentage` |
| Higgsfield credits | `state.json` (Project 4) |
| Running job | only if the band mod is unavailable |

- `refreshInterval: 5`.
- **Under 100 ms per run, never a network call.** Unreadable fields are left out.

### 5. Safety guard (`bin/cutroom-guard`, PreToolUse)
**Matchers:** `Bash`, `Write`, `Edit`, `NotebookEdit`, and all `mcp__.*` tools (matched case-insensitively).

**Return values:**
- `deny`, with a reason Claude can act on;
- `ask`, with a plain-English question;
- or silence (no opinion).
- **Never `allow`**, so it can't weaken Claude Code's own permission system or the auto-mode classifier.

**Free (no opinion; Claude narrates)**
- Reading and inspecting anything: `ls`, `ffprobe`, `mediainfo`, reading files, read-only Resolve queries.
- Creating **new** files inside AI-edits or the media roots, including copying new footage into `raw/`.
- ffmpeg, MakeMyClip and Whisper runs whose outputs are new files.
- `cutroom-mv` moves and renames **outside `raw/`**.

**Ask first**
| Trigger | Example question |
|---|---|
| `cutroom-trash` (any delete) | "Move 3 files to the Trash? (A01_bad.mov, …) You can get them back from the Trash." |
| `cutroom-mv` with a source inside a `raw/` folder | "A03.mov is in raw/. Moving it can make Resolve show it as Media Offline. Move anyway?" |
| Higgsfield generation tools: `mcp__.*higgsfield.*__(generate_.*\|.*_batch\|execute_preset\|upscale_.*\|…)` (case-insensitive; full list in the plan), and the `higgsfield` CLI's generate commands | "This spends about 40 credits (820 left). Go ahead?" |
| Sending data off the Mac: `curl` upload flags (`-T`, `-F`, `--data @`, `--upload-file`), `scp`, `rsync` to a remote host, `rclone`, media-upload MCP tools | "This sends A03.mov to <host>. OK?" |
| Write/Edit/Bash targets outside AI-edits and the media roots | "This touches ~/Desktop/…, outside your editing folders. OK?" |
| First-time installs: `brew install`, `npm i -g`, `npx <pkg>` fetches, `npx skills add`, `pip install`, `claude plugin install`, model downloads | "Install ffmpeg with Homebrew (~1 min)?" |
| Quitting or killing Resolve | "Quit Resolve? Unsaved changes could be lost." |
| Resolve `run_script_unsafe`, and sandboxed `run_script` that deletes, closes or changes clip edges (revised 2026-11-25: sandboxed `run_script` is Resolve's main tool, so it runs and is logged) | "This Resolve script deletes something from the Resolve project ("Remove the bad takes"). OK?" |

**Denied** (the reason tells Claude what to do instead)
| Pattern | Reason |
|---|---|
| `rm`, `rmdir`, `unlink`, `shred`, `find … -delete`, `-exec rm`, `xargs rm` | "Deletes go through `cutroom-trash` so they can be undone." |
| any raw `mv` | "Use `cutroom-mv`: it never overwrites and logs the move." |
| `cp` without `-n` | "Use `cp -n`: existing files are never overwritten." |
| `ffmpeg` with `-y` or without `-n` | "Add `-n` and write a new file name." |
| Write/Edit onto an existing media file (video/audio/image extensions, `.drp`, `.drt`, `.fcpxml` in `raw/`) or any existing file in `raw/` | "Footage is never overwritten; write a new file." |
| `sudo`, `diskutil erase*/partition*/reformat`, `newfs*`, `chmod -R`/`chown -R` on media roots | "Not allowed in cutroom." |
| download piped into a shell (`curl\|wget … \| sh/bash`, `bash -c "$(curl …)"`) | "Don't run downloaded scripts. Show it to him; he can run it himself if he wants." |
| edits to `~/.claude/settings*.json` or shell rc files outside `/cutroom-setup` | "Settings only change through /cutroom-setup." |

**Parsing**
- Commands are split on `;` `&&` `||` `|` and newlines, and `$( … )` and backticks are scanned.
- Prefixes are stripped (`env`, `command`, `nohup`, `time`, `caffeinate`) and paths are normalised, so `/bin/rm` is treated as `rm`.
- This is best-effort, made to catch honest mistakes. Claude Code's own permissions and the auto-mode classifier are the second layer.

**`raw/` detection**
- Any path with a path segment named exactly `raw` under an AI-edits root.
- Configurable in `config.json` as `lockedFolders: ["raw"]`.

### 6. Activity log and `/what-happened` (new in r2)
This is what makes "review results, not prompts" work.

**`cutroom-log`** (PostToolUse, all tools)
- Appends one line per action to `~/.cutroom/activity.jsonl`: `{ts, session, cwd, tool, summary, ok}`.
  - `summary` is short and mechanical, e.g. `ffmpeg: interview_A03.mov → clips/A03_cfr.mov`, `cutroom-mv: 14 files → clips/interviews/`, `Higgsfield generate_video: 5 s, kling-3.0, 10 cr`.
- Guard decisions (deny/ask) are logged too, with their reason.
- Local only. Lines older than 30 days are pruned. Never sent anywhere.

**`/what-happened [today|this video|<question>]`**
- Claude reads the log for the current folder and tells the story in plain English: what it did, in order, what changed on disk, and what was blocked or asked.
- Given a symptom ("the clips are red in Resolve", "the title is choppy"), it matches the log against the guide's known failure modes and proposes a fix:
  - a move → relink;
  - a frame-rate mismatch → re-render at the timeline's rate;
  - captions timed to the raw clip → re-time to the cut.
- It offers `cutroom-undo-move` when a move caused the problem.

### 7. Undoable files (`cutroom-mv`, `cutroom-trash`, `cutroom-undo-move`)
**`cutroom-mv <src…> <dest>`**
- Refuses if a destination exists.
- Logs `{ts, batch, from, to}` to `~/.cutroom/moves.log`.
- Prints one line for Claude to relay.
- The guard asks first when a source is inside `raw/`.

**`cutroom-trash <paths…>`**
- Uses Finder via `osascript` (so "Put Back" works), and logs it.
- Falls back to `/usr/bin/trash` if present ⚠️ verify.

**`cutroom-undo-move [n]`**
- Reverses the last batch (or n batches).
- Refuses if something is in the way.
- Restores from the Trash where possible.

### 8. Jobs (`cutroom-job`)
```
cutroom-job start <id> "<label>" --total 14
cutroom-job progress <id> 4 --current interview_A03.mov
cutroom-job done <id>  |  cutroom-job fail <id> "<reason>"
```
- Each job records `cwd` (so parallel windows don't mix).
- Writes are atomic.
- ETA comes from the rate of progress.
- Jobs older than 24 h are pruned.

### 9. `/cutroom-setup` (setup and health check)
Safe to re-run any time ("is everything OK?").

1. **Check and report** in a single checklist, without fixing:
   - macOS version;
   - Claude Code version (≥ 2.1.287 for the band);
   - Node ≥ 24;
   - Homebrew (if missing, give the official one-liner for him to paste himself);
   - ffmpeg;
   - MakeMyClip installed;
   - Resolve Studio installed and running, and a Resolve entry in `claude mcp list`;
   - Higgsfield connector present;
   - HyperFrames/Remotion present.
2. **Ask:** where is AI-edits, and which drives hold media? Write `~/.cutroom/config.json`:
   `{ "projectRoots": ["…/AI-edits"], "mediaRoots": [...], "lockedFolders": ["raw"] }`
3. **Show the exact diff** to `~/.claude/settings.json`, and write it (keeping a backup) only after a yes:
   - `statusLine` → `cutroom-status`, `refreshInterval: 5`;
   - `theme: "custom:cutroom"`;
   - `spinnerTipsEnabled: false`;
   - `permissions.defaultMode` left as is.
4. Point to `/cutroom-help`.

How setup's own settings write is exempted from the guard is decided in the plan.

### 10. `/cutroom-help`
- One screen of example requests by job: organise footage, fix frame rate, rough cut, Resolve chores, graphics, Higgsfield shots.
- Covers *undo that* and `/what-happened`.
- Projects 2–4 add to it.

## Data files (`~/.cutroom/`)
| File | Writer | Readers |
|---|---|---|
| `config.json` | `/cutroom-setup` | guard, status, mv |
| `jobs.json` | `cutroom-job` | band, status |
| `state.json` | Project 2 (Resolve), Project 4 (Higgsfield) | status |
| `moves.log` | `cutroom-mv`, `cutroom-trash` | `cutroom-undo-move`, `/what-happened` |
| `activity.jsonl` | `cutroom-log`, guard | `/what-happened` |

Missing or corrupt files are treated as empty; nothing crashes the UI.

## Error handling
- The status line, band and log never throw; on error they drop the field or line.
- The guard fails closed (ask).
- Every bin tool exits non-zero with one plain-English line.

## Testing
- **Guard:** a fixture table `(tool, input, cwd) → deny | ask | none`, covering every row plus tricky cases:
  - `cd x && rm -rf y`, `/bin/rm`, `$(rm x)`;
  - `find -delete`;
  - `ffmpeg -y`, and `ffmpeg -n` (must be allowed);
  - `cutroom-mv raw/A.mov clips/` (ask), and `cutroom-mv ~/Downloads/A.mov raw/` (none);
  - `mcp__claude_ai_Higgsfield__generate_video` (ask), and `mcp__claude_ai_Higgsfield__balance` (none);
  - `bash -c "$(curl …)"` (deny).
- **Status:** stdin fixtures with missing fields, a stale `state.json`, no config; run against the time budget.
- **Log, jobs, mv, trash, undo:** node:test in temp dirs. Trash is Mac-only, behind a platform check.
- **On Poe's machine:** `claude --plugin-dir ~/Work/cutroom`.
- **On the friend's Mac (required before calling it done):**
  - `pgrep` name
  - Finder trash and Put Back
  - external `df`
  - band rendering
  - theme
  - a `/what-happened` replay after a real session

## Open questions (verify on his Mac)
- Resolve's process name (`Resolve`?).
- Whether macOS 15 has `/usr/bin/trash`.
- His Claude Code version.
- The mechanism for setup's exemption from the settings guard (plan).
- Higgsfield CLI subcommand names that spend credits.

## Roadmap
Each project gets its own spec, then a plan, then a build.

### Project 2: Resolve bridge
- **Resolve 21.1's built-in MCP (`ResolveMCP`, *File → Setup AI Assistants*)** is what the guide already uses.
- Use `samuelgursky/davinci-resolve-mcp` only for gaps, after an audit, and never both at once.
- Writes `state.json` (open project, timeline).
- Before a Resolve edit: duplicate the timeline and export a project backup.
- Raw scripts route to *ask*.
- Known gaps: no blade/split, no speed ramps.

### Project 3: Cutting kit
- **Built on MakeMyClip/editor**, after an audit.
- Ships `/roughcut` (the guide's 3 messages as one command: check → transcribe locally → cut list → wait → FCPXML) and `/overnight` (the guide's headless batch: transcribe and write `cutlist.md` per video, never cut or render).
- Adds:
  - constant-frame-rate conversion for variable-frame-rate footage
  - proxies
  - SRT subtitles re-timed to the cut
  - progress through `cutroom-job`
- Borrows ideas from `browser-use/video-use` with **local** transcription only.

### Project 4: Generative
- **Graphics:** HyperFrames / Remotion / GSAP / motion-design (already in the guide), with transparent ProRes 4444 at the footage's frame rate.
- **Higgsfield** via his claude.ai connector:
  - the credit gate in the guard;
  - credits written to `state.json`;
  - numbered downloads into `clips/`.
- ⚠️ Remotion licence: 4+ people need a company licence.

### After Project 1 ships: guide update
- Step 6 becomes "install cutroom, run `/cutroom-setup`".
- The safety text changes from "read each command" to "the rails block the dangerous stuff; review results; ask `/what-happened` when something's off".
- Higgsfield house rules move from CLAUDE.md to the plugin.

## Research sources (2026-11-19)
- **Claude Code docs:**
  - statusline: https://code.claude.com/docs/en/statusline.md
  - output styles: https://code.claude.com/docs/en/output-styles.md
  - plugins: https://code.claude.com/docs/en/plugins/manifest-reference.md
  - hooks: https://code.claude.com/docs/en/hooks.md
  - mods: https://code.claude.com/docs/en/plugins/mods/overview.md
- **Video tooling survey:**
  - samuelgursky/davinci-resolve-mcp
  - browser-use/video-use (sends audio to ElevenLabs)
  - WyattBlue/auto-editor
  - MakeMyClip/editor (from the guide)
- **Red flags:**
  - hetpatel-11 Premiere MCP has telemetry on by default
  - OpenMontage and kajisho5 show signs of star inflation
  - Tooflex, elliotttate and burningion are unlicensed
- **Guide:** https://ai-editing-guide.cellestial-studio.workers.dev (checked 16 and 19 Nov 2026).
