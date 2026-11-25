# The cutroom workflow, end to end

Claude does the chores. You make the calls. Resolve is the only editing app you look at.

Every stage below says who does what, what you type, and what comes back. You can type the examples as written or say it your own way. Each stage ends in **your call** only where a creative decision is needed; everything else just happens and shows up as one plain line, like `✓ Checked the frame rate of 6 clips`.

## The shape of it

| | Stage | Claude does | Your call |
|---|---|---|---|
| 1 | Set up the video | Folders, frame-rate check, fixes | — |
| 2 | Bring it into Resolve | Project, bins, names, a working copy of the timeline | — |
| 3 | Rough cut | Transcript, cut list, 2–3 versions as timelines | Approve the cut list, pick a version |
| 4 | Pick moments | Finds the strongest lines, marks them | Keep the ones you want |
| 5 | Fill the gaps | B-roll plan, generated shots, graphics | Approve the plan and the spend |
| 6 | Your pass | Chores while you work | Pacing, color, sound, feel |
| 7 | Finish | Subtitles, levels, looks as a starting point | Sign off |
| 8 | Deliver | Every format at once, checked | Watch it once in real time |

Quick actions above the prompt: **1** Rough cut · **2** Find clips · **3** Render · **4** What happened?. Type the number on an empty prompt and the request appears, ready to edit or send.

## 1. Set up the video

Make a folder in `AI-edits/` for the video with `raw/` inside, drop the footage in `raw/`, and start Claude in that folder.

> What's in raw? Lengths, resolution and frame rates. Don't change anything.

Claude reports what's there and warns about anything that will cause trouble later, such as phone clips with a variable frame rate.

> Make constant-frame-rate copies of the phone clips.

New copies go in `clips/`. Your originals in `raw/` are never changed, and cutroom asks before anything in `raw/` is moved.

## 2. Bring it into Resolve

Open Resolve Studio with a project loaded.

> Make a new project called Nike Spot, 4K 23.976, import raw and clips, sort them into bins by camera and color the interviews blue.

> Duplicate the main timeline and work on the copy.

Claude names the copy `<name> (Claude)` and tells you which timeline it's on. It always works on a copy.

## 3. Rough cut

Press **1**, or:

> Transcribe the interview on this computer and propose cuts: silences, ums and earlier takes of repeated lines. Show me the cut list and wait for my OK.

**Your call:** read the cut list. Say "keep the pause after the joke" or "OK".

> Give me three versions as timelines: A opens cold on the strongest line, B tells it in order, C is a 60-second teaser.

**Your call:** pick one. It lands in Resolve as a timeline of ordinary clips you can trim or extend.

## 4. Pick moments

Press **2**, or:

> Find the 8 strongest moments for vertical clips. Put a blue marker on each with one line on why.

**Your call:** keep the ones you want.

> Make 9:16 timelines for the ones I kept.

## 5. Fill the gaps

> Write a B-roll plan against the markers: what shot, how long, where it comes from.

**Your call:** approve the plan. Higgsfield shots cost credits, so Claude quotes the cost and cutroom asks before anything is spent.

> Generate shots 2 and 5 with Higgsfield, the cheapest model that could work. Try one first.

Results land in `clips/` as `clip01.mp4`, `clip02.mp4`, … and in a "Generated" bin.

> Make a lower third for "Jane Doe, Director" in the brand fonts, transparent, at the timeline's frame rate.

Graphics come back as transparent ProRes files for the track above your edit.

## 6. Your pass

This is the part that's yours: pacing, color, sound, feel. Claude handles chores while you work:

> Add a marker at every speaker change.
> Rename the timeline clips by scene.
> Which clips on this timeline are still offline?
> Copy the grade attributes from the first interview clip to the other interview clips.

## 7. Finish

> Normalize the dialogue levels across the timeline.
> Transcribe the final cut and make an SRT, re-timed to this cut, and import it.
> Apply the client's LUT to every interview clip as a starting point.

**Your call:** the grade, the mix, the final feel.

## 8. Deliver

Press **3**, or:

> Render YouTube 4K, a 9:16 vertical and a square for LinkedIn. Tell me the settings first.

Claude starts the renders, checks each one finished, and exports a still from each so it can check the framing.

**Your call:** watch each export once, in real time. Claude can't see motion or hear sound.

## Examples by kind of job

**Talking-head short for a repeat client.** 1 → OK the cut list → pick version A → 2 → keep three moments → "9:16 for those, with the client's caption style and lower third" → 3. Mostly decisions, very little hands-on.

**Long interview for YouTube.** Stage 3 for the selects, then a long Stage 6: the story is yours. Use Claude for markers at topics, chapter timecodes, b-roll plans and the subtitle file.

**Podcast, two cameras.** "Make a multicam clip from cam A, cam B and the audio recorder, and let SmartSwitch switch on whoever is speaking." Then "find 10 clips under 60 seconds" and deliver vertical versions.

**Travel or event montage, no talking.** No transcript to cut from. "Sort clips by camera and time shot, mark everything under 2 seconds, build a first-pass timeline in shooting order to this music track's length." Then your pass carries it.

**Screen recording or tutorial.** 1 with "cut silences over 0.8 seconds", then "zoom-in callouts at these timestamps as a transparent overlay".

**Something went wrong.** Press **4**, or type `/what-happened clips are red in Resolve`. Claude replays what it did and finds the cause, such as a moved file to relink.

## What Claude can and can't do inside Resolve

| Can | Partly | Can't (do these by hand) |
|---|---|---|
| Build timelines from in/out points, import and organize media, markers, renders, transitions and fades, constant speed, multicam and SmartSwitch, LUTs and CDLs, Fusion titles, read transcripts, clip effects, copy attributes, export stills | Subtitles (makes an SRT, can't edit one subtitle), audio (levels only, no EQ or effects), Magic Mask (you click the subject) | Trim or blade clips already on a timeline (it builds a new timeline instead), color wheels, curves and windows, speed ramps, color nodes, Smart or Power Bins |

When something can't be done by Claude, it says so in one line and names the menu that does it.

## What asks you first

Deleting anything (to the Trash, undoable) · moving files already in `raw/` · spending Higgsfield credits · sending files off your Mac · installing software · Resolve scripts that delete clips, timelines or projects or change clip edges · Resolve scripts with full access to your Mac · quitting Resolve · anything outside your editing folders.

Everything else just happens, is logged, and shows as one line. `/what-happened` replays it.
