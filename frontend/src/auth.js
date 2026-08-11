// Auth + entitlement context — Google login via Emergent + Stripe paywall status.
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';
const AuthCtx = createContext(null);

// LOCAL_MODE: no backend configured (typical local `npm start` dev setup) —
// skip Google/Emergent OAuth and the Stripe paywall entirely so the game is
// always "logged in" and "paid" offline. Untouched when REACT_APP_BACKEND_URL
// is set (e.g. a real deploy), so the real auth/payment flow still works there.
const LOCAL_MODE = !process.env.REACT_APP_BACKEND_URL;
// `user_id` mirrors the real entitlement payload's shape — anything reading
// the signed-in identity (the leaderboard placement lookup, for one) must not
// behave differently in local mode just because a field is missing.
const LOCAL_USER = { user_id: 'local', name: 'Local Player', email: 'local@dev', picture: null };

// Configure axios to send cookies
axios.defaults.withCredentials = true;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(LOCAL_MODE ? LOCAL_USER : null);
  const [paid, setPaid] = useState(LOCAL_MODE);
  const [price, setPrice] = useState(1.99);
  const [loading, setLoading] = useState(!LOCAL_MODE);

  const refresh = useCallback(async () => {
    if (LOCAL_MODE) return;
    try {
      const r = await axios.get(`${API}/entitlement`);
      setUser(r.data.user || null);
      setPaid(!!r.data.paid);
      setPrice(r.data.price_usd || 1.99);
    } catch (e) {
      setUser(null);
      setPaid(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (LOCAL_MODE) return;
    // CRITICAL: If returning from OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash && window.location.hash.indexOf('session_id=') !== -1) {
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh]);

  const login = () => {
    if (LOCAL_MODE) return; // already "logged in" locally, nothing to do
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const logout = async () => {
    if (LOCAL_MODE) return; // no real session to end locally
    try { await axios.post(`${API}/auth/logout`); } catch (e) { console.error('logout', e); }
    setUser(null); setPaid(false);
  };

  return (
    <AuthCtx.Provider value={{ user, paid, price, loading, refresh, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

// Component that detects ?stripe_session_id=... after Stripe returns,
// polls /api/payment/status, then refreshes entitlement.
export function StripeReturnHandler({ children }) {
  const { refresh } = useAuth();
  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState('');

  useEffect(() => {
    if (LOCAL_MODE) return; // no Stripe session to poll for offline
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('stripe_session_id');
    const cancelled = params.get('stripe_cancelled');
    if (cancelled) {
      setPollMsg('Payment cancelled.');
      const url = new URL(window.location.href); url.searchParams.delete('stripe_cancelled');
      window.history.replaceState({}, '', url.toString());
      setTimeout(() => setPollMsg(''), 2500);
      return;
    }
    if (!sid) return;
    setPolling(true);
    setPollMsg('Verifying your purchase…');

    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      if (attempts > 8) {
        setPollMsg('Verification took too long. Please refresh.');
        setPolling(false);
        return;
      }
      try {
        const r = await axios.get(`${API}/payment/status/${sid}`);
        if (r.data.payment_status === 'paid') {
          setPollMsg('Purchase confirmed! Unlocking…');
          await refresh();
          // Clear URL
          const url = new URL(window.location.href); url.searchParams.delete('stripe_session_id');
          window.history.replaceState({}, '', url.toString());
          setTimeout(() => { setPolling(false); setPollMsg(''); }, 1200);
          return;
        }
        if (r.data.status === 'expired') {
          setPollMsg('Payment expired.');
          setPolling(false);
          return;
        }
        setTimeout(tick, 2000);
      } catch (e) {
        console.error('poll payment', e);
        setTimeout(tick, 2000);
      }
    };
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {children}
      {(polling || pollMsg) && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="menu" style={{ maxWidth: 380, textAlign: 'center', padding: 28 }} data-testid="stripe-poll">
            <div className="title" style={{ fontSize: 22 }}>UNLOCK</div>
            <div style={{ margin: '14px 0', fontFamily: 'VT323, monospace', fontSize: 18 }}>{pollMsg}</div>
            {polling && <div style={{ height: 6, background: '#222', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: '70%', height: '100%', background: 'var(--accent-2)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            </div>}
          </div>
        </div>
      )}
    </>
  );
}

// Component that detects #session_id=... in URL fragment after Google OAuth,
// posts it to backend to exchange for a session, then strips the fragment.
export function AuthCallback() {
  const { refresh } = useAuth();
  const [status, setStatus] = useState('Signing you in…');
  const hasProcessed = React.useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    if (LOCAL_MODE) { window.location.replace('/'); return; }

    const hash = window.location.hash || '';
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      setStatus('Invalid login link.');
      return;
    }
    const sid = decodeURIComponent(m[1]);
    (async () => {
      try {
        await axios.post(`${API}/auth/session`, { session_id: sid });
        await refresh();
        // Remove the fragment, navigate to root
        window.history.replaceState({}, '', window.location.origin + '/');
        // Reload to reset all React state cleanly
        window.location.replace('/');
      } catch (e) {
        console.error('auth exchange', e);
        setStatus('Login failed. Please try again.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-shell">
      <div className="menu" style={{ maxWidth: 380, textAlign: 'center', padding: 28 }} data-testid="auth-callback">
        <div className="title">WATERDROP SURVIVOR</div>
        <div style={{ margin: '14px 0', fontFamily: 'VT323, monospace', fontSize: 18 }}>{status}</div>
      </div>
    </div>
  );
}

// Lightweight axios helper for components that don't need the context
export { API, axios };
