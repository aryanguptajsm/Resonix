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
  syncBpm,
  syncTime = 0,
  syncPitch = 0,
  onDurationChange,
  onBpmChange,
  onEqChange,
  onVolumeChange,
  onPositionChange,
  onPitchChange,
  onSyncFeedback,
  onPlayingChange,
}) {
  const audioRef = useRef(null);
  const audioGraphRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const drawWaveformRef = useRef(() => {});
  const waveformRequestRef = useRef(0);
  const jogDragRef = useRef(null);
  const jogRef = useRef(null);
  const jogWheelHandlerRef = useRef(() => {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState([]);
  const [effects, setEffects] = useState({
    filter: false,
    echo: false,
    reverb: false,
    flanger: false,
  });
  const [filterCutoff, setFilterCutoff] = useState(1800);
  const [jogRotation, setJogRotation] = useState(0);
  const [isJogging, setIsJogging] = useState(false);
  const [waveformStatus, setWaveformStatus] = useState('idle');
  const [waveformError, setWaveformError] = useState('');
  const [error, setError] = useState('');

  const label = `DECK ${deckId}`;
  const waveformStart = 0;
  const visibleWindowSeconds = duration || 30;
  const waveformEnd = duration;
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
    setWaveformStatus(track?.needsAccess ? 'unavailable' : track ? 'waiting' : 'idle');
    setError('');
    if (track?.needsAccess) {
      setWaveformError('Choose Load A or Load B in the library to restore file access.');
    }
    setIsPlaying(false);
    setPitch(0);
    onPitchChange?.(0);
    onPositionChange?.(0);
    waveformRequestRef.current += 1;

    if (track?.url) {
      audio.src = track.url;
      audio.load();
    } else {
      audio.removeAttribute('src');
      audio.load();
    }

    return () => {
      waveformRequestRef.current += 1;
    };
  }, [track?.id, track?.url]);

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
    const graph = audioGraphRef.current;
    if (!graph) return;

    const { context, fxFilter, delay, echoGain, reverbGain, flangerGain } = graph;
    const bpm = Number(track?.bpm);
    const echoDelay = Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : 0.375;
    updateAudioParam(context, fxFilter.frequency, effects.filter ? filterCutoff : context.sampleRate / 2);
    updateAudioParam(context, delay.delayTime, echoDelay);
    updateAudioParam(context, echoGain.gain, effects.echo ? 0.32 : 0);
    updateAudioParam(context, reverbGain.gain, effects.reverb ? 0.22 : 0);
    updateAudioParam(context, flangerGain.gain, effects.flanger ? 0.2 : 0);
  }, [effects, filterCutoff, track?.bpm]);

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

      const rulerHeight = 18;
      const waveformHeight = bounds.height - rulerHeight;
      const center = waveformHeight / 2;
      const visibleDuration = Math.max(0.01, waveformEnd - waveformStart);
      const firstPeak = Math.max(0, Math.floor(waveformStart * 20));
      const lastPeak = Math.min(waveformPeaks.length, Math.ceil(waveformEnd * 20));
      const playheadX = Math.max(
        0,
        Math.min(bounds.width, ((currentTime - waveformStart) / visibleDuration) * bounds.width),
      );
      const color = getComputedStyle(canvas).getPropertyValue('--_deck-color').trim() || '#8b5cf6';
      const barSpacing = bounds.width / (visibleDuration * 20);
      const peakStride = Math.max(1, Math.ceil((lastPeak - firstPeak) / bounds.width));
      const barWidth = Math.max(1, barSpacing * peakStride * 0.72);
      const playedGradient = context.createLinearGradient(0, 0, 0, waveformHeight);
      playedGradient.addColorStop(0, '#f4f8ff');
      playedGradient.addColorStop(0.38, color);
      playedGradient.addColorStop(0.62, '#f4f8ff');
      playedGradient.addColorStop(1, color);
      const bpm = Number(track?.bpm);
      const beatDuration = Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : 0;

      if (beatDuration && (bounds.width / visibleDuration) * beatDuration >= 8) {
        const firstBeat = Math.ceil(waveformStart / beatDuration);
        for (let beat = firstBeat; beat * beatDuration <= waveformEnd; beat += 1) {
          const x = ((beat * beatDuration - waveformStart) / visibleDuration) * bounds.width;
          context.strokeStyle = beat % 4 === 0
            ? 'rgba(255,255,255,0.15)'
            : 'rgba(255,255,255,0.055)';
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(x + 0.5, 0);
          context.lineTo(x + 0.5, waveformHeight);
          context.stroke();
        }
      }

      context.strokeStyle = 'rgba(255,255,255,0.12)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, center + 0.5);
      context.lineTo(bounds.width, center + 0.5);
      context.stroke();

      const tickSeconds = visibleDuration > 600 ? 60 : visibleDuration > 120 ? 30 : visibleDuration > 30 ? 10 : 5;
      context.font = '9px ui-monospace, monospace';
      context.textBaseline = 'bottom';
      for (let tick = Math.ceil(waveformStart / tickSeconds) * tickSeconds; tick <= waveformEnd; tick += tickSeconds) {
        const x = ((tick - waveformStart) / visibleDuration) * bounds.width;
        context.strokeStyle = 'rgba(255,255,255,0.08)';
        context.beginPath();
        context.moveTo(x + 0.5, 0);
        context.lineTo(x + 0.5, waveformHeight);
        context.stroke();
        context.fillStyle = 'rgba(201,210,229,0.65)';
        context.fillText(formatTime(tick), Math.min(bounds.width - 30, x + 3), bounds.height - 2);
      }

      for (let index = firstPeak; index < lastPeak; index += peakStride) {
        let peak = 0;
        for (let sample = index; sample < Math.min(lastPeak, index + peakStride); sample += 1) {
          peak = Math.max(peak, waveformPeaks[sample]);
        }
        const x = ((index / 20 - waveformStart) / visibleDuration) * bounds.width;
        const barHeight = Math.max(2, Math.sqrt(peak) * (waveformHeight * 0.86));
        context.fillStyle = x < playheadX ? playedGradient : color;
        context.globalAlpha = x < playheadX ? 1 : 0.48;
        context.fillRect(x, center - barHeight / 2, barWidth, barHeight);
      }
      context.globalAlpha = 1;

      if (waveformPeaks.length > 0 && currentTime >= waveformStart && currentTime <= waveformEnd) {
        context.fillStyle = '#ffffff';
        context.shadowColor = color;
        context.shadowBlur = 10;
        context.fillRect(Math.min(playheadX - 1, bounds.width - 1), 0, 2, waveformHeight);
        context.beginPath();
        context.moveTo(playheadX - 5, 0);
        context.lineTo(playheadX + 5, 0);
        context.lineTo(playheadX, 6);
        context.closePath();
        context.fill();
        context.shadowBlur = 0;
      }
    };

    drawWaveformRef.current();
  }, [currentTime, duration, track?.bpm, waveformEnd, waveformPeaks, waveformStart]);

  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return undefined;

    const observer = new ResizeObserver(() => drawWaveformRef.current());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const jog = jogRef.current;
    if (!jog) return undefined;

    const handleWheel = (event) => jogWheelHandlerRef.current(event);
    jog.addEventListener('wheel', handleWheel, { passive: false });
    return () => jog.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => () => {
    const context = audioGraphRef.current?.context;
    if (context && context.state !== 'closed') {
      context.close().catch((closeError) => {
        console.error(`Deck ${deckId} audio context close failed:`, closeError);
      });
    }
  }, [deckId]);

  useEffect(() => {
    if (!isPlaying || !audioRef.current) return undefined;

    let frameId = 0;
    let lastPaint = 0;
    const updatePlayhead = (timestamp) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      const time = audio.currentTime;

      if (timestamp - lastPaint >= 33) {
        setCurrentTime(time);
        lastPaint = timestamp;
      }
      frameId = window.requestAnimationFrame(updatePlayhead);
    };

    frameId = window.requestAnimationFrame(updatePlayhead);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const createAudioGraph = () => {
    if (audioGraphRef.current) return audioGraphRef.current;
    if (!window.AudioContext || !audioRef.current) {
      throw new Error('Web Audio API is not available in this browser.');
    }

    const context = new window.AudioContext();
    const source = context.createMediaElementSource(audioRef.current);
    const lowFilter = context.createBiquadFilter();
    const midFilter = context.createBiquadFilter();
    const highFilter = context.createBiquadFilter();
    const channelGain = context.createGain();
    const fxFilter = context.createBiquadFilter();
    const delay = context.createDelay(2);
    const echoFeedback = context.createGain();
    const echoGain = context.createGain();
    const convolver = context.createConvolver();
    const reverbGain = context.createGain();
    const flangerDelay = context.createDelay(0.05);
    const flangerGain = context.createGain();
    const flangerLfo = context.createOscillator();
    const flangerDepth = context.createGain();

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
    fxFilter.type = 'lowpass';
    fxFilter.frequency.value = effects.filter ? filterCutoff : context.sampleRate / 2;
    const bpm = Number(track?.bpm);
    delay.delayTime.value = Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : 0.375;
    echoFeedback.gain.value = 0.28;
    echoGain.gain.value = effects.echo ? 0.32 : 0;
    reverbGain.gain.value = effects.reverb ? 0.22 : 0;
    flangerDelay.delayTime.value = 0.004;
    flangerGain.gain.value = effects.flanger ? 0.2 : 0;
    flangerLfo.frequency.value = 0.22;
    flangerDepth.gain.value = 0.0015;

    const impulseLength = Math.floor(context.sampleRate * 2.2);
    const impulse = context.createBuffer(2, impulseLength, context.sampleRate);
    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const samples = impulse.getChannelData(channel);
      for (let sample = 0; sample < impulseLength; sample += 1) {
        const fade = (1 - sample / impulseLength) ** 2.5;
        samples[sample] = (Math.random() * 2 - 1) * fade;
      }
    }
    convolver.buffer = impulse;

    source.connect(lowFilter);
    lowFilter.connect(midFilter);
    midFilter.connect(highFilter);
    highFilter.connect(channelGain);
    channelGain.connect(fxFilter);
    fxFilter.connect(context.destination);
    fxFilter.connect(delay);
    delay.connect(echoFeedback);
    echoFeedback.connect(delay);
    delay.connect(echoGain);
    echoGain.connect(context.destination);
    fxFilter.connect(convolver);
    convolver.connect(reverbGain);
    reverbGain.connect(context.destination);
    fxFilter.connect(flangerDelay);
    flangerDelay.connect(flangerGain);
    flangerGain.connect(context.destination);
    flangerLfo.connect(flangerDepth);
    flangerDepth.connect(flangerDelay.delayTime);
    flangerLfo.start();
    audioRef.current.volume = 1;

    audioGraphRef.current = {
      context,
      lowFilter,
      midFilter,
      highFilter,
      channelGain,
      fxFilter,
      delay,
      echoGain,
      reverbGain,
      flangerDelay,
      flangerGain,
    };
    return audioGraphRef.current;
  };

  const seekTo = (time) => {
    if (!audioRef.current || !duration) return;
    const nextTime = Math.min(duration, Math.max(0, time));
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
    onPositionChange?.(nextTime);
  };

  jogWheelHandlerRef.current = (event) => {
    if (!track?.url) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    seekTo((audioRef.current?.currentTime ?? currentTime) + direction * 0.25);
    setJogRotation((rotation) => rotation + direction * 24);
  };

  const handleTimeUpdate = () => {
    const time = audioRef.current?.currentTime || 0;
    setCurrentTime(time);
    onPositionChange?.(time);
  };

  const updatePitch = (value) => {
    const nextPitch = Math.max(-12, Math.min(12, value));
    setPitch(nextPitch);
    onPitchChange?.(nextPitch);
  };

  const handleSync = () => {
    const sourceBpm = Number(syncBpm);
    const targetBpm = Number(track?.bpm);
    if (!Number.isFinite(sourceBpm) || !Number.isFinite(targetBpm) || sourceBpm <= 0 || targetBpm <= 0) {
      setError('Both tracks need analyzed BPM values before they can be synced.');
      return;
    }

    const requestedPitch = ((sourceBpm * (1 + syncPitch / 100) / targetBpm) - 1) * 100;
    const nextPitch = Math.round(Math.max(-12, Math.min(12, requestedPitch)));
    const matchedBpm = targetBpm * (1 + nextPitch / 100);
    const sourceBeat = Math.round((syncTime * sourceBpm) / 60);
    const targetBeatTime = (sourceBeat * 60) / targetBpm;
    updatePitch(nextPitch);
    seekTo(targetBeatTime);
    setError('');

    const limited = Math.abs(requestedPitch - nextPitch) >= 0.5
      ? ' Pitch limit ±12% reached; BPM match is partial.'
      : '';
    onSyncFeedback?.(
      `Deck ${deckId} synced near beat ${sourceBeat + 1} at ${matchedBpm.toFixed(1)} BPM. Phase assumes the first beat is at track start; BPM is approximate.${limited}`,
    );
  };

  const handleJogPointerDown = (event) => {
    if (!track?.url) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    jogDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startTime: audioRef.current?.currentTime ?? currentTime,
      startRotation: jogRotation,
    };
    setIsJogging(true);
    event.preventDefault();
  };

  const handleJogPointerMove = (event) => {
    const drag = jogDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const horizontalMovement = event.clientX - drag.startX;
    seekTo(drag.startTime + horizontalMovement * 0.04);
    setJogRotation(drag.startRotation + horizontalMovement * 3);
  };

  const handleJogPointerEnd = (event) => {
    if (!jogDragRef.current || jogDragRef.current.pointerId !== event.pointerId) return;
    jogDragRef.current = null;
    setIsJogging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleJogKeyDown = (event) => {
    const nudge = event.shiftKey ? 1 : 0.1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      seekTo(currentTime - nudge);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      seekTo(currentTime + nudge);
    } else if (event.key === 'Home') {
      seekTo(0);
    } else if (event.key === 'End') {
      seekTo(duration);
    } else {
      return;
    }
    event.preventDefault();
  };

  const handlePlay = async () => {
    if (!track?.url || !audioRef.current) return;
    try {
      const graph = createAudioGraph();
      await graph.context.resume();
      await audioRef.current.play();
      setError('');
    } catch (playError) {
      setError(`Playback could not start: ${playError.message || 'audio device or browser error.'}`);
    }
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    onPositionChange?.(0);
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
      setWaveformError('The original audio file is not available for analysis.');
      return;
    }

    const requestId = waveformRequestRef.current;
    setWaveformStatus('analyzing');
    setWaveformError('');
    analyzeAudioFile(track.file, loadedDuration)
      .then(({ peaks, bpm, confidence }) => {
        if (requestId !== waveformRequestRef.current) return;
        setWaveformPeaks(peaks);
        setWaveformStatus('ready');
        onBpmChange?.(track.id, bpm, confidence);
      })
      .catch((analysisError) => {
        if (requestId !== waveformRequestRef.current) return;
        setWaveformStatus('error');
        setWaveformError(analysisError.message || 'Waveform analysis failed.');
      });
  };

  const handleAudioError = () => {
    const mediaError = audioRef.current?.error;
    const reason = mediaError?.message || 'The format is unsupported or the file could not be read.';
    setError(`Audio could not be loaded or played: ${reason}`);
    setIsPlaying(false);
    onPlayingChange?.(false);
  };

  const waveformMessage = {
    idle: 'Load a track from your library',
    waiting: 'Loading track details…',
    analyzing: 'Analyzing audio waveform…',
    error: waveformError,
    unavailable: waveformError,
  }[waveformStatus];
  const numericSyncBpm = Number(syncBpm);
  const canSync = Boolean(track?.url && track?.bpm && Number.isFinite(numericSyncBpm) && numericSyncBpm > 0);

  return (
    <div className="deck" style={{ '--_deck-color': deckColor }}>
      <header className="deck__header">
        <div className="deck__header-left">
          <span className="deck__label">{label}</span>
          <div className="deck__track-info">
            <span className="deck__track-title">{track?.title || 'No track loaded'}</span>
            <span className="deck__track-artist">{track?.artist || 'Choose a track from your library'}</span>
          </div>
        </div>

        <div className="deck__header-right">
          <div className="deck__bpm">
            <span
              className="deck__bpm-value"
              title={track?.bpmConfidence != null ? `Approximate analysis confidence: ${track.bpmConfidence}%` : undefined}
            >
              {track?.bpm && track.bpm !== '—' ? `~${track.bpm}` : '—'}
            </span>
            <span className="deck__bpm-label">
              {waveformStatus === 'analyzing'
                ? 'ANALYZING'
                : track?.bpm && track.bpm !== '—'
                  ? 'APPROX. BPM'
                  : 'BPM NOT FOUND'}
            </span>
          </div>
          <div className="deck__time">
            <span className="deck__time-value">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
        </div>
      </header>

      <div className="deck__waveform-toolbar">
        <div className="deck__waveform-meta">
          <span className="deck__waveform-title">TRACK WAVEFORM</span>
          <span className="deck__waveform-time-range">
            {formatTime(waveformStart)} – {formatTime(waveformEnd)} / {formatTime(duration)}
          </span>
        </div>
      </div>
      <div className={`deck__waveform-container ${waveformPeaks.length ? 'deck__waveform-container--ready' : ''}`}>
        <canvas
          ref={waveformCanvasRef}
          className="deck__waveform-canvas"
          role="slider"
          tabIndex={waveformPeaks.length ? 0 : -1}
          aria-label={`Seek using Deck ${deckId} waveform`}
          aria-valuemin={Math.floor(waveformStart)}
          aria-valuemax={Math.floor(waveformEnd)}
          aria-valuenow={Math.floor(Math.min(waveformEnd, Math.max(waveformStart, currentTime)))}
          onPointerDown={(event) => {
            if (!waveformPeaks.length) return;
            const bounds = event.currentTarget.getBoundingClientRect();
            seekTo(waveformStart + ((event.clientX - bounds.left) / bounds.width) * visibleWindowSeconds);
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
          disabled={!track?.url}
          onClick={handleStop}
        >
          CUE
        </button>
        <button
          className={`deck__transport-btn deck__transport-btn--play ${isPlaying ? 'deck__transport-btn--active' : ''}`}
          title="Play / Pause"
          disabled={!track?.url}
          onClick={isPlaying ? () => audioRef.current?.pause() : handlePlay}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button
          className="deck__transport-btn deck__transport-btn--sync"
          title={canSync ? `Match this deck to Deck ${deckId === 'A' ? 'B' : 'A'} tempo and beat` : 'Both decks need analyzed BPM values'}
          disabled={!canSync}
          onClick={handleSync}
        >
          SYNC
        </button>
      </div>

      <div className="deck__jog-pitch-row">
        <div className="deck__jog-wrapper">
          <div
            ref={jogRef}
            className={`deck__jog ${isJogging ? 'deck__jog--dragging' : ''}`}
            role="slider"
            tabIndex={track?.url ? 0 : -1}
            aria-label={`Deck ${deckId} jog wheel; drag to scrub audio`}
            aria-disabled={!track?.url}
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            data-playing={isPlaying}
            onPointerDown={handleJogPointerDown}
            onPointerMove={handleJogPointerMove}
            onPointerUp={handleJogPointerEnd}
            onPointerCancel={handleJogPointerEnd}
            onKeyDown={handleJogKeyDown}
            style={{ '--jog-angle': `${jogRotation}deg` }}
          >
            <div className="deck__jog-platter">
              <span className="deck__jog-groove deck__jog-groove--outer" />
              <span className="deck__jog-groove deck__jog-groove--inner" />
              <div className="deck__jog-inner">
                <span className="deck__jog-label-center">RX</span>
                <div className="deck__jog-dot" />
              </div>
            </div>
          </div>
          <span className="deck__jog-label">{isJogging ? 'SCRUBBING' : 'JOG · SCRUB'}</span>
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
          onChange={(event) => updatePitch(Number(event.target.value))}
          aria-label={`Deck ${deckId} pitch`}
        />
      </div>

      <section className="deck__effects" aria-label={`Deck ${deckId} audio effects`}>
        <div className="deck__effects-heading">
          <span>FX</span>
          <button
            type="button"
            onClick={() => setEffects({ filter: false, echo: false, reverb: false, flanger: false })}
          >
            RESET
          </button>
        </div>
        <div className="deck__effects-buttons">
          {[
            ['filter', 'FILTER'],
            ['echo', 'ECHO'],
            ['reverb', 'REVERB'],
            ['flanger', 'FLANGER'],
          ].map(([effect, label]) => (
            <button
              key={effect}
              type="button"
              className={`deck__effect-btn ${effects[effect] ? 'deck__effect-btn--active' : ''}`}
              aria-pressed={effects[effect]}
              onClick={() => setEffects((current) => ({ ...current, [effect]: !current[effect] }))}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="deck__effect-cutoff" htmlFor={`filter-${deckId}`}>
          <span>FILTER CUTOFF</span>
          <strong>{filterCutoff >= 1000 ? `${(filterCutoff / 1000).toFixed(1)} kHz` : `${filterCutoff} Hz`}</strong>
          <input
            id={`filter-${deckId}`}
            type="range"
            min="200"
            max="12000"
            step="100"
            value={filterCutoff}
            onChange={(event) => setFilterCutoff(Number(event.target.value))}
            aria-label={`Deck ${deckId} filter cutoff`}
          />
        </label>
      </section>

      {error && <p className="deck__error" role="alert">{error}</p>}
      <audio
        ref={audioRef}
        preload="metadata"
        onLoadedMetadata={handleMetadata}
        onTimeUpdate={handleTimeUpdate}
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
