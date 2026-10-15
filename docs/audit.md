# Repository audit and algorithm coverage

Audit updated 13 October 2026 after the navigation, dashboard, and runner expansion.

## Initial audit findings

The project was a working React + TypeScript + Vite frontend with a FastAPI backend, a Python callable registry, SQLite persistence, and eight deterministic algorithm runners. The original interface mixed catalogue and dashboard responsibilities in a top navigation bar, had no individual module pages or category/status filters, and used a hardcoded fallback catalogue after API errors. That fallback has been removed so an unavailable backend remains visibly unavailable.

The workspace has no `.git` metadata. Existing app SQLite storage and experiment rows were preserved; API tests use isolated temporary databases. No authentication, secrets, or deployment setup were found.

## Current architecture and user-facing behavior

- The client page shell in `frontend/src/App.tsx` provides dashboard, live algorithm explorer, foundations, algorithm lab, comparison, performance lab, and experiment history/report export. Navigation is real client-side page state; no routing package is used.
- The current UI intentionally omits syllabus pages, module navigation, and module filters. It uses the collapsible sidebar, mobile drawer, global live-registry search, category/status filters, and current-page indication. The API's module metadata endpoint is retained for compatibility, but the frontend does not request it.
- The dashboard reads actual registry counts and persisted experiment/benchmark summaries. Empty, loading, and error states are distinct; empty charts are not fabricated.
- The algorithm lab uses real runner snapshots for playback and supports reset, step backward/forward, play/pause, speed, pseudocode mapping, counters, and verified persistence. Recent experiments can be rerun with their saved input.
- Styling uses the existing React/CSS stack and light design tokens, with responsive breakpoints, keyboard focus treatment, reduced-motion handling, and a collapsible mobile drawer.

The topic-by-topic matrix below is retained as an engineering coverage record from the earlier syllabus-alignment request; it is not displayed in the current product UI.

## Backend and persistence

