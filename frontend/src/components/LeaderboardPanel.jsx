import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

const fmtTime = (t) => {
  const m = Math.floor((t || 0) / 60);
  const s = Math.floor((t || 0) % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export default function LeaderboardPanel() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [sortBy, setSortBy] = useState('time');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await axios.get(`${API}/leaderboard?limit=50&sort_by=${sortBy}`, { withCredentials: true });
        if (mounted) setRows(r.data);
      } catch (e) {
        if (mounted) setErr('Could not load leaderboard.');
      }
    })();
    return () => { mounted = false; };
  }, [sortBy]);

  return (
    <div className="lb-wrap" data-testid="leaderboard-panel">
      <div className="lb-head">
        <div className="panel-title" style={{ flex: 1 }}>LEADERBOARD</div>
        <div className="lb-tabs">
          {['time', 'kills', 'level'].map(k => (
            <button
              key={k}
              className={`lb-tab ${sortBy === k ? 'active' : ''}`}
              onClick={() => setSortBy(k)}
              data-testid={`lb-tab-${k}`}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {err && <div className="lb-empty">{err}</div>}
      {!err && !rows && <div className="lb-empty">Loading…</div>}
      {!err && rows && rows.length === 0 && (
        <div className="lb-empty">No runs yet — be the first to claim a spot!</div>
      )}
      {!err && rows && rows.length > 0 && (
        <div className="lb-list">
          {rows.map((r, i) => (
            <div key={r.id || i} className={`lb-row ${i < 3 ? 'lb-top' : ''}`} data-testid={`lb-row-${i}`}>
              <div className="lb-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
              {r.picture
                ? <img src={r.picture} alt="" className="lb-avatar" />
                : <div className="lb-avatar lb-avatar-fb">💧</div>}
              <div className="lb-name">
                {r.name || 'Anonymous'}
                <div className="lb-meta">
                  {r.victory && <span className="lb-badge lb-badge-gold">VICTORY</span>}
                  {r.no_hit && <span className="lb-badge lb-badge-cyan">NO-HIT</span>}
                </div>
              </div>
              <div className="lb-stat"><span>TIME</span><b>{fmtTime(r.time)}</b></div>
              <div className="lb-stat"><span>LVL</span><b>{r.level || 1}</b></div>
              <div className="lb-stat"><span>KILLS</span><b>{r.kills || 0}</b></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
