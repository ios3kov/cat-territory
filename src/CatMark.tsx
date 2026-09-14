type Props = {
  className?: string;
  happy?: boolean;
};

export function CatMark({ className = '', happy = false }: Props) {
  return (
    <svg
      className={`cat-mark ${className}`.trim()}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g className="cat-idle-body">
        <path
          className="cat-mark-fill"
          d="M13 25 10 10l15 8c2-.6 4.4-1 7-1s5 .4 7 1l15-8-3 15c4.2 4.2 6.5 9.8 6.5 16.2C57.5 52.6 47.4 59 32 59S6.5 52.6 6.5 41.2C6.5 34.8 8.8 29.2 13 25Z"
        />
        <path
          className="cat-mark-line cat-ear-line cat-ear-left"
          d="m14.5 15.5 8.2 4.4"
        />
        <path
          className="cat-mark-line cat-ear-line cat-ear-right"
          d="M49.5 15.5l-8.2 4.4"
        />
        <g className="cat-eye-look">
          <g className="cat-mark-eyes">
            <path
              className="cat-mark-line cat-eye cat-eye-left"
              d="M21.5 36.5h.1"
            />
            <path
              className="cat-mark-line cat-eye cat-eye-right"
              d="M42.4 36.5h.1"
            />
          </g>
        </g>
        <path className="cat-mark-nose" d="M29 42.2h6L32 45l-3-2.8Z" />
        {happy ? (
          <path
            className="cat-mark-line cat-mouth"
            d="M23.5 47c2 3.3 4.8 5 8.5 5s6.5-1.7 8.5-5"
          />
        ) : (
          <path
            className="cat-mark-line cat-mouth"
            d="M25 48c2.1 1.5 4.4 2.2 7 2.2s4.9-.7 7-2.2"
          />
        )}
        <path
          className="cat-mark-whisker cat-whisker-left"
          d="M19 43 8 40M19 47 7 48"
        />
        <path
          className="cat-mark-whisker cat-whisker-right"
          d="M45 43l11-3M45 47l12 1"
        />
      </g>
    </svg>
  );
}
