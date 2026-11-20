# cutroom

A calm, safe Claude Code terminal for video editors who work in **DaVinci Resolve**.

cutroom keeps all the power of Claude Code in the terminal. It also makes the terminal feel like an editing suite, and makes it hard for anything to go wrong with your footage:

- **A calmer look**
  - a muted colour theme;
  - a status line that shows your video folder, whether Resolve is open, free drive space, your Claude usage and your Higgsfield credits;
  - one line above the prompt that shows what's running right now.
- **An editing partner, not a programmer**
  - Claude explains in plain English what it's doing and why, and teaches as it goes.
  - It stops only at creative decisions: which take, pacing, the cut list.
- **Safety rails**
  - deletes go to the Trash and ask first;
  - footage is never overwritten;
  - files in `raw/` don't move without asking;
  - spending Higgsfield credits or sending files off your Mac always asks.
- **Review results, not prompts.** Every action goes into a private log on your Mac. Type `/what-happened` and Claude replays it, or helps find out why something looks wrong.

It builds on the setup in the [AI editing guide](https://ai-editing-guide.cellestial-studio.workers.dev):
- the `AI-edits/<video>/raw|clips|renders` folders;
- MakeMyClip for cuts;
- Resolve Studio's built-in AI connection;
- HyperFrames / Remotion for graphics;
- Higgsfield for b-roll.

## Install

You need a Mac with **Node.js 24+** and **Claude Code 2.1.287+** (run `claude update` if you're older).

### Option A: paste this into Claude

```
Please install the cutroom plugin for me:
1. Run: claude plugin marketplace add Mystic-Poe/cutroom
2. Run: claude plugin install cutroom@cutroom --scope user
3. Tell me to restart you (type /exit, then claude), and after that to run /cutroom-setup.
```

### Option B: type it yourself

In Claude Code:

```
/plugin marketplace add Mystic-Poe/cutroom
/plugin install cutroom@cutroom
```

Then restart Claude (`/exit`, then `claude`), and run:

```
/cutroom-setup
```

### What setup does
- **Checks what's installed:** Node, ffmpeg, Homebrew, MakeMyClip, Resolve, the Resolve and Higgsfield connections, and the animation tools.
- **Asks where things are:** your AI-edits folder, and which drives hold media.
- **Shows you the exact settings it will change, then asks before writing them:**
  - status line;
  - theme;
  - spinner tips off.

  A backup of your settings is kept.

Run `/cutroom-setup check` any time to see if anything is missing.

### The first time Claude moves something to the Trash
macOS may ask *"Terminal wants to control Finder"*. Click **OK**: that's how files go to the real Trash, where *Put Back* works.

## Everyday use

| You type | What happens |
|---|---|
| anything, in plain English | Claude does it, and narrates |
| "undo that" | the last move or Trash is put back |
| `/what-happened` | a plain-English replay of what Claude did here; add what looks wrong, e.g. `/what-happened clips are red in Resolve` |
| `/cutroom-help` | examples of what to ask for |
| `/cutroom-setup check` | health check |

## What's protected

| Always blocked | Asks you first | Just happens (and is logged) |
|---|---|---|
| `rm` and other permanent deletes | moving files to the Trash | reading and checking footage |
| overwriting footage or project files | moving or renaming files already in `raw/` | making new files: proxies, transcripts, renders, timelines |
| admin (`sudo`) and disk erase/format | spending Higgsfield credits | moving and renaming outside `raw/` (undoable) |
| running downloaded scripts | sending files off your Mac | |
| changing Claude/shell settings outside `/cutroom-setup` | installing new software | |
| | quitting Resolve, running custom Resolve scripts | |
| | anything outside your editing folders | |

**These rails are a safety net, not a lock.**
- They are built to catch honest mistakes, by reading commands as patterns; something deliberately disguised could slip past.
- Claude Code's own permission system still sits behind them.
- **The rails never approve anything**: they can only block or ask.

## Where cutroom keeps things

Everything stays on your Mac, in `~/.cutroom/`:

| File | What it holds |
|---|---|
| `config.json` | your folders |
| `activity.jsonl` | the activity log, kept 30 days, secrets stripped |
| `moves.log` | moves, for undo |
| `jobs.json` | running jobs |
| `statusline.sh` | the status line launcher |

## Uninstall

```
/plugin uninstall cutroom@cutroom
```

Your previous settings are in `~/.claude/settings.json.cutroom-backup-*` if you want them back.

## For developers

- Plain Node (no dependencies) in `bin/` and `lib/`.
- One mod in `mod/band.tsx`.
- Markdown commands in `commands/`, plus the Editor output style.
- **Tests:**
  - `npm test` (node:test);
  - `claude plugin test .` (band);
  - `claude plugin validate .`.
- Specs and plans: `claude-vault/`.

MIT licence.
