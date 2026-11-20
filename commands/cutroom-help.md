---
description: What you can ask Claude to do in cutroom, with examples
---

Show the editor the guide below, as is (you may shorten nothing, add nothing). Then ask what they'd like to start with.

**cutroom: things you can just ask for**

*Footage and folders*
- "What's in raw? Lengths, resolution and frame rates. Don't change anything."
- "Sort the clips in clips/ into folders by camera."
- "Rename the interview clips to Interview_01, Interview_02…"
- "This phone footage drifts. Make constant-frame-rate copies."
- "Make proxies for the 4K clips."

*Cutting*
- "Transcribe the interview on this computer and propose cuts: silences, ums, repeated takes. Wait for my OK."
- "Export that as an FCPXML for Resolve."
- "Give me three versions: cold open, in order, 60-second teaser."

*Resolve* (Studio, with Resolve open)
- "Duplicate the timeline and add markers wherever the speaker changes."
- "Queue renders for YouTube 4K and a 9:16 vertical."

*Graphics and b-roll*
- "Make a lower-third for 'Jane Doe, Director' at the footage's frame rate, transparent."
- "Generate a 5-second Higgsfield shot of a city at dusk. Quote me the credits first."

**Safety, built in**
- **Deleting** goes to the Trash and asks you first.
- **Originals in `raw/`** are protected: nothing there is overwritten, and moving one asks first.
- **Other moves** just happen, and Claude tells you. Say **"undo that"** to reverse the last one.
- **Spending Higgsfield credits** or **sending files off your Mac** always asks.

**When something looks off**
- Type **`/what-happened`**. Claude replays what it did and helps you find why.
- Type **`/cutroom-setup check`** to see if anything is missing.

**What's on screen**
- **The line above the prompt** shows what's running right now.
- **The status line at the bottom** shows:
  - your video folder;
  - Resolve (● open, ○ closed);
  - free drive space;
  - **limit**: your Claude usage;
  - **memory**: how full this conversation is (start a new one per video);
  - your Higgsfield credits.
