import React, { useState } from 'react';
import './Library.css';

/* ──────────────────────────────────────────────
   Library — Bottom panel track browser
   Phase 1 shell: displays sample tracks, search
   bar, tabs, and load-to-deck buttons. No real
   audio loading yet.
   ────────────────────────────────────────────── */

/* Tabs available in the library header */
const TABS = ['ALL TRACKS', 'PLAYLISTS', 'FAVORITES', 'HISTORY'];

/* Placeholder tracks for visual testing — real data comes in Phase 2 */
const SAMPLE_TRACKS = [
  { id: 1, title: 'Midnight Groove', artist: 'DJ Shadow', album: 'Endtroducing', bpm: 126, duration: '5:32', key: 'Am' },
  { id: 2, title: 'Electric Dreams', artist: 'Daft Punk', album: 'Discovery', bpm: 128, duration: '4:15', key: 'Cm' },
  { id: 3, title: 'Bass Cathedral', artist: 'Noisia', album: 'Split The Atom', bpm: 174, duration: '6:01', key: 'Fm' },
];

function Library() {
  /* Currently active tab — only "ALL TRACKS" is functional for now */
  const [activeTab, setActiveTab] = useState('ALL TRACKS');

  /* Search query (filtering not wired up yet) */
  const [searchQuery, setSearchQuery] = useState('');

  /* Track being hovered — used to show load-to-deck buttons */
  const [hoveredTrackId, setHoveredTrackId] = useState(null);

  /* Compute total duration from sample tracks for the status bar */
  const totalDuration = () => {
    let totalSeconds = 0;
    SAMPLE_TRACKS.forEach((track) => {
      const [mins, secs] = track.duration.split(':').map(Number);
      totalSeconds += mins * 60 + secs;
    });
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  /* Placeholder handler — Phase 2 will load audio into a deck */
  const handleLoadToDeck = (trackId, deck) => {
    console.log(`[Library] Load track ${trackId} to Deck ${deck}`);
  };

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
              onClick={() => setActiveTab(tab)}
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
          <button className="library__import-btn">📂 Import</button>
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
        {SAMPLE_TRACKS.map((track, index) => (
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
            <span className="library__cell library__cell--duration library__cell--mono">{track.duration}</span>
            <span className="library__cell library__cell--key library__cell--mono">{track.key}</span>

            {/* Load-to-deck buttons — visible only on hover */}
            <span className="library__cell library__cell--actions">
              {hoveredTrackId === track.id && (
                <div className="library__load-buttons">
                  <button
                    className="library__load-btn library__load-btn--a"
                    onClick={() => handleLoadToDeck(track.id, 'A')}
                  >
                    Load A
                  </button>
                  <button
                    className="library__load-btn library__load-btn--b"
                    onClick={() => handleLoadToDeck(track.id, 'B')}
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
        <span className="library__status-count">{SAMPLE_TRACKS.length} tracks</span>
        <span className="library__status-sep">|</span>
        <span className="library__status-duration">{totalDuration()}</span>
      </div>
    </section>
  );
}

export default Library;
