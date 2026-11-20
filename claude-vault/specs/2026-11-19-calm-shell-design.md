---
type: spec
project: cutroom
created: 2026-11-19
status: draft (awaiting Poe's review)
tags: [claude-code, plugin, video-editing, davinci-resolve, safety]
---
# cutroom: Project 1, Calm shell (design)

`cutroom` is a Claude Code plugin. It makes the terminal feel calm, safe and useful for Poe's friend, a video editor (non-developer) who uses **DaVinci Resolve Studio on a Mac** and **Claude Code in the terminal (Pro plan)**.

This spec covers **Project 1 only**. Projects 2–4 are listed in the [[#Roadmap]] and each gets its own spec.

## Goals
- The terminal looks clean and calm, but keeps all of Claude Code's power.
- Useful information is always visible: project, Resolve state, drive space, running jobs, session meters.
- Claude works **mostly autonomously**, says in plain English what it is doing and why, teaches as it goes, and stops for his input only at **creative decisions** and **hard safety stops**.
- Nothing can destroy footage. Deletes are always reversible (they go to the Trash), and existing media files are never overwritten.

## Non-goals (Project 1)
- Controlling Resolve, ffmpeg workflows, transcription, generative tools (Projects 2–4).
- The Desktop app or VS Code. The terminal is the target. The plugin should not *break* other surfaces, but they get no polish.
- Windows/Linux support for the friend. Poe develops on Linux, but **macOS is the target**.

## Decisions made in brainstorming
| Question | Decision |
|---|---|
| Editing software | DaVinci Resolve Studio, macOS |
| Surface | Terminal, made calm |
| Layout | "Quiet strip": clean chat, a band above the prompt for live activity, a status line for everything else |
| Info shown | Project and Resolve state · drives and jobs · plain-English "what Claude is doing" · session meters (context, usage limits, Higgsfield credits) |
| Autonomy | Mostly autonomous. Narrates and teaches. Asks at creative decisions. Hard stops: delete, spending credits, sending data off the Mac, acting outside project and media drives |
| Moves / renames | **Allowed without asking.** Claude says what moved where, and every move is logged so it can be undone |
| Packaging | One plugin (`cutroom`), one GitHub repo, installed via `/plugin marketplace add`. Later projects add to the same plugin |
| Status line | Our own small script, not ccstatusline or powerline (avoids auditing third-party code for ~40 lines of work) |

## Components

```
cutroom/
├── .claude-plugin/
│   ├── plugin.json            # name, version, description
│   └── marketplace.json       # so the repo is its own marketplace
├── themes/cutroom.json        # muted "grading suite" palette
├── output-styles/editor.md    # force-for-plugin: true
├── hooks/hooks.json           # PreToolUse guards (+ mod module entry for the band)
├── mod/band.js                # band above the prompt, reads jobs.json
├── bin/
│   ├── cutroom-guard          # the safety guard (Node, no deps), called by hooks
│   ├── cutroom-status         # status line script (Node, no deps)
│   ├── cutroom-job            # start/progress/done/fail: writes jobs.json
│   ├── cutroom-mv             # move/rename: refuses overwrite, logs to moves.log
│   ├── cutroom-undo-move      # reverses the last N moves from moves.log
│   └── cutroom-trash          # moves to the macOS Trash (Finder), logs it
├── commands/
│   ├── cutroom-setup.md       # first-run setup (see below)
│   └── cutroom-help.md        # one screen of what he can ask for
├── tests/                     # node:test, fixture-driven
└── claude-vault/              # specs, plans, notes (this file)
```

**Runtime: Node ≥ 20, no npm dependencies.** He already has Node 22+ for HyperFrames/Remotion. `/cutroom-setup` checks for it, and the guard **fails closed**: if Node is missing, a short shell shim in the hook asks instead of allowing.

### 1. Theme (`themes/cutroom.json`)
- Base: `dark`. Overrides give a muted, low-contrast palette: warm greys, one soft accent (like a grading-suite UI).
- Red only for real errors. Selected by setup as `custom:cutroom`.

### 2. Editor output style (`output-styles/editor.md`)
`force-for-plugin: true`, so it is active whenever the plugin is on. Rules it gives Claude:
- **Plain English.** No raw tool dumps, no jargon without a five-word gloss.
- **Before** a multi-step action: one line on what and why ("Making proxies so Resolve plays smoothly").
- **After**: what changed, where it went, and that the originals are untouched. Example: "Moved 14 clips into `Interviews/`. Say 'undo that' to put them back."
- **Teach lightly.** At most one "here's the trick" line when it helps him learn (e.g. which Resolve menu does this by hand).
- **Ask only at creative decisions**: pacing, look, which take, music, titles. Otherwise keep going. When asking, give 2–3 concrete options and a recommendation.
- **When a guard blocks something**: don't retry the same thing. Use the safe route the guard named and tell him in one line.
- Long jobs must report progress through `cutroom-job` so the band shows them.
- Use `cutroom-mv` / `cutroom-trash` instead of raw `mv` / `rm`.

Caveat: a style is guidance, not enforcement. Anything safety-critical is enforced by the guard, not the style.

### 3. Band (`mod/band.js`)
- A mod handler that draws one line above the prompt.
- It reads `~/.cutroom/jobs.json` and shows the most recent running job: `◐ Transcribing 4/14 · interview_A03.mov · 2m left`.
- It shows nothing when idle. It shows a finished job for 30 s (`✓ Proxies 14/14`) and a failed job until the next one starts (`✕ Proxy failed on A07, ask Claude why`).
- Needs Claude Code ≥ 2.1.287 (mods). Poe is on 2.1.323; **check the friend's version in setup**. If mods are unavailable, the status line shows the running job instead (degrades gracefully).
- The mod **only draws**. It never approves or blocks tool calls (all guarding lives in the hook), so mods not being sandboxed is not a safety concern here.

### 4. Status line (`bin/cutroom-status`)
Two lines. Fields that can't be read are left out rather than showing errors:
```
▸ Nike_Spot · Resolve ● Timeline v3 · Media 1.2TB free
  memory 34% · limit 22% · Higgsfield 820 cr
```
| Field | Source | Cost |
|---|---|---|
| Project | basename of `workspace.project_dir` (stdin JSON) | free |
| Resolve open/closed | `pgrep -x Resolve` (macOS process name ⚠️ verify on his Mac) | ~5 ms |
| Timeline name | `~/.cutroom/state.json` `resolve.timeline`, written by Project 2; hidden if older than 2 min | free |
| Drive free space | `df -k` for each `mediaRoots` path in config | ~5 ms |
| memory % | `context_window.used_percentage` | free |
| limit % | `rate_limits.five_hour.used_percentage` (Pro plan; present after the first reply) | free |
| Higgsfield credits | `state.json` `higgsfield.credits`, written by Project 4 | free |
| Running job (fallback) | `jobs.json`, only if the band mod is unavailable | free |

`refreshInterval: 5`. Hard budget: **< 100 ms per run, never a network call**.

### 5. Safety guard (`bin/cutroom-guard`, wired as PreToolUse hooks)
Matchers: `Bash`, `Write`, `Edit`, `mcp__*` (for Higgsfield and Resolve tools).
- The guard returns `deny` (with a reason Claude can act on), `ask` (with a plain-English question for him), or exits silently (no opinion: Claude Code's normal rules apply).
- **It never returns `allow`**, so it can never weaken Claude Code's own permission checks or auto-mode classifier.

**Allowed (no opinion from the guard; he just gets narration):**
- Reading or inspecting anything: `ls`, `ffprobe`, `mediainfo`, reading files, read-only Resolve queries.
- Creating new files inside the project folder or the media roots.
- Running ffmpeg / whisper / auto-editor with outputs that are new files.
- Moving and renaming through `cutroom-mv` (refuses overwrite, logs every move).

**Ask first** (the question is in plain English):
| Trigger | Example question |
|---|---|
| `cutroom-trash` (any delete) | "Move 3 files to the Trash? (A01_bad.mov, …) You can get them back from the Trash." |
| Higgsfield generate/spend tools (`mcp__*higgsfield*__generate_*`, `*_batch`, `execute_preset`, …) | "This will spend about 40 credits (820 left). Go ahead?" |
| Sending data off the Mac: `curl` with upload flags (`-T`, `-F`, `--data @`, `--upload-file`), `scp`, `rsync` to a remote, `rclone`, media upload tools | "This sends A03.mov to <host>. OK?" |
| Write/Edit/Bash targets outside the project folder and media roots | "This touches ~/Desktop/… which is outside the project. OK?" |
| First-time installs: `brew install`, `npm i -g`, `pip install`, model downloads | "Install ffmpeg with Homebrew (~1 min)?" |
| Quitting or killing Resolve (`pkill`/`killall Resolve`, `osascript … quit`) | "Quit Resolve? Unsaved changes could be lost." |
| Resolve raw-script tools (`run_script`, `run_script_unsafe`) | "Claude wants to run a custom Resolve script. OK?" |

**Denied** (the reason tells Claude what to do instead):
| Pattern | Reason sent to Claude |
|---|---|
| `rm`, `rmdir`, `unlink`, `shred`, `find … -delete`, `-exec rm`, `xargs rm` | "Deletes go through `cutroom-trash` so they can be undone." |
| any raw `mv` | "Use `cutroom-mv`: it never overwrites and logs the move so it can be undone." |
| `cp` without `-n` | "Use `cp -n` so existing files are never overwritten." |
| `ffmpeg` without `-n`, or with `-y` | "Add `-n` and write to a new file name; existing media is never overwritten." |
| Write/Edit onto an existing media file (video/audio/image extensions, `.drp`, `.drt`) | "Media files are never overwritten; write a new file." |
| `sudo`, `diskutil erase*/partition*/reformat`, `newfs*`, `chmod -R`/`chown -R` on media roots | "Not allowed in cutroom." |
| `curl … \| sh`/`bash`, `wget … \| sh` | "Don't pipe downloads into a shell; download, show it, then ask." |
| Edits to `~/.claude/settings*.json`, `~/.zshrc`, `~/.bashrc`, `~/.zprofile` outside `/cutroom-setup` | "Settings change only through /cutroom-setup." |

**How commands are parsed:**
- A Bash command is split into segments on `;` `&&` `||` `|` and newlines. Subshells `$( … )` and backticks are scanned too.
- Each segment's command word is matched after stripping `env`, `command`, `nohup`, `time` and paths (`/bin/rm` counts as `rm`).
- **This is best-effort.** A determined obfuscation can get past a parser. That is acceptable because Claude Code's own permission system and auto-mode classifier remain as the second layer, and the guard's job is to catch honest mistakes, not adversaries.

**Fail-closed:** if the guard crashes or times out, the hook shim asks instead of allowing.

### 6. Undoable files (`cutroom-mv`, `cutroom-trash`, `cutroom-undo-move`)
- `cutroom-mv <src…> <dest>`
  - Refuses if any destination exists.
  - Appends `{ts, from, to}` lines to `~/.cutroom/moves.log` (JSONL).
  - Prints a one-line summary for Claude to relay.
- `cutroom-trash <paths…>`
  - Uses Finder via `osascript` (keeps "Put Back" working) and logs the move to `moves.log`.
  - Falls back to `/usr/bin/trash` if present ⚠️ verify on macOS 15.
- `cutroom-undo-move [n]`
  - Reverses the last n moves (default: the last batch), refusing if anything is in the way.
  - Trash entries are restored through Finder "Put Back" where possible, otherwise by moving them back from `~/.Trash`.

### 7. Jobs (`cutroom-job`)
```
cutroom-job start <id> "<label>" --total 14
cutroom-job progress <id> 4 --current interview_A03.mov
cutroom-job done <id>  |  cutroom-job fail <id> "<reason>"
```
- Writes `~/.cutroom/jobs.json` atomically (write to a temp file, then rename).
- ETA is calculated from the rate of progress.
- Jobs older than 24 h are pruned.
- Projects 2–4 use it for every long task.

### 8. `/cutroom-setup`
1. Check: macOS, Claude Code version (mods ≥ 2.1.287), Node ≥ 20, ffmpeg (report only; installing it is Project 3).
2. Ask: where is the project root folder? Which drives/folders hold media? Write `~/.cutroom/config.json`:
   `{ "projectRoots": [...], "mediaRoots": [...] }`
3. **Show the exact diff** to `~/.claude/settings.json`:
   - `statusLine` → `cutroom-status`, `refreshInterval: 5`
   - `theme: "custom:cutroom"`
   - `spinnerTipsEnabled: false`
   - leave `permissions.defaultMode` as is (auto mode = "mostly autonomous")

   Write only after he says yes, and keep a backup copy of `settings.json`.
4. Print a short welcome and point to `/cutroom-help`.

`/cutroom-setup` is the only path allowed to write those settings (the guard exempts it via an env flag the command sets for its own Bash calls ⚠️ the exact mechanism is decided in the plan).

### 9. `/cutroom-help`
One screen of example requests grouped by job (organize footage, proxies, transcripts, rough cut, effects, b-roll). Projects 2–4 add to it as they ship. It also covers how undo works ("say *undo that*").

## Data files (`~/.cutroom/`)
| File | Writer | Readers |
|---|---|---|
| `config.json` | `/cutroom-setup` | guard, status |
| `jobs.json` | `cutroom-job` | band, status |
| `state.json` | Project 2 (Resolve), Project 4 (Higgsfield) | status |
| `moves.log` | `cutroom-mv`, `cutroom-trash` | `cutroom-undo-move` |

Missing or corrupt files are treated as empty. Nothing crashes the UI.

## Error handling
- The status line and band never throw. On any error the field is omitted.
- The guard fails closed (ask).
- Every bin tool exits non-zero with a one-line plain-English message Claude can relay.

## Testing
- **Guard:** a fixture table of `(tool, input) → deny | ask | none`, covering every row above plus tricky cases. Examples:
  - `cd x && rm -rf y`
  - `/bin/rm`
  - `find . -name '*.tmp' -delete`
  - `ffmpeg -i a.mov -y b.mov`
  - `$(rm x)`
  - an ffmpeg command with `-n` (must be allowed)
- **Status:** stdin JSON fixtures with missing fields, a stale `state.json`, and a missing config, each run against a time budget.
- **jobs / mv / trash / undo:** node:test in temp dirs. The trash test is skipped on Linux; Mac-only behavior is behind a platform check.
- **Manual on Poe's machine:** `claude --plugin-dir ~/Work/cutroom`, a run-through of the main flows.
- **Manual on the friend's Mac (required before calling it done):**
  - `pgrep` name
  - Finder trash and Put Back
  - `df` on external volumes
  - band rendering
  - theme

## Open questions (verify on his Mac)
- Exact Resolve process name for `pgrep` (`Resolve`?).
- Does macOS 15 ship `/usr/bin/trash`?
- His Claude Code version (mods need ≥ 2.1.287).
- Mechanism for exempting `/cutroom-setup` from the settings-file guard (decided in the plan).

## Roadmap
Each project gets its own spec, then a plan, then a build.

### Project 2: Resolve bridge
- **Prefer Resolve 21.1's built-in MCP server (`ResolveMCP`, via *File → Setup AI Assistants*).** It is first-party. ⚠️ Unverified, from the [[2026-11-19-animator-stack-higgsfield-resolve-studio|ai-editing-guide research]].
- Use `samuelgursky/davinci-resolve-mcp` (MIT, ~4.2k★) only for gaps, after an audit of:
  - its GitHub auto-update check
  - its local control-panel port binding
  - its raw-API passthrough tools

  Never run both at once.
- Writes `state.json` (open project, timeline) for the status line.
- Raw-script tools route to *ask*.
- Before Claude edits a timeline it duplicates it ("v3 → v3 (Claude)") and exports a project backup.

### Project 3: Local media kit
All local; footage never leaves the Mac.
- ffmpeg proxies and transcodes, including converting variable-frame-rate (VFR) phone/OBS footage to constant frame rate (CFR)
- whisper.cpp / faster-whisper transcripts and SRT subtitles
- `WyattBlue/auto-editor` (public domain) for silence cuts, exported as a Resolve timeline
- Transcript-driven rough cuts, borrowing ideas from `browser-use/video-use` but **with local Whisper instead of ElevenLabs**
- Possibly an OpenTimelineIO export
- Skip `kajisho5/ffmpeg-skill` (suspected inflated stars) unless audited.

### Project 4: Generative
- Motion graphics: Fusion via Resolve, plus his existing HyperFrames / Remotion / GSAP stack. ⚠️ Check Remotion's licence if he works under a company.
- Higgsfield b-roll through the Higgsfield MCP on **his own account**, with the guard's credit gate, writing `state.json` credits.

## Research sources (2026-11-19)
- Claude Code docs:
  - statusline: https://code.claude.com/docs/en/statusline.md
  - output styles: https://code.claude.com/docs/en/output-styles.md
  - plugins: https://code.claude.com/docs/en/plugins/manifest-reference.md
  - hooks: https://code.claude.com/docs/en/hooks.md
  - mods: https://code.claude.com/docs/en/plugins/mods/overview.md
- Video tooling survey (web research agent):
  - samuelgursky/davinci-resolve-mcp
  - browser-use/video-use (sends audio to ElevenLabs)
  - WyattBlue/auto-editor
  - leancoderkavy/premiere-pro-mcp
  - DareDev256/fcp-mcp-server

  Red flags noted: hetpatel-11 Premiere MCP telemetry on by default; OpenMontage / kajisho5 star inflation; unlicensed repos (Tooflex, elliotttate, burningion).
