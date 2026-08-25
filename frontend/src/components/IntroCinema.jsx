import React, { useEffect, useRef, useState } from 'react';
import { IntroCinema as Cinema } from '../game/introCinema';

// The intro film's React shell — a canvas, a skip button, and teardown.
//
// Everything visual lives in `game/introCinema.js`; this file deliberately owns
// nothing but the mount. That split matters here: the old intro
// (`IntroDialogue.jsx`, now deleted) put its entire look in ~344 lines of CSS
// keyed to empty `<span>`s, which meant nothing about it could be driven from
// JS, timed against anything, or reused. Timmy: "ta bort introt helt som finns
// inget ska va från det."
//
// `onDone` keeps the exact contract App.js already expected, so the swap is a
// one-line change there: it fires when the film ends OR when SKIP is pressed,
// and App marks `introSeen` and moves on.
export default function IntroCinema({ onDone }) {
  const canvasRef = useRef(null);
  const cinemaRef = useRef(null);
  const doneRef = useRef(false);
  const [ready, setReady] = useState(false);

  // Guarded so the film can never advance the app twice — the runner reaching
  // its end and an impatient SKIP tap can otherwise both fire.
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone && onDone();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    let cancelled = false;
    const c = new Cinema(canvasRef.current, { onDone: () => finishRef.current() });
    cinemaRef.current = c;
    c.init()
      .then(() => { if (!cancelled) setReady(true); })
      // A WebGL context that will not come up must not strand the player on a
      // black screen — skip straight into the game instead.
      .catch((err) => {
        // Log before bailing. A silent catch here meant ANY error while building
        // the film — a typo in a beat, a bad gradient — skipped the whole intro
        // with no trace, which is indistinguishable from 'the intro is done'.
        // eslint-disable-next-line no-console
        console.error('[IntroCinema] init failed, skipping the film:', err);
        if (!cancelled) finishRef.current();
      });
    return () => {
      cancelled = true;
      cinemaRef.current = null;
      c.destroy();
    };
  }, []);

  return (
    <div className="cine-root" data-testid="intro-cinema">
      <canvas ref={canvasRef} className="cine-canvas" data-testid="intro-cinema-canvas" />
      {!ready && <div className="cine-boot" aria-hidden />}
      <button
        type="button"
        className="cine-skip"
        data-testid="intro-skip"
        onClick={() => { const c = cinemaRef.current; if (c) c.skip(); else finish(); }}
      >
        SKIP ▸
      </button>
    </div>
  );
}
