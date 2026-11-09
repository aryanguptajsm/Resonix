import { useEffect, useState } from 'react';
import './RemixStudio.css';

const REMIX_STYLES = [
  { id: 'festival', name: 'Festival House', detail: 'Big drops · crowd energy', color: 'violet' },
  { id: 'techno', name: 'Afterhours Techno', detail: 'Deep grooves · hypnotic', color: 'blue' },
  { id: 'disco', name: 'Neon Disco', detail: 'Funky bass · hands up', color: 'pink' },
];

const STAGE_BARS = [24, 42, 30, 58, 36, 74, 46, 88, 52, 70, 38, 96, 56, 78, 42, 65, 34, 84, 48, 68, 32, 90, 50, 72, 40, 60, 28, 80, 46, 94, 54, 72];

function trackDetails(track) {
  return {
    title: track.title,
    artist: track.artist,
    bpm: track.bpm,
    key: track.key,
  };
}

function RemixStudio({ tracks, onLoadToDeck, onLoadPairToDecks, onImportTracks }) {
  const [trackAId, setTrackAId] = useState('');
  const [trackBId, setTrackBId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(REMIX_STYLES[0].id);
  const [prompt, setPrompt] = useState('');
  const [mixPlans, setMixPlans] = useState([]);
  const [activePlanId, setActivePlanId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!tracks.some((track) => track.id === trackAId)) {
      setTrackAId(tracks[0]?.id || '');
    }
    if (!tracks.some((track) => track.id === trackBId)) {
      setTrackBId(tracks.find((track) => track.id !== trackAId)?.id || '');
    } else if (trackBId === trackAId) {
      setTrackBId(tracks.find((track) => track.id !== trackAId)?.id || '');
    }
  }, [trackAId, trackBId, tracks]);

  const trackA = tracks.find((track) => track.id === trackAId);
  const trackB = tracks.find((track) => track.id === trackBId);
  const canGenerate = Boolean(trackA && trackB && trackA.id !== trackB.id && !isGenerating);
  const activePlan = mixPlans.find((item) => item.id === activePlanId);

  const generateMixPlan = async (event) => {
    event.preventDefault();
    if (!canGenerate) return;

    setIsGenerating(true);
    setMessage('');
    try {
      const response = await fetch('/api/remix-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackA: trackDetails(trackA),
          trackB: trackDetails(trackB),
          style: selectedStyle,
          prompt: prompt.trim(),
        }),
      });
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('The remix service returned an unreadable response.');
      }
      if (!response.ok) {
        throw new Error(result.error || `Could not create an AI mix plan (HTTP ${response.status}).`);
      }

      const style = REMIX_STYLES.find((item) => item.id === selectedStyle);
      const mix = {
        id: crypto.randomUUID(),
        trackAId: trackA.id,
        trackBId: trackB.id,
        trackATitle: trackA.title,
        trackBTitle: trackB.title,
        style: style.name,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...result.plan,
      };
      setMixPlans((current) => [mix, ...current]);
      setActivePlanId(mix.id);
      setMessage('AI mix plan ready. Your audio stays on this device.');
      setPrompt('');
    } catch (error) {
      setMessage(error.message || 'Could not create an AI mix plan. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const loadPair = (firstId, secondId) => {
    const first = tracks.find((track) => track.id === firstId);
    const second = tracks.find((track) => track.id === secondId);
    if (first && second) onLoadPairToDecks(first, second);
  };

  return (
    <section className="remix-studio" id="remix" aria-labelledby="remix-title">
      <div className="remix-stage">
        <div className="remix-stage__lights" aria-hidden="true" />
        <div className="remix-stage__topline">
          <span className="remix-stage__live"><span /> REMIX STAGE</span>
          <span className="remix-stage__edition">RESONIX / AI DJ LAB</span>
        </div>
        <div className="remix-stage__content">
          <div className="remix-stage__copy">
            <p className="remix-stage__eyebrow">TWO TRACKS. ONE CROWD.</p>
            <h1 id="remix-title">Make the room<br /><span>move.</span></h1>
            <p className="remix-stage__description">
              Let Gemini map the handoff. You bring both tracks to the decks and take the room to the drop.
            </p>
            <a className="remix-stage__cta" href="#remix-create">
              Build your live mix <span aria-hidden="true">↗</span>
            </a>
          </div>
          <div className="remix-stage__visual" aria-hidden="true">
            <div className="remix-stage__orb" />
            <div className="remix-stage__equalizer">
              {STAGE_BARS.map((height, index) => (
                <i key={index} style={{ '--bar-height': `${height}%`, '--bar-delay': `${(index % 9) * -0.13}s` }} />
              ))}
            </div>
            <span className="remix-stage__visual-caption">FEEL THE DROP</span>
          </div>
        </div>
        <div className="remix-stage__footer">
          <span>01 — CHOOSE TWO TRACKS</span>
          <span>02 — GET YOUR AI CUES</span>
          <span>03 — PLAY IT LIVE</span>
        </div>
      </div>

      <div className="remix-content">
        <div className="remix-section-heading">
          <div>
            <span className="remix-eyebrow">YOUR TWO-DECK SET BUILDER</span>
            <h2>Make a live remix</h2>
          </div>
          <span className="remix-session-tag"><span /> AUDIO STAYS LOCAL</span>
        </div>

        <div className="remix-layout">
          <form className="remix-create" id="remix-create" onSubmit={generateMixPlan}>
            <div className="remix-create__heading">
              <span className="remix-create__number">01</span>
              <div>
                <h3>Build your track pair</h3>
                <p>AI uses track details to plan a concert-ready transition.</p>
              </div>
            </div>

            {tracks.length >= 2 ? (
              <div className="remix-track-pair">
                <label className="remix-track-slot remix-track-slot--a" htmlFor="remix-track-a">
                  <span className="remix-track-slot__deck">DECK A</span>
                  <span className="remix-field-label">FIRST TRACK</span>
                  <select
                    id="remix-track-a"
                    className="remix-select"
                    value={trackAId}
                    onChange={(event) => setTrackAId(event.target.value)}
                    required
                  >
                    {tracks.map((track) => (
                      <option key={track.id} value={track.id}>{track.title} — {track.artist}</option>
                    ))}
                  </select>
                </label>
                <span className="remix-track-pair__plus" aria-hidden="true">＋</span>
                <label className="remix-track-slot remix-track-slot--b" htmlFor="remix-track-b">
                  <span className="remix-track-slot__deck">DECK B</span>
                  <span className="remix-field-label">BRING IN TRACK</span>
                  <select
                    id="remix-track-b"
                    className="remix-select"
                    value={trackBId}
                    onChange={(event) => setTrackBId(event.target.value)}
                    required
                  >
                    {tracks.map((track) => (
                      <option key={track.id} value={track.id} disabled={track.id === trackAId}>
                        {track.title} — {track.artist}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <button className="remix-empty-track" type="button" onClick={onImportTracks}>
                <span aria-hidden="true">＋</span>
                <span>
                  <strong>{tracks.length === 0 ? 'Your library is waiting' : 'One more track for the mix'}</strong>
                  <small>Import two tracks to start your set</small>
                </span>
                <span aria-hidden="true">↗</span>
              </button>
            )}

            <span className="remix-field-label">PICK THE ROOM'S ENERGY</span>
            <div className="remix-style-grid">
              {REMIX_STYLES.map((style) => (
                <button
                  key={style.id}
                  className={`remix-style remix-style--${style.color} ${selectedStyle === style.id ? 'remix-style--selected' : ''}`}
                  type="button"
                  aria-pressed={selectedStyle === style.id}
                  onClick={() => setSelectedStyle(style.id)}
                >
                  <span className="remix-style__icon" aria-hidden="true">{style.id === 'festival' ? '✳' : style.id === 'techno' ? '◈' : '✦'}</span>
                  <strong>{style.name}</strong>
                  <small>{style.detail}</small>
                </button>
              ))}
            </div>

            <label className="remix-field-label" htmlFor="remix-prompt">
              YOUR CREATIVE DIRECTION <span>OPTIONAL</span>
            </label>
            <textarea
              id="remix-prompt"
              className="remix-prompt"
              value={prompt}
              maxLength={500}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="e.g. Hold the vocal, build tension for 16 bars, then hit a euphoric drop..."
              rows={3}
            />
            <span className="remix-prompt-count">{prompt.length}/500</span>

            <button className="remix-generate" type="submit" disabled={!canGenerate}>
              <span aria-hidden="true">{isGenerating ? '◌' : '✦'}</span>
              {isGenerating ? 'Gemini is mapping your set…' : 'Generate AI mix plan'}
              {!isGenerating && <span aria-hidden="true">→</span>}
            </button>
            <p className="remix-disclaimer">
              Gemini receives track names, artist, BPM/key if known, style, and your direction—not audio files.
              It creates DJ cues, not a rendered song.
            </p>

            {message && (
              <p className={`remix-message ${message.startsWith('AI mix plan') ? 'remix-message--success' : ''}`} role="status">
                {message}
              </p>
            )}
          </form>

          <aside className="remix-shelf" aria-labelledby="remix-shelf-title">
            <div className="remix-shelf__heading">
              <div>
                <span className="remix-eyebrow">AI SET DIRECTION</span>
                <h3 id="remix-shelf-title">Your concert plan</h3>
              </div>
              <span className="remix-shelf__count">{String(mixPlans.length).padStart(2, '0')}</span>
            </div>

            {activePlan ? (
              <article className="remix-plan">
                <div className="remix-plan__tracks">
                  <span className="remix-plan__art remix-plan__art--a">A</span>
                  <span className="remix-plan__connector" aria-hidden="true">↗</span>
                  <span className="remix-plan__art remix-plan__art--b">B</span>
                  <span className="remix-plan__style">{activePlan.style}</span>
                </div>
                <h4>{activePlan.mixTitle}</h4>
                <p className="remix-plan__pair">{activePlan.trackATitle} <span>→</span> {activePlan.trackBTitle}</p>
                <div className="remix-plan__stats">
                  <span><small>TEMPO PLAN</small><strong>{activePlan.targetBpm ? `~${activePlan.targetBpm} BPM` : 'Match by ear'}</strong></span>
                  <span><small>HANDOFF</small><strong>{activePlan.transitionBars ? `${activePlan.transitionBars} bars` : 'DJ cue'}</strong></span>
                </div>
                <div className="remix-plan__arc">
                  <span className="remix-plan__arc-label">THE ENERGY ARC</span>
                  <p>{activePlan.energyArc || activePlan.bpmStrategy}</p>
                </div>
                <div className="remix-plan__transition">
                  <span className="remix-plan__arc-label">THE HANDOFF</span>
                  <p>{activePlan.transition}</p>
                </div>
                <ol className="remix-plan__cues">
                  {activePlan.performanceCues.map((cue, index) => (
                    <li key={`${activePlan.id}-${index}`}><span>{String(index + 1).padStart(2, '0')}</span>{cue}</li>
                  ))}
                </ol>
                <button
                  className="remix-load-pair"
                  type="button"
                  onClick={() => loadPair(activePlan.trackAId, activePlan.trackBId)}
                  disabled={!tracks.some((track) => track.id === activePlan.trackAId) || !tracks.some((track) => track.id === activePlan.trackBId)}
                >
                  Load both tracks to Decks A + B <span aria-hidden="true">↗</span>
                </button>
              </article>
            ) : (
              <div className="remix-shelf__empty">
                <div className="remix-shelf__empty-icon" aria-hidden="true">♫</div>
                <strong>Your next big moment starts here.</strong>
                <p>Choose two tracks and Gemini will map the tempo strategy, handoff, and live performance cues.</p>
                <div className="remix-shelf__sample" aria-hidden="true">
                  <span>✦</span><span>✦</span><span>✦</span>
                </div>
              </div>
            )}

            {mixPlans.length > 1 && (
              <div className="remix-plan-history" aria-label="Recent mix plans">
                <span className="remix-plan-history__label">RECENT SETS</span>
                {mixPlans.slice(1, 4).map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    className="remix-plan-history__item"
                    onClick={() => setActivePlanId(plan.id)}
                  >
                    <span>{plan.mixTitle}</span><small>{plan.createdAt}</small>
                  </button>
                ))}
              </div>
            )}

            <div className="remix-shelf__note">
              <span aria-hidden="true">✦</span>
              <p>AI plans the moment. You mix both tracks live with the decks, EQ, effects, and crossfader.</p>
            </div>
          </aside>
        </div>

        <div className="remix-library">
          <div className="remix-library__heading">
            <div>
              <span className="remix-eyebrow">YOUR LOCAL CRATE</span>
              <h3>Tracks ready for the stage</h3>
            </div>
            <span className="remix-shelf__count">{String(tracks.length).padStart(2, '0')}</span>
          </div>
          {tracks.length > 0 ? (
            <div className="remix-library__list">
              {tracks.map((track) => (
                <div className="remix-library__item" key={track.id}>
                  <span className="remix-library__note" aria-hidden="true">♫</span>
                  <span className="remix-library__track">
                    <strong>{track.title}</strong>
                    <small>{track.artist} · {track.bpm && track.bpm !== '—' ? `~${track.bpm} BPM` : 'BPM will analyze in a deck'}</small>
                  </span>
                  <button
                    type="button"
                    onClick={() => onLoadToDeck(track, 'A')}
                    aria-label={`Load ${track.title} to Deck A`}
                  >
                    Load <span aria-hidden="true">↗</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="remix-library__empty">
              <p>Import your own music to build a two-track mix. The source audio never leaves this device.</p>
              <button type="button" onClick={onImportTracks}>Go to music library <span aria-hidden="true">↗</span></button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default RemixStudio;
