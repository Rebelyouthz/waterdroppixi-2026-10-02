import React, { useEffect, useRef, useState } from 'react';
import { AIDA_INTRO } from '../game/data_ext';
import { Audio } from '../game/audio';
import HeroFigure from './HeroFigure';

/* The opening.
 *
 * It used to be a talking head reciting plot at you. Now there is no narrator:
 * the drop thinks, and each line has its own visual beat behind it, so the
 * scene moves instead of a portrait blinking through four paragraphs.
 *
 * Everything here is CSS and SVG. The intro must run BEFORE the game canvas
 * exists — that is the whole point, it covers the load — so it cannot use
 * anything the renderer owns.
 */

// One scene per `emote` in AIDA_INTRO. Kept as a lookup rather than a switch
// inside render so an unknown beat degrades to the plain starfield instead of
// throwing during the first thing the player ever sees.
function Scene({ beat, bandColor }) {
  return (
    <div className={`intro-scene beat-${beat}`} aria-hidden>
      {/* Deep space, back to front. Everything here is CSS gradients and
          transforms — the intro covers the canvas load, so it cannot depend on
          an asset request completing or on anything the renderer owns. */}
      <span className="intro-nebula n1" />
      <span className="intro-nebula n2" />
      <span className="intro-nebula n3" />
      <span className="intro-galaxy" />
      <span className="intro-planet" />
      <span className="intro-planet-ring" />

      {/* Starfield: four parallax layers. The nearest twinkles; the far ones
          only drift, because everything twinkling at once reads as noise. */}
      <span className="intro-stars s1" />
      <span className="intro-stars s2" />
      <span className="intro-stars s3" />
      <span className="intro-stars s4" />
      <span className="intro-dust" />

      {/* Two shooting stars on long, offset, prime-ish delays so they never
          fall in step and never quite repeat while a line is being read. */}
      <span className="intro-shoot a" />
      <span className="intro-shoot b" />

      {/* The lake, far behind — a horizon that catches fire on cue. */}
      <span className="intro-lake" />
      <span className="intro-lake-fire" />

      {/* The drop itself.
          This used to be its own drawing: a symmetric blue blob with a
          DIFFERENT body curve, its own eye coordinates, no cigar and no
          headband. So the scene that introduces the character was the one
          place that did not show him. It renders the shared figure now, which
          is also what gets him the cigar and the rarity-coloured bandage
          without this file having to know anything about either. */}
      <HeroFigure className="intro-drop" rarColor={bandColor} bandColor={bandColor} />

      {/* Ember drift for the burning beat. */}
      <span className="intro-embers" />
    </div>
  );
}

// `rarColor` is the character's rarity colour, so the drop the player meets in
// the opening is already wearing the bandage they will see everywhere else.
// Defaulted rather than required: the intro must survive being rendered before
// anything has loaded a save.
export default function IntroDialogue({ onDone, rarColor = '#9a8fa6' }) {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const line = AIDA_INTRO[idx];
  const doneRef = useRef(false);

  useEffect(() => {
    setTyped('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(line.text.slice(0, i));
      // A soft tick per few characters. Every character would be a machine gun.
      if (i % 3 === 0) { try { Audio.uiTick && Audio.uiTick(); } catch (e) { /* optional */ } }
      if (i >= line.text.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, [idx, line.text]);

  const next = () => {
    if (doneRef.current) return;
    if (typed.length < line.text.length) { setTyped(line.text); return; }
    if (idx + 1 < AIDA_INTRO.length) setIdx(idx + 1);
    else { doneRef.current = true; onDone(); }
  };

  // Skip should always be reachable. Being trapped in an unskippable intro is
  // the single most annoying thing an opening can do, and it is worse on a
  // reload than on the first play.
  const skip = (e) => {
    e.stopPropagation();
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  return (
    <div className="intro-overlay intro-v2" onClick={next} data-testid="intro-dialogue">
      <Scene beat={line.emote} bandColor={rarColor} />

      <div className="intro-copy">
        {line.who ? <div className="intro-name">{line.who}</div> : null}
        <div className="intro-text">
          {typed}
          <span className="intro-caret">▌</span>
        </div>
      </div>

      <button className="intro-skipbtn" onClick={skip} data-testid="intro-skip">SKIP ▸</button>
      <div className="intro-progress" aria-hidden>
        {AIDA_INTRO.map((_, i) => (
          <span key={i} className={`intro-pip${i <= idx ? ' on' : ''}`} />
        ))}
      </div>
    </div>
  );
}
