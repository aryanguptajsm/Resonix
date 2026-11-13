import { useEffect, useRef, useState } from 'react';
import './App.css';
import Deck from './components/deck/Deck.jsx';
import TopBar from './components/layout/TopBar.jsx';
import Library from './components/library/Library.jsx';
import Mixer from './components/mixer/Mixer.jsx';
import SmartSet from './components/remix/SmartSet.jsx';
import { createLocalRemixPlan, getTransitionStartTime } from './audio/createLocalRemixPlan.js';
import { getSavedLibraryTracks, saveLibraryTrack } from './audio/libraryStore.js';

const DEVELOPMENT_STAGES = [
  { id: 'phase-1', label: 'Phase 1', name: 'Interface shell', done: true },
  { id: 'phase-2', label: 'Phase 2', name: 'Local music import', done: true },
  { id: 'phase-3', label: 'Phase 3', name: 'Dual-deck playback', done: true },
  { id: 'phase-4', label: 'Phase 4', name: 'Mixer & crossfader', done: true },
  { id: 'phase-5', label: 'Phase 5', name: '3-band EQ', done: true },
  { id: 'phase-6', label: 'Phase 6', name: 'Real waveforms', done: true },
  { id: 'phase-7', label: 'Phase 7', name: 'Approx. BPM detection', done: true },
  { id: 'phase-8', label: 'Phase 8', name: 'Approx. sync & pitch', done: true },
  { id: 'phase-9', label: 'Phase 9', name: 'Beat-grid analysis', done: true },
  { id: 'phase-10', label: 'Phase 10', name: 'Audio effects', done: true },
  { id: 'phase-11', label: 'Phase 11', name: 'Library & playlists', done: false },
  { id: 'phase-12', label: 'Phase 12', name: 'Mix recording', done: false },
  { id: 'phase-13', label: 'Phase 13', name: 'Spotify metadata', done: false },
  { id: 'phase-14', label: 'Phase 14', name: 'Licensed music sources', done: false },
  { id: 'phase-15', label: 'Phase 15', name: 'Electron desktop app', done: false },
  { id: 'phase-16', label: 'Phase 16', name: 'Testing & optimization', done: false },
];

