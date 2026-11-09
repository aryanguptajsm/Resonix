const STYLE_PLANS = {
  festival: {
    name: 'Festival House',
    bars: 16,
    arc: 'Keep the groove steady, build anticipation across the blend, then hand the downbeat to the incoming track.',
    transition: 'Start the incoming percussion on a phrase boundary. Blend for 16 bars, trade the bass at the next phrase, then bring up the incoming drop.',
    cues: [
      'Cue Deck B at the start of an 8- or 16-bar phrase and confirm its first kick lands with Deck A.',
      'Match the tempos before blending; keep Deck B LOW down while both tracks overlap.',
      'Bring in Deck B percussion gradually and keep Deck A vocal or hook in front.',
      'Trade basslines on the phrase boundary, then use a brief filter lift on Deck A as Deck B takes the room.',
    ],
  },
  techno: {
    name: 'Afterhours Techno',
    bars: 32,
    arc: 'Hold a patient, continuous pulse; let texture build gradually before the bassline handoff.',
    transition: 'Layer kick and hats over 32 bars. Keep only one bassline full at a time, swapping LOW EQ on a phrase boundary.',
    cues: [
      'Cue Deck B on a clean kick and align the downbeats before opening its channel.',
      'Bring in hats and percussion first; keep Deck B LOW fully down during the overlap.',
      'Ride the blend slowly over 32 bars and check the kicks for drift every phrase.',
      'Swap LOW EQ at the phrase boundary; avoid boosting both basslines together.',
      'Use a restrained filter or short echo on Deck A only after Deck B is carrying the groove.',
    ],
  },
  disco: {
    name: 'Neon Disco',
    bars: 16,
    arc: 'Keep the outgoing hook clear, then turn the handoff into a bright, singalong lift.',
    transition: 'Bring in the incoming drums under the outgoing hook. Swap bass after the hook resolves, then use a short echo to clear the outgoing track.',
    cues: [
      'Start Deck B at the beginning of a phrase and match its kick to Deck A by ear or sync.',
      'Keep Deck B LOW down and bring in its drums beneath the outgoing hook.',
      'Let the outgoing vocal or hook finish before trading the basslines.',
      'At the next phrase boundary, open Deck B LOW and ease Deck A LOW out.',
      'Use a short echo on Deck A to clear the handoff; avoid overlapping prominent vocals.',
    ],
  },
};

const KEY_TO_CAMELOT = {
  C: '8B', 'C#': '3B', DB: '3B', D: '10B', 'D#': '5B', EB: '5B', E: '12B', F: '7B',
  'F#': '2B', GB: '2B', G: '9B', 'G#': '4B', AB: '4B', A: '11B', 'A#': '6B', BB: '6B', B: '1B',
  CM: '5A', 'C#M': '12A', DBM: '12A', DM: '7A', 'D#M': '2A', EBM: '2A', EM: '9A', FM: '4A',
  'F#M': '11A', GBM: '11A', GM: '6A', 'G#M': '1A', ABM: '1A', AM: '8A', 'A#M': '3A', BBM: '3A', BM: '10A',
};

function parseBpm(value) {
  const match = String(value ?? '').match(/\b(\d{2,3}(?:\.\d+)?)\b/);
  const bpm = match ? Number(match[1]) : NaN;
  return Number.isFinite(bpm) && bpm >= 60 && bpm <= 180 ? bpm : null;
}

function tempoOptions(bpm) {
  return [bpm, bpm * 2, bpm / 2]
    .filter((value) => value >= 60 && value <= 180)
    .filter((value, index, values) => values.indexOf(value) === index);
}

function findTempoMatch(firstBpm, secondBpm) {
  let bestMatch = null;
  for (const firstTempo of tempoOptions(firstBpm)) {
    for (const secondTempo of tempoOptions(secondBpm)) {
      const difference = Math.abs(firstTempo - secondTempo) / ((firstTempo + secondTempo) / 2);
      if (!bestMatch || difference < bestMatch.difference) {
        bestMatch = { firstTempo, secondTempo, difference };
      }
    }
  }

  return bestMatch?.difference <= 0.04 ? bestMatch : null;
}

