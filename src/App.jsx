import { useEffect, useRef, useState } from 'react';
import './App.css';
import Deck from './components/deck/Deck.jsx';
import TopBar from './components/layout/TopBar.jsx';
import Library from './components/library/Library.jsx';
import Mixer from './components/mixer/Mixer.jsx';

function App() {
  const [tracks, setTracks] = useState([]);
  const [deckTracks, setDeckTracks] = useState({ A: null, B: null });
  const [playingDecks, setPlayingDecks] = useState({ A: false, B: false });
  const [notice, setNotice] = useState('');
  const objectUrls = useRef(new Set());

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleImport = (files) => {
    const acceptedFiles = files.filter((file) => (
      file.type.startsWith('audio/')
      || /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)
    ));

    if (acceptedFiles.length !== files.length) {
      setNotice('Kuch files audio format mein nahi thi, isliye import nahi hui.');
    } else {
      setNotice('');
    }

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
      setNotice(`${importedTracks.length} audio file(s) library mein add hue.`);
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
      <main className="main-area" id="decks">
        <Deck
          deckId="A"
          deckColor="var(--deck-a-color)"
          track={deckTracks.A}
          onDurationChange={handleDurationChange}
          onPlayingChange={(isPlaying) => setPlayingDecks((current) => ({ ...current, A: isPlaying }))}
        />
        <Deck
          deckId="B"
          deckColor="var(--deck-b-color)"
          track={deckTracks.B}
          onDurationChange={handleDurationChange}
          onPlayingChange={(isPlaying) => setPlayingDecks((current) => ({ ...current, B: isPlaying }))}
        />
        <Mixer />
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
