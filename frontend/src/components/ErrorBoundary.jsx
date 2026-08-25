import React from 'react';

// =============================================
// ERROR BOUNDARY — the app's last line of defence
// =============================================
// Until 2026-08-17 there was no error boundary anywhere in this app. That
// is not a theoretical gap: React unmounts the ENTIRE tree when a render
// throws, so one bad value in one panel took the whole game to a blank
// black screen — no message, no way back, and no clue what happened. It
// bit us for real once (a Skill Tree wheel-zoom race, fixed separately)
// and it bit Timmy again when a hot reload caught a half-finished edit.
//
// A blank screen is the worst possible failure for someone who cannot read
// a stack trace. This gives him three things instead:
//   · a plain statement that the game hit an error, not a dead screen
//   · a RELOAD button, which fixes the overwhelming majority of cases
//     (stale hot-reload bundle, transient state)
//   · the actual error text, collapsed, so he can screenshot it — his
//     screenshots have consistently been the fastest diagnostic here
//
// Crucially it does NOT clear localStorage or touch the save. A crash must
// never cost progress: in local mode `wds.save.v1` IS the save, not a cache.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    // Keep it in the console too — devtools is still the fastest route
    // once someone is actually looking at them.
    console.error('[Waterdrop] render error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { error, info } = this.state;
    const detail = [
      String(error?.stack || error?.message || error),
      info?.componentStack ? `\nComponent stack:${info.componentStack}` : '',
    ].join('');

    return (
      <div className="eb-shell">
        <div className="eb-card">
          <div className="eb-title">SOMETHING BROKE</div>
          <p className="eb-copy">
            The game hit an error and stopped drawing. <strong>Your save is
            untouched</strong> — nothing was lost.
          </p>
          <p className="eb-copy">Reloading fixes this almost every time.</p>
          <button className="eb-btn" onClick={() => window.location.reload()}>
            RELOAD THE GAME
          </button>
          <details className="eb-details">
            <summary>What went wrong (screenshot this)</summary>
            <pre className="eb-pre">{detail}</pre>
          </details>
        </div>
      </div>
    );
  }
}
