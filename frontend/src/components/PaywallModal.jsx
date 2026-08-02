import React, { useState } from 'react';
import { useAuth, API, axios } from '../auth';

// Blocks gameplay until user has paid. Shown when entitlement.paid === false.
export default function PaywallModal({ onClose }) {
  const { user, price, login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const buy = async () => {
    setBusy(true); setErr('');
    try {
      const r = await axios.post(`${API}/payment/checkout`, { origin_url: window.location.origin });
      if (r.data.already_paid) {
        window.location.reload();
        return;
      }
      if (r.data.url) {
        window.location.href = r.data.url;
      } else {
        setErr('Could not start checkout.');
        setBusy(false);
      }
    } catch (e) {
      setErr(e.response?.data?.detail || 'Checkout failed.');
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" data-testid="paywall-modal" style={{ zIndex: 9000 }}>
      <div className="menu paywall-card" style={{ maxWidth: 460, padding: 28, textAlign: 'center' }}>
        <div className="title" style={{ fontSize: 30 }}>UNLOCK THE LAKE</div>
        <div className="subtitle" style={{ marginBottom: 8 }}>A ONE-TIME GIFT TO THE COLLECTIVE</div>
        <div style={{ fontFamily: 'VT323, monospace', fontSize: 18, color: 'var(--ink-dim)', margin: '14px 0 18px', lineHeight: 1.45 }}>
          Pay once, play forever.<br />
          <span style={{ color: '#4dffd4' }}>NO ads · NO microtransactions · NO pay-to-win</span><br />
          Just the full game and every future update.
        </div>

        <div className="paywall-price" data-testid="paywall-price">
          <span className="paywall-currency">$</span>
          <span className="paywall-num">{price.toFixed(2)}</span>
          <span className="paywall-once">/ one-time</span>
        </div>

        {!user ? (
          <>
            <div style={{ fontFamily: 'VT323, monospace', fontSize: 15, color: '#ffd166', margin: '14px 0 10px' }}>
              Sign in with Google so your purchase is saved to your account.
            </div>
            <button onClick={login} data-testid="paywall-login" style={{ width: '100%', marginTop: 4 }}>
              ▸ SIGN IN WITH GOOGLE
            </button>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'VT323, monospace', fontSize: 14, color: '#bff0ff', margin: '14px 0 4px' }}>
              Signed in as <b>{user.name || user.email}</b>
            </div>
            <button
              onClick={buy}
              disabled={busy}
              data-testid="paywall-buy"
              style={{ width: '100%', marginTop: 10, borderColor: '#4dffd4', boxShadow: 'var(--pixel-edge), 0 6px 0 #000, 0 0 26px #4dffd466' }}
            >
              {busy ? 'OPENING CHECKOUT…' : `▸ BUY NOW — $${price.toFixed(2)}`}
            </button>
          </>
        )}
        {err && <div style={{ color: '#ff6675', marginTop: 10, fontFamily: 'VT323, monospace' }}>{err}</div>}

        {onClose && (
          <button onClick={onClose} className="paywall-close" data-testid="paywall-close" style={{ marginTop: 14, background: 'transparent', borderColor: '#333' }}>
            ↩ Back
          </button>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: '#666', fontFamily: 'VT323, monospace', letterSpacing: '0.1em' }}>
          Secure payment by Stripe · Test mode card: 4242 4242 4242 4242
        </div>
      </div>
    </div>
  );
}
