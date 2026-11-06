/**
 * Deck.jsx — A single DJ deck (Deck A or Deck B) for RESONIX
 *
 * This is a Phase 1 shell: all controls render but have no audio
 * functionality yet. Each section is clearly marked for future wiring.
 *
 * Props:
 *   deckId    — "A" or "B"
 *   deckColor — CSS variable string, e.g. "var(--deck-a-color)"
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import './Deck.css';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export default function Deck({
  deckId = 'A',
  deckColor = 'var(--deck-a-color)',
  track = null,
  channelVolume = 0.8,
  masterVolume = 0.8,
  onDurationChange,
  onVolumeChange,
  onPlayingChange,
}) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [error, setError] = useState('');

  const label = `DECK ${deckId}`;

  const waveformBars = useMemo(() => {
    const progress = duration ? currentTime / duration : 0;
    return Array.from({ length: 36 }, (_, index) => {
      const wave = 16 + Math.abs(Math.sin(index * 0.75)) * 28 + (index % 5) * 4;
      const active = index / 36 <= progress;
      return { height: wave, active };
    });
  }, [currentTime, duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(0);
    setError('');
    setIsPlaying(false);

    if (track) {
      audio.src = track.url;
      audio.load();
    } else {
      audio.removeAttribute('src');
      audio.load();
    }
  }, [track]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(1, Math.max(0, channelVolume * masterVolume));
    }
  }, [channelVolume, masterVolume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = 1 + pitch / 100;
    }
  }, [pitch]);

  const handlePlay = async () => {
    if (!track || !audioRef.current) return;
    try {
      await audioRef.current.play();
      setError('');
    } catch (playError) {
      setError(`Playback start nahi hua: ${playError.message}`);
    }
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
    onPlayingChange?.(false);
  };

  const handleMetadata = () => {
    if (!audioRef.current || !track) return;
    const loadedDuration = audioRef.current.duration;
    if (Number.isFinite(loadedDuration)) {
      setDuration(loadedDuration);
      onDurationChange?.(track.id, loadedDuration);
    }
  };

  const handleAudioError = () => {
    const mediaError = audioRef.current?.error;
    const reason = mediaError?.message || 'format supported nahi hai ya file read nahi ho paayi.';
    setError(`Audio load/play nahi hua: ${reason}`);
    setIsPlaying(false);
    onPlayingChange?.(false);
  };

  return (
    <div
      className="deck"
      style={{ '--_deck-color': deckColor }}
    >
      <header className="deck__header">
        <div className="deck__header-left">
          <span className="deck__label">{label}</span>
          <div className="deck__track-info">
            <span className="deck__track-title">{track?.title || 'No Track Loaded'}</span>
            <span className="deck__track-artist">{track?.artist || 'Library se audio load karein'}</span>
          </div>
        </div>

        <div className="deck__header-right">
          <div className="deck__bpm">
            <span className="deck__bpm-value">{track?.bpm ?? '—'}</span>
            <span className="deck__bpm-label">BPM</span>
          </div>

          <div className="deck__time">
            <span className="deck__time-value">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </header>

      <div className="deck__waveform-container" aria-label={`Waveform for ${label}`}>
        {waveformBars.map((bar, index) => (
          <span
            key={`${deckId}-${index}`}
            className={`deck__wave-bar ${bar.active ? 'deck__wave-bar--active' : ''}`}
            style={{ height: `${bar.height}px` }}
          />
        ))}
      </div>

      <div className="deck__pitch-row">
        <label className="deck__seek-label" htmlFor={`seek-${deckId}`}>SEEK</label>
        <div className="deck__pitch-indicator">{pitch > 0 ? `+${pitch}%` : `${pitch}%`}</div>
      </div>
      <input
        id={`seek-${deckId}`}
        className="deck__seek"
        type="range"
        min="0"
        max={duration || 0}
        step="0.1"
        value={Math.min(currentTime, duration || 0)}
        disabled={!track || !duration}
        aria-label={`Seek Deck ${deckId}`}
        onChange={(event) => {
          const time = Number(event.target.value);
          if (audioRef.current) {
            audioRef.current.currentTime = time;
          }
          setCurrentTime(time);
        }}
      />

      <div className="deck__transport">
        <button
          className="deck__transport-btn deck__transport-btn--cue"
          title="Cue"
          disabled={!track}
          onClick={handleStop}
        >
          CUE
        </button>

        <button
          className={`deck__transport-btn deck__transport-btn--play ${
            isPlaying ? 'deck__transport-btn--active' : ''
          }`}
          title="Play / Pause"
          disabled={!track}
          onClick={isPlaying ? () => audioRef.current?.pause() : handlePlay}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        <button
          className="deck__transport-btn deck__transport-btn--stop"
          title="Stop"
          disabled={!track}
          onClick={handleStop}
        >
          ⏹
        </button>

        <button
          className="deck__transport-btn deck__transport-btn--sync"
          title="Sync"
          disabled={!track}
        >
          SYNC
        </button>
      </div>

      <div className="deck__jog-pitch-row">
        <div className="deck__jog-wrapper">
          <div className="deck__jog">
            <div className="deck__jog-inner">
              <div className="deck__jog-dot" />
            </div>
          </div>
          <span className="deck__jog-label">JOG · READY</span>
        </div>

        <div className="deck__volume">
          <label htmlFor={`volume-${deckId}`}>DECK VOLUME {Math.round(channelVolume * 100)}%</label>
          <input
            id={`volume-${deckId}`}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={channelVolume}
            onChange={(event) => {
              const value = Number(event.target.value);
              onVolumeChange?.(value);
            }}
            aria-label={`Deck ${deckId} volume`}
          />
        </div>
      </div>

      <div className="deck__pitch-wrapper">
        <label htmlFor={`pitch-${deckId}`}>PITCH {pitch > 0 ? `+${pitch}%` : `${pitch}%`}</label>
        <input
          id={`pitch-${deckId}`}
          type="range"
          min="-12"
          max="12"
          step="1"
          value={pitch}
          onChange={(event) => setPitch(Number(event.target.value))}
          aria-label={`Deck ${deckId} pitch`}
        />
      </div>

      <div className="deck__hotcues">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button key={n} className="deck__hotcue-btn" title={`Hot Cue ${n} — Phase 9`} disabled>
            {n}
          </button>
        ))}
      </div>

      <div className="deck__loops">
        {['1', '2', '4', '8', '16'].map((beats) => (
          <button key={beats} className="deck__loop-btn" title={`${beats} beat loop — Phase 9`} disabled>
            {beats}
          </button>
        ))}
        <button className="deck__loop-btn deck__loop-btn--toggle" title="Loop — Phase 9" disabled>
          LOOP
        </button>
      </div>

      {error && <p className="deck__error" role="alert">{error}</p>}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={handleMetadata}
        onTimeUpdate={() => setCurrentTime(audioRef.current.currentTime)}
        onPlay={() => {
          setIsPlaying(true);
          onPlayingChange?.(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          onPlayingChange?.(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          onPlayingChange?.(false);
        }}
        onError={handleAudioError}
      />
    </div>
  );
}
