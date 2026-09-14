import { getCatOrder } from "./catOrder";
import { memo, useMemo } from "react";
import {
  REGION_COLORS,
  getRegionColorMap,
  type CellState,
  type Level,
} from "./game";
type Props = { board: CellState[]; level: Level };
type PawProps = { color?: string; side: "left" | "right" };
function Paw({ color, side }: PawProps) {
  return (
    <svg
      className={`paw-progress-icon paw-${side} ${color ? "filled" : ""}`.trim()}
      viewBox="0 0 20 20"
      style={color ? { color } : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="5.1" cy="5.2" r="2.1" />
      <circle cx="9.3" cy="3.7" r="2" />
      <circle cx="13.8" cy="5.1" r="2.1" />
      <circle cx="16" cy="8.7" r="1.8" />
      <path d="M5.1 12.9c.2-3 2.4-5.2 5.2-5.2 3 0 5.2 2.3 5.2 5.4 0 2.4-1.8 3.7-3.9 3.7-1.1 0-1.9-.4-2.7-.4-.8 0-1.6.4-2.6.4-2.1 0-3.4-1.5-3.1-3.9Z" />
    </svg>
  );
}
function CatProgressView({ board, level }: Props) {
  const map = useMemo(() => getRegionColorMap(level.regions), [level.regions]);
  const regionIds = useMemo(
    () => Array.from(new Set(level.regions.flat())).sort((a, b) => a - b),
    [level.regions],
  );
  const filledRegions = useMemo(() => {
    const result: number[] = [];
    for (const index of getCatOrder(board)) {
      const row = Math.floor(index / level.size),
        col = index % level.size,
        region = level.regions[row]?.[col];
      if (
        region !== undefined &&
        level.solution[row] === col &&
        !result.includes(region)
      )
        result.push(region);
    }
    return result;
  }, [board, level]);
  return (
    <span
      className="cat-progress"
      role="img"
      aria-label={`${filledRegions.length} of ${regionIds.length} cats placed`}
    >
      {regionIds.map((_, index) => (
        <Paw
          color={
            index < filledRegions.length
              ? (map[filledRegions[index]] ??
                REGION_COLORS[filledRegions[index] % REGION_COLORS.length])
              : undefined
          }
          side={index % 2 === 0 ? "left" : "right"}
          key={index}
        />
      ))}
    </span>
  );
}

export const CatProgress = memo(CatProgressView);