function toCamelot(value) {
  const key = String(value ?? '').trim().toUpperCase();
  const camelotMatch = key.match(/^(1[0-2]|[1-9])\s*([AB])$/);
  if (camelotMatch) return { number: Number(camelotMatch[1]), mode: camelotMatch[2] };

  const isMinor = /(?:MINOR|MIN|M)\s*$/i.test(key);
  const root = key
    .replace(/(?:MINOR|MIN|MAJOR|MAJ|M)\s*$/i, '')
    .replace(/\s+/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'B');
  const code = KEY_TO_CAMELOT[`${root}${isMinor ? 'M' : ''}`];
  const mappedMatch = code?.match(/^(1[0-2]|[1-9])([AB])$/);
  return mappedMatch ? { number: Number(mappedMatch[1]), mode: mappedMatch[2] } : null;
}

function describeKeyRelationship(firstKey, secondKey) {
  const firstCamelot = toCamelot(firstKey);
  const secondCamelot = toCamelot(secondKey);
  if (!firstCamelot || !secondCamelot) {
    return 'Key data is missing or unrecognized; keep the blend percussion-led and trust your ears.';
  }

  const ringDistance = Math.abs(firstCamelot.number - secondCamelot.number);
  const adjacent = Math.min(ringDistance, 12 - ringDistance) === 1;
  const compatible = firstCamelot.mode === secondCamelot.mode
    ? firstCamelot.number === secondCamelot.number || adjacent
    : firstCamelot.number === secondCamelot.number;
  if (compatible) {
    return `Keys ${firstCamelot.number}${firstCamelot.mode} and ${secondCamelot.number}${secondCamelot.mode} are close on the Camelot wheel; confirm by ear.`;
  }
  return `Keys ${firstCamelot.number}${firstCamelot.mode} and ${secondCamelot.number}${secondCamelot.mode} are not close on the Camelot wheel; favor a short percussion-led handoff.`;
}

export function createLocalRemixPlan({ trackA, trackB, style, prompt = '' }) {
  const stylePlan = STYLE_PLANS[style];
  if (!stylePlan || !trackA?.title || !trackB?.title || trackA.title === trackB.title && trackA.artist === trackB.artist) {
    throw new Error('Choose two different tracks and a supported mix style.');
  }

  const firstBpm = parseBpm(trackA.bpm);
  const secondBpm = parseBpm(trackB.bpm);
  const tempoMatch = firstBpm && secondBpm ? findTempoMatch(firstBpm, secondBpm) : null;
  let targetBpm = null;
  let bpmStrategy = 'BPM data is unavailable. Beatmatch by ear, start with a short percussion blend, and avoid long overlapping basslines.';
  let transitionBars = stylePlan.bars;

  if (tempoMatch) {
    targetBpm = Math.round((tempoMatch.firstTempo + tempoMatch.secondTempo) / 2);
    bpmStrategy = `A practical shared tempo is about ${targetBpm} BPM${tempoMatch.firstTempo !== firstBpm || tempoMatch.secondTempo !== secondBpm ? ' using a half-time or double-time count' : ''}. Check pitch range and beat alignment on the decks before blending.`;
  } else if (firstBpm && secondBpm) {
    transitionBars = 8;
    bpmStrategy = `The analyzed tempos (${Math.round(firstBpm)} and ${Math.round(secondBpm)} BPM) do not have a close half-time/double-time match. Beatmatch by ear and use a short 8-bar handoff instead of forcing a long blend.`;
  } else if (firstBpm || secondBpm) {
    targetBpm = Math.round(firstBpm || secondBpm);
    bpmStrategy = `Use about ${targetBpm} BPM as the reference from the analyzed track; match the other deck by ear and verify the pitch range before blending.`;
  }

  return {
    mixTitle: `${stylePlan.name}: ${trackA.title} → ${trackB.title}`,
    bpmStrategy,
    keyStrategy: describeKeyRelationship(trackA.key, trackB.key),
    transition: transitionBars === 8 && stylePlan.bars !== 8
      ? 'Keep the blend short: align a phrase, bring in percussion, trade bass on the downbeat, and clear the outgoing track with a brief echo or clean cut.'
      : stylePlan.transition,
    energyArc: stylePlan.arc,
    targetBpm,
    transitionBars,
    performanceCues: stylePlan.cues,
    creativeDirection: prompt.trim(),
  };
}