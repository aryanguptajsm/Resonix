# Auto-DJ / Concert Mode

## Use it

1. Add tracks to **Songs** and wait for their analysis to finish.
2. Open **Concert mix**, choose the opening song and mix style, then reorder the remaining queue with its up/down buttons.
3. Select **Start Auto-DJ**. The panel shows the current song, next song, transition progress and the active mix stage. Choose **Stop Auto-DJ** to stop both decks.

The queue and all audio processing stay in the browser. The browser may ask for access to locally selected files again after a restart.

## Architecture

- Each deck owns its Web Audio graph, EQ, effects and peak guard. The two-deck mixer still controls levels and crossfader.
- BPM, beat-grid, approximate key, bar-energy, intro/outro and peak-energy analysis runs in `src/audio/analysis.worker.js`. The main thread decodes audio, downmixes/resamples it, and transfers the PCM to the worker.
- Analysis results are cached in IndexedDB by SHA-256 file hash. Reopening the same file can reuse the analysis without recalculating it.
- The local set planner orders tracks using tempo, Camelot compatibility and energy. Auto-DJ supports Festival House, Afterhours Techno and Neon Disco transition plans.
- When a pair has a close direct/half-time/double-time BPM match, the incoming deck uses SoundTouch's AudioWorklet to adjust tempo while preserving pitch. If no close match is available, the planner selects a shorter transition rather than forcing tempo sync.
- Phrase boundaries are estimated every 16 beats. The transition begins at the next available boundary around the outgoing track's midpoint, subject to enough remaining time for the blend.
- During a transition, crossfader and EQ automation follows the outgoing deck's media position. Echo and reverb are added during the handoff; the opening song returns for the finale.
- The queue's up/down controls are keyboard accessible. Stop Auto-DJ remains visible while the set is running.

## Analysis and playback limits

- BPM is an approximate onset-autocorrelation estimate, not a certified beat grid. Current tests validate synthetic click tracks only; a licensed reference corpus has not been used to verify the brief's 90%-within-1-BPM target.
- Key detection uses a lightweight chroma/Goertzel heuristic. Camelot compatibility and key estimates should be confirmed by ear.
- Phrase alignment assumes the first detected beat is the track's first beat. It cannot reliably identify pickup bars or a delayed first downbeat.
- The transition timeline is driven by media-element playback position and UI updates, with Web Audio parameter smoothing. It is not a shared-AudioContext/AudioWorklet scheduled transition, so a transition within 10 ms of a real beat is not guaranteed.
- Vocal overlap detection, stem separation/mashups, drag-and-drop queueing, visualizer/strobe, recording, and a shared master limiter are not implemented. Per-deck peak guards remain active.
- Analysis is limited to files whose estimated decoded size is no more than 192 MiB. Longer tracks remain playable but do not receive waveform analysis.
- AudioWorklet playback requires a secure context (HTTPS or localhost) and browser support for Web Audio AudioWorklets.

## Validation

Run `npm test` for synthetic BPM, beat-grid, Camelot, tempo-match, transition-plan and phrase-boundary tests. Run `npm run build` for the production bundle. The browser audio path still needs hands-on listening tests with licensed tracks in Chrome, Edge and Firefox.
