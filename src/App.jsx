import { useEffect, useRef, useState } from 'react';
import './App.css';
import Deck from './components/deck/Deck.jsx';
import TopBar from './components/layout/TopBar.jsx';
import Library from './components/library/Library.jsx';
import Mixer from './components/mixer/Mixer.jsx';
import RemixStudio from './components/remix/RemixStudio.jsx';
import { getSavedLibraryTracks, saveLibraryTrack } from './audio/libraryStore.js';

const DEVELOPMENT_STAGES = [
  { id: 'phase-1', label: 'Phase 1', name: 'Interface shell', done: true },
  { id: 'phase-2', label: 'Phase 2', name: 'Local music import', done: true },
  { id: 'phase-3', label: 'Phase 3', name: 'Dual-deck playback', done: true },
  { id: 'phase-4', label: 'Phase 4', name: 'Mixer & crossfader', done: true },
  { id: 'phase-5', label: 'Phase 5', name: '3-band EQ', done: true },
  { id: 'phase-6', label: 'Phase 6', name: 'Real waveforms', done: true },
  { id: 'phase-7', label: 'Phase 7', name: 'Approx. BPM detection', done: true },
  { id: 'phase-8', label: 'Phase 8', name: 'Approx. sync & pitch', done: true },
  { id: 'phase-9', label: 'Phase 9', name: 'Beat-grid analysis', done: true },
  { id: 'phase-10', label: 'Phase 10', name: 'Audio effects', done: true },
  { id: 'phase-11', label: 'Phase 11', name: 'Library & playlists', done: false },
  { id: 'phase-12', label: 'Phase 12', name: 'Mix recording', done: false },
  { id: 'phase-13', label: 'Phase 13', name: 'Spotify metadata', done: false },
  { id: 'phase-14', label: 'Phase 14', name: 'Licensed music sources', done: false },
  { id: 'phase-15', label: 'Phase 15', name: 'Electron desktop app', done: false },
  { id: 'phase-16', label: 'Phase 16', name: 'Testing & optimization', done: false },
];

