import type { ReactNode } from 'react';

type Props = {
  tone: 'hint' | 'error' | 'info';
  icon: ReactNode;
  title: string;
  text: string;
  children?: ReactNode;
  caption?: string;
};

export function ContextPanel({
  tone,
  icon,
  title,
  text,
  children,
  caption,
}: Props) {
  return (
    <div
      className={`context-panel context-${tone}`}
      role="region"
      aria-label={title}
    >
      <span className="context-panel-icon" aria-hidden="true">
        {icon}
      </span>
      <div className="context-panel-copy">
        <strong>{title}</strong>
        <span
          aria-live={tone === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {text}
        </span>
        {caption && <small className="hint-legend">{caption}</small>}
      </div>
      {children && <div className="context-panel-actions">{children}</div>}
    </div>
  );
}
