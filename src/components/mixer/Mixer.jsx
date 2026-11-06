/* ============================================
   Mixer Component — RESONIX DJ Application
   ============================================
   The central mixer panel that sits between Deck A
   and Deck B. Contains channel faders, EQ controls,
   crossfader, master volume, FX buttons, and a
   record button.
   
   Phase 1: All controls render visually but do not
   process audio. Values are tracked in local state.
   ============================================ */

import './Mixer.css';

function Mixer() {
  return (
    <aside className="mixer">
      <div className="mixer__header">
        <span className="mixer__title">MIXER</span>
      </div>
      <p className="mixer__phase-note">
        Audio mixer, crossfader aur EQ Phase 4–5 mein connect honge.
        Abhi har deck ka volume alag control karein.
      </p>
    </aside>
  );
}

export default Mixer;
