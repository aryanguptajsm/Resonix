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
  const loopRef = useRef(null);
  const jogDragRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [waveformWindowSeconds, setWaveformWindowSeconds] = useState(30);
  const [waveformStart, setWaveformStart] = useState(0);
  const [waveformPeaks, setWaveformPeaks] = useState([]);
  const [loopBeats, setLoopBeats] = useState(4);
  const [activeLoop, setActiveLoop] = useState(null);
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
  const visibleWindowSeconds = Math.min(waveformWindowSeconds, duration || waveformWindowSeconds);
  const waveformEnd = Math.min(duration, waveformStart + visibleWindowSeconds);
  const headroom = 10 ** (-Math.max(0, eq.low, eq.mid, eq.high) / 20);
  const outputGain = Math.min(1, Math.max(0, channelVolume * outputMix * headroom));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(0);
    setWaveformStart(0);
    setWaveformPeaks([]);
    setWaveformError('');
    setWaveformStatus(track ? 'waiting' : 'idle');
    setError('');
    setIsPlaying(false);
    setPitch(0);
    onPitchChange?.(0);
    onPositionChange?.(0);
    loopRef.current = null;
    setActiveLoop(null);
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
      const barWidth = Math.max(1, barSpacing * 0.7);
      const playedGradient = context.createLinearGradient(0, 0, 0, waveformHeight);
      playedGradient.addColorStop(0, color);
      playedGradient.addColorStop(0.5, 'rgba(255,255,255,0.94)');
      playedGradient.addColorStop(1, color);
      const bpm = Number(track?.bpm);
      const beatDuration = Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : 0;

      if (beatDuration) {
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

      if (activeLoop) {
        const loopStartX = ((activeLoop.start - waveformStart) / visibleDuration) * bounds.width;
        const loopEndX = ((activeLoop.end - waveformStart) / visibleDuration) * bounds.width;
        context.fillStyle = 'rgba(6,182,212,0.12)';
        context.fillRect(
          Math.max(0, loopStartX),
          0,
          Math.max(0, Math.min(bounds.width, loopEndX) - Math.max(0, loopStartX)),
          waveformHeight,
        );
        context.strokeStyle = 'rgba(6,182,212,0.7)';
        context.lineWidth = 1;
        [loopStartX, loopEndX].forEach((x) => {
          if (x < 0 || x > bounds.width) return;
          context.beginPath();
          context.moveTo(x + 0.5, 0);
          context.lineTo(x + 0.5, waveformHeight);
          context.stroke();
        });
      }

      context.strokeStyle = 'rgba(255,255,255,0.12)';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, center + 0.5);
      context.lineTo(bounds.width, center + 0.5);
      context.stroke();

      const tickSeconds = waveformWindowSeconds === 30 ? 5 : 10;
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

      for (let index = firstPeak; index < lastPeak; index += 1) {
        const peak = waveformPeaks[index];
        const x = ((index / 20 - waveformStart) / visibleDuration) * bounds.width;
        const barHeight = Math.max(2, Math.sqrt(peak) * (waveformHeight * 0.86));
        context.fillStyle = x < playheadX ? playedGradient : 'rgba(78,157,221,0.58)';
        context.fillRect(x, center - barHeight / 2, barWidth, barHeight);
      }

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
  }, [activeLoop, currentTime, duration, track?.bpm, waveformEnd, waveformPeaks, waveformStart, waveformWindowSeconds]);

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

  useEffect(() => {
    if (!isPlaying || !audioRef.current) return undefined;

    let frameId = 0;
    let lastPaint = 0;
    const updatePlayhead = (timestamp) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      let time = audio.currentTime;
      const loop = loopRef.current;
      if (loop && time >= loop.end) {
        const graph = audioGraphRef.current;
        if (graph) {
          const now = graph.context.currentTime;
          graph.loopGain.gain.cancelScheduledValues(now);
          graph.loopGain.gain.setTargetAtTime(0, now, 0.003);
          graph.loopGain.gain.setValueAtTime(0, now + 0.006);
          graph.loopGain.gain.linearRampToValueAtTime(1, now + 0.018);
        }
        audio.currentTime = loop.start;
        time = loop.start;
        onPositionChange?.(time);
      }

      if (timestamp - lastPaint >= 33) {
        setCurrentTime(time);
        setWaveformStart(Math.max(
          0,
          Math.min(duration - visibleWindowSeconds, time - visibleWindowSeconds / 2),
        ));
        lastPaint = timestamp;
      }
      frameId = window.requestAnimationFrame(updatePlayhead);
    };

    frameId = window.requestAnimationFrame(updatePlayhead);
    return () => window.cancelAnimationFrame(frameId);
  }, [duration, isPlaying, onPositionChange, visibleWindowSeconds]);

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
    const loopGain = context.createGain();
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
    loopGain.gain.value = 1;
    fxFilter.type = 'lowpass';
    fxFilter.frequency.value = context.sampleRate / 2;
    delay.delayTime.value = 0.375;
    echoFeedback.gain.value = 0.28;
    echoGain.gain.value = 0;
    reverbGain.gain.value = 0;
    flangerDelay.delayTime.value = 0.004;
    flangerGain.gain.value = 0;
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
    channelGain.connect(loopGain);
    loopGain.connect(fxFilter);
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
      loopGain,
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
    setWaveformStart(Math.max(
      0,
      Math.min(duration - visibleWindowSeconds, nextTime - visibleWindowSeconds / 2),
    ));
  };

  const handleTimeUpdate = () => {
    const time = audioRef.current?.currentTime || 0;
    if (loopRef.current && time >= loopRef.current.end) {
      const graph = audioGraphRef.current;
      if (graph) {
        const now = graph.context.currentTime;
        graph.loopGain.gain.cancelScheduledValues(now);
        graph.loopGain.gain.setTargetAtTime(0, now, 0.003);
        graph.loopGain.gain.setValueAtTime(0, now + 0.006);
        graph.loopGain.gain.linearRampToValueAtTime(1, now + 0.018);
      }
      audioRef.current.currentTime = loopRef.current.start;
      setCurrentTime(loopRef.current.start);
      onPositionChange?.(loopRef.current.start);
      return;
    }

    setCurrentTime(time);
    onPositionChange?.(time);
    setWaveformStart(Math.max(
      0,
      Math.min(duration - visibleWindowSeconds, time - visibleWindowSeconds / 2),
    ));
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
      setError('Sync ke liye dono tracks ka BPM pehle analyze hona chahiye.');
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

  const handleLoopToggle = () => {
    if (activeLoop) {
      loopRef.current = null;
      setActiveLoop(null);
      return;
    }

    const bpm = Number(track?.bpm);
    if (!Number.isFinite(bpm) || bpm <= 0 || !duration) {
      setError('Beat loop ke liye track BPM analysis complete hona zaroori hai.');
      return;
    }

    const beatDuration = 60 / bpm;
    const start = Math.max(0, Math.round((audioRef.current?.currentTime ?? currentTime) / beatDuration) * beatDuration);
    const end = start + loopBeats * beatDuration;
    if (end > duration) {
      setError('Track ke end se pehle poora loop fit nahi hota. Playhead ko thoda peeche le jaayein.');
      return;
    }

    const loop = { start, end };
    seekTo(start);
    loopRef.current = loop;
    setActiveLoop(loop);
    setError('');
  };

  const handleJogPointerDown = (event) => {
    if (!track) return;
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
      setWaveformError('Original local file analysis ke liye available nahi hai.');
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
  const numericSyncBpm = Number(syncBpm);
  const canSync = Boolean(track?.bpm && Number.isFinite(numericSyncBpm) && numericSyncBpm > 0);

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
          <span className="deck__waveform-title">AUDIO WAVEFORM</span>
          <span className="deck__waveform-time-range">
            {formatTime(waveformStart)} – {formatTime(waveformEnd)} / {formatTime(duration)}
          </span>
        </div>
        <div className="deck__waveform-controls">
          <button
            type="button"
            className="deck__waveform-nav"
            aria-label="Previous waveform section"
            disabled={!waveformPeaks.length || waveformStart <= 0}
            onClick={() => setWaveformStart(Math.max(0, waveformStart - waveformWindowSeconds))}
          >
            ‹
          </button>
          {[30, 60].map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={`deck__waveform-zoom ${waveformWindowSeconds === seconds ? 'deck__waveform-zoom--active' : ''}`}
              aria-pressed={waveformWindowSeconds === seconds}
              onClick={() => {
                setWaveformWindowSeconds(seconds);
                setWaveformStart(Math.floor(currentTime / seconds) * seconds);
              }}
            >
              {seconds}s
            </button>
          ))}
          <button
            type="button"
            className="deck__waveform-nav"
            aria-label="Next waveform section"
            disabled={!waveformPeaks.length || waveformStart + waveformWindowSeconds >= duration}
            onClick={() => setWaveformStart(Math.min(
              Math.max(0, duration - waveformWindowSeconds),
              waveformStart + waveformWindowSeconds,
            ))}
          >
            ›
          </button>
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
            className={`deck__jog ${isJogging ? 'deck__jog--dragging' : ''}`}
            role="slider"
            tabIndex={track ? 0 : -1}
            aria-label={`Deck ${deckId} jog wheel; drag to scrub audio`}
            aria-disabled={!track}
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            data-playing={isPlaying}
            onPointerDown={handleJogPointerDown}
            onPointerMove={handleJogPointerMove}
            onPointerUp={handleJogPointerEnd}
            onPointerCancel={handleJogPointerEnd}
            onWheel={(event) => {
              if (!track) return;
              event.preventDefault();
              const direction = event.deltaY > 0 ? 1 : -1;
              seekTo(currentTime + direction * 0.25);
              setJogRotation((rotation) => rotation + direction * 24);
            }}
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

      <div className="deck__hotcues">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((number) => (
          <button key={number} className="deck__hotcue-btn" title={`Hot Cue ${number} — Phase 9`} disabled>
            {number}
          </button>
        ))}
      </div>

      <div className="deck__loops">
        {['1', '2', '4', '8', '16'].map((beats) => (
          <button
            key={beats}
            className={`deck__loop-btn ${loopBeats === Number(beats) ? 'deck__loop-btn--selected' : ''}`}
            title={`${beats} beat loop at approximately ${track?.bpm || 'unknown'} BPM`}
            disabled={!track?.bpm || track.bpm === '—'}
            aria-pressed={loopBeats === Number(beats)}
            onClick={() => setLoopBeats(Number(beats))}
          >
            {beats}
          </button>
        ))}
        <button
          className={`deck__loop-btn deck__loop-btn--toggle ${activeLoop ? 'deck__loop-btn--active' : ''}`}
          title={activeLoop ? 'Deactivate beat loop' : 'Activate selected beat loop'}
          disabled={!track?.bpm || track.bpm === '—'}
          aria-pressed={Boolean(activeLoop)}
          onClick={handleLoopToggle}
        >
          {activeLoop ? 'ON' : 'LOOP'}
        </button>
      </div>

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
