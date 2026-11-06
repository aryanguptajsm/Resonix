/* ============================================
   Mixer Component — RESONIX DJ Application
   ============================================
   The central mixer panel that sits between Deck A
   and Deck B. Contains channel faders, EQ controls,
   crossfader, master volume, FX buttons, and a
   record button.
   
   Phase 1: All controls render visually but do not
   process audio. Values are tracked in local state.
   ============================================ */

import React, { useState } from 'react';
import './Mixer.css';

function Mixer() {
  /* ---- State for all mixer controls ---- */

  // Channel volume faders (0–100, default 80)
  const [volumeA, setVolumeA] = useState(80);
  const [volumeB, setVolumeB] = useState(80);

  // EQ knobs per channel: HI, MID, LO (-12 to +12 dB, default 0)
  const [eqA, setEqA] = useState({ hi: 0, mid: 0, lo: 0 });
  const [eqB, setEqB] = useState({ hi: 0, mid: 0, lo: 0 });

  // Crossfader (0 = full A, 100 = full B, default 50 center)
  const [crossfader, setCrossfader] = useState(50);

  // Master volume (0–100, default 80)
  const [masterVol, setMasterVol] = useState(80);

  // FX toggle states (all off in Phase 1)
  const [fxActive, setFxActive] = useState({
    echo: false,
    delay: false,
    rev: false,
    fltr: false,
  });

  // Record button state (inactive in Phase 1)
  const [isRecording, setIsRecording] = useState(false);

  /* ---- Level meter placeholder heights ---- */
  // In Phase 1 these are static; later they'll reflect real audio levels
  const levelA = volumeA; // Simulated: mirrors fader position
  const levelB = volumeB;

  /* ---- EQ change handler ---- */
  // Updates one band of one channel's EQ
  const handleEqChange = (deck, band, value) => {
    const numVal = parseInt(value, 10);
    if (deck === 'A') {
      setEqA((prev) => ({ ...prev, [band]: numVal }));
    } else {
      setEqB((prev) => ({ ...prev, [band]: numVal }));
    }
    console.log(`EQ ${deck} ${band.toUpperCase()}: ${value} dB`);
  };

  /* ---- FX button toggle handler ---- */
  const handleFxToggle = (fx) => {
    setFxActive((prev) => ({ ...prev, [fx]: !prev[fx] }));
    console.log(`FX ${fx.toUpperCase()}: ${!fxActive[fx] ? 'ON' : 'OFF'}`);
  };

  return (
    <div className="mixer">
      {/* =============================================
          Section 1: Mixer Header
          ============================================= */}
      <div className="mixer__header">
        <span className="mixer__title">MIXER</span>
      </div>

      {/* =============================================
          Section 2: Channel Volume Faders + Level Meters
          ============================================= */}
      <div className="mixer__section">
        <div className="mixer__channels">
          {/* ---- Deck A Channel ---- */}
          <div className="mixer__channel">
            <span className="mixer__channel-label mixer__channel-label--a">A</span>
            <div className="mixer__fader-wrapper">
              {/* Level meter placeholder — colored bar from bottom */}
              <div className="mixer__level-meter">
                <div
                  className="mixer__level-fill mixer__level-fill--a"
                  style={{ height: `${levelA}%` }}
                />
              </div>
              {/* Vertical volume slider */}
              <input
                type="range"
                className="mixer__fader mixer__fader--vertical mixer__fader--a"
                min="0"
                max="100"
                value={volumeA}
                onChange={(e) => {
                  setVolumeA(parseInt(e.target.value, 10));
                  console.log(`Volume A: ${e.target.value}`);
                }}
                orient="vertical"
              />
            </div>
          </div>

          {/* ---- Deck B Channel ---- */}
          <div className="mixer__channel">
            <span className="mixer__channel-label mixer__channel-label--b">B</span>
            <div className="mixer__fader-wrapper">
              {/* Level meter placeholder */}
              <div className="mixer__level-meter">
                <div
                  className="mixer__level-fill mixer__level-fill--b"
                  style={{ height: `${levelB}%` }}
                />
              </div>
              {/* Vertical volume slider */}
              <input
                type="range"
                className="mixer__fader mixer__fader--vertical mixer__fader--b"
                min="0"
                max="100"
                value={volumeB}
                onChange={(e) => {
                  setVolumeB(parseInt(e.target.value, 10));
                  console.log(`Volume B: ${e.target.value}`);
                }}
                orient="vertical"
              />
            </div>
          </div>
        </div>
      </div>

      {/* =============================================
          Section 3: EQ — 3-Band per Channel
          Layout:  A    Label    B
                  [|]   HI     [|]
                  [|]   MID    [|]
                  [|]   LO     [|]
          ============================================= */}
      <div className="mixer__section">
        <span className="mixer__section-title">EQ</span>
        <div className="mixer__eq">
          {/* One row per EQ band */}
          {['hi', 'mid', 'lo'].map((band) => (
            <div className="mixer__eq-row" key={band}>
              {/* Deck A EQ slider */}
              <input
                type="range"
                className="mixer__eq-slider mixer__eq-slider--a"
                min="-12"
                max="12"
                value={eqA[band]}
                onChange={(e) => handleEqChange('A', band, e.target.value)}
                orient="vertical"
                title={`Deck A ${band.toUpperCase()}: ${eqA[band]} dB`}
              />
              {/* Band label in center */}
              <span className="mixer__eq-label">{band.toUpperCase()}</span>
              {/* Deck B EQ slider */}
              <input
                type="range"
                className="mixer__eq-slider mixer__eq-slider--b"
                min="-12"
                max="12"
                value={eqB[band]}
                onChange={(e) => handleEqChange('B', band, e.target.value)}
                orient="vertical"
                title={`Deck B ${band.toUpperCase()}: ${eqB[band]} dB`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* =============================================
          Section 4: Crossfader
          Horizontal slider from A (left) to B (right)
          ============================================= */}
      <div className="mixer__section">
        <span className="mixer__section-title">CROSSFADER</span>
        <div className="mixer__crossfader">
          <span className="mixer__crossfader-label mixer__crossfader-label--a">A</span>
          <input
            type="range"
            className="mixer__crossfader-slider"
            min="0"
            max="100"
            value={crossfader}
            onChange={(e) => {
              setCrossfader(parseInt(e.target.value, 10));
              console.log(`Crossfader: ${e.target.value}`);
            }}
          />
          <span className="mixer__crossfader-label mixer__crossfader-label--b">B</span>
        </div>
      </div>

      {/* =============================================
          Section 5: Master Volume
          ============================================= */}
      <div className="mixer__section">
        <span className="mixer__section-title">MASTER</span>
        <div className="mixer__master">
          <input
            type="range"
            className="mixer__fader mixer__fader--vertical mixer__fader--master"
            min="0"
            max="100"
            value={masterVol}
            onChange={(e) => {
              setMasterVol(parseInt(e.target.value, 10));
              console.log(`Master Volume: ${e.target.value}`);
            }}
            orient="vertical"
          />
        </div>
      </div>

      {/* =============================================
          Section 6: FX Buttons (Phase 10 placeholder)
          ============================================= */}
      <div className="mixer__section">
        <span className="mixer__section-title">FX</span>
        <div className="mixer__fx">
          {['echo', 'delay', 'rev', 'fltr'].map((fx) => (
            <button
              key={fx}
              className={`mixer__fx-btn ${fxActive[fx] ? 'mixer__fx-btn--active' : ''}`}
              onClick={() => handleFxToggle(fx)}
            >
              {fx.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* =============================================
          Section 7: Record Button
          ============================================= */}
      <div className="mixer__section mixer__section--rec">
        <button
          className={`mixer__rec-btn ${isRecording ? 'mixer__rec-btn--active' : ''}`}
          onClick={() => {
            setIsRecording(!isRecording);
            console.log(`Recording: ${!isRecording ? 'STARTED' : 'STOPPED'}`);
          }}
        >
          ⏺
        </button>
        <span className="mixer__rec-label">REC</span>
      </div>
    </div>
  );
}

export default Mixer;
