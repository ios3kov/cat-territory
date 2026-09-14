import { Component, type ReactNode } from 'react';
export function LoadingTerritory({ onCancel }: { onCancel?: () => void }) {
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Preparing territory"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onCancel) onCancel();
        if (e.key === 'Tab' && onCancel) e.preventDefault();
      }}
    >
      <section className="modal">
        <h2 role="status">Preparing…</h2>
        <p>Just a moment.</p>
        {onCancel && (
          <button className="primary-button" autoFocus onClick={onCancel}>
            Cancel
          </button>
        )}
      </section>
    </div>
  );
}
export class TerritoryBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="overlay">
        <section className="modal" role="alert">
          <h2>Could not prepare territory</h2>
          <p>Your progress is saved. Please reload to retry.</p>
          <button className="primary-button" onClick={() => location.reload()}>
            Retry
          </button>
        </section>
      </div>
    ) : (
      this.props.children
    );
  }
}
