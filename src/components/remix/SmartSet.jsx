import { useMemo, useState } from 'react';
import { createLocalSmartSetlist } from '../../audio/createLocalRemixPlan.js';
import './SmartSet.css';

function SmartSet({ tracks, autoSet, onStart, onStop }) {
  const [openingTrackId, setOpeningTrackId] = useState('');
  const setlist = useMemo(() => {
    if (tracks.length < 2) return [];
    const openingId = tracks.some((track) => track.id === openingTrackId)
      ? openingTrackId
      : tracks[0].id;
    return createLocalSmartSetlist(tracks, openingId);
  }, [openingTrackId, tracks]);

  const handleStart = () => {
    if (setlist.length >= 2) onStart(setlist);
  };
  const activeStage = autoSet?.stage || 'ready';
  const stageIndex = {
    ready: -1,
    opening: 0,
    build: 1,
    blending: 1,
    middle: 2,
    finale: 3,
    'finale-fade': 3,
  }[activeStage] ?? -1;
  const stageLabel = {
    ready: 'READY FOR THE ROOM',
    opening: 'OPENING / WARM-UP',
    build: 'BUILDING THE ROOM',
    blending: 'LIVE BASS + ECHO HANDOFF',
    middle: 'MIDDLE OF THE SET',
    finale: 'GRAND FINALE',
    'finale-fade': 'FINAL FADE',
  }[activeStage] || 'READY FOR THE ROOM';

  return (
    <section className="smart-set" aria-labelledby="smart-set-title">
      <div className="smart-set__intro">
        <span className="smart-set__eyebrow">LOCAL CONCERT MIX · NO UPLOADS</span>
        <h2 id="smart-set-title">Build a live concert mix</h2>
        <p>
          Resonix orders your songs by beat and key, blends into each next song around
          the middle, then brings the opening song back for the finale.
        </p>
        <label className="smart-set__opener" htmlFor="smart-set-opener">
          OPENING SONG
          <select
            id="smart-set-opener"
            value={openingTrackId && tracks.some((track) => track.id === openingTrackId) ? openingTrackId : tracks[0]?.id || ''}
            onChange={(event) => setOpeningTrackId(event.target.value)}
            disabled={tracks.length === 0 || Boolean(autoSet)}
          >
            {tracks.map((track) => (
              <option key={track.id} value={track.id}>{track.title}</option>
            ))}
          </select>
        </label>
        {autoSet ? (
          <button className="smart-set__button smart-set__button--stop" type="button" onClick={onStop}>
            Stop concert mix
          </button>
        ) : (
          <button
            className="smart-set__button"
            type="button"
            onClick={handleStart}
            disabled={setlist.length < 2}
          >
            <span aria-hidden="true">✦</span>
            Start concert mix · {setlist.length} songs
            <span aria-hidden="true">→</span>
          </button>
        )}
        {tracks.length < 2 && (
          <small className="smart-set__hint">Import at least two songs to start a concert mix.</small>
        )}
        {autoSet && (
          <>
            <small className="smart-set__hint" role="status">
              {stageLabel} · {Math.min(autoSet.nextIndex, autoSet.songCount)} of {autoSet.songCount} songs cued
            </small>
            <ol className="smart-set__arc" aria-label="Concert mix progress">
              {['START', 'BUILD + DROP', 'MIDDLE', 'ENDING'].map((step, index) => (
                <li
                  key={step}
                  className={index === stageIndex
                    ? 'smart-set__arc-step smart-set__arc-step--active'
                    : index < stageIndex
                      ? 'smart-set__arc-step smart-set__arc-step--done'
                      : 'smart-set__arc-step'}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {step}
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <ol className="smart-set__list" aria-label="Concert mix song order">
        {setlist.map((track, index) => (
          <li key={track.id} className={index === 0 ? 'smart-set__track smart-set__track--opener' : 'smart-set__track'}>
            <span className="smart-set__number">{String(index + 1).padStart(2, '0')}</span>
            <span className="smart-set__track-info">
              <strong>{track.title}</strong>
              <small>{track.artist} {track.bpm === '—' ? 'tempo unknown' : `${track.bpm} BPM`}</small>
            </span>
            <span className="smart-set__role">
              {index === 0 ? 'OPEN' : index === setlist.length - 1 ? 'CLOSING' : 'NEXT'}
            </span>
          </li>
        ))}
        {setlist.length === 0 && (
          <li className="smart-set__empty">Your concert mix will include every imported song and return to the opener.</li>
        )}
      </ol>
    </section>
  );
}

export default SmartSet;
