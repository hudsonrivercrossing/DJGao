# FM‑1 emulation and verification

The firmware mode can run the original update package on `fm1-emu` instead of interpreting the panel in application JavaScript. Upstream models the JieLi AC791N's two pi32v2 cores, flash, timers, key matrix, encoders, 240 × 240 LCD, LEDs and audio. Its browser build runs the machine in an AudioWorklet and compiles hot firmware code to WebAssembly. Version 0.3.0 explicitly added working factory V16 boot, display and audio. This integration targets **fm1-emu v0.4.0**, commit `9de1ef0`, which adds hardware DSP and reset modeling. [Upstream source](https://github.com/joakimeriksson/fm1-emu/tree/v0.4.0) · [Release notes](https://github.com/joakimeriksson/fm1-emu/releases)

## Firmware files and startup state

| Package | Source | Verified starting state |
| --- | --- | --- |
| M‑VAVE factory V16 (`FM-1.fwsc`) | [M‑VAVE downloads](https://www.m-vave.com/download) | The firmware LCD showed `001 PIANO 3` on the tested package. |
| Baud Girl V102 (`FM-1+VA-102.fwsc`) | [Baud Girl installer and download](https://baudgirl.com/work/FM-1%2BVA/install) | The firmware LCD showed `001 EMU E.PNO` on a fresh emulated unit. |

The emulator's MIT license covers its code, with its copyright and permission notice carried alongside redistributed copies. Firmware belongs to its respective author and is supplied as a local file by the player. The vendor package servers do not provide the cross-origin access needed by the hosted emulator for these downloads. The browser file picker can provide the bytes directly to the local runtime. [License](https://github.com/joakimeriksson/fm1-emu/blob/v0.4.0/LICENSE) · [Upstream browser and firmware notes](https://github.com/joakimeriksson/fm1-emu/tree/v0.4.0)

A firmware package and a unit's saved presets and patterns are separate. Baud Girl's package booted in FM mode with the emulator's initial preset. To use its 8‑Bit engine, initialize a spare preset via `EDIT → Erase Preset → 8-Bit`, or load a compatible preset from its pack. The initialized kit has twelve drums, a triangle bass and a 25% pulse lead. The real waveform, per-part envelope and sequencer editing are provided by that firmware. [Emulated flash initialization](https://github.com/joakimeriksson/fm1-emu/blob/v0.4.0/docs/stock-firmware.md) · [Baud Girl manual §§3.5, 6 and 13.4](https://baudgirl.com/work/FM-1%2BVA/manual/102)

## Panel and browser integration

- Matrix IDs `0–13` are `OCT−`, `OCT+`, `FX`, `SEL`, `ENV`, `LFO`, `EDIT`, `GLO`, `HOME`, `SAVE`, `ARP`, `SEQ`, `PLAY`, `REC`. IDs `14–40` are the chromatic keys from F3 to G5, so the browser's physical base MIDI note maps to `baseMidi - 39`. Send press and release separately so firmware can detect holds and combinations. [Upstream panel mapping](https://github.com/joakimeriksson/fm1-emu/blob/v0.4.0/crates/fm1-live/src/panel.rs)
- The encoder IDs are `SELECT=0`, `ALGORITHM=1`, `KNOB 1–4=2–5` and `PRESETS=6`. MASTER is an analog pot. The runtime provides a 240 × 240 RGB565 framebuffer and 41 LED values indexed by matrix ID. [WASM interface](https://github.com/joakimeriksson/fm1-emu/blob/v0.4.0/crates/fm1-web/src/lib.rs)
- The vendorable browser build consists of the `fm1-web` WASM and the worklet. A Start gesture resumes the 44.1 kHz AudioContext, then the worklet consumes the package. The worklet supports firmware snapshots, which represent flash rather than unsaved firmware RAM. Upstream's hosted `?embed=1` presents its own panel. Its optional `flash` and `script` assets must come from its own origin, and its status messages are also same-origin. [Browser build](https://github.com/joakimeriksson/fm1-emu/blob/v0.4.0/web/build.sh) · [Worklet](https://github.com/joakimeriksson/fm1-emu/blob/v0.4.0/web/worklet.js) · [Try-out source](https://github.com/joakimeriksson/fm1-emu/blob/v0.4.0/web/tryout.js)

## What we verified

Booted both authors' packages directly in the pinned WASM with JIT at 100 MHz, using the same firmware boot ABI as the upstream browser. Each delivered over 132,000 audio frames in a three-second render with neither core reporting a fault. In each firmware, matrix key `21` (the physical C4 key) produced audio from silence and button `11` (SEQ) changed the real framebuffer. A second test sent `SEQ → REC → C4 E4 G4 → REC → PLAY` through the same matrix. The firmware changed its LCD for recording and playback, and both packages produced sequenced audio after all three piano keys were released. These checks establish firmware execution, physical input mapping, recording and digital audio. Real-unit audio comparison, device-specific timing and wider feature parity require separate verification.

The birthday workflow has a separate hardware arrangement score. Its authentic progression comes from recording the notes and drum hits described there. Loading firmware into the emulator establishes the real instrument controls and sound, and the birthday guide can keep track of which arrangement edits the player made. [Birthday score and hardware steps](birthday-hardware-research.md)

The website's Firmware control accepts a local `.fwsc`. Power On boots the selected file into the pink panel. The instrument controls retain press and release semantics, and LCD opens a magnified view of the same framebuffer. On a real browser test, factory V16 recorded three notes, played them, then saved the pattern from the firmware's own SAVE menu. After powering off and reloading the same package, its sequencer showed all three saved steps. Browser flash storage is scoped to the exact package and site origin. A firmware's own SAVE action is still required before switching off.

The vendored `fm1_web.wasm` was built from v0.4.0 with `web/build.sh` and Rust 1.96.0. Its SHA-256 is `a1ada74b6450604799babba3c40ffad2ff1a293b18c6e425082dd2eb8d48f3aa`. The accompanying `worklet.js` and `LICENSE` are from the same commit. The standalone HTML embeds all three and leaves the firmware file to the player.
