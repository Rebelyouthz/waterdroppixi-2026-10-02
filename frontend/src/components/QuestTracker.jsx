import React, { useEffect, useRef, useState } from 'react';
import { activeQuests } from '../game/storyQuests';

// =============================================
// QUEST TRACKER — the always-on "what now?" bar
// =============================================
// Two rows, one per track, each showing exactly one open step. The animation
// is the point of the component: when a step completes it does NOT simply
// vanish and get replaced. It ticks its checkbox, strikes itself through,
// holds long enough to be read, and only then does the next step slide up.
// That beat is what makes the chain feel like a chain — a list that silently
// swapped a line would read as the UI glitching, not as progress.
//
// Implementation note on why this keeps its own copy of the step: the payout
// pass (settleProgression) marks a step done and advances the track in the
// same tick, so by the time this re-renders the completed step is already
// gone from `activeQuests`. Holding the outgoing step locally for the
// duration of the animation is what lets us show a thing the save no longer
// reports.

const HOLD_MS = 1500;   // strike-through dwell before the next step slides up
const SLIDE_MS = 380;

function QuestRow({ q, outgoing, onGo }) {
  const done = !!outgoing;
  return (
    <div
      className={`qt-row${done ? ' qt-done' : ''}${q.ready && !done ? ' qt-ready' : ''}`}
      style={{ '--qt-color': q.trackColor }}
      data-testid={`quest-row-${q.track}`}
      onClick={() => !done && onGo && onGo(q)}
      role={done ? undefined : 'button'}
      tabIndex={done ? -1 : 0}
      onKeyDown={(e) => { if (!done && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onGo && onGo(q); } }}
    >
      <span className={`qt-check${done ? ' checked' : ''}`} aria-hidden="true">
        <svg viewBox="0 0 20 20" width="14" height="14">
          <path d="M4 10.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" className="qt-tick" />
        </svg>
      </span>
      <span className="qt-icon">{q.icon}</span>
      <span className="qt-body">
        <span className="qt-track">{q.trackName}</span>
        <span className="qt-goal">{q.goal}</span>
        {!done && q.why && <span className="qt-why">{q.why}</span>}
      </span>
      {!done && <span className="qt-go" aria-hidden="true">▸</span>}
    </div>
  );
}

export default function QuestTracker({ save, onGo, compact = false, className = '' }) {
  const live = activeQuests(save);
  // Tapping a step opens a detail sheet first instead of firing you straight
  // into a run. On a phone the rows are thumb-sized and sit right where you
  // scroll, so a direct-navigate row meant brushing past one could drop you
  // into a mission you never chose.
  const [detail, setDetail] = useState(null);
  // { [trackId]: quest } for steps that just completed and are still playing
  // their strike-through.
  const [outgoing, setOutgoing] = useState({});
  const prevRef = useRef({});
  const timers = useRef({});

  useEffect(() => {
    const prev = prevRef.current;
    const next = {};
    for (const q of live) next[q.track] = q;

    for (const track of Object.keys(prev)) {
      const was = prev[track];
      const now = next[track];
      // A track whose step CHANGED (or ran out) is a step that completed.
      if (was && (!now || now.id !== was.id)) {
        setOutgoing(o => ({ ...o, [track]: was }));
        clearTimeout(timers.current[track]);
        timers.current[track] = setTimeout(() => {
          setOutgoing(o => { const c = { ...o }; delete c[track]; return c; });
        }, HOLD_MS + SLIDE_MS);
      }
    }
    prevRef.current = next;
  }, [live.map(q => q.id).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  const rows = [];
  for (const q of live) {
    const out = outgoing[q.track];
    // While a completed step is holding, show IT and keep the replacement
    // queued behind — otherwise the new step would appear above the old one
    // and both would be on screen claiming to be the current objective.
    if (out) rows.push({ key: out.id, q: out, outgoing: true });
    else rows.push({ key: q.id, q, outgoing: false });
  }
  // A track that has run out of steps entirely still shows its final tick.
  for (const [track, out] of Object.entries(outgoing)) {
    if (!rows.some(r => r.q.track === track)) rows.push({ key: out.id, q: out, outgoing: true });
  }

  if (!rows.length) return null;

  return (
    <>
      <div className={`quest-tracker${compact ? ' qt-compact' : ''} ${className}`} data-testid="quest-tracker">
        {rows.map(r => (
          <QuestRow key={r.key} q={r.q} outgoing={r.outgoing} onGo={setDetail} />
        ))}
      </div>
      {detail && (
        <div className="modal-overlay qt-sheet-overlay" data-testid="quest-detail"
          onClick={(e) => { if (e.target.classList.contains('modal-overlay')) setDetail(null); }}>
          <div className="qt-sheet" style={{ '--qt-color': detail.trackColor }}>
            <div className="qt-sheet-track">{detail.trackName}</div>
            <div className="qt-sheet-head">
              <span className="qt-sheet-icon">{detail.icon}</span>
              <h3>{detail.title}</h3>
            </div>
            <div className="qt-sheet-goal">{detail.goal}</div>
            {detail.why && <p className="qt-sheet-why">{detail.why}</p>}
            {!!detail.rwd && (
              <div className="qt-sheet-rwd">
                <span className="qt-sheet-rwd-lbl">REWARD</span>
                {Object.entries(detail.rwd).map(([k, v]) => (
                  <span key={k} className="qt-sheet-rwd-item">
                    {({ gold: '★', sp: '◆', gems: '💎', gearParts: '🔩', talentPoints: '🌿',
                       petFood: '🍖', slotCoins: '🎰', gachaTokens: '🎫', flux: '🜁' })[k] || ''} {v}
                  </span>
                ))}
              </div>
            )}
            <div className="qt-sheet-actions">
              <button className="qt-sheet-back" onClick={() => setDetail(null)}>◂ BACK</button>
              <button className="qt-sheet-go" data-testid="quest-detail-go"
                onClick={() => { const g = detail.go; setDetail(null); onGo && onGo(g); }}>
                TAKE ME THERE ▸
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
