# Architecture

```text
React dashboard / explorer / lab / comparison / benchmark / history
                   │ HTTP JSON
                   ▼
FastAPI validation → registry → deterministic algorithm runner
                                      │
                  result + metrics + replayable state snapshots
                                      │
        React state visualizers       └── SQLite experiment / benchmark rows
```

## Frontend

- React and TypeScript, built with Vite.
- `App.tsx` owns client-side page selection, responsive sidebar navigation, global algorithm search, and loading of the live algorithm registry. API errors render a retry state; no local mock catalogue is substituted.
- `OverviewDashboard.tsx` displays registry-derived algorithm and category counts plus persisted experiment and benchmark summaries. `Dashboard.tsx` is the searchable explorer with category and implementation-status filters.
- `AlgorithmLab.tsx` owns input, request, trace position, playback and save state. Input edits and algorithm changes clear the prior trace. While a run is pending, its input is locked so a stale response cannot be shown against edited data.
- `StepVisualizer.tsx` renders arrays, DP tables, boards, graph nodes/edge decisions, coloring, strings, schedules, Huffman trees, and branch-and-bound bounds from runner state. `CodePanel.tsx` maps supported events to pseudocode outline lines.
- `BenchmarkLab.tsx` and `ComparisonLab.tsx` call their real API endpoints. Comparison currently permits only Merge Sort and Quick Sort over the same numeric array.
- `Foundations.tsx` contains interactive-range mathematical growth curves and conceptual analysis/classification explanations; these are explicitly separate from measured output.

The light design system lives in `frontend/src/styles.css`. It uses shared color/type tokens, semantic controls, visible focus styles, responsive breakpoints, and reduced-motion support. There is no component library or chart dependency.

## Backend

`backend/app/algorithms/registry.py` owns algorithm implementations, pseudocode, input examples, and theoretical complexity metadata. A runner accepts a JSON-like input and `capture_steps`. Interactive mode records immutable snapshots; benchmark/compare/save verification disables snapshots.

The event contract is:

```json
{
  "step": 3,
  "event": "compare",
  "description": "Compare target 23 with middle value 16.",
  "state": { "kind": "array", "array": [2, 5, 8, 12, 16, 23], "low": 0, "high": 5, "mid": 4 },
  "metrics": { "comparisons": 3, "writes": 0, "expanded_nodes": 0 }
}
```

`state.kind` selects a visualization shape. The event's description and state come from the executing runner, not a separately animated mock. Full snapshots support backward/forward playback but increase memory use; trace endpoints apply bounded input sizes.

`backend/app/main.py` exposes catalogue, execution, comparison, benchmark, saved experiment, experiment-summary, and recent-benchmark endpoints. SQLite initialization and additive benchmark metadata migration are in `database.py`. Dashboard summary APIs aggregate actual saved rows. The benchmark clock is `time.perf_counter_ns`; each result records Python version, platform, case type, size, repetition, elapsed time, and instrumented operation count. Benchmark response reports a median by size. Timing includes backend runner validation and algorithm execution, while generated visualization snapshots are disabled.

## Persistence and safe tests

Saved experiments store algorithm ID, title, input, recomputed result/counters, and UTC timestamp. The API rejects client-supplied result/counters that differ from a fresh runner execution. Benchmark rows are stored individually with measurement environment metadata. Pytest's API fixture redirects SQLite to a per-test temporary file, keeping tests out of the user's local experiment history.

## Extension rules

1. Add a deterministic runner and input validation in the registry.
2. Emit events only when a real decision or state transition occurs.
3. Add the runner to `ALGORITHMS` with verified theoretical metadata.
4. Reuse a `state.kind` visualization when it is semantically appropriate; otherwise add a specific visualizer.
5. Add correctness, edge-case, and API tests. Keep measured data and theoretical metadata separate.
