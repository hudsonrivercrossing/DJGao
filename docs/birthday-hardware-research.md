# Happy Birthday on the FM‑1

## What the current site does

The birthday card is a four-take DJ set: Music box, House Party, Birthday Drop, Hyper Encore, about 86 seconds at 124 BPM. She records each take's signature layer (standard mode) or every layer (hard mode), and the guide places the rest. Replay and the V102 pattern export use the events she entered, saved in the browser under `fm1-dj-birthday-v1`. The set's score is in [`site/dj-score.js`](../site/dj-score.js) and the journey in [`site/finale.js`](../site/finale.js). The pattern table and transfer steps are in the last section, [Transfer the DJ set and play it on your FM‑1](#transfer-the-dj-set-and-play-it-on-your-fm1); hardware checks are in [`fm1-v102-dj-verification.md`](fm1-v102-dj-verification.md).

The rest of this note is the earlier research. The three-quarter, 96-step arrangement (Music Box, Neon Groove, Arcade Finale, Secret Encore) is superseded: the site no longer plays or exports it. The firmware comparison and the V102 key and range notes below still apply.

## Choose the firmware before writing the hardware lesson

| Firmware | Documented workflow |
| --- | --- |
| Factory V15 | A 16-step pattern and single-timbral FM playback. A useful match for playing the melody by hand or learning a short pattern. [M‑VAVE product page](https://www.m-vave.com/product?id=fm-1) · [V16 comparison](https://forum.m-vave.com/topic/23) |
| Factory V16 | 64 steps per pattern, 16 pattern slots, eight FM Voices, and an eight-row by eight-column Arrangement. The Arrangement replaces V15 sequential chaining. A real multi-voice arrangement is possible, with a different panel workflow and sound engine from the recipe below. [M‑VAVE V16 release notes](https://forum.m-vave.com/topic/23) |
| Baud Girl V102 | 64 steps per pattern, 16 pattern slots, Chain and per-pattern Preset, plus an 8‑Bit engine with separate Lead, Bass, Drums and SFX ranges. Use copies of the same 8‑Bit kit to switch sounds between takes. [Baud Girl manual §§6, 9, 9.15](https://baudgirl.com/work/FM-1%2BVA/manual/102) |

On a factory FM preset, the player can still perform the 25-note tune live with the same physical key positions at OCT +1, transpose 0 and ARP off. On Baud Girl’s 8‑Bit engine the same positions use OCT +2 because the Lead sounds one octave below the displayed trigger note. The documented mapping here assumes Baud Girl V102 and an existing 8‑Bit kit on the hardware. The site can teach this workflow as a browser simulation without any firmware install. [M‑VAVE keyboard manual §4.1](https://device.report/m/69bfea10c942797408c00f72adca51485cf91913f0ddc0e4f4dda3c7b8b715da) · [Baud Girl manual §§6.1.1, 13.4.1](https://baudgirl.com/work/FM-1%2BVA/manual/102)

For a factory V16 lesson, use the same two melody halves in Voice 1 and bring in a separate Voice for a bass pattern, then a separate pattern for the finale's fill. Reuse melody patterns by assigning them to more than one Arrangement cell. V16 applies edits to every cell that refers to the same pattern, so put new notes in a separate pattern to preserve the earlier take. V16 also has per-step Ratchet for repeated hits on a fill. The last GLOBE page shows the firmware version. [M‑VAVE V16 release notes](https://forum.m-vave.com/topic/23)

## Superseded: the earlier 3/4 Baud Girl score

This section describes the earlier arrangement and is kept as research. It is not what the site exports now.

Use **96 sixteenth-note steps** for the melody as currently written, split into **two 48-step patterns** named A and B here. Set each pattern to Rate 1/16, Swing 50%, Gate 100% and Repeats 1. The split falls immediately before the pickup to phrase three, between held notes. With Sync Off, choose one comfortable global Tempo, for example 108 BPM. Every pattern follows that Tempo across preset and pattern changes on V102. [Site melody](../site/learning-content.js) · [Baud Girl manual §§9.8.5, 9.14, 9.15, 10.1](https://baudgirl.com/work/FM-1%2BVA/manual/102)

### 1. Music Box · enter the melody

Use a spare 8‑Bit preset with Lead Wave **Triangle** and Delay Mix at 0. Set the preset's Key and both part arpeggios to Off, and leave the global Note Engine disengaged and transpose at zero so the keys play the written pitches. On HOME, ALGORITHM changes the Lead Wave. To access individual Lead parameters, press EDIT and select Lead. At **OCT +2**, the table names the trigger notes as they appear on the Lead lane. [Baud Girl manual §§1.7.1, 6.1.1, 6.3, 6.5, 8](https://baudgirl.com/work/FM-1%2BVA/manual/102)

| Pattern | Start step, trigger note and length in steps |
| --- | --- |
| A, phrase 1 | `1 G5 ×3`, `4 G5 ×1`, `5 A5 ×4`, `9 G5 ×4`, `13 C6 ×4`, `17 B5 ×8` |
| A, phrase 2 | `25 G5 ×3`, `28 G5 ×1`, `29 A5 ×4`, `33 G5 ×4`, `37 D6 ×4`, `41 C6 ×8` |
| B, phrase 3 | `1 G5 ×3`, `4 G5 ×1`, `5 G6 ×4`, `9 E6 ×4`, `13 C6 ×4`, `17 B5 ×4`, `21 A5 ×4` |
| B, phrase 4 | `25 F6 ×3`, `28 F6 ×1`, `29 E6 ×4`, `33 C6 ×4`, `37 D6 ×4`, `41 C6 ×8` |

For on-device entry, press SEQ, turn SELECT to Lead, press SEL and then REC. ALGORITHM moves the cursor. For a held note, enter the same key on consecutive steps with REC held on each step that ties into the next, then enter its last step with REC released. The two pickup notes on the same G or F each get their own onset. On the website, guidance can move the cursor and insert the documented ties if it shows them on the grid. [Baud Girl manual §§9.8, 9.8.5, 9.11.3](https://baudgirl.com/work/FM-1%2BVA/manual/102)

### 2. Neon Groove · overdub bass and drums

Copy A and B into two free pattern slots with Copy Pattern and Paste Pattern while stopped. Copy the kit and turn ALGORITHM on HOME to **GB Bell**. Enter **eight bass notes** (two steps each) and **16 drum hits** on the copies. Use **OCT −1** for C3 and G3 bass on the usual C4 and G4 physical key positions. Switch to **OCT −3** for drums. Use kick on F0 (MIDI 17), snare on F♯0 (18), and closed hi-hat on G0 (19). Audition them first. Drum slots are editable, so configure these slots if your kit uses a different order. On the Drums lane, the cursor stays after an entry so she uses ALGORITHM to move to the next step. After recording the first kick and snare of a pattern, she can also copy a drum step to an empty destination on that lane by holding SEL and turning SELECT. The lead and bass stay in place. [Baud Girl manual §§6.1.1, 6.2, 9.8.1–3, 9.12, 9.16](https://baudgirl.com/work/FM-1%2BVA/manual/102)

| Bar | Kick and bass on beat 1 | Snare on beat 2 |
| --- | --- | --- |
| 1 | A 5 · C3 | A 9 |
| 2 | A 17 · G3 | A 21 |
| 3 | A 29 · G3 | A 33 |
| 4 | A 41 · C3 | A 45 |
| 5 | B 5 · C3 | B 9 |
| 6 | B 17 · G3 | B 21 |
| 7 | B 29 · C3 | B 33 |
| 8 | B 41 · C3 | B 45 |

The snare goes on beat 2 so both hits fit every bar. Beat 3 of bar 4 falls at B step 1, the next phrase’s pickup, and beat 3 of bar 8 falls beyond the 96-step melody.

Let her hear the new lanes before offering echo. For optional echo, open FX, use SELECT to highlight Delay, turn ALGORITHM to enable it if needed, press SEL, and adjust its Mix row with ALGORITHM. KNOB3 changes the same Mix when the Delay knob bank is selected. Use a copied Groove preset if the solo should stay dry. [Baud Girl manual §§2.1.1, 2.2, 3.6, 7.1, 7.3](https://baudgirl.com/work/FM-1%2BVA/manual/102)

### 3. Arcade Finale · make the melody bigger

Copy the Groove patterns and kit. Select **Pulse 25** on HOME. Keep the lead polyphonic so the upper note and original melody can sound together. Set Pattern B to **52 steps**. Add the following while stopped. Each octave double begins alongside the lower note and lasts the same number of steps. [V102 manual §§3.2.2, 6.3, 9.8, 9.11.3, 9.14.1, 9.16](https://baudgirl.com/work/FM-1%2BVA/manual/102)

| Layer | Octave buttons | New events |
| --- | --- | --- |
| Closed hat | −3 | A 27, 31, 39, 47 · B 27, 31, 35, 39, 43, 47 · G0 (MIDI 19) on each |
| Bass pickups | −1 | A 15 G3, A 39 D3, B 15 G3, B 39 G3 · two steps each |
| Octave doubles | +3 | B 5 G7 ×4, B 9 E7 ×4, B 13 C7 ×4, B 41 C7 ×8 |
| Four-note fill | +2 | B 49 C6, B 50 E6, B 51 G6, B 52 C7 · one step each |

### 4. Secret Encore · let the game answer

Copy the Arcade patterns. Keep its Pulse 25 kit. Extend B to **64 steps**, leaving everything through B 52 intact. The three built-in effects play to their own end. They share the step with the drum that announces them. [V102 manual §§6.1.2, 9.8, 9.14.1](https://baudgirl.com/work/FM-1%2BVA/manual/102)

| B step | SFX at OCT −2 | Drum at OCT −3 | Lead at OCT +2 |
| --- | --- | --- | --- |
| 53 | F1 · Coin (29) | F0 · Kick (17) | |
| 54 | | | E6 |
| 56 | | | G6 |
| 57 | F♯1 · Jump (30) | F♯0 · Snare (18) | |
| 58 | | | D6 |
| 60 | | | G6 |
| 61 | A♯1 · Power-Up (34) | G0 · Closed hat (19) | |
| 62 | | | G6 |
| 64 | | | C7 |

All six Lead notes are one step. The last trigger is the physical C5 key and sounds C6. The web birthday card starts there.

### Transfer the DJ set and play it on your FM‑1

The four-take DJ set (Music box → House Party → Birthday Drop → Hyper Encore) replaced the four arrangements above on the birthday card. Its export is `encodeDjPatterns` in [`site/dj-export.js`](../site/dj-export.js), a Device Manager pattern backup written to the Device Manager's own layout (`fm1seq.js`: 0x22 whole-step messages with Ratchet, Gate and Chance in each step's 32 bytes, 0x21 lock messages; Filter Cutoff values from its `FX_CUTOFF` table). Task 1's results are in [`fm1-v102-dj-verification.md`](fm1-v102-dj-verification.md).

1. In Device Manager, back up all 16 patterns. The set needs 16 patterns: it fills Patterns 9–16 and then 1–8, chained in play order, the last back to 9. Open the .syx in Library and click Send.
2. In GLO, set Tempo 124 and Sync Off. Leave Seq Transpose at 0: every key change (the drop a whole tone up, the encore's D, E, F♯ and A) is written into the notes.
3. Make one 8-Bit preset per section and set it on its patterns with SEQ → Settings → Preset. The card lists each take's settings; the file only locks Filter Cutoff and Bitcrush Bits.

| Patterns | Take | Rate | Steps | Preset |
| --- | --- | --- | --- | --- |
| 9, 10 | Music box | 1/8T (≈ 93 BPM sixteenths) | 61 + 55 | Music box |
| 11–13 | House Party | 1/16 | 48 + 64 + 50 | House: Key C, Bass Pattern Alberti, Filter Low Pass |
| 14 | Birthday Drop: breakdown | 1/16 | 64 | Breakdown: Lead Arpeggio Major Wide, Bass Auto-Chord |
| 15 | Birthday Drop: build | 1/16 | 32 | Build: Filter High Pass, Bitcrush On |
| 16, 1, 2 | Birthday Drop: drop and rewind | 1/16 | 64 + 64 + 33 | Drop: Lead Octave +1, Key D, Auto-Chord, Lead Follows Bass, Distortion |
| 3, 4, 5, 6 | Hyper Encore, phrases in D, E, F♯, A | 1/16T | 48 + 32 + 32 + 32 | Encore in D, E, F♯, A |
| 7, 8 | Hyper Encore: fireworks and applause | 1/32T | 64 + 61 | Encore in A |

What the file leaves out or changes: notes the web marks as arpeggio, chord or double come from the preset; a held arpeggio bass key is written as the key. Chance is a whole step's setting, so only steps holding nothing but Chance hits roll; other Chance hits always play. A Ratchet repeats every note of its step inside that step. Pitch slides are not written. The party horn becomes the Alarm effect. Bass below F2 and the drop's chord keys below F5 move up an octave into their part's keys. Untested on hardware (Task 1): the drum slots, Ratchet over held notes and effects, echo tails at preset changes, the HEY drum and the 8‑Bit limiter.
