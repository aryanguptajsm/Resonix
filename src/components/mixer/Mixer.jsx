import './Mixer.css';

function Mixer({ deckLevels, crossfader, onDeckLevelChange, onCrossfaderChange }) {
  const blendLabel = crossfader < -0.2
    ? 'A focus'
    : crossfader > 0.2
      ? 'B focus'
      : 'Center mix';

  return (
    <aside className="mixer">
      <div className="mixer__header">
        <span className="mixer__title">MIXER</span>
      </div>

      <div className="mixer__channel-control">
        <div className="mixer__label-row">
          <span>Deck A</span>
          <span>{Math.round(deckLevels.A * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={deckLevels.A}
          onChange={(event) => onDeckLevelChange?.('A', Number(event.target.value))}
          aria-label="Deck A channel level"
        />
      </div>

      <div className="mixer__channel-control">
        <div className="mixer__label-row">
          <span>Deck B</span>
          <span>{Math.round(deckLevels.B * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={deckLevels.B}
          onChange={(event) => onDeckLevelChange?.('B', Number(event.target.value))}
          aria-label="Deck B channel level"
        />
      </div>

      <div className="mixer__crossfader-block">
        <div className="mixer__label-row mixer__label-row--crossfader">
          <span>A</span>
          <strong>{blendLabel}</strong>
          <span>B</span>
        </div>
        <input
          className="mixer__crossfader"
          type="range"
          min="-1"
          max="1"
          step="0.01"
          value={crossfader}
          onChange={(event) => onCrossfaderChange?.(Number(event.target.value))}
          aria-label="Crossfader"
        />
      </div>

      <div className="mixer__status">
        <span>MASTER</span>
        <strong>{crossfader === 0 ? 'Balanced' : crossfader < 0 ? 'A Lead' : 'B Lead'}</strong>
      </div>

      <div className="mixer__phase-note">
        Phase 4 complete: channel gain and crossfader are now live. EQ aur waveform tasks follow next.
      </div>
    </aside>
  );
}

export default Mixer;
