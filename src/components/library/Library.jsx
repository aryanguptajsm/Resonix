import React, { useMemo, useRef, useState } from 'react';
import './Library.css';

const TABS = ['ALL TRACKS', 'PLAYLISTS', 'FAVORITES', 'HISTORY'];

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function Library({ tracks, onImport, onLoadToDeck }) {
  const [activeTab, setActiveTab] = useState('ALL TRACKS');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredTrackId, setHoveredTrackId] = useState(null);
  const fileInputRef = useRef(null);
  const visibleTracks = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return tracks.filter((track) => (
      !query
      || `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(query)
    ));
  }, [searchQuery, tracks]);
  const knownDuration = tracks.reduce((total, track) => total + (track.duration || 0), 0);

  return (
    <section className="library">
      {/* ── 1. Header Bar ─────────────────────────── */}
      <div className="library__header">
        {/* Tab navigation */}
        <div className="library__tabs">
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`library__tab ${activeTab === tab ? 'library__tab--active' : ''}`}
              disabled={tab !== 'ALL TRACKS'}
              onClick={() => setActiveTab(tab)}
              title={tab === 'ALL TRACKS' ? undefined : 'Available in a later phase'}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Right-side controls: search + import */}
        <div className="library__header-actions">
          <div className="library__search-wrapper">
            <span className="library__search-icon">🔍</span>
            <input
              type="text"
              className="library__search"
              placeholder="Search tracks…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            onClick={() => fileInputRef.current?.click()}
          >
            📂 Import audio
          </button>
        </div>
      </div>

      {/* ── 2. Track List ─────────────────────────── */}
      <div className="library__tracklist">
        {/* Column headers (sticky) */}
        <div className="library__row library__row--header">
          <span className="library__cell library__cell--num">#</span>
          <span className="library__cell library__cell--title">TITLE</span>
          <span className="library__cell library__cell--artist">ARTIST</span>
          <span className="library__cell library__cell--album">ALBUM</span>
          <span className="library__cell library__cell--bpm">BPM</span>
          <span className="library__cell library__cell--duration">DURATION</span>
          <span className="library__cell library__cell--key">KEY</span>
          {/* Empty spacer for the load buttons column */}
          <span className="library__cell library__cell--actions"></span>
        </div>

        {/* Track rows */}
        {visibleTracks.length === 0 && (
          <p className="library__empty">
            {tracks.length === 0 ? 'Import audio files to start your library.' : 'Search se koi track nahi mila.'}
          </p>
        )}
        {visibleTracks.map((track, index) => (
          <div
            key={track.id}
            className="library__row library__row--track"
            onMouseEnter={() => setHoveredTrackId(track.id)}
            onMouseLeave={() => setHoveredTrackId(null)}
          >
            <span className="library__cell library__cell--num">{index + 1}</span>
            <span className="library__cell library__cell--title">{track.title}</span>
            <span className="library__cell library__cell--artist">{track.artist}</span>
            <span className="library__cell library__cell--album">{track.album}</span>
            <span className="library__cell library__cell--bpm library__cell--mono">{track.bpm}</span>
            <span className="library__cell library__cell--duration library__cell--mono">
              {formatDuration(track.duration)}
            </span>
            <span className="library__cell library__cell--key library__cell--mono">{track.key}</span>

            {/* Load-to-deck buttons — visible only on hover */}
            <span className="library__cell library__cell--actions">
              {hoveredTrackId === track.id && (
                <div className="library__load-buttons">
                  <button
                    className="library__load-btn library__load-btn--a"
                    onClick={() => onLoadToDeck(track, 'A')}
                  >
                    Load A
                  </button>
                  <button
                    className="library__load-btn library__load-btn--b"
                    onClick={() => onLoadToDeck(track, 'B')}
                  >
                    Load B
                  </button>
                </div>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* ── 3. Bottom Status Bar ──────────────────── */}
      <div className="library__status">
        <span className="library__status-count">{tracks.length} tracks</span>
        <span className="library__status-sep">|</span>
        <span className="library__status-duration">{formatDuration(knownDuration)} analyzed</span>
      </div>
    </section>
  );
}

export default Library;