function App() {
  const [tracks, setTracks] = useState([]);
  const [deckTracks, setDeckTracks] = useState({ A: null, B: null });
  const [playingDecks, setPlayingDecks] = useState({ A: false, B: false });
  const [deckLevels, setDeckLevels] = useState({ A: 0.8, B: 0.8 });
  const [deckEq, setDeckEq] = useState({
    A: { low: 0, mid: 0, high: 0 },
    B: { low: 0, mid: 0, high: 0 },
  });
  const [deckEffects, setDeckEffects] = useState({
    A: { filter: false, echo: false, reverb: false, flanger: false },
    B: { filter: false, echo: false, reverb: false, flanger: false },
  });
  const [deckPitch, setDeckPitch] = useState({ A: 0, B: 0 });
  const [deckTempoRatio, setDeckTempoRatio] = useState({ A: 1, B: 1 });
  const [deckTimes, setDeckTimes] = useState({ A: 0, B: 0 });
  const [deckAutomation, setDeckAutomation] = useState({ A: null, B: null });
  const [autoMix, setAutoMix] = useState(null);
  const [smartSet, setSmartSet] = useState(null);
  const [crossfader, setCrossfader] = useState(0);
  const [activePage, setActivePage] = useState('studio');
  const [notice, setNotice] = useState('');
  const [libraryReady, setLibraryReady] = useState(false);
  const objectUrls = useRef(new Set());
  const appRef = useRef(null);
  const automationSequence = useRef(0);
  const advancedSetMixId = useRef(null);

  const sendDeckCommand = (
    deckId,
    action,
    trackId,
    runId = 'manual',
    effects = {},
    commandOptions = {},
  ) => {
    automationSequence.current += 1;
    setDeckAutomation((current) => ({
      ...current,
      [deckId]: {
        id: `${runId}-${deckId}-${automationSequence.current}`,
        action,
        trackId,
        effects,
        ...commandOptions,
      },
    }));
  };

  const handleDeckEffectsChange = (deckId, update) => {
    setDeckEffects((current) => ({
      ...current,
      [deckId]: typeof update === 'function' ? update(current[deckId]) : update,
    }));
  };

  const handleTempoRatioChange = (deckId, ratio) => {
    setDeckTempoRatio((current) => (
      current[deckId] === ratio ? current : { ...current, [deckId]: ratio }
    ));
  };

  useEffect(() => {
    let cancelled = false;

    getSavedLibraryTracks().then(async (savedTracks) => {
      const restoreResults = await Promise.all(savedTracks.map(async (savedTrack) => {
        try {
          const permission = await savedTrack.handle.queryPermission({ mode: 'read' });
          if (permission !== 'granted') {
            return { track: { ...savedTrack, file: null, url: '', needsAccess: true } };
          }

          const file = await savedTrack.handle.getFile();
          const url = URL.createObjectURL(file);
          objectUrls.current.add(url);
          return { track: { ...savedTrack, file, url, needsAccess: false } };
        } catch (error) {
          return {
            track: { ...savedTrack, file: null, url: '', needsAccess: true },
            error,
          };
        }
      }));
      const restoredTracks = restoreResults.map(({ track }) => track);

      if (cancelled) {
        restoredTracks.forEach((track) => {
          if (track.url) URL.revokeObjectURL(track.url);
        });
        return;
      }

      setTracks(restoredTracks);
      let savedDeckIds = {};
      try {
        const savedAssignments = JSON.parse(localStorage.getItem('resonix-decks') || '{}');
        if (savedAssignments && typeof savedAssignments === 'object') {
          savedDeckIds = savedAssignments;
        }
      } catch (error) {
        setNotice(`Could not restore your deck assignments: ${error.message}`);
      }
      setDeckTracks({
        A: restoredTracks.find((track) => track.id === savedDeckIds.A) || null,
        B: restoredTracks.find((track) => track.id === savedDeckIds.B) || null,
      });
      const failedRestores = restoreResults.filter((result) => result.error);
      if (failedRestores.length > 0) {
        setNotice(`Could not reopen ${failedRestores.length} saved track(s): ${failedRestores.map(({ error }) => error.message).join('; ')}`);
      } else if (restoredTracks.some((track) => track.needsAccess)) {
        setNotice('Some tracks need file access. Choose Load A or Load B to reconnect them.');
      }
      setLibraryReady(true);
    }).catch((restoreError) => {
      if (!cancelled) {
        setNotice(`Could not restore the saved music library: ${restoreError.message}`);
        setLibraryReady(true);
      }
    });

    return () => {
      cancelled = true;
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!libraryReady) return;
    try {
      localStorage.setItem('resonix-decks', JSON.stringify({
        A: deckTracks.A?.id || null,
        B: deckTracks.B?.id || null,
      }));
    } catch (error) {
      setNotice(`Could not save your deck assignments: ${error.message}`);
    }
  }, [deckTracks, libraryReady]);

  const getDeckOutputVolume = (deckId) => {
    const normalized = (crossfader + 1) / 2;
    const leftMix = Math.cos(normalized * (Math.PI / 2));
    const rightMix = Math.sin(normalized * (Math.PI / 2));

    if (deckId === 'A') {
      return leftMix;
    }

    return rightMix;
  };

  const handleAutoMixPair = async (
    trackA,
    trackB,
    plan,
    { fromDeck = 'A', keepFromPlaying = false, style = 'festival' } = {},
  ) => {
    const toDeck = fromDeck === 'A' ? 'B' : 'A';
    const shouldKeepFromPlaying = keepFromPlaying && deckTracks[fromDeck]?.id === trackA.id;
    setAutoMix(null);
    const [loadedFrom, loadedTo] = await Promise.all([
      shouldKeepFromPlaying ? Promise.resolve(true) : handleLoadToDeck(trackA, fromDeck),
      handleLoadToDeck(trackB, toDeck),
    ]);

    if (!loadedFrom || !loadedTo) {
      setNotice('Both songs must be available before the concert mix can start.');
      return false;
    }

    const bpm = Number(trackA.bpm) * (deckTempoRatio[fromDeck] || 1);
    const transitionBars = [8, 16, 32].includes(plan?.transitionBars) ? plan.transitionBars : 16;
    const transitionSeconds = Number.isFinite(bpm) && bpm > 0
      ? (transitionBars * 4 * 60) / bpm
      : 12;
    const runId = crypto.randomUUID();
    const startEq = deckEq;
    const startEffects = deckEffects;
    setCrossfader(fromDeck === 'A' ? -1 : 1);
    setDeckEq((current) => ({
      A: { ...current.A, mid: current.A.mid, high: current.A.high },
      B: { ...current.B },
      [toDeck]: {
        ...current[toDeck],
        low: current[toDeck].low - 10,
        mid: current[toDeck].mid - 2,
        high: current[toDeck].high - 3,
      },
    }));
    setDeckEffects((current) => ({
      A: { ...current.A, echo: false, reverb: false },
      B: { ...current.B, echo: false, reverb: false },
    }));
    setAutoMix({
      id: runId,
      phase: 'intro',
      fromDeck,
      toDeck,
      trackAId: trackA.id,
      trackBId: trackB.id,
      transitionSeconds,
      tempoRatio: plan?.tempoRatio,
      startEq,
      startEffects,
      style,
      progress: 0,
    });
    if (!shouldKeepFromPlaying) sendDeckCommand(fromDeck, 'restart-play', trackA.id, runId);
    setNotice(`Concert mix is playing ${trackA.title}. ${trackB.title} will blend in around the middle.`);
    return true;
  };

  const handleStopAutoMix = () => {
    if (autoMix?.startEq) setDeckEq(autoMix.startEq);
    if (autoMix?.startEffects) setDeckEffects(autoMix.startEffects);
    if (deckTracks.A) sendDeckCommand('A', 'stop', deckTracks.A.id);
    if (deckTracks.B) sendDeckCommand('B', 'stop', deckTracks.B.id);
    setAutoMix(null);
    setSmartSet(null);
    setCrossfader(0);
    setDeckTempoRatio({ A: 1, B: 1 });
    setNotice('Concert mix stopped.');
  };

  useEffect(() => {
    if (!['intro', 'build'].includes(autoMix?.phase)) return;
    const fromDeck = autoMix.fromDeck || 'A';
    const toDeck = autoMix.toDeck || 'B';
    const outgoingTrack = deckTracks[fromDeck];
    if (outgoingTrack?.id !== autoMix.trackAId) return;
    const duration = Number(outgoingTrack.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;

    const blendDuration = Math.min(autoMix.transitionSeconds, duration * 0.4);
    const blendStart = Number.isFinite(autoMix.blendStart)
      ? autoMix.blendStart
      : getTransitionStartTime(
        outgoingTrack,
        duration * 0.5,
        duration - blendDuration,
      );
    const buildStart = Math.max(0, blendStart - Math.min(8, blendDuration * 0.5));
    const currentTime = deckTimes[fromDeck];

    if (autoMix.phase === 'intro' && currentTime >= buildStart && currentTime < blendStart) {
      setAutoMix((current) => (
        current?.id === autoMix.id && current.phase === 'intro'
          ? { ...current, phase: 'build', blendStart, blendDuration }
          : current
      ));
      setDeckEq((current) => ({
        ...current,
        [fromDeck]: {
          ...current[fromDeck],
          mid: current[fromDeck].mid + 1.5,
          high: current[fromDeck].high + 2,
        },
      }));
      return;
    }
    if (currentTime < blendStart) return;

    setAutoMix((current) => (
      current?.id === autoMix.id && ['intro', 'build'].includes(current.phase)
        ? { ...current, phase: 'blending', blendDuration, blendStart, progress: 0 }
        : current
    ));
    setDeckEq((current) => ({
      ...current,
      [toDeck]: {
        ...autoMix.startEq[toDeck],
        low: autoMix.startEq[toDeck].low - 10,
        mid: autoMix.startEq[toDeck].mid - 2,
        high: autoMix.startEq[toDeck].high - 3,
      },
    }));
    const incomingTrack = deckTracks[toDeck];
    const effectiveOutgoingTrack = {
      ...outgoingTrack,
      bpm: String(Number(outgoingTrack.bpm) * (deckTempoRatio[fromDeck] || 1)),
    };
    const updatedPlan = createLocalRemixPlan({
      trackA: effectiveOutgoingTrack,
      trackB: incomingTrack,
      style: autoMix.style || 'festival',
    });
    const tempoRatio = Number.isFinite(autoMix.tempoRatio)
      ? autoMix.tempoRatio
      : updatedPlan.tempoRatio;
    const canSync = Number.isFinite(tempoRatio);
    if (Number.isFinite(tempoRatio) && !Number.isFinite(autoMix.tempoRatio)) {
      setAutoMix((current) => (
        current?.id === autoMix.id ? { ...current, tempoRatio } : current
      ));
    }
    sendDeckCommand(
      toDeck,
      canSync ? 'sync-play' : 'restart-play',
      incomingTrack.id,
      autoMix.id,
      { filter: true, filterCutoff: 1800 },
      { tempoRatio },
    );
  }, [autoMix, deckTimes, deckTracks, deckTempoRatio]);

  useEffect(() => {
    if (!smartSet || autoMix?.phase === 'finished') return;
    const stage = autoMix?.phase === 'build'
      ? 'build'
      : autoMix?.phase === 'blending'
        ? 'blending'
        : autoMix?.phase === 'intro'
          ? smartSet.nextIndex === 2 ? 'opening' : 'middle'
          : smartSet.stage;
    if (stage && stage !== smartSet.stage) {
      setSmartSet((current) => (
        current && current.stage !== stage ? { ...current, stage } : current
      ));
    }
  }, [autoMix?.id, autoMix?.phase, smartSet?.nextIndex, smartSet?.stage]);

  useEffect(() => {
    if (autoMix?.phase !== 'blending') return;

    const fromDeck = autoMix.fromDeck || 'A';
    const toDeck = autoMix.toDeck || 'B';
    const crossfaderStart = fromDeck === 'A' ? -1 : 1;
    const crossfaderEnd = -crossfaderStart;
    const currentTime = deckTimes[fromDeck];
    const progress = Math.max(0, Math.min(
      1,
      (currentTime - autoMix.blendStart) / autoMix.blendDuration,
    ));
    setCrossfader(crossfaderStart + (crossfaderEnd - crossfaderStart) * progress);

    const bassSwap = Math.min(1, Math.max(0, (progress - 0.3) / 0.3));
    setDeckEq((current) => ({
      ...current,
      [fromDeck]: {
        ...autoMix.startEq[fromDeck],
        low: autoMix.startEq[fromDeck].low - (10 * bassSwap),
        mid: autoMix.startEq[fromDeck].mid + 1.5 - (1.5 * progress),
        high: autoMix.startEq[fromDeck].high + 2 - (2 * progress),
      },
      [toDeck]: {
        ...autoMix.startEq[toDeck],
        low: autoMix.startEq[toDeck].low - (10 * (1 - bassSwap)),
        mid: autoMix.startEq[toDeck].mid - (2 * (1 - progress)),
        high: autoMix.startEq[toDeck].high - 3 + (3 * progress),
      },
    }));

    if (progress >= 0.4 && !autoMix.reverbTriggered) {
      sendDeckCommand(toDeck, 'effects', autoMix.trackBId, autoMix.id, { reverb: true, filter: false });
      setAutoMix((current) => (
        current?.id === autoMix.id ? { ...current, reverbTriggered: true } : current
      ));
    }
    if (progress >= 0.78 && !autoMix.echoTriggered) {
      sendDeckCommand(fromDeck, 'effects', autoMix.trackAId, autoMix.id, { echo: true });
      setAutoMix((current) => (
        current?.id === autoMix.id ? { ...current, echoTriggered: true } : current
      ));
    }
    if (Math.abs((autoMix.progress || 0) - progress) >= 0.02 || progress === 1) {
      setAutoMix((current) => (
        current?.id === autoMix.id ? { ...current, progress } : current
      ));
    }
    if (progress < 1) return;

    sendDeckCommand(fromDeck, 'stop', autoMix.trackAId, autoMix.id);
    setDeckEq(autoMix.startEq);
    setDeckEffects(autoMix.startEffects);
    setAutoMix((current) => (
      current?.id === autoMix.id ? { ...current, phase: 'finished', progress: 1 } : current
    ));
    setNotice(`Handoff complete. ${deckTracks[toDeck]?.title || 'The next song'} has the mix.`);
  }, [autoMix, deckTimes, deckTracks]);

  useEffect(() => {
    if (autoMix?.phase !== 'finished' || !smartSet || advancedSetMixId.current === autoMix.id) return;
    advancedSetMixId.current = autoMix.id;

    const nextTrackId = smartSet.trackIds[smartSet.nextIndex];
    if (!nextTrackId) {
      const finalDeck = autoMix.toDeck || 'B';
      const finalTrack = tracks.find((track) => track.id === autoMix.trackBId);
      setSmartSet((current) => (
        current
          ? {
            ...current,
            stage: 'finale',
            finalDeck,
            finalTrackId: autoMix.trackBId,
            finalLevel: deckLevels[finalDeck],
          }
          : current
      ));
      setNotice(`Closing song: ${finalTrack?.title || 'the opening song'} returns for the finale.`);
      return;
    }

    const currentTrack = tracks.find((track) => track.id === autoMix.trackBId);
    const nextTrack = tracks.find((track) => track.id === nextTrackId);
    if (!currentTrack || !nextTrack) {
      setSmartSet(null);
      setNotice('The next concert song is no longer available. Import it again to continue.');
      return;
    }

    const effectiveCurrentTrack = {
      ...currentTrack,
      bpm: String(Number(currentTrack.bpm) * (deckTempoRatio[autoMix.toDeck || 'B'] || 1)),
    };
    const plan = createLocalRemixPlan({
      trackA: effectiveCurrentTrack,
      trackB: nextTrack,
      style: smartSet.style || 'festival',
    });
    void handleAutoMixPair(currentTrack, nextTrack, plan, {
      fromDeck: autoMix.toDeck || 'B',
      keepFromPlaying: true,
      style: smartSet.style || 'festival',
    }).then((started) => {
      if (!started) {
        setSmartSet(null);
        return;
      }
      setSmartSet((current) => (
        current ? { ...current, nextIndex: current.nextIndex + 1 } : current
      ));
    });
  }, [autoMix, smartSet, tracks, deckLevels, deckTempoRatio]);

  useEffect(() => {
    if (!['finale', 'finale-fade'].includes(smartSet?.stage) || !smartSet.finalDeck || !smartSet.finalTrackId) return;

    const { finalDeck, finalTrackId } = smartSet;
    const finalTrack = deckTracks[finalDeck];
    if (finalTrack?.id !== finalTrackId) return;
    const duration = Number(finalTrack.duration);
    if (!Number.isFinite(duration) || duration <= 0) return;

    const fadeSeconds = Math.min(10, Math.max(4, duration * 0.08));
    const remaining = duration - deckTimes[finalDeck];
    if (remaining > fadeSeconds) return;

    const progress = Math.max(0, remaining / fadeSeconds);
    const finalLevel = smartSet.finalLevel ?? 0.8;
    setDeckLevels((current) => {
      const nextLevel = finalLevel * progress;
      return Math.abs(current[finalDeck] - nextLevel) < 0.01
        ? current
        : { ...current, [finalDeck]: nextLevel };
    });

    if (remaining <= 0) {
      sendDeckCommand(finalDeck, 'stop', finalTrackId, 'concert-finale');
      setDeckLevels((current) => ({ ...current, [finalDeck]: finalLevel }));
      setSmartSet(null);
      setNotice('Concert mix complete. The finale faded out cleanly.');
    } else if (smartSet.stage !== 'finale-fade') {
      setSmartSet((current) => (
        current?.stage === 'finale' ? { ...current, stage: 'finale-fade' } : current
      ));
    }
  }, [smartSet, deckTimes, deckTracks]);

  const handleStartSmartSet = (setlist, style = 'festival') => {
    if (setlist.length < 2) {
      setNotice('Import at least two songs to start a concert mix.');
      return;
    }
    const trackIds = [...setlist.map((track) => track.id), setlist[0].id];
    setSmartSet({
      trackIds,
      songCount: setlist.length,
      nextIndex: 2,
      stage: 'opening',
      style,
    });
    advancedSetMixId.current = null;
    const plan = createLocalRemixPlan({
      trackA: setlist[0],
      trackB: setlist[1],
      style,
    });
    void handleAutoMixPair(setlist[0], setlist[1], plan, { style }).then((started) => {
      if (!started) setSmartSet(null);
    });
  };

  const handleImport = (files, handles = []) => {
    const acceptedFiles = files.map((file, index) => ({ file, handle: handles[index] || null })).filter(({ file }) => (
      file.type.startsWith('audio/')
      || /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name)
    ));
    const rejectedCount = files.length - acceptedFiles.length;

    const importedTracks = acceptedFiles.map(({ file, handle }) => {
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      return {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, ''),
        artist: 'Local audio',
        album: '—',
        bpm: '—',
        key: '—',
        duration: null,
        file,
        url,
        handle,
        needsAccess: false,
      };
    });

    if (importedTracks.length > 0) {
      setTracks((currentTracks) => [...currentTracks, ...importedTracks]);
      Promise.all(importedTracks.map(saveLibraryTrack)).catch((saveError) => {
        setNotice(`Tracks were imported, but could not be saved for next time: ${saveError.message}`);
      });
      const skippedMessage = rejectedCount > 0
        ? ` ${rejectedCount} unsupported file(s) were skipped.`
        : '';
      const persistenceMessage = importedTracks.some((track) => !track.handle)
        ? ' This browser could not save file access; re-import these tracks after restarting.'
        : ' File access and deck assignments will be remembered.';
      setNotice(`${importedTracks.length} track(s) added to your library.${skippedMessage}${persistenceMessage}`);
    } else if (rejectedCount > 0) {
      setNotice('The selected files are not in a supported audio format.');
    }
  };

  const handleLoadToDeck = async (track, deckId) => {
    let readyTrack = track;
    if (track.needsAccess) {
      try {
        const permission = await track.handle.requestPermission({ mode: 'read' });
        if (permission !== 'granted') {
          setNotice(`Access to ${track.title} was not granted. Choose Load again to retry.`);
          return false;
        }
        const file = await track.handle.getFile();
        const url = URL.createObjectURL(file);
        objectUrls.current.add(url);
        readyTrack = { ...track, file, url, needsAccess: false };
        setTracks((currentTracks) => currentTracks.map((item) => (
          item.id === track.id ? readyTrack : item
        )));
      } catch (accessError) {
        setNotice(`Could not reopen ${track.title}: ${accessError.message}`);
        return false;
      }
    }

    setDeckTracks((current) => ({ ...current, [deckId]: readyTrack }));
    setNotice(`${track.title} loaded to Deck ${deckId}.`);
    return true;
  };

  const handleDurationChange = (trackId, duration) => {
    const updateDuration = (track) => (
      track?.id === trackId ? { ...track, duration } : track
    );
    setTracks((currentTracks) => currentTracks.map(updateDuration));
    setDeckTracks((currentDecks) => ({
      A: updateDuration(currentDecks.A),
      B: updateDuration(currentDecks.B),
    }));
  };

  const handleBpmChange = (trackId, bpm, confidence, analysis = null) => {
    const bpmValue = bpm ? String(bpm) : '—';
    const { cacheError, ...analysisData } = analysis || {};
    const updateTrack = (track) => (
      track?.id === trackId
        ? {
          ...track,
          bpm: bpmValue,
          bpmConfidence: confidence,
          key: analysisData.key || '—',
          analysis: analysisData,
        }
        : track
    );
    setTracks((currentTracks) => currentTracks.map(updateTrack));
    setDeckTracks((currentDecks) => ({
      A: updateTrack(currentDecks.A),
      B: updateTrack(currentDecks.B),
    }));
    if (cacheError) setNotice(`Audio was analyzed but could not be cached: ${cacheError}`);
  };

  const handleSyncFeedback = (message) => setNotice(message);

  const handleTrackEnded = (deckId, trackId) => {
    if (
      ['finale', 'finale-fade'].includes(smartSet?.stage)
      && smartSet.finalDeck === deckId
      && smartSet.finalTrackId === trackId
    ) {
      setDeckLevels((current) => ({ ...current, [deckId]: smartSet.finalLevel ?? current[deckId] }));
      setSmartSet(null);
      setNotice('Concert mix complete. The finale ended cleanly.');
    }
  };

  const handleNavigate = (page, section) => {
    setActivePage(page);
    if (page === 'studio' && section) {
      window.setTimeout(() => {
        document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 0);
      return;
    }
    appRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const status = Object.values(playingDecks).some(Boolean)
    ? 'Playing'
    : tracks.length > 0
      ? 'Audio ready'
      : 'Import audio to begin';

  return (
    <div className="app" ref={appRef}>
      <TopBar status={status} activePage={activePage} onNavigate={handleNavigate} />
      {notice && (
        <div className="app__notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {activePage === 'studio' ? (
        <>
          <main className="main-area" id="decks">
            <Deck
              deckId="A"
              deckColor="var(--deck-a-color)"
              track={deckTracks.A}
              channelVolume={deckLevels.A}
              outputMix={getDeckOutputVolume('A')}
              eq={deckEq.A}
              effects={deckEffects.A}
              syncBpm={deckTracks.B?.bpm}
              syncTime={deckTimes.B}
              syncPitch={deckPitch.B}
              syncTempoRatio={deckTempoRatio.B}
              tempoRatio={deckTempoRatio.A}
              automationCommand={deckAutomation.A}
              onDurationChange={handleDurationChange}
              onBpmChange={handleBpmChange}
              onPositionChange={(time) => setDeckTimes((current) => ({ ...current, A: time }))}
              onPitchChange={(value) => setDeckPitch((current) => ({ ...current, A: value }))}
              onTempoRatioChange={(value) => handleTempoRatioChange('A', value)}
              onSyncFeedback={handleSyncFeedback}
              onEqChange={(band, value) => setDeckEq((current) => ({
                ...current,
                A: { ...current.A, [band]: value },
              }))}
              onEffectsChange={(update) => handleDeckEffectsChange('A', update)}
              onVolumeChange={(value) => setDeckLevels((current) => ({ ...current, A: value }))}
              onPlayingChange={(isPlaying) => setPlayingDecks((current) => ({ ...current, A: isPlaying }))}
              onTrackEnded={handleTrackEnded}
            />
            <Deck
              deckId="B"
              deckColor="var(--deck-b-color)"
              track={deckTracks.B}
              channelVolume={deckLevels.B}
              outputMix={getDeckOutputVolume('B')}
              eq={deckEq.B}
              effects={deckEffects.B}
              syncBpm={deckTracks.A?.bpm}
              syncTime={deckTimes.A}
              syncPitch={deckPitch.A}
              syncTempoRatio={deckTempoRatio.A}
              tempoRatio={deckTempoRatio.B}
              automationCommand={deckAutomation.B}
              onDurationChange={handleDurationChange}
              onBpmChange={handleBpmChange}
              onPositionChange={(time) => setDeckTimes((current) => ({ ...current, B: time }))}
              onPitchChange={(value) => setDeckPitch((current) => ({ ...current, B: value }))}
              onTempoRatioChange={(value) => handleTempoRatioChange('B', value)}
              onSyncFeedback={handleSyncFeedback}
              onEqChange={(band, value) => setDeckEq((current) => ({
                ...current,
                B: { ...current.B, [band]: value },
              }))}
              onEffectsChange={(update) => handleDeckEffectsChange('B', update)}
              onVolumeChange={(value) => setDeckLevels((current) => ({ ...current, B: value }))}
              onPlayingChange={(isPlaying) => setPlayingDecks((current) => ({ ...current, B: isPlaying }))}
              onTrackEnded={handleTrackEnded}
            />
            <Mixer
              deckLevels={deckLevels}
              deckEq={deckEq}
              crossfader={crossfader}
              onDeckLevelChange={(deckId, value) => setDeckLevels((current) => ({ ...current, [deckId]: value }))}
              onEqChange={(deckId, band, value) => setDeckEq((current) => ({
                ...current,
                [deckId]: { ...current[deckId], [band]: value },
              }))}
              onEqReset={(deckId) => setDeckEq((current) => ({
                ...current,
                [deckId]: { low: 0, mid: 0, high: 0 },
              }))}
              onBalancedBass={() => setDeckEq((current) => ({
                A: { ...current.A, low: -2 },
                B: { ...current.B, low: -2 },
              }))}
              onCrossfaderChange={setCrossfader}
            />
          </main>
          <Library
            tracks={tracks}
            onImport={handleImport}
            onLoadToDeck={handleLoadToDeck}
            onImportError={(error) => setNotice(`Could not import audio: ${error.message}`)}
          />
          <SmartSet
            tracks={tracks}
            autoSet={smartSet}
            onStart={handleStartSmartSet}
            onStop={handleStopAutoMix}
          />
        </>
      ) : (
        <main className="roadmap-page" id="roadmap">
          <div className="roadmap-page__header">
            <span className="roadmap-page__eyebrow">RESONIX DEVELOPMENT</span>
            <h1>Project roadmap</h1>
            <p>
              Completed work and the remaining milestones. Approximate analysis features are labeled honestly.
            </p>
            <div className="roadmap-page__progress" role="status">
              <strong>{DEVELOPMENT_STAGES.filter((phase) => phase.done).length} / {DEVELOPMENT_STAGES.length}</strong>
              <span>phases complete</span>
            </div>
          </div>
          <ol className="roadmap-page__list" aria-label="Development phases checklist">
            {DEVELOPMENT_STAGES.map((phase) => (
              <li
                key={phase.id}
                className={`roadmap-page__item ${phase.done ? 'roadmap-page__item--done' : ''}`}
              >
                <span className="roadmap-page__check" aria-hidden="true">{phase.done ? '✓' : '·'}</span>
                <span className="roadmap-page__phase">{phase.label}</span>
                <span className="roadmap-page__name">{phase.name}</span>
                <span className="roadmap-page__status">{phase.done ? 'Complete' : 'Upcoming'}</span>
              </li>
            ))}
          </ol>
        </main>
      )}
    </div>
  );
}

export default App;
