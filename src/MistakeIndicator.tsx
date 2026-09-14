type Props = { count: number; total?: number };
function Scratch({ active }: { active: boolean }) {
  return (
    <svg
      className={`mistake-scratch ${active ? 'active' : ''}`}
      viewBox="0 0 18 20"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.6 3.5 2.6 15.8" />
      <path d="M9.1 2.4 7.2 16.8" />
      <path d="M13.7 3.5 11.8 15.8" />
    </svg>
  );
}
export function MistakeIndicator({ count, total = 3 }: Props) {
  const safeCount = Math.max(0, Math.min(total, count));
  return (
    <span
      className={`mistake-indicator ${safeCount === total ? 'at-limit' : ''}`}
      role="img"
      aria-label={`${safeCount} of ${total} mistakes`}
    >
      {Array.from({ length: total }, (_, index) => (
        <Scratch active={index < safeCount} key={index} />
      ))}
    </span>
  );
}
