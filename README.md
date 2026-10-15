# AlgoScope — Interactive DAA Algorithm Visualizer

AlgoScope is an interactive Design and Analysis of Algorithms learning tool. It replays real backend execution traces and keeps theoretical complexity separate from measured timings.

## Current coverage

The backend registry contains 19 runnable algorithms across several technique categories:

- Search and divide-and-conquer: Binary Search, Merge Sort, Quick Sort.
- Greedy: Fractional Knapsack, Job Sequencing with Deadlines, Huffman Coding.
- Backtracking and branch-and-bound: N-Queens (board sizes 1–8), Graph Coloring, TSP with FIFO/LIFO/least-cost strategies, branch-and-bound Knapsack.
- Dynamic programming: Matrix Chain Multiplication, Longest Common Subsequence, 0/1 Knapsack, Optimal Binary Search Tree.
- Graph and string algorithms: Kruskal, Prim, Bellman–Ford, Dijkstra, Rabin–Karp.

The interface includes global registry search, category and implementation-status filters, algorithm playback, comparison, benchmarks, foundations, and SQLite-backed experiment summaries. Known limitations are documented in [docs/audit.md](docs/audit.md).

## Run locally

Open two PowerShell terminals.

Terminal 1 — backend:

```powershell
cd "E:\DAA Project\backend"
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

Terminal 2 — frontend:

```powershell
cd "E:\DAA Project\frontend"
npm install
npm run dev
```

Open `http://localhost:5173`. The API documentation is at `http://127.0.0.1:8000/docs`. Set `VITE_API_BASE_URL` before starting Vite if the API runs elsewhere.

## Verify

```powershell
cd "E:\DAA Project\backend"
python -m pytest -q
```

```powershell
cd "E:\DAA Project\frontend"
npm run build
```

API tests use temporary SQLite databases and do not populate the app's saved history.

## Trust and measurement notes

- Interactive traces are snapshots from the same deterministic runner that returns each result.
- Benchmark mode disables snapshots, repeats local trials, reports medians, and records Python/platform/timer metadata. It does not measure auxiliary memory.
- Saved experiments are recomputed by the backend before SQLite stores results and counters.
- Benchmark and experiment summaries on the dashboard come from persisted records. Empty data produces an empty state, not synthetic chart values.
- Theoretical bounds come from registry metadata; benchmark measurements do not prove asymptotic complexity.
- Saved experiment export is JSON. A PDF report exporter and dedicated graphical graph editor are not implemented.
