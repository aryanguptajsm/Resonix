import { useEffect, useRef, useState } from 'react';
import { SoundTouchNode } from '@soundtouchjs/audio-worklet';
import soundTouchProcessorUrl from '@soundtouchjs/audio-worklet/processor?url';
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
  effects = { filter: false, echo: false, reverb: false, flanger: false },
  syncBpm,
  syncTime = 0,
  syncPitch = 0,
  syncTempoRatio = 1,
  syncBeatOffset = 0,
  automationCommand = null,
  tempoRatio = 1,
  onDurationChange,
  onBpmChange,
  onEqChange,
  onEffectsChange,
  onVolumeChange,
  onPositionChange,
  onPitchChange,
  onTempoRatioChange,
  onSyncFeedback,
  onPlayingChange,
  onTrackEnded,
}) {
  const audioRef = useRef(null);
  const audioGraphRef = useRef(null);
  const automationCommandRef = useRef(null);
  const waveformCanvasRef = useRef(null);
  const drawWaveformRef = useRef(() => {});
  const waveformRequestRef = useRef(0);
  const loopRef = useRef(null);
  const jogDragRef = useRef(null);
  const jogRef = useRef(null);
  const jogWheelHandlerRef = useRef(() => {});
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pitch, setPitch] = useState(0);
  const [pitchLocked, setPitchLocked] = useState(false);
  const [waveformPeaks, setWaveformPeaks] = useState([]);
  const [loopBeats, setLoopBeats] = useState(4);
  const [activeLoop, setActiveLoop] = useState(null);
  const [filterCutoff, setFilterCutoff] = useState(1800);
  const [jogRotation, setJogRotation] = useState(0);
  const [isJogging, setIsJogging] = useState(false);
  const [waveformStatus, setWaveformStatus] = useState('idle');
  const [waveformError, setWaveformError] = useState('');
  const [error, setError] = useState('');

  const label = `DECK ${deckId}`;
  const loopBpm = Number(track?.bpm);
  const canSetLoop = Boolean(track?.url && Number.isFinite(loopBpm) && loopBpm > 0 && duration);
  const visibleWindowSeconds = 30;
  const waveformStart = currentTime - visibleWindowSeconds / 2;
  const waveformEnd = waveformStart + visibleWindowSeconds;
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
    loopRef.current = null;
    setActiveLoop(null);
    setError('');
    if (track?.needsAccess) {
      setWaveformError('Choose Load A or Load B in the library to restore file access.');
    }
    setIsPlaying(false);
    setPitch(0);
    setPitchLocked(false);
    onTempoRatioChange?.(1);
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
    const echoDelay = Number.isFinite(bpm) && bpm > 0 ? 60 / (bpm * tempoRatio) : 0.375;
    updateAudioParam(context, fxFilter.frequency, effects.filter ? filterCutoff : context.sampleRate / 2);
    updateAudioParam(context, delay.delayTime, echoDelay);
    updateAudioParam(context, echoGain.gain, effects.echo ? 0.32 : 0);
    updateAudioParam(context, reverbGain.gain, effects.reverb ? 0.22 : 0);
    updateAudioParam(context, flangerGain.gain, effects.flanger ? 0.2 : 0);
  }, [effects, filterCutoff, tempoRatio, track?.bpm]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const playbackRate = tempoRatio * (1 + pitch / 100);
    audio.playbackRate = playbackRate;
    const graph = audioGraphRef.current;
    if (graph?.soundTouchNode) {
      updateAudioParam(graph.context, graph.soundTouchNode.playbackRate, playbackRate);
      updateAudioParam(
        graph.context,
        graph.soundTouchNode.pitch,
        pitchLocked ? 1 : 1 + pitch / 100,
      );
    }
  }, [pitch, pitchLocked, tempoRatio]);

  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;

    drawWaveformRef.current = () => {
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const canvasWidth = Math.round(bounds.width * pixelRatio);
      const canvasHeight = Math.round(bounds.height * pixelRatio);
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
      }

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
      playedGradient.addColorStop(0, color);
      playedGradient.addColorStop(0.45, '#ecf7ff');
      playedGradient.addColorStop(0.56, '#ecf7ff');
      playedGradient.addColorStop(1, color);
      const bpm = Number(track?.bpm);
      const beatDuration = Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : 0;

      if (beatDuration && (bounds.width / visibleDuration) * beatDuration >= 8) {
        const firstBeat = Math.max(0, Math.ceil(waveformStart / beatDuration));
        for (let beat = firstBeat; beat * beatDuration <= Math.min(duration, waveformEnd); beat += 1) {
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

      if (activeLoop && activeLoop.end >= waveformStart && activeLoop.start <= waveformEnd) {
        const loopStartX = ((activeLoop.start - waveformStart) / visibleDuration) * bounds.width;
        const loopEndX = ((activeLoop.end - waveformStart) / visibleDuration) * bounds.width;
        const visibleStartX = Math.max(0, loopStartX);
        const visibleEndX = Math.min(bounds.width, loopEndX);
        context.fillStyle = 'rgba(63, 224, 208, 0.12)';
        context.fillRect(visibleStartX, 0, Math.max(0, visibleEndX - visibleStartX), waveformHeight);
        context.strokeStyle = 'rgba(63, 224, 208, 0.8)';
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

      const tickSeconds = visibleDuration > 600 ? 60 : visibleDuration > 120 ? 30 : visibleDuration > 30 ? 10 : 5;
      context.font = '9px ui-monospace, monospace';
      context.textBaseline = 'bottom';
      for (
        let tick = Math.max(0, Math.ceil(waveformStart / tickSeconds) * tickSeconds);
        tick <= Math.min(duration, waveformEnd);
        tick += tickSeconds
      ) {
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
        context.shadowBlur = 16;
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
  }, [activeLoop, currentTime, duration, track?.bpm, waveformEnd, waveformPeaks, waveformStart]);

  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return undefined;

    const observer = new ResizeObserver(() => drawWaveformRef.current());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const wrapBeatLoop = (audio) => {
    const loop = loopRef.current;
    if (!loop || audio.currentTime < loop.end) return null;

    const graph = audioGraphRef.current;
    if (graph) {
      const now = graph.context.currentTime;
      const gain = graph.loopGain.gain;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
      gain.linearRampToValueAtTime(0, now + 0.003);
      gain.setValueAtTime(0, now + 0.005);
      gain.linearRampToValueAtTime(1, now + 0.015);
    }

    audio.currentTime = loop.start;
    setCurrentTime(loop.start);
    onPositionChange?.(loop.start);
    return loop.start;
  };

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

      const time = wrapBeatLoop(audio) ?? audio.currentTime;

      if (timestamp - lastPaint >= 33) {
        setCurrentTime(time);
        lastPaint = timestamp;
      }
      frameId = window.requestAnimationFrame(updatePlayhead);
    };

    frameId = window.requestAnimationFrame(updatePlayhead);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const createAudioGraph = async () => {
    if (audioGraphRef.current) return audioGraphRef.current;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || !audioRef.current) {
      throw new Error('Web Audio API is not available in this browser.');
    }

    const context = new AudioContextClass();
    if (!context.audioWorklet || !window.AudioWorkletNode) {
      await context.close();
      throw new Error('AudioWorklet is required for pitch-preserving tempo sync in this browser.');
    }
    try {
      await SoundTouchNode.register(context, soundTouchProcessorUrl);
    } catch (registrationError) {
      await context.close();
      throw new Error(`Could not load the pitch-preserving audio processor: ${registrationError.message}`);
    }

    const soundTouchNode = new SoundTouchNode({ context });
    const playbackRate = tempoRatio * (1 + pitch / 100);
    soundTouchNode.playbackRate.value = playbackRate;
    soundTouchNode.pitch.value = pitchLocked ? 1 : 1 + pitch / 100;
    const source = context.createMediaElementSource(audioRef.current);
    const lowFilter = context.createBiquadFilter();
    const midFilter = context.createBiquadFilter();
    const highFilter = context.createBiquadFilter();
    const channelGain = context.createGain();
    const peakGuard = context.createDynamicsCompressor();
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
    peakGuard.threshold.value = -6;
    peakGuard.knee.value = 0;
    peakGuard.ratio.value = 12;
    peakGuard.attack.value = 0.003;
    peakGuard.release.value = 0.18;
    loopGain.gain.value = 1;
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

    if ('preservesPitch' in audioRef.current) audioRef.current.preservesPitch = false;
    if ('webkitPreservesPitch' in audioRef.current) audioRef.current.webkitPreservesPitch = false;
    if ('mozPreservesPitch' in audioRef.current) audioRef.current.mozPreservesPitch = false;
    source.connect(soundTouchNode);
    soundTouchNode.connect(lowFilter);
    lowFilter.connect(midFilter);
    midFilter.connect(highFilter);
    highFilter.connect(channelGain);
    channelGain.connect(loopGain);
    loopGain.connect(fxFilter);
    fxFilter.connect(peakGuard);
    fxFilter.connect(delay);
    delay.connect(echoFeedback);
    echoFeedback.connect(delay);
    delay.connect(echoGain);
    fxFilter.connect(convolver);
    convolver.connect(reverbGain);
    fxFilter.connect(flangerDelay);
    flangerDelay.connect(flangerGain);
    echoGain.connect(peakGuard);
    reverbGain.connect(peakGuard);
    flangerGain.connect(peakGuard);
    peakGuard.connect(context.destination);
    flangerLfo.connect(flangerDepth);
    flangerDepth.connect(flangerDelay.delayTime);
    flangerLfo.start();
    audioRef.current.volume = 1;

    audioGraphRef.current = {
      context,
      soundTouchNode,
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
  };

  jogWheelHandlerRef.current = (event) => {
    if (!track?.url) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    seekTo((audioRef.current?.currentTime ?? currentTime) + direction * 0.25);
    setJogRotation((rotation) => rotation + direction * 24);
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = wrapBeatLoop(audio) ?? audio.currentTime;
    setCurrentTime(time);
    onPositionChange?.(time);
  };

  const updatePitch = (value) => {
    const nextPitch = Math.max(-12, Math.min(12, value));
    setPitchLocked(false);
    onTempoRatioChange?.(1);
    setPitch(nextPitch);
    onPitchChange?.(nextPitch);
    const audio = audioRef.current;
    if (audio) audio.playbackRate = 1 + nextPitch / 100;
  };

  const handleSync = ({ startAtBeginning = false, tempoRatio: requestedTempoRatio } = {}) => {
    const sourceBpm = Number(syncBpm);
    const targetBpm = Number(track?.bpm);
    if (!Number.isFinite(sourceBpm) || !Number.isFinite(targetBpm) || sourceBpm <= 0 || targetBpm <= 0) {
      setError('Both tracks need analyzed BPM values before they can be synced.');
      return;
    }

    const sourceTempo = sourceBpm * syncTempoRatio * (1 + syncPitch / 100);
    const matchRatio = Number.isFinite(requestedTempoRatio)
      ? requestedTempoRatio
      : sourceTempo / targetBpm;
    if (!Number.isFinite(matchRatio) || matchRatio < 0.1 || matchRatio > 8) {
      setError('The tempo ratio is outside the supported pitch-lock range.');
      return;
    }
    const nextPitch = 0;
    setPitch(nextPitch);
    setPitchLocked(true);
    onPitchChange?.(nextPitch);
    onTempoRatioChange?.(matchRatio);
    if (audioRef.current) audioRef.current.playbackRate = matchRatio;
    const graph = audioGraphRef.current;
    if (graph?.soundTouchNode) {
      updateAudioParam(graph.context, graph.soundTouchNode.playbackRate, matchRatio);
      updateAudioParam(graph.context, graph.soundTouchNode.pitch, 1);
    }
    const matchedBpm = targetBpm * matchRatio;
    const sourceBeat = startAtBeginning
      ? 0
      : Math.max(0, Math.round(
        ((syncTime - syncBeatOffset) * sourceBpm * syncTempoRatio * (1 + syncPitch / 100)) / 60,
      ));
    const targetBeatOffset = Number(track?.analysis?.beatTimes?.[0]) || 0;
    const targetBeatTime = targetBeatOffset + ((sourceBeat * 60) / targetBpm);
    seekTo(targetBeatTime);
    setError('');
    onSyncFeedback?.(
      `Deck ${deckId} tempo-matched near ${matchedBpm.toFixed(1)} BPM with pitch lock. Phase uses the analyzed beat grid.`,
    );
  };

  const handleLoopLengthChange = (beats) => {
    if (activeLoop) {
      const bpm = Number(track?.bpm);
      const end = activeLoop.start + (beats * 60) / bpm;
      if (end > duration) {
        setError('This loop does not fit before the end of the track.');
        return;
      }

      const nextLoop = { start: activeLoop.start, end };
      loopRef.current = nextLoop;
      setActiveLoop(nextLoop);
    }

    setLoopBeats(beats);
    setError('');
  };

  const handleLoopToggle = () => {
    if (activeLoop) {
      loopRef.current = null;
      setActiveLoop(null);
      setError('');
      return;
    }

    const bpm = Number(track?.bpm);
    if (!Number.isFinite(bpm) || bpm <= 0 || !duration) {
      setError('Analyze the track BPM before setting a beat loop.');
      return;
    }

    const beatDuration = 60 / bpm;
    const playhead = audioRef.current?.currentTime ?? currentTime;
    const loopDuration = loopBeats * beatDuration;
    const lastValidBeat = Math.floor((duration - loopDuration) / beatDuration);
    const start = Math.max(
      0,
      Math.min(Math.round(playhead / beatDuration), lastValidBeat) * beatDuration,
    );
    const end = start + loopDuration;
    if (end > duration) {
      setError('This loop does not fit before the end of the track.');
      return;
    }

    const nextLoop = { start, end };
    loopRef.current = nextLoop;
    setActiveLoop(nextLoop);
    seekTo(start);
    setError('');
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

  const handlePlay = async (existingGraph = null) => {
    if (!track?.url || !audioRef.current) return;
    try {
      const graph = existingGraph || await createAudioGraph();
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

  useEffect(() => {
    if (
      !automationCommand?.id
      || automationCommandRef.current === automationCommand.id
      || automationCommand.trackId !== track?.id
      || !track?.url
    ) return;

    automationCommandRef.current = automationCommand.id;
    if (automationCommand.action === 'stop') {
      handleStop();
      return;
    }
    if (automationCommand.effects) {
      const { filterCutoff: nextFilterCutoff, ...effectUpdates } = automationCommand.effects;
      if (Object.keys(effectUpdates).length > 0) {
        onEffectsChange?.((current) => ({ ...current, ...effectUpdates }));
      }
      if (Number.isFinite(nextFilterCutoff)) setFilterCutoff(nextFilterCutoff);
    }
    if (automationCommand.action === 'effects') {
      return;
    }
    if (automationCommand.action === 'restart-play' && audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      onPositionChange?.(0);
    }
    const startAutomation = async () => {
      const graph = await createAudioGraph();
      if (automationCommand.action === 'sync-play') {
        handleSync({
          startAtBeginning: true,
          tempoRatio: automationCommand.tempoRatio,
        });
      }
      await handlePlay(graph);
    };
    void startAutomation().catch((automationError) => {
      setError(`Auto-DJ playback could not start: ${automationError.message}`);
    });
  }, [automationCommand, track?.id, track?.url]);

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
      .then((analysis) => {
        if (requestId !== waveformRequestRef.current) return;
        const { peaks, version, cacheError, ...trackAnalysis } = analysis;
        setWaveformPeaks(peaks);
        setWaveformStatus('ready');
        onBpmChange?.(track.id, analysis.bpm, analysis.bpmConfidence, {
          ...trackAnalysis,
          ...(version ? { version } : {}),
          ...(cacheError ? { cacheError } : {}),
        });
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
              {track?.bpm && track.bpm !== '—'
                ? `~${(Number(track.bpm) * tempoRatio).toFixed(1)}`
                : '—'}
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
            {formatTime(Math.max(0, waveformStart))} – {formatTime(Math.min(duration, waveformEnd))} / {formatTime(duration)}
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
          aria-valuemin={Math.floor(Math.max(0, waveformStart))}
          aria-valuemax={Math.floor(Math.min(duration, waveformEnd))}
          aria-valuenow={Math.floor(Math.min(duration, Math.max(0, currentTime)))}
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
        <div className="deck__pitch-indicator">
          {pitchLocked ? `${tempoRatio.toFixed(2)}× LOCK` : pitch > 0 ? `+${pitch}%` : `${pitch}%`}
        </div>
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
        <label htmlFor={`pitch-${deckId}`}>
          {pitchLocked ? `KEY LOCK · ${tempoRatio.toFixed(2)}× TEMPO` : `PITCH ${pitch > 0 ? `+${pitch}%` : `${pitch}%`}`}
        </label>
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

      <section className={`deck__loops ${activeLoop ? 'deck__loops--active' : ''}`} aria-label={`Deck ${deckId} beat loop`}>
        <div className="deck__loops-heading">
          <span>BEAT LOOP</span>
          <span className="deck__loops-status">{activeLoop ? `${loopBeats} BEAT LOOP ACTIVE` : 'LOOP OFF'}</span>
        </div>
        <div className="deck__loops-controls">
          <div className="deck__loop-lengths">
            {[0.5, 1, 2, 4, 8, 16].map((beats) => (
              <button
                key={beats}
                type="button"
                className={`deck__loop-length ${loopBeats === beats ? 'deck__loop-length--selected' : ''}`}
                aria-label={`${beats === 0.5 ? 'Half' : beats} beat loop`}
                aria-pressed={loopBeats === beats}
                disabled={!canSetLoop}
                onClick={() => handleLoopLengthChange(beats)}
              >
                {beats === 0.5 ? '1/2' : beats}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`deck__loop-toggle ${activeLoop ? 'deck__loop-toggle--active' : ''}`}
            aria-pressed={Boolean(activeLoop)}
            disabled={!canSetLoop}
            onClick={handleLoopToggle}
          >
            {activeLoop ? 'EXIT LOOP' : 'LOOP'}
          </button>
        </div>
      </section>

      <section className="deck__effects" aria-label={`Deck ${deckId} audio effects`}>
        <div className="deck__effects-heading">
          <span>FX</span>
          <button
            type="button"
            onClick={() => onEffectsChange?.({ filter: false, echo: false, reverb: false, flanger: false })}
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
              onClick={() => onEffectsChange?.((current) => ({ ...current, [effect]: !current[effect] }))}
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
          onTrackEnded?.(deckId, track?.id);
        }}
        onError={handleAudioError}
      />
    </div>
  );
}
