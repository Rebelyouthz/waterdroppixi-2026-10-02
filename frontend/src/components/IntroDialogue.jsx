import React, { useEffect, useState } from 'react';
import { AIDA_INTRO } from '../game/data_ext';

export default function IntroDialogue({ onDone }) {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const line = AIDA_INTRO[idx];

  useEffect(() => {
    setTyped('');
    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(line.text.slice(0, i));
      if (i >= line.text.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [idx, line.text]);

  const next = () => {
    if (typed.length < line.text.length) { setTyped(line.text); return; }
    if (idx + 1 < AIDA_INTRO.length) setIdx(idx + 1);
    else onDone();
  };

  return (
    <div className="intro-overlay" onClick={next} data-testid="intro-dialogue">
      <div className="intro-aida">{line.emote}</div>
      <div className="intro-name">{line.who}</div>
      <div className="intro-text">{typed}<span className="intro-caret">▌</span></div>
      <div className="intro-skip">tap / click to continue · {idx + 1}/{AIDA_INTRO.length}</div>
    </div>
  );
}
