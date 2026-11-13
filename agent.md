# Resonix: Auto-DJ Mode (Codex Task Brief)

Paste this whole file into Codex as the task, or save it as `AGENTS.md` in the repo root.

## Goal
Add an **Auto-DJ / Concert Mode** to Resonix. The user loads or queues tracks, presses one button, and the app plays and mixes them continuously like a live DJ set. No manual input is needed. Transitions must be beat-matched, phrase-aligned and harmonically sensible.

## Work autonomously
- Inspect the repo first (framework, build tool, existing audio code, folder structure). Follow the existing conventions and do not rewrite working features.
- Make decisions yourself and note them in `docs/autodj.md`. Do not stop to ask questions unless something is truly blocked.
- Work in small commits. After each milestone run build, lint and tests, and fix failures before moving on.
- Do not add paid or API-key services. Everything must run in the browser (static hosting such as GitHub Pages must work).

## Tech stack (browser only)
- Web Audio API with `AudioContext`, `AudioWorklet` for sample-accurate scheduling, `GainNode`, and `BiquadFilterNode` for 3-band EQ and filter sweeps.
- Time-stretch with pitch preservation (key lock): use `soundtouchjs` or a Rubber Band WASM build. Plain `playbackRate` shifts pitch, so do not use it alone for tempo sync.
- Analysis in a **Web Worker** so the UI never freezes:
  - BPM and beat grid: `essentia.js` (RhythmExtractor) or `web-audio-beat-detector`. Fall back to a custom onset-autocorrelation if neither works.
  - Key detection: essentia.js KeyExtractor, then map to the **Camelot wheel**.
  - Energy curve: RMS per bar.
  - Intro, outro and drop detection: find low-energy intro and outro regions and high-energy sections.
- Cache analysis results in IndexedDB keyed by a file hash, so a track is analysed only once.

## Architecture
1. `AnalysisEngine` (worker) returns `{bpm, beatTimes[], downbeats[], key, camelot, energyCurve[], introEnd, outroStart, phraseBoundaries[]}`.
2. `Deck` (x2) handles load, play, cue, tempo, key-lock, gain, EQ and filter. Each deck has its own audio graph feeding the master bus.
3. `Mixer` provides the master bus, crossfader, limiter (`DynamicsCompressorNode` as a safety limiter) and a recorder.
4. `TransitionPlanner` takes track A and track B and produces a plan.
5. `AutoDJController` is a state machine: `IDLE -> PLAYING_A -> PREPARING_B -> TRANSITIONING -> PLAYING_B -> ...`. It loads the next track on the idle deck ahead of time and schedules everything on the `AudioContext` clock, not `setTimeout`.
6. UI: Auto-DJ toggle, now-playing and next-up, a transition progress bar, waveform with beat grid, a "mix style" selector, and a queue with drag-reorder.

## Transition logic
- **Tempo sync:** stretch the incoming track to match the outgoing BPM. If the BPM ratio is within +/-8%, sync directly. Also try half-time and double-time (x0.5, x2). If still too far apart, use a short filter-sweep or echo-out transition without beatmatching. Then ease the tempo gradually back to the incoming track's native BPM after the mix.
- **Phase alignment:** start the incoming track on a downbeat, aligned to the outgoing track's beat grid and a phrase boundary (8, 16 or 32 beats).
- **Harmonic mixing:** prefer Camelot-compatible neighbours (same number, +/-1, or A/B swap). If keys clash, use a shorter transition or an EQ-heavy one so clashing melodies are not overlapped.
- **Transition styles** (pick by energy and key compatibility, with a little randomness):
  - *Smooth blend*: 16 to 32 beats, with crossfade and bass swap.
  - *Bass swap*: cut the low EQ of the outgoing track exactly when the incoming bass enters.
  - *Filter sweep*: high-pass the outgoing track while the incoming one rises.
  - *Echo out / reverb tail*: for tracks that do not match.
  - *Drop mix*: start the incoming track so its drop lands on the outgoing outro end.
- Never overlap two vocals if vocal regions can be detected; otherwise keep overlaps short.
- **Auto-ordering:** optional "Smart order" that sorts the queue by BPM and key so energy flows naturally, with a gentle rise and fall.

## "Remix two songs together" (mashup mode)
- Milestone 1 (required): overlap mix as above.
- Milestone 2 (stretch goal): in-browser stem separation (Demucs or Spleeter via ONNX Runtime Web or TensorFlow.js, running in a worker). Then allow mashups such as vocals of A over the instrumental of B, with drums and bass from one track and melody from the other. Make this optional and lazy-loaded, because the models are large.

## Concert feel
- Optional live effects automation (riser noise before the drop, short beat-repeat or stutter, filter automation) on a per-bar schedule.
- Optional visualiser synced to the beat grid, with strobe and colour on downbeats.
- Crossfade minimum silence must be zero, and the output must never clip.

## Acceptance criteria
- With 3 or more tracks queued, pressing "Auto-DJ" plays the whole set with no clicks, gaps or pops.
- Transition start is aligned to a beat within 10 ms of the grid (verify with a scheduling test).
- BPM detection is within +/-1 BPM on at least 90% of a small test set of tracks that you generate or license-free sample.
- UI stays responsive (no main-thread analysis blocking longer than 50 ms).
- Works in current Chrome, Edge and Firefox. Handle Safari's `AudioContext` resume-on-gesture rule.
- Unit tests for BPM math, Camelot compatibility, transition planning and phase alignment.
- README section with a short demo GIF or description and usage steps. Update `docs/autodj.md`.

## Rules
- Only use audio the user owns, has licensed, or that is royalty-free for demos and tests. Do not commit copyrighted songs to the repo.
- Keep it accessible: keyboard controls, a visible "stop Auto-DJ" button, and an option to disable flashing visuals.
- Do not break existing features. Run the full build and tests before finishing.

## Deliverables
1. Working Auto-DJ mode merged on a feature branch with clear commits.
2. `docs/autodj.md` covering architecture, decisions and known limits.
3. A short summary of what works, what is stretch or unfinished, and how to run it.