function App() {
  const [tracks, setTracks] = useState([]);
  const [deckTracks, setDeckTracks] = useState({ A: null, B: null });
  const [playingDecks, setPlayingDecks] = useState({ A: false, B: false });
  const [deckLevels, setDeckLevels] = useState({ A: 0.8, B: 0.8 });
  const [deckEq, setDeckEq] = useState({
    A: { low: 0, mid: 0, high: 0 },
    B: { low: 0, mid: 0, high: 0 },
  });
  const [deckPitch, setDeckPitch] = useState({ A: 0, B: 0 });
  const [deckTimes, setDeckTimes] = useState({ A: 0, B: 0 });
  const [crossfader, setCrossfader] = useState(0);
  const [activePage, setActivePage] = useState('studio');
  const [notice, setNotice] = useState('');
  const [libraryReady, setLibraryReady] = useState(false);
  const objectUrls = useRef(new Set());
  const appRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    getSavedLibraryTracks().then(async (savedTracks) => {
      const restoreResults = await Promise.all(savedTracks.map(async (savedTrack) => {
        try {
          const permission = await savedTrack.handle.queryPermission({ mode: 'read' });
          if (permission !== 'granted') {
            return { track: { ...savedTrack, file: null, url: '', needsAccess: true } };
          }

          const file = await savedTrack.handle.getFile();
          const url = URL.createObjectURL(file);
          objectUrls.current.add(url);
          return { track: { ...savedTrack, file, url, needsAccess: false } };
        } catch (error) {
          return {
            track: { ...savedTrack, file: null, url: '', needsAccess: true },
            error,
          };
        }
      }));
      const restoredTracks = restoreResults.map(({ track }) => track);

      if (cancelled) {
        restoredTracks.forEach((track) => {
          if (track.url) URL.revokeObjectURL(track.url);
        });
        return;
      }

      setTracks(restoredTracks);
      let savedDeckIds = {};
      try {
        const savedAssignments = JSON.parse(localStorage.getItem('resonix-decks') || '{}');
        if (savedAssignments && typeof savedAssignments === 'object') {
          savedDeckIds = savedAssignments;
        }
      } catch (error) {
        setNotice(`Could not restore your deck assignments: ${error.message}`);
      }
      setDeckTracks({
        A: restoredTracks.find((track) => track.id === savedDeckIds.A) || null,
        B: restoredTracks.find((track) => track.id === savedDeckIds.B) || null,
      });
      const failedRestores = restoreResults.filter((result) => result.error);
      if (failedRestores.length > 0) {
        setNotice(`Could not reopen ${failedRestores.length} saved track(s): ${failedRestores.map(({ error }) => error.message).join('; ')}`);
      } else if (restoredTracks.some((track) => track.needsAccess)) {
        setNotice('Some tracks need file access. Choose Load A or Load B to reconnect them.');
      }
      setLibraryReady(true);
    }).catch((restoreError) => {
      if (!cancelled) {
        setNotice(`Could not restore the saved music library: ${restoreError.message}`);
        setLibraryReady(true);
      }
    });

    return () => {
      cancelled = true;
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!libraryReady) return;
    try {
      localStorage.setItem('resonix-decks', JSON.stringify({
        A: deckTracks.A?.id || null,
        B: deckTracks.B?.id || null,
      }));
    } catch (error) {
      setNotice(`Could not save your deck assignments: ${error.message}`);
    }
  }, [deckTracks, libraryReady]);

  const getDeckOutputVolume = (deckId) => {
    const normalized = (crossfader + 1) / 2;
    const leftMix = Math.cos(normalized * (Math.PI / 2));
    const rightMix = Math.sin(normalized * (Math.PI / 2));

    if (deckId === 'A') {
      return leftMix;
    }

    return rightMix;
  };

  const handleImport = (files, handles = []) => {
    const acceptedFiles = files.map((file, index) => ({ file, handle: handles[index] || null })).filter(({ file }) => (
      file.type.startsWith('audio/')
      || /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)
    ));
    const rejectedCount = files.length - acceptedFiles.length;

    const importedTracks = acceptedFiles.map(({ file, handle }) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      return {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: 'Local audio',
        album: '—',
        bpm: '—',
        key: '—',
        duration: null,
        file,
        url,
        handle,
        needsAccess: false,
      };
    });

    if (importedTracks.length > 0) {
      setTracks((currentTracks) => [...currentTracks, ...importedTracks]);
      Promise.all(importedTracks.map(saveLibraryTrack)).catch((saveError) => {
        setNotice(`Tracks were imported, but could not be saved for next time: ${saveError.message}`);
      });
      const skippedMessage = rejectedCount > 0
        ? ` ${rejectedCount} unsupported file(s) were skipped.`
        : '';
      const persistenceMessage = importedTracks.some((track) => !track.handle)
        ? ' This browser could not save file access; re-import these tracks after restarting.'
        : ' File access and deck assignments will be remembered.';
      setNotice(`${importedTracks.length} track(s) added to your library.${skippedMessage}${persistenceMessage}`);
    } else if (rejectedCount > 0) {
      setNotice('The selected files are not in a supported audio format.');
    }
  };

  const handleLoadToDeck = async (track, deckId) => {
    let readyTrack = track;
    if (track.needsAccess) {
      try {
        const permission = await track.handle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') {
          setNotice(`Access to ${track.title} was not granted. Choose Load again to retry.`);
          return;
        }
        const file = await track.handle.getFile();
        const url = URL.createObjectURL(file);
        objectUrls.current.add(url);
        readyTrack = { ...track, file, url, needsAccess: false };
        setTracks((currentTracks) => currentTracks.map((item) => (
          item.id === track.id ? readyTrack : item
        )));
      } catch (accessError) {
        setNotice(`Could not reopen ${track.title}: ${accessError.message}`);
        return;
      }
    }

    setDeckTracks((current) => ({ ...current, [deckId]: readyTrack }));
    setNotice(`${track.title} loaded to Deck ${deckId}.`);
  };

  const handleDurationChange = (trackId, duration) => {
    setTracks((currentTracks) => currentTracks.map((track) => (
      track.id === trackId ? { ...track, duration } : track
    )));
  };

  const handleBpmChange = (trackId, bpm, confidence) => {
    const bpmValue = bpm ? String(bpm) : '—';
    const updateTrack = (track) => (
      track?.id === trackId ? { ...track, bpm: bpmValue, bpmConfidence: confidence } : track
    );
    setTracks((currentTracks) => currentTracks.map(updateTrack));
    setDeckTracks((currentDecks) => ({
      A: updateTrack(currentDecks.A),
      B: updateTrack(currentDecks.B),
    }));
  };

  const handleSyncFeedback = (message) => setNotice(message);

  const handleNavigate = (page, section) => {
    setActivePage(page);
    if (page === 'studio' && section) {
      window.setTimeout(() => {
        document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
      return;
    }
    appRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const status = Object.values(playingDecks).some(Boolean)
    ? 'Playing'
    : tracks.length > 0
      ? 'Audio ready'
      : 'Import audio to begin';

  return (
    <div className="app" ref={appRef}>
      <TopBar status={status} activePage={activePage} onNavigate={handleNavigate} />
      {notice && (
        <div className="app__notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {activePage === 'studio' ? (
        <>
          <main className="main-area" id="decks">
            <Deck
              deckId="A"
              deckColor="var(--deck-a-color)"
              track={deckTracks.A}
              channelVolume={deckLevels.A}
              outputMix={getDeckOutputVolume('A')}
              eq={deckEq.A}
              syncBpm={deckTracks.B?.bpm}
              syncTime={deckTimes.B}
              syncPitch={deckPitch.B}
              onDurationChange={handleDurationChange}
              onBpmChange={handleBpmChange}
              onPositionChange={(time) => setDeckTimes((current) => ({ ...current, A: time }))}
              onPitchChange={(value) => setDeckPitch((current) => ({ ...current, A: value }))}
              onSyncFeedback={handleSyncFeedback}
              onEqChange={(band, value) => setDeckEq((current) => ({
                ...current,
                A: { ...current.A, [band]: value },
              }))}
              onVolumeChange={(value) => setDeckLevels((current) => ({ ...current, A: value }))}
              onPlayingChange={(isPlaying) => setPlayingDecks((current) => ({ ...current, A: isPlaying }))}
            />
            <Deck
              deckId="B"
              deckColor="var(--deck-b-color)"
              track={deckTracks.B}
              channelVolume={deckLevels.B}
              outputMix={getDeckOutputVolume('B')}
              eq={deckEq.B}
              syncBpm={deckTracks.A?.bpm}
              syncTime={deckTimes.A}
              syncPitch={deckPitch.A}
              onDurationChange={handleDurationChange}
              onBpmChange={handleBpmChange}
              onPositionChange={(time) => setDeckTimes((current) => ({ ...current, B: time }))}
              onPitchChange={(value) => setDeckPitch((current) => ({ ...current, B: value }))}
              onSyncFeedback={handleSyncFeedback}
              onEqChange={(band, value) => setDeckEq((current) => ({
                ...current,
                B: { ...current.B, [band]: value },
              }))}
              onVolumeChange={(value) => setDeckLevels((current) => ({ ...current, B: value }))}
              onPlayingChange={(isPlaying) => setPlayingDecks((current) => ({ ...current, B: isPlaying }))}
            />
            <Mixer
              deckLevels={deckLevels}
              deckEq={deckEq}
              crossfader={crossfader}
              onDeckLevelChange={(deckId, value) => setDeckLevels((current) => ({ ...current, [deckId]: value }))}
              onEqChange={(deckId, band, value) => setDeckEq((current) => ({
                ...current,
                [deckId]: { ...current[deckId], [band]: value },
              }))}
              onEqReset={(deckId) => setDeckEq((current) => ({
                ...current,
                [deckId]: { low: 0, mid: 0, high: 0 },
              }))}
              onCrossfaderChange={setCrossfader}
            />
          </main>
          <div id="library">
            <Library
              tracks={tracks}
              onImport={handleImport}
              onLoadToDeck={handleLoadToDeck}
              onImportError={(error) => setNotice(`Could not import audio: ${error.message}`)}
            />
          </div>
          <RemixStudio
            tracks={tracks}
            onLoadToDeck={handleLoadToDeck}
            onImportTracks={() => {
              handleNavigate('studio', 'library');
              setNotice('Import a track from your library to start a remix.');
            }}
          />
        </>
      ) : (
        <main className="roadmap-page" id="roadmap">
          <div className="roadmap-page__header">
            <span className="roadmap-page__eyebrow">RESONIX DEVELOPMENT</span>
            <h1>Project roadmap</h1>
            <p>
              Completed work and the remaining milestones. Approximate analysis features are labeled honestly.
            </p>
            <div className="roadmap-page__progress" role="status">
              <strong>{DEVELOPMENT_STAGES.filter((phase) => phase.done).length} / {DEVELOPMENT_STAGES.length}</strong>
              <span>phases complete</span>
            </div>
          </div>
          <ol className="roadmap-page__list" aria-label="Development phases checklist">
            {DEVELOPMENT_STAGES.map((phase) => (
              <li
                key={phase.id}
                className={`roadmap-page__item ${phase.done ? 'roadmap-page__item--done' : ''}`}
              >
                <span className="roadmap-page__check" aria-hidden="true">{phase.done ? '✓' : '·'}</span>
                <span className="roadmap-page__phase">{phase.label}</span>
                <span className="roadmap-page__name">{phase.name}</span>
                <span className="roadmap-page__status">{phase.done ? 'Complete' : 'Upcoming'}</span>
              </li>
            ))}
          </ol>
        </main>
      )}
    </div>
  );
}

export default App;
