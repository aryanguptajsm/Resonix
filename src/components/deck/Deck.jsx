/**
 * Deck.jsx — A single DJ deck (Deck A or Deck B) for RESONIX
 *
 * This is a Phase 1 shell: all controls render but have no audio
 * functionality yet. Each section is clearly marked for future wiring.
 *
 * Props:
 *   deckId    — "A" or "B"
 *   deckColor — CSS variable string, e.g. "var(--deck-a-color)"
 */
import React, { useRef, useState } from 'react';
import './Deck.css';

export default function Deck({ deckId = 'A', deckColor = 'var(--deck-a-color)' }) {
  /* ── Local UI state (no audio logic yet) ── */
  const [isPlaying, setIsPlaying] = useState(false);
  const [pitchValue, setPitchValue] = useState(0);
  const canvasRef = useRef(null);

  /* Helpers */
  const label = `DECK ${deckId}`;
  const pitchDisplay = `${pitchValue > 0 ? '+' : ''}${pitchValue.toFixed(1)}%`;

  return (
    <div
      className="deck"
      /* Expose deckColor so every child can reference it via var(--_deck-color) */
      style={{ '--_deck-color': deckColor }}
    >
      {/* ───────────────── 1. DECK HEADER ───────────────── */}
      <header className="deck__header">
        {/* Left: deck label + track info */}
        <div className="deck__header-left">
          <span className="deck__label">{label}</span>

          <div className="deck__track-info">
            <span className="deck__track-title">No Track Loaded</span>
            <span className="deck__track-artist">---</span>
          </div>
        </div>

        {/* Right: BPM + time readouts */}
        <div className="deck__header-right">
          <div className="deck__bpm">
            <span className="deck__bpm-value">---.-</span>
            <span className="deck__bpm-label">BPM</span>
          </div>

          <div className="deck__time">
            <span className="deck__time-value">0:00 / 0:00</span>
          </div>
        </div>
      </header>

      {/* ───────────────── 2. WAVEFORM AREA ───────────────── */}
      <div className="deck__waveform-container">
        {/* Canvas — will render real waveform data in a later phase */}
        <canvas ref={canvasRef} className="deck__waveform-canvas" />

        {/* Progress bar — width 0 % for now */}
        <div className="deck__waveform-progress" />
      </div>

      {/* ───────────────── 3. TRANSPORT CONTROLS ───────────────── */}
      <div className="deck__transport">
        <button
          className="deck__transport-btn deck__transport-btn--cue"
          title="Cue"
        >
          CUE
        </button>

        <button
          className={`deck__transport-btn deck__transport-btn--play ${
            isPlaying ? 'deck__transport-btn--active' : ''
          }`}
          title="Play / Pause"
          onClick={() => setIsPlaying((prev) => !prev)}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="deck__transport-btn deck__transport-btn--stop"
          title="Stop"
          onClick={() => setIsPlaying(false)}
        >
          ⏹
        </button>

        <button
          className="deck__transport-btn deck__transport-btn--sync"
          title="Sync"
        >
          SYNC
        </button>
      </div>

      {/* ─────── 4 & 5. JOG WHEEL + PITCH SLIDER (side by side) ─────── */}
      <div className="deck__jog-pitch-row">
        {/* 4. Jog Wheel */}
        <div className="deck__jog-wrapper">
          <div className="deck__jog">
            <div className="deck__jog-inner">
              <div className="deck__jog-dot" />
            </div>
          </div>
          <span className="deck__jog-label">JOG</span>
        </div>

        {/* 5. Pitch / Tempo Slider */}
        <div className="deck__pitch">
          <span className="deck__pitch-label">PITCH</span>

          <input
            type="range"
            className="deck__pitch-slider"
            min={-8}
            max={8}
            step={0.1}
            value={pitchValue}
            onChange={(e) => setPitchValue(parseFloat(e.target.value))}
            orient="vertical"
          />

          <span className="deck__pitch-value">{pitchDisplay}</span>
        </div>
      </div>

      {/* ───────────────── 6. HOT CUE BUTTONS ───────────────── */}
      <div className="deck__hotcues">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button key={n} className="deck__hotcue-btn" title={`Hot Cue ${n}`}>
            {n}
          </button>
        ))}
      </div>

      {/* ───────────────── 7. LOOP CONTROLS ───────────────── */}
      <div className="deck__loops">
        {['1', '2', '4', '8', '16'].map((beats) => (
          <button key={beats} className="deck__loop-btn" title={`${beats} beat loop`}>
            {beats}
          </button>
        ))}
        <button className="deck__loop-btn deck__loop-btn--toggle" title="Toggle Loop">
          LOOP
        </button>
      </div>

      {/* ───────────────── 8. LOAD TRACK BUTTON ───────────────── */}
      <button className="deck__load-btn" title="Load a track into this deck">
        📂 Load
      </button>
    </div>
  );
}
