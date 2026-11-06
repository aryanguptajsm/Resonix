import { useEffect, useRef, useState } from 'react';
import './App.css';
import Deck from './components/deck/Deck.jsx';
import TopBar from './components/layout/TopBar.jsx';
import Library from './components/library/Library.jsx';
import Mixer from './components/mixer/Mixer.jsx';

const DEVELOPMENT_STAGES = [
  { id: 'phase-1', label: 'Phase 1', name: 'Interface shell', done: true },
  { id: 'phase-2', label: 'Phase 2', name: 'Local music import', done: true },
  { id: 'phase-3', label: 'Phase 3', name: 'Dual-deck playback', done: true },
  { id: 'phase-4', label: 'Phase 4', name: 'Mixer & crossfader', done: true },
  { id: 'phase-5', label: 'Phase 5', name: 'EQ & gain staging', done: false },
  { id: 'phase-6', label: 'Phase 6', name: 'Waveform analysis', done: false },
];

function App() {
  const [tracks, setTracks] = useState([]);
  const [deckTracks, setDeckTracks] = useState({ A: null, B: null });
  const [playingDecks, setPlayingDecks] = useState({ A: false, B: false });
  const [deckLevels, setDeckLevels] = useState({ A: 0.8, B: 0.8 });
  const [crossfader, setCrossfader] = useState(0);
  const [notice, setNotice] = useState('');
  const objectUrls = useRef(new Set());

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const getDeckOutputVolume = (deckId) => {
    const normalized = (crossfader + 1) / 2;
    const leftMix = Math.cos(normalized * (Math.PI / 2));
    const rightMix = Math.sin(normalized * (Math.PI / 2));

    if (deckId === 'A') {
      return leftMix;
    }

    return rightMix;
  };

  const handleImport = (files) => {
    const acceptedFiles = files.filter((file) => (
      file.type.startsWith('audio/')
      || /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)
    ));
    const rejectedCount = files.length - acceptedFiles.length;

    const importedTracks = acceptedFiles.map((file) => {
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
        url,
      };
    });

    if (importedTracks.length > 0) {
      setTracks((currentTracks) => [...currentTracks, ...importedTracks]);
      const skippedMessage = rejectedCount > 0
        ? ` ${rejectedCount} non-audio file(s) skip hui.`
        : '';
      setNotice(`${importedTracks.length} audio file(s) library mein add hue.${skippedMessage}`);
    } else if (rejectedCount > 0) {
      setNotice('Selected files supported audio format mein nahi hain.');
    }
  };

  const handleLoadToDeck = (track, deckId) => {
    setDeckTracks((current) => ({ ...current, [deckId]: track }));
    setNotice(`${track.title} Deck ${deckId} mein load hua.`);
  };

  const handleDurationChange = (trackId, duration) => {
    setTracks((currentTracks) => currentTracks.map((track) => (
      track.id === trackId ? { ...track, duration } : track
    )));
  };

  const status = Object.values(playingDecks).some(Boolean)
    ? 'Playing'
    : tracks.length > 0
      ? 'Audio ready'
      : 'Import audio to begin';

  return (
    <div className="app">
      <TopBar status={status} />
      {notice && (
        <div className="app__notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      <div className="app__checklist" aria-label="Development checklist">
        {DEVELOPMENT_STAGES.map((phase) => (
          <div
            key={phase.id}
            className={`app__checklist-item ${phase.done ? 'app__checklist-item--done' : ''}`}
          >
            <span className="app__checklist-toggle">{phase.done ? '✓' : '•'}</span>
            <span>{phase.label}</span>
            <small>{phase.name}</small>
          </div>
        ))}
      </div>
      <main className="main-area" id="decks">
        <Deck
          deckId="A"
          deckColor="var(--deck-a-color)"
          track={deckTracks.A}
          channelVolume={deckLevels.A}
          masterVolume={getDeckOutputVolume('A')}
          onDurationChange={handleDurationChange}
          onVolumeChange={(value) => setDeckLevels((current) => ({ ...current, A: value }))}
          onPlayingChange={(isPlaying) => setPlayingDecks((current) => ({ ...current, A: isPlaying }))}
        />
        <Deck
          deckId="B"
          deckColor="var(--deck-b-color)"
          track={deckTracks.B}
          channelVolume={deckLevels.B}
          masterVolume={getDeckOutputVolume('B')}
          onDurationChange={handleDurationChange}
          onVolumeChange={(value) => setDeckLevels((current) => ({ ...current, B: value }))}
          onPlayingChange={(isPlaying) => setPlayingDecks((current) => ({ ...current, B: isPlaying }))}
        />
        <Mixer
          deckLevels={deckLevels}
          crossfader={crossfader}
          onDeckLevelChange={(deckId, value) => setDeckLevels((current) => ({ ...current, [deckId]: value }))}
          onCrossfaderChange={setCrossfader}
        />
      </main>
      <div id="library">
        <Library
          tracks={tracks}
          onImport={handleImport}
          onLoadToDeck={handleLoadToDeck}
        />
      </div>
    </div>
  );
}

export default App;
