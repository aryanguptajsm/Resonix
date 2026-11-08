import './Mixer.css';

const EQ_BANDS = [
  { id: 'low', label: 'LOW' },
  { id: 'mid', label: 'MID' },
  { id: 'high', label: 'HIGH' },
];

function Mixer({
  deckLevels,
  deckEq,
  crossfader,
  onDeckLevelChange,
  onEqChange,
  onEqReset,
  onCrossfaderChange,
}) {
  const blendLabel = crossfader < -0.02
    ? 'A focus'
    : crossfader > 0.02
      ? 'B focus'
      : 'Center mix';

  return (
    <aside className="mixer">
      <div className="mixer__header">
        <span className="mixer__title">MIXER</span>
      </div>

      {['A', 'B'].map((deckId) => (
        <section key={deckId} className="mixer__channel">
          <div className="mixer__channel-heading">
            <h2>DECK {deckId}</h2>
            <button type="button" onClick={() => onEqReset?.(deckId)}>EQ RESET</button>
          </div>
          <div className="mixer__channel-control">
            <div className="mixer__label-row">
              <label htmlFor={`channel-${deckId}`}>LEVEL</label>
              <span>{Math.round(deckLevels[deckId] * 100)}%</span>
            </div>
            <input
              id={`channel-${deckId}`}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={deckLevels[deckId]}
              onChange={(event) => onDeckLevelChange?.(deckId, Number(event.target.value))}
              aria-label={`Deck ${deckId} channel level`}
            />
          </div>
          <div className="mixer__eq">
            {EQ_BANDS.map(({ id, label }) => (
              <label key={id} className="mixer__eq-control" htmlFor={`eq-${deckId}-${id}`}>
                <span>{label}</span>
                <strong>{deckEq[deckId][id] > 0 ? '+' : ''}{deckEq[deckId][id]} dB</strong>
                <input
                  id={`eq-${deckId}-${id}`}
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={deckEq[deckId][id]}
                  onChange={(event) => onEqChange?.(deckId, id, Number(event.target.value))}
                  aria-label={`Deck ${deckId} ${label.toLowerCase()} EQ`}
                />
              </label>
            ))}
          </div>
        </section>
      ))}

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

    </aside>
  );
}

export default Mixer;
