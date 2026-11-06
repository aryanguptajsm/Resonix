const MAX_DECODED_BYTES = 192 * 1024 * 1024;
const WAVEFORM_BAR_COUNT = 220;
const waveformCache = new WeakMap();
let analysisQueue = Promise.resolve();

export function extractWaveformPeaks(audioBuffer, barCount = WAVEFORM_BAR_COUNT) {
  const channelCount = audioBuffer.numberOfChannels;
  const channels = Array.from({ length: channelCount }, (_, channel) => (
    audioBuffer.getChannelData(channel)
  ));
  const peaks = new Array(barCount);

  for (let bar = 0; bar < barCount; bar += 1) {
    const start = Math.floor((bar / barCount) * audioBuffer.length);
    const end = Math.max(start + 1, Math.floor(((bar + 1) / barCount) * audioBuffer.length));
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
    return extractWaveformPeaks(audioBuffer);
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
