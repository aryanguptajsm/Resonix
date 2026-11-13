import { useMemo, useState } from 'react';
import { createLocalSmartSetlist } from '../../audio/createLocalRemixPlan.js';
import './SmartSet.css';

function SmartSet({ tracks, autoSet, onStart, onStop }) {
  const [openingTrackId, setOpeningTrackId] = useState('');
  const [mixStyle, setMixStyle] = useState('festival');
  const [queueOrder, setQueueOrder] = useState([]);
  const [draggedTrackId, setDraggedTrackId] = useState(null);
  const generatedSetlist = useMemo(() => {
    if (tracks.length < 2) return [];
    const openingId = tracks.some((track) => track.id === openingTrackId)
      ? openingTrackId
      : tracks[0].id;
    return createLocalSmartSetlist(tracks, openingId);
  }, [openingTrackId, tracks]);
  const setlist = useMemo(() => {
    if (generatedSetlist.length === 0) return generatedSetlist;
    const trackById = new Map(generatedSetlist.map((track) => [track.id, track]));
    const orderedTracks = queueOrder
      .map((trackId) => trackById.get(trackId))
      .filter(Boolean);
    generatedSetlist.forEach((track) => {
      if (!orderedTracks.some((queuedTrack) => queuedTrack.id === track.id)) {
        orderedTracks.push(track);
      }
    });
    const openerId = tracks.some((track) => track.id === openingTrackId)
      ? openingTrackId
      : generatedSetlist[0].id;
    const openerIndex = orderedTracks.findIndex((track) => track.id === openerId);
    if (openerIndex > 0) orderedTracks.unshift(orderedTracks.splice(openerIndex, 1)[0]);
    return orderedTracks;
  }, [generatedSetlist, openingTrackId, queueOrder, tracks]);

  const handleStart = () => {
    if (setlist.length >= 2) onStart(setlist, mixStyle);
  };

  const reorderQueue = (sourceTrackId, destinationTrackId) => {
    if (autoSet || sourceTrackId === destinationTrackId) return;
    const reorderedIds = setlist.map((track) => track.id);
    const sourceIndex = reorderedIds.indexOf(sourceTrackId);
    const destinationIndex = reorderedIds.indexOf(destinationTrackId);
    if (sourceIndex <= 0 || destinationIndex <= 0) return;
    reorderedIds.splice(sourceIndex, 1);
    const insertIndex = sourceIndex < destinationIndex ? destinationIndex - 1 : destinationIndex;
    reorderedIds.splice(insertIndex, 0, sourceTrackId);
    setQueueOrder(reorderedIds);
  };

  const moveTrack = (index, direction) => {
    const destination = index + direction;
    if (destination < 1 || destination >= setlist.length) return;
    const reorderedIds = setlist.map((track) => track.id);
    [reorderedIds[index], reorderedIds[destination]] = [reorderedIds[destination], reorderedIds[index]];
    setQueueOrder(reorderedIds);
  };

  const currentTrack = tracks.find((track) => track.id === autoSet?.currentTrackId);
  const nextTrack = tracks.find((track) => track.id === autoSet?.nextTrackId);
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
    <section className="smart-set" id="smart-set" aria-labelledby="smart-set-title">
      <div className="smart-set__intro">
        <span className="smart-set__eyebrow">AUTO-DJ · LOCAL AUDIO</span>
        <h2 id="smart-set-title">Auto-DJ / Concert Mode</h2>
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
        <label className="smart-set__style" htmlFor="smart-set-style">
          MIX STYLE
          <select
            id="smart-set-style"
            value={mixStyle}
            onChange={(event) => setMixStyle(event.target.value)}
            disabled={Boolean(autoSet)}
          >
            <option value="festival">Festival House</option>
            <option value="techno">Afterhours Techno</option>
            <option value="disco">Neon Disco</option>
          </select>
        </label>
        {autoSet ? (
          <button className="smart-set__button smart-set__button--stop" type="button" onClick={onStop}>
            Stop Auto-DJ
          </button>
        ) : (
          <button
            className="smart-set__button"
            type="button"
            onClick={handleStart}
            disabled={setlist.length < 2}
          >
            <span aria-hidden="true">✦</span>
            Start Auto-DJ · {setlist.length} songs
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
            <div className="smart-set__now-playing">
              <span><strong>NOW PLAYING</strong>{currentTrack?.title || 'Preparing next song'}</span>
              <span><strong>NEXT UP</strong>{nextTrack?.title || 'Finale'}</span>
            </div>
            {autoSet.phase === 'blending' && (
              <div
                className="smart-set__progress"
                role="progressbar"
                aria-label="Transition progress"
                aria-valuemin="0"
                aria-valuemax="100"
                aria-valuenow={Math.round((autoSet.progress || 0) * 100)}
              >
                <span style={{ width: `${Math.round((autoSet.progress || 0) * 100)}%` }} />
              </div>
            )}
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
          <li
            key={track.id}
            className={`smart-set__track ${index === 0 ? 'smart-set__track--opener' : ''} ${draggedTrackId === track.id ? 'smart-set__track--dragging' : ''}`}
            draggable={!autoSet && index > 0}
            onDragStart={(event) => {
              setDraggedTrackId(track.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', track.id);
            }}
            onDragOver={(event) => {
              if (!autoSet && index > 0 && draggedTrackId) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              reorderQueue(event.dataTransfer.getData('text/plain') || draggedTrackId, track.id);
              setDraggedTrackId(null);
            }}
            onDragEnd={() => setDraggedTrackId(null)}
          >
            <span className="smart-set__number">{String(index + 1).padStart(2, '0')}</span>
            <span className="smart-set__track-info">
              <strong>{track.title}</strong>
              <small>{track.artist} {track.bpm === '—' ? 'tempo unknown' : `${track.bpm} BPM`}</small>
            </span>
            <span className="smart-set__role">
              {index === 0 ? 'OPEN / RETURN' : 'NEXT'}
            </span>
            <span className="smart-set__queue-controls">
              <button
                type="button"
                aria-label={`Move ${track.title} up in queue`}
                disabled={Boolean(autoSet) || index <= 1}
                onClick={() => moveTrack(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${track.title} down in queue`}
                disabled={Boolean(autoSet) || index === setlist.length - 1}
                onClick={() => moveTrack(index, 1)}
              >
                ↓
              </button>
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
