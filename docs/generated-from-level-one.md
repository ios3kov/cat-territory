# Generated from level one

CAT TERRITORY now uses one deterministic generation pipeline for every puzzle.

## Progression contract

The visible size curve is unchanged:

- levels 1–4: 5×5
- levels 5–10: 6×6
- levels 11–16: 7×7
- levels 17–24: 8×8
- later levels keep the existing 8×8 / 9×9 / 10×10 Endless and Moon Run schedule

The first 24 puzzles are no longer stored as region/solution arrays in the bundle. They are generated from the level index, validated for a single solution, required to be solvable by the logical engine, and cached like later puzzles.

## Compatibility

Level indices, unlocked progress, achievements, settings and the late Endless generator remain unchanged. Existing generated levels at index 24+ keep their `endless-v5-*` IDs and cache keys. Early generated levels use new `generated-v1-*` IDs so an in-progress board from an old curated puzzle cannot be applied to a different generated puzzle by accident.

The legacy `source: 'curated'` value is retained for levels 1–24 only as a presentation marker so the existing Chapter UI stays unchanged; it no longer means the puzzle is hardcoded.

## Runtime

All levels use the same resource/worker/cache path. An uncached first launch may briefly show the existing loading state while level 1 is generated; after generation it is persisted and opens synchronously from cache.
