import React, { useState } from 'react';
import './TopBar.css';

/**
 * TopBar — The top navigation/utility bar for RESONIX.
 * Fixed at 48px height, contains logo, nav links, audio status,
 * master volume, and settings. Phase 1 shell — no audio functionality yet.
 */
function TopBar() {
  /* Master volume state — default 80% */
  const [masterVolume, setMasterVolume] = useState(80);

  return (
    <header className="topbar">
      {/* ---- Left section: Logo + Nav Links ---- */}
      <div className="topbar__left">
        {/* RESONIX logo with vinyl disc icon */}
        <div className="topbar__logo">
          <svg
            className="topbar__logo-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Vinyl disc / record icon */}
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" />
            {/* Grooves */}
            <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          </svg>
          <span className="topbar__logo-text">RESONIX</span>
        </div>

        {/* Navigation links — functional placeholders for now */}
        <nav className="topbar__nav">
          <button className="topbar__nav-link">Library</button>
          <button className="topbar__nav-link">Effects</button>
          <button className="topbar__nav-link">Record</button>
        </nav>
      </div>

      {/* ---- Center spacer pushes right section to the end ---- */}
      <div className="topbar__spacer" />

      {/* ---- Right section: Status, Master Volume, Settings ---- */}
      <div className="topbar__right">
        {/* Audio context status indicator */}
        <div className="topbar__status">
          <span className="topbar__status-dot" />
          <span className="topbar__status-text">Ready</span>
        </div>

        {/* Master volume control */}
        <div className="topbar__master">
          <label className="topbar__master-label" htmlFor="master-volume">
            MASTER
          </label>
          <input
            id="master-volume"
            className="topbar__master-slider"
            type="range"
            min="0"
            max="100"
            value={masterVolume}
            onChange={(e) => setMasterVolume(Number(e.target.value))}
          />
          <span className="topbar__master-value">{masterVolume}</span>
        </div>

        {/* Settings gear button */}
        <button className="topbar__settings-btn" aria-label="Settings">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Gear / cog icon */}
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33
              1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06
              a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09
              A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68
              a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06
              a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09
              a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
