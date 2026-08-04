import React, { useEffect, useRef, useState } from 'react';
import { subscribeToast } from '../game/toastBus';
import GameIcon from './GameIcon';

const LIFE_MS = 3600;

// Mounted once, at the top of the app (see App.js) — sits above everything,
// including modals, since a reward can happen while a modal is open (a
// gear drop mid-run, a card claimed inside the Weaponsmith). Stacks
// upward; each toast rolls in from the right and slides out the same way
// it came, never just vanishing.
export default function ToastHost() {
  const [items, setItems] = useState([]);
  const timers = useRef({});

  useEffect(() => {
    return subscribeToast((t) => {
      setItems(cur => [...cur.slice(-4), t]); // cap at 5 on screen at once
      timers.current[t.id] = setTimeout(() => {
        setItems(cur => cur.map(x => (x.id === t.id ? { ...x, leaving: true } : x)));
        setTimeout(() => setItems(cur => cur.filter(x => x.id !== t.id)), 320);
      }, LIFE_MS);
    });
  }, []);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  if (!items.length) return null;
  return (
    <div className="toast-host" data-testid="toast-host">
      {items.map(t => (
        <div key={t.id} className={`toast-item t-${t.tone}${t.leaving ? ' leaving' : ''}`} data-testid={`toast-${t.tone}`}>
          <span className="toast-icon">
            {t.icon && (t.icon.length <= 2 ? t.icon : <GameIcon name={t.icon} size={22} />)}
          </span>
          <div className="toast-body">
            <div className="toast-title">{t.title}</div>
            {t.text && <div className="toast-text">{t.text}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
