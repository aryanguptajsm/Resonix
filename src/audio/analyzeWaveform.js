const MAX_DECODED_BYTES = 192 * 1024 * 1024;
const WAVEFORM_SAMPLES_PER_SECOND = 20;
const BPM_ANALYSIS_SAMPLE_RATE = 100;
const BPM_ANALYSIS_MAX_SECONDS = 120;
const waveformCache = new WeakMap();
let analysisQueue = Promise.resolve();

export function extractWaveformPeaks(audioBuffer, samplesPerSecond = WAVEFORM_SAMPLES_PER_SECOND) {
  const channelCount = audioBuffer.numberOfChannels;
  const channels = Array.from({ length: channelCount }, (_, channel) => (
    audioBuffer.getChannelData(channel)
  ));
  const samplesPerWindow = Math.max(1, Math.round(audioBuffer.sampleRate / samplesPerSecond));
  const peakCount = Math.ceil(audioBuffer.length / samplesPerWindow);
  const peaks = new Array(peakCount);

  for (let bar = 0; bar < peakCount; bar += 1) {
    const start = bar * samplesPerWindow;
    const end = Math.min(audioBuffer.length, start + samplesPerWindow);
    let peak = 0;

    for (let sample = start; sample < end; sample += 1) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        peak = Math.max(peak, Math.abs(channels[channel][sample]));
      }
    }

    peaks[bar] = peak;
  }

  return peaks;
}

export function detectBpm(audioBuffer) {
  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, channel) => (
    audioBuffer.getChannelData(channel)
  ));
  const frameSize = Math.max(1, Math.round(audioBuffer.sampleRate / BPM_ANALYSIS_SAMPLE_RATE));
  const frameCount = Math.min(
    Math.floor(audioBuffer.length / frameSize),
    BPM_ANALYSIS_MAX_SECONDS * BPM_ANALYSIS_SAMPLE_RATE,
  );
  const energy = new Float32Array(frameCount);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * frameSize;
    const end = Math.min(audioBuffer.length, start + frameSize);
    let sum = 0;
    let sampleCount = 0;
    for (const channel of channels) {
      for (let sample = start; sample < end; sample += 1) {
        const amplitude = channel[sample];
        sum += amplitude * amplitude;
        sampleCount += 1;
      }
    }
    energy[frame] = sampleCount ? Math.sqrt(sum / sampleCount) : 0;
  }

  const onsetStrength = new Float32Array(frameCount);
  let onsetTotal = 0;
  for (let frame = 1; frame < frameCount; frame += 1) {
    const increase = Math.max(0, energy[frame] - energy[frame - 1]);
    onsetStrength[frame] = increase;
    onsetTotal += increase;
  }

  const meanOnset = onsetTotal / Math.max(1, frameCount - 1);
  if (frameCount < 500 || meanOnset < 0.00001) {
    return { bpm: null, confidence: 0 };
  }

  const minimumLag = Math.floor((60 * BPM_ANALYSIS_SAMPLE_RATE) / 180);
  const maximumLag = Math.ceil((60 * BPM_ANALYSIS_SAMPLE_RATE) / 70);
  let bestLag = 0;
  let bestScore = 0;
  let scoreTotal = 0;
  let scoreCount = 0;

  for (let lag = minimumLag; lag <= maximumLag; lag += 1) {
    let dotProduct = 0;
    let currentEnergy = 0;
    let delayedEnergy = 0;
    for (let frame = lag; frame < frameCount; frame += 1) {
      const current = onsetStrength[frame];
      const delayed = onsetStrength[frame - lag];
      dotProduct += current * delayed;
      currentEnergy += current * current;
      delayedEnergy += delayed * delayed;
    }

    const denominator = Math.sqrt(currentEnergy * delayedEnergy);
    const score = denominator ? dotProduct / denominator : 0;
    scoreTotal += score;
    scoreCount += 1;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  if (!bestLag || bestScore < 0.08) {
    return { bpm: null, confidence: 0 };
  }

  const meanScore = scoreTotal / Math.max(1, scoreCount);
  const confidence = Math.max(0, Math.min(1, (bestScore - meanScore) / (1 - meanScore)));
  const estimatedBpm = (60 * BPM_ANALYSIS_SAMPLE_RATE) / bestLag;
  return {
    bpm: Math.round(estimatedBpm),
    confidence: Math.round(confidence * 100),
  };
}

async function decodeWaveform(file, duration) {
  const estimatedDecodedBytes = duration * 48_000 * 2 * Float32Array.BYTES_PER_ELEMENT;
  if (estimatedDecodedBytes > MAX_DECODED_BYTES) {
    throw new Error('Track bahut lamba hai waveform analysis ke liye; playback aur seeking available hain.');
  }

  if (!window.AudioContext) {
    throw new Error('Is browser mein local waveform analysis ke liye Web Audio API available nahi hai.');
  }

  const context = new window.AudioContext();
  try {
    const encodedAudio = await file.arrayBuffer();
    const audioBuffer = await context.decodeAudioData(encodedAudio);
    return {
      peaks: extractWaveformPeaks(audioBuffer),
      ...detectBpm(audioBuffer),
    };
  } finally {
    await context.close();
  }
}

export function analyzeAudioFile(file, duration) {
  const cachedAnalysis = waveformCache.get(file);
  if (cachedAnalysis) return cachedAnalysis;

  const analysis = analysisQueue.then(() => decodeWaveform(file, duration));
  const cachedPromise = analysis.catch((error) => {
    waveformCache.delete(file);
    throw error;
  });

  waveformCache.set(file, cachedPromise);
  analysisQueue = cachedPromise.then(() => undefined, () => undefined);
  return cachedPromise;
}
