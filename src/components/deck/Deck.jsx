import { useEffect, useRef, useState } from 'react';
import { analyzeAudioFile } from '../../audio/analyzeWaveform.js';
import './Deck.css';

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

function updateAudioParam(context, audioParam, value) {
  audioParam.cancelScheduledValues(context.currentTime);
  audioParam.setTargetAtTime(value, context.currentTime, 0.025);
}

export default function Deck({
  deckId = 'A',
  deckColor = 'var(--deck-a-color)',
  track = null,
  channelVolume = 0.8,
  outputMix = 0.8,
  eq = { low: 0, mid: 0, high: 0 },
  onDurationChange,
  onEqChange,
  onVolumeChange,
  onPlayingChange,
}) {
  const audioRef = useRef(null);
  const audioGraphRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const drawWaveformRef = useRef(() => {});
  const waveformRequestRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState([]);
  const [waveformStatus, setWaveformStatus] = useState('idle');
  const [waveformError, setWaveformError] = useState('');
  const [error, setError] = useState('');

  const label = `DECK ${deckId}`;
  const headroom = 10 ** (-Math.max(0, eq.low, eq.mid, eq.high) / 20);
  const outputGain = Math.min(1, Math.max(0, channelVolume * outputMix * headroom));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(0);
    setWaveformPeaks([]);
    setWaveformError('');
    setWaveformStatus(track ? 'waiting' : 'idle');
    setError('');
    setIsPlaying(false);
    waveformRequestRef.current += 1;

    if (track) {
      audio.src = track.url;
      audio.load();
    } else {
      audio.removeAttribute('src');
      audio.load();
    }

    return () => {
      waveformRequestRef.current += 1;
    };
  }, [track]);

  useEffect(() => {
    const graph = audioGraphRef.current;
    if (!graph) return;

    const { context, lowFilter, midFilter, highFilter, channelGain } = graph;
    updateAudioParam(context, channelGain.gain, outputGain);
    updateAudioParam(context, lowFilter.gain, eq.low);
    updateAudioParam(context, midFilter.gain, eq.mid);
    updateAudioParam(context, highFilter.gain, eq.high);
  }, [eq.high, eq.low, eq.mid, outputGain]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = 1 + pitch / 100;
  }, [pitch]);

  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    drawWaveformRef.current = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(bounds.width * pixelRatio);
      canvas.height = Math.round(bounds.height * pixelRatio);

      const context = canvas.getContext('2d');
      if (!context) return;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);

      const center = bounds.height / 2;
      const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
      const playedWidth = bounds.width * progress;
      const color = getComputedStyle(canvas).getPropertyValue('--_deck-color').trim() || '#8b5cf6';
      const barWidth = Math.max(1, (bounds.width / Math.max(waveformPeaks.length, 1)) * 0.62);
      const playedGradient = context.createLinearGradient(0, 0, 0, bounds.height);
      playedGradient.addColorStop(0, color);
      playedGradient.addColorStop(0.5, 'rgba(255,255,255,0.88)');
      playedGradient.addColorStop(1, color);

      context.strokeStyle = 'rgba(255,255,255,0.08)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, center + 0.5);
      context.lineTo(bounds.width, center + 0.5);
      context.stroke();

      waveformPeaks.forEach((peak, index) => {
        const x = (index / waveformPeaks.length) * bounds.width;
        const barHeight = Math.max(2, peak * (bounds.height * 0.84));
        context.fillStyle = x < playedWidth ? playedGradient : 'rgba(179,190,215,0.42)';
        context.fillRect(x, center - barHeight / 2, barWidth, barHeight);
      });

      if (waveformPeaks.length > 0) {
        context.fillStyle = '#ffffff';
        context.shadowColor = color;
        context.shadowBlur = 7;
        context.fillRect(Math.min(playedWidth, bounds.width - 1), 0, 1.5, bounds.height);
        context.shadowBlur = 0;
      }
    };

    drawWaveformRef.current();
  }, [currentTime, duration, waveformPeaks]);

  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return undefined;

    const observer = new ResizeObserver(() => drawWaveformRef.current());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    const context = audioGraphRef.current?.context;
    if (context && context.state !== 'closed') {
      context.close().catch((closeError) => {
        console.error(`Deck ${deckId} audio context close failed:`, closeError);
      });
    }
  }, [deckId]);

  const createAudioGraph = () => {
    if (audioGraphRef.current) return audioGraphRef.current;
    if (!window.AudioContext || !audioRef.current) {
      throw new Error('Web Audio API available nahi hai; is browser mein deck audio start nahi ho sakta.');
    }

    const context = new window.AudioContext();
    const source = context.createMediaElementSource(audioRef.current);
    const lowFilter = context.createBiquadFilter();
    const midFilter = context.createBiquadFilter();
    const highFilter = context.createBiquadFilter();
    const channelGain = context.createGain();

    lowFilter.type = 'lowshelf';
    lowFilter.frequency.value = 250;
    lowFilter.gain.value = eq.low;
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 0.7;
    midFilter.gain.value = eq.mid;
    highFilter.type = 'highshelf';
    highFilter.frequency.value = 4000;
    highFilter.gain.value = eq.high;
    channelGain.gain.value = outputGain;

    source.connect(lowFilter);
    lowFilter.connect(midFilter);
    midFilter.connect(highFilter);
    highFilter.connect(channelGain);
    channelGain.connect(context.destination);
    audioRef.current.volume = 1;

    audioGraphRef.current = {
      context,
      lowFilter,
      midFilter,
      highFilter,
      channelGain,
    };
    return audioGraphRef.current;
  };

  const seekTo = (time) => {
    if (!audioRef.current || !duration) return;
    const nextTime = Math.min(duration, Math.max(0, time));
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handlePlay = async () => {
    if (!track || !audioRef.current) return;
    try {
      const graph = createAudioGraph();
      await graph.context.resume();
      await audioRef.current.play();
      setError('');
    } catch (playError) {
      setError(`Playback start nahi hua: ${playError.message || 'audio device/browser error.'}`);
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
    if (!Number.isFinite(loadedDuration)) return;

    setDuration(loadedDuration);
    onDurationChange?.(track.id, loadedDuration);
    if (!track.file) {
      setWaveformStatus('unavailable');
      setWaveformError('Original local file analysis ke liye available nahi hai.');
      return;
    }

    const requestId = waveformRequestRef.current;
    setWaveformStatus('analyzing');
    setWaveformError('');
    analyzeAudioFile(track.file, loadedDuration)
      .then((peaks) => {
        if (requestId !== waveformRequestRef.current) return;
        setWaveformPeaks(peaks);
        setWaveformStatus('ready');
      })
      .catch((analysisError) => {
        if (requestId !== waveformRequestRef.current) return;
        setWaveformStatus('error');
        setWaveformError(analysisError.message || 'Waveform analysis failed.');
      });
  };

  const handleAudioError = () => {
    const mediaError = audioRef.current?.error;
    const reason = mediaError?.message || 'format supported nahi hai ya file read nahi ho paayi.';
    setError(`Audio load/play nahi hua: ${reason}`);
    setIsPlaying(false);
    onPlayingChange?.(false);
  };

  const waveformMessage = {
    idle: 'Library se track load karein',
    waiting: 'Track metadata load ho raha hai…',
    analyzing: 'Audio se waveform calculate ho rahi hai…',
    error: waveformError,
    unavailable: waveformError,
  }[waveformStatus];

  return (
    <div className="deck" style={{ '--_deck-color': deckColor }}>
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

      <div className={`deck__waveform-container ${waveformPeaks.length ? 'deck__waveform-container--ready' : ''}`}>
        <canvas
          ref={waveformCanvasRef}
          className="deck__waveform-canvas"
          role="slider"
          tabIndex={waveformPeaks.length ? 0 : -1}
          aria-label={`Seek using Deck ${deckId} waveform`}
          aria-valuemin={0}
          aria-valuemax={Math.floor(duration)}
          aria-valuenow={Math.floor(currentTime)}
          onPointerDown={(event) => {
            if (!waveformPeaks.length) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            seekTo(((event.clientX - bounds.left) / bounds.width) * duration);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') seekTo(currentTime - 5);
            else if (event.key === 'ArrowRight') seekTo(currentTime + 5);
            else if (event.key === 'Home') seekTo(0);
            else if (event.key === 'End') seekTo(duration);
            else return;
            event.preventDefault();
          }}
        />
        {!waveformPeaks.length && waveformMessage && (
          <span className="deck__waveform-message" role={waveformStatus === 'error' ? 'alert' : 'status'}>
            {waveformMessage}
          </span>
        )}
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
        onChange={(event) => seekTo(Number(event.target.value))}
      />

      <div className="deck__transport">
        <button
          className="deck__transport-btn deck__transport-btn--cue"
          title="Return to track start"
          disabled={!track}
          onClick={handleStop}
        >
          CUE
        </button>
        <button
          className={`deck__transport-btn deck__transport-btn--play ${isPlaying ? 'deck__transport-btn--active' : ''}`}
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
        <button className="deck__transport-btn deck__transport-btn--sync" title="Sync arrives in Phase 9" disabled>
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
          <span className="deck__jog-label">JOG · LATER</span>
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
            onChange={(event) => onVolumeChange?.(Number(event.target.value))}
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
        {[1, 2, 3, 4, 5, 6, 7, 8].map((number) => (
          <button key={number} className="deck__hotcue-btn" title={`Hot Cue ${number} — Phase 9`} disabled>
            {number}
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