FastAPI endpoints include:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/modules`, `GET /api/algorithms` | Live syllabus metadata and executable registry |
| `GET /api/algorithms/{id}`, `POST /api/execute` | Algorithm details and trace-producing execution |
| `POST /api/compare` | Equivalent-array Merge Sort / Quick Sort comparison |
| `POST /api/benchmark` | Repeated, snapshot-free measurement for Binary Search, Merge Sort, and Quick Sort |
| `POST /api/experiments`, `GET /api/experiments` | Verify, save, and list interactive runs |
| `GET /api/experiments/summary` | True saved-run count and a recent sample for the dashboard |
| `GET /api/benchmarks/recent` | Persisted benchmark batches summarized by input size |

SQLite schema and existing data remain intact. New dashboard APIs are read-only summaries over saved experiments and benchmark trials. Experiment creation still recomputes output/counters server-side and rejects forged values. Benchmarks use `time.perf_counter_ns`, store Python/platform/timer metadata, and exclude trace snapshots from timed runs. Auxiliary memory is not measured.

## Syllabus coverage matrix

“Runnable” means a deterministic backend runner returns the result and replayable state events. “Theory” means the topic has an explicit educational explanation but is not represented as a standalone executable algorithm. Counts and status in the app are kept separate from theoretical or measured claims.

| Module | Topic | Status | Evidence / limitation |
| --- | --- | --- | --- |
| I | Algorithm definition and characteristics | Theory | Foundations describes input/output, definiteness, finiteness, and effectiveness |
| I | Efficiency analysis; time and space complexity | Theory | Foundations and per-runner complexity lens; no general operation-model editor |
| I | Classes of functions | Theory | Interactive input-range control on the mathematical growth chart; not measured data |
| I | Best, average, worst-case analysis | Partial | Metadata and Binary Search best/average/worst benchmark cases; average-case distributions are not generalized to every algorithm |
| I | Asymptotic notation O, Ω, Θ | Theory | Written definitions and theoretical growth curves |
| I | Performance analysis / input-size experiments | Runnable tool | Repeated measurements exist for Binary Search and the two sorting runners; no memory measurement |
| II | Divide-and-conquer control abstraction | Theory | Topic note plus Binary Search, Merge Sort, and Quick Sort examples |
| II | Binary Search | Runnable | Sorted-input validation and shrinking-interval trace |
| II | Merge Sort | Runnable | Merge snapshots and counters |
| II | Quick Sort | Runnable | Pivot/partition snapshots; iterative range stack |
| II | Greedy control abstraction | Theory | Topic note and greedy runner examples |
| II | Fractional Knapsack | Runnable | Ratio ordering, fractions, and capacity state |
| II | Job Sequencing with Deadlines | Runnable | Profit ordering, time-slot decisions, and scheduled jobs |
| II | Huffman Coding | Runnable | Priority-queue merges, tree snapshots, and prefix codes |
| III | Backtracking control abstraction | Theory + runnable example | Explanation plus N-Queens and Graph Coloring traces |
| III | Eight Queens | Runnable | N-Queens accepts board sizes 1–8; size-4 path is tested, size 8 is not yet automated |
| III | Graph Coloring | Runnable | Vertex assignments, conflicts, and backtracking; capped at 12 vertices |
| III | Branch-and-bound control abstraction | Theory + runnable examples | TSP and Knapsack traces display incumbent/bounds and prune events |
| III | FIFO, LIFO, least-cost strategies | Runnable | TSP input accepts all three live-node policies; least-cost uses the MST-based bound priority |
| III | Travelling Salesperson Problem | Runnable | Complete undirected graphs, 3–8 vertices, non-negative weights, admissible MST-based completion bound |
| III | Knapsack Problem (branch and bound) | Runnable | Fractional upper bound and best-bound-first node selection; at most 15 items |
| IV | Dynamic-programming control abstraction | Theory + runnable examples | State/table examples in MCM, LCS, 0/1 Knapsack, and OBST |
| IV | Matrix Chain Multiplication | Runnable | Cost table and reconstructed parenthesization |
| IV | Longest Common Subsequence | Runnable | Table updates and subsequence reconstruction |
| IV | 0/1 Knapsack | Runnable | Include/exclude DP table and selected-item reconstruction; trace capped at 1,200 states |
| IV | Optimal Binary Search Tree | Runnable | Successful and unsuccessful frequencies, cost table, and reconstructed tree |
| V | Minimum Spanning Trees | Runnable | Kruskal and Prim reject disconnected input because no spanning tree exists |
| V | Kruskal's Algorithm | Runnable | Edge weight ordering and cycle rejection with disjoint-set components |
| V | Prim's Algorithm | Runnable | Cut-edge updates and accepted edges |
| V | Single-source shortest paths | Theory + runnable examples | Dijkstra and Bellman–Ford show distances under their respective assumptions |
| V | Bellman–Ford | Runnable | Repeated relaxation and reachable negative-cycle detection |
| V | Dijkstra | Runnable | Non-negative weight validation and distance relaxation |
| V | Rabin–Karp | Runnable | Rolling hash, candidate window, and character-verification trace |
| V | Nondeterministic algorithms | Theory | Certificate-verification framing; no claim of instant parallel guesses on ordinary hardware |
| V | P, NP, NP-hard, NP-complete | Theory | Definitions and subset note; no claim that sample executions classify a problem |

## Remaining limitations

- Graph input is a validated JSON editor, not a direct manipulation graph canvas. Graph traces display nodes plus an edge list; they do not yet draw geometric edge routes or final shortest paths.
- Branch-and-bound traces show the current partial state, bound, incumbent, and prune/expand events, but do not yet retain/render the entire historical search tree as a node-link diagram.
- FIFO/LIFO/least-cost strategy selection is currently edited in the TSP JSON input. The Knapsack branch-and-bound runner uses a max-upper-bound priority queue; it does not offer separate FIFO/LIFO controls.
- Performance Lab currently benchmarks only Binary Search, Merge Sort, and Quick Sort. It has measured timing and operation charts, while theoretical references remain separate. There is no PDF report generator.
- The frontend has no automated component/browser test runner, lint script, or contrast audit. Visual smoke checks were performed at 1280×720, 768×1024, and 390×844; document width did not exceed the viewport at those sizes. Search, module navigation, live filtering, actual Dijkstra execution, and trace backward/forward controls were exercised in a browser.
- No dark mode, authentication, or deployment configuration is included.
- `package.json` still declares Vite/TypeScript as `latest`; reproducible npm installs rely on the checked-in lockfile.

## Verification

- Backend: `python -m pytest -q` — 23 passed, one Starlette/AnyIO deprecation warning.
- Frontend: `npm run build` — TypeScript and Vite production build passed.
- HTTP smoke check: API health and both new dashboard summary endpoints returned HTTP 200; Vite served the app with HTTP 200.
- Browser smoke checks confirmed the dashboard's empty-history state, global search opening the registered Dijkstra visualizer, a 12-step Dijkstra trace with working backward/forward playback, module-topic status labels, category/status filtering, and responsive layouts.

## Implementation sequence

1. Audit existing frontend, backend, database, algorithms, docs, and baseline checks.
2. Replace top navigation with a responsive workspace shell and live registry search.
3. Separate dashboard, explorer, and syllabus module pages; connect module/topic status to registry entries.
4. Add persisted benchmark/experiment summaries without fabricating measurements.
5. Expand deterministic runners across Modules II–V and add validation/regression coverage.
6. Verify production build, API behavior, browser interactions, responsive widths, and document remaining product gaps.
