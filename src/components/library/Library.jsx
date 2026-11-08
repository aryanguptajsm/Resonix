import React, { useMemo, useRef, useState } from 'react';
import './Library.css';

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function Library({ tracks, onImport, onLoadToDeck, onImportError }) {
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef(null);
  const visibleTracks = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return tracks.filter((track) => (
      !query
      || `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(query)
    ));
  }, [searchQuery, tracks]);
  const knownDuration = tracks.reduce((total, track) => total + (track.duration || 0), 0);

  const openAudioPicker = async () => {
    if (!window.showOpenFilePicker) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{
          description: 'Audio files',
          accept: {
            'audio/*': ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac', '.opus'],
          },
        }],
      });
      const files = await Promise.all(handles.map((handle) => handle.getFile()));
      onImport(files, handles);
    } catch (error) {
      if (error.name !== 'AbortError') onImportError?.(error);
    }
  };

  return (
    <section className="library">
      <div className="library__header">
        <div className="library__heading">
          <div>
            <span className="library__eyebrow">YOUR COLLECTION</span>
            <h2>Music library</h2>
          </div>
          <span className="library__track-count">{tracks.length} tracks</span>
        </div>

        <div className="library__header-actions">
          <div className="library__search-wrapper">
            <svg className="library__search-icon" viewBox="0 0 20 20" aria-hidden="true">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <path d="m13 13 4 4" />
            </svg>
            <input
              type="text"
              className="library__search"
              placeholder="Search your library"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search tracks"
            />
          </div>
          <input
            ref={fileInputRef}
            className="library__import-input"
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus"
            multiple
            onChange={(event) => {
              onImport(Array.from(event.target.files || []));
              event.target.value = '';
            }}
          />
          <button
            className="library__import-btn"
            type="button"
            onClick={openAudioPicker}
          >
            <span aria-hidden="true">+</span>
            Import tracks
          </button>
        </div>
      </div>

      <div className="library__tracklist">
        <div className="library__row library__row--header">
          <span className="library__cell library__cell--num">#</span>
          <span className="library__cell library__cell--title">TITLE</span>
          <span className="library__cell library__cell--artist">ARTIST</span>
          <span className="library__cell library__cell--album">ALBUM</span>
          <span className="library__cell library__cell--bpm">BPM</span>
          <span className="library__cell library__cell--duration">DURATION</span>
          <span className="library__cell library__cell--key">KEY</span>
          <span className="library__cell library__cell--actions"></span>
        </div>

        {visibleTracks.length === 0 && (
          <p className="library__empty">
            {tracks.length === 0
              ? 'Your library is empty. Import audio files to get started.'
              : 'No tracks match your search.'}
          </p>
        )}
        {visibleTracks.map((track, index) => (
          <div
            key={track.id}
            className="library__row library__row--track"
          >
            <span className="library__cell library__cell--num">{String(index + 1).padStart(2, '0')}</span>
            <span className="library__cell library__cell--title">
              <span>{track.title}</span>
              {track.needsAccess && <small className="library__access-note">Access required</small>}
            </span>
            <span className="library__cell library__cell--artist">{track.artist}</span>
            <span className="library__cell library__cell--album">{track.album}</span>
            <span className="library__cell library__cell--bpm library__cell--mono">{track.bpm}</span>
            <span className="library__cell library__cell--duration library__cell--mono">
              {formatDuration(track.duration)}
            </span>
            <span className="library__cell library__cell--key library__cell--mono">{track.key}</span>

            <span className="library__cell library__cell--actions">
              <div className="library__load-buttons">
                <button
                  className="library__load-btn library__load-btn--a"
                  type="button"
                  onClick={() => onLoadToDeck(track, 'A')}
                >
                  A
                </button>
                <button
                  className="library__load-btn library__load-btn--b"
                  type="button"
                  onClick={() => onLoadToDeck(track, 'B')}
                >
                  B
                </button>
              </div>
            </span>
          </div>
        ))}
      </div>

      <div className="library__status">
        <span>{tracks.filter((track) => track.handle).length} tracks saved for next time</span>
        <span>{formatDuration(knownDuration)} total play time</span>
      </div>
    </section>
  );
}

export default Library;
