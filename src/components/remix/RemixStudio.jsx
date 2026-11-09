import { useState } from 'react';
import './RemixStudio.css';

const REMIX_STYLES = [
  { id: 'festival', name: 'Festival House', detail: 'Big drops · 128 BPM', color: 'violet' },
  { id: 'techno', name: 'Afterhours Techno', detail: 'Deep grooves · 132 BPM', color: 'blue' },
  { id: 'disco', name: 'Neon Disco', detail: 'Funky bass · disco edits', color: 'pink' },
];

const STAGE_BARS = [24, 42, 30, 58, 36, 74, 46, 88, 52, 70, 38, 96, 56, 78, 42, 65, 34, 84, 48, 68, 32, 90, 50, 72, 40, 60, 28, 80, 46, 94, 54, 72];

function RemixStudio({ tracks, onLoadToDeck, onImportTracks }) {
  const [selectedTrackId, setSelectedTrackId] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(REMIX_STYLES[0].id);
  const [prompt, setPrompt] = useState('');
  const [remixBriefs, setRemixBriefs] = useState([]);
  const [message, setMessage] = useState('');

  const selectedTrack = tracks.find((track) => track.id === selectedTrackId);

  const createRemixBrief = (event) => {
    event.preventDefault();
    if (!selectedTrack) {
      setMessage('Add a track to your library before creating a remix concept.');
      return;
    }

    const style = REMIX_STYLES.find((item) => item.id === selectedStyle);
    const brief = {
      id: crypto.randomUUID(),
      trackId: selectedTrack.id,
      trackTitle: selectedTrack.title,
      style: style.name,
      prompt: prompt.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setRemixBriefs((current) => [brief, ...current]);
    setPrompt('');
    setMessage('Remix concept added to your shelf.');
  };

  return (
    <section className="remix-studio" id="remix" aria-labelledby="remix-title">
      <div className="remix-stage">
        <div className="remix-stage__lights" aria-hidden="true" />
        <div className="remix-stage__topline">
          <span className="remix-stage__live"><span /> REMIX STAGE</span>
          <span className="remix-stage__edition">RESONIX / AI LAB</span>
        </div>
        <div className="remix-stage__content">
          <div className="remix-stage__copy">
            <p className="remix-stage__eyebrow">YOUR SOUND. YOUR CROWD.</p>
            <h1 id="remix-title">Make the room<br /><span>move.</span></h1>
            <p className="remix-stage__description">
              Pick a track, choose your energy, and shape a remix concept for your next set.
            </p>
            <a className="remix-stage__cta" href="#remix-create">
              Build your remix <span aria-hidden="true">↗</span>
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
          <span>01 — PICK YOUR TRACK</span>
          <span>02 — SET THE VIBE</span>
          <span>03 — MAKE IT YOURS</span>
        </div>
      </div>

      <div className="remix-content">
        <div className="remix-section-heading">
          <div>
            <span className="remix-eyebrow">YOUR CREATIVE PLAYGROUND</span>
            <h2>Remix your set</h2>
          </div>
          <span className="remix-session-tag"><span /> LOCAL SESSION</span>
        </div>

        <div className="remix-layout">
          <form className="remix-create" id="remix-create" onSubmit={createRemixBrief}>
            <div className="remix-create__heading">
              <span className="remix-create__number">01</span>
              <div>
                <h3>Create a remix</h3>
                <p>Start with a track and give it a new direction.</p>
              </div>
            </div>

            <label className="remix-field-label" htmlFor="remix-track">SOURCE TRACK</label>
            {tracks.length > 0 ? (
              <select
                id="remix-track"
                className="remix-select"
                value={selectedTrackId}
                onChange={(event) => setSelectedTrackId(event.target.value)}
                required
              >
                <option value="" disabled>Choose from your music library</option>
                {tracks.map((track) => (
                  <option key={track.id} value={track.id}>{track.title} — {track.artist}</option>
                ))}
              </select>
            ) : (
              <button className="remix-empty-track" type="button" onClick={onImportTracks}>
                <span aria-hidden="true">＋</span>
                <span><strong>Your library is waiting</strong><small>Import a track to get started</small></span>
                <span aria-hidden="true">↗</span>
              </button>
            )}

            <span className="remix-field-label">CHOOSE YOUR STAGE</span>
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

            <label className="remix-field-label" htmlFor="remix-prompt">YOUR CREATIVE DIRECTION <span>OPTIONAL</span></label>
            <textarea
              id="remix-prompt"
              className="remix-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="e.g. Build a euphoric late-night drop with a punchy bassline..."
              rows={3}
            />

            <button className="remix-generate" type="submit" disabled={tracks.length === 0}>
              <span aria-hidden="true">✦</span> Create remix concept <span aria-hidden="true">→</span>
            </button>
            <p className="remix-disclaimer">
              AI audio rendering isn’t connected yet. This creates a local remix brief, not playable audio.
            </p>
            {message && <p className="remix-message" role="status">{message}</p>}
          </form>

          <aside className="remix-shelf" aria-labelledby="remix-shelf-title">
            <div className="remix-library">
              <div className="remix-library__heading">
                <div>
                  <span className="remix-eyebrow">ALREADY MADE</span>
                  <h3>Your remixes &amp; tracks</h3>
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
                        <small>{track.artist} · In your library</small>
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
                  <p>Finished remixes stay with your local music. Import them to find and play them here.</p>
                  <button type="button" onClick={onImportTracks}>Go to music library <span aria-hidden="true">↗</span></button>
                </div>
              )}
            </div>
            <div className="remix-shelf__heading">
              <div>
                <span className="remix-eyebrow">SAVED THIS SESSION</span>
                <h3 id="remix-shelf-title">Your remix shelf</h3>
              </div>
              <span className="remix-shelf__count">{String(remixBriefs.length).padStart(2, '0')}</span>
            </div>

            {remixBriefs.length === 0 ? (
              <div className="remix-shelf__empty">
                <div className="remix-shelf__empty-icon" aria-hidden="true">♫</div>
                <strong>Your next big moment starts here.</strong>
                <p>Create a remix concept and it’ll show up on your shelf.</p>
                <div className="remix-shelf__sample" aria-hidden="true">
                  <span>✦</span><span>✦</span><span>✦</span>
                </div>
              </div>
            ) : (
              <div className="remix-shelf__list">
                {remixBriefs.map((brief, index) => {
                  const sourceTrack = tracks.find((track) => track.id === brief.trackId);
                  return (
                    <article className="remix-card" key={brief.id}>
                      <div className={`remix-card__art remix-card__art--${index % 3}`}>
                        <span aria-hidden="true">♫</span>
                        <div className="remix-card__art-bars" aria-hidden="true">
                          {STAGE_BARS.slice(index, index + 12).map((height, barIndex) => (
                            <i key={barIndex} style={{ height: `${height}%` }} />
                          ))}
                        </div>
                      </div>
                      <div className="remix-card__info">
                        <strong>{brief.trackTitle}</strong>
                        <span>{brief.style} · Concept</span>
                        {brief.prompt && <small>{brief.prompt}</small>}
                      </div>
                      <span className="remix-card__time">{brief.createdAt}</span>
                      {sourceTrack && (
                        <button
                          className="remix-card__load"
                          type="button"
                          onClick={() => onLoadToDeck(sourceTrack, 'A')}
                          aria-label={`Load ${brief.trackTitle} to Deck A`}
                          title="Load source track to Deck A"
                        >
                          ↗
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            <div className="remix-shelf__note">
              <span aria-hidden="true">✦</span>
              <p>Remix concepts are saved for this session. Imported music stays on this device.</p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default RemixStudio;
