interface Props {
  algorithmId: string
  lines: string[]
  event?: string
}

const eventLine: Record<string, Record<string, number>> = {
  'binary-search': { start: 0, compare: 3, found: 3, discard: 4, not_found: 1 },
  'merge-sort': { start: 1, merge: 3, complete: 3 },
  'quick-sort': { start: 0, partition: 2, complete: 3 },
  'insertion-sort': { start: 0, insert: 3, complete: 3 },
  'selection-sort': { start: 0, select: 2, complete: 3 },
  'heap-sort': { start: 0, heapify: 2, extract: 1, complete: 3 },
  'fractional-knapsack': { sort: 0, select: 2 },
  'job-sequencing': { sort: 0, schedule: 2, reject: 2 },
  'huffman-coding': { start: 0, merge: 2, complete: 3 },
  'n-queens': { place: 2, conflict: 1, backtrack: 3 },
  'graph-coloring': { start: 0, assign: 2, conflict: 2, backtrack: 3, complete: 3 },
  'travelling-salesperson': { start: 0, expand: 3, prune: 2, best: 3 },
  'knapsack-branch-bound': { start: 0, expand: 2, incumbent: 2, prune: 3 },
  'matrix-chain-multiplication': { start: 0, fill: 2, reconstruct: 4 },
  'longest-common-subsequence': { match: 1, choose: 2, reconstruct: 3 },
  'zero-one-knapsack': { start: 0, choose: 2, reconstruct: 3 },
  'optimal-binary-search-tree': { start: 0, choose: 3, reconstruct: 4 },
  kruskal: { start: 0, accept: 2, reject: 2, complete: 3 },
  prim: { start: 0, accept: 2, update: 3, settle: 1, complete: 3 },
  'bellman-ford': { start: 0, relax: 1, check: 1, negative_cycle: 3, complete: 3 },
  dijkstra: { start: 0, relax: 2, settle: 3 },
  'rabin-karp': { hash: 1, match: 2, collision: 2 },
}

export function CodePanel({ algorithmId, lines, event }: Props) {
  const currentLine = event ? eventLine[algorithmId]?.[event] : undefined
  return (
    <section className="code-panel panel">
      <div className="panel-heading"><span>Pseudocode outline</span><small>{currentLine === undefined ? (event ? `Event: ${event.replace('_', ' ')}` : 'Trace line appears on execution') : `Line ${currentLine + 1} · ${event?.replace('_', ' ')}`}</small></div>
      <ol>
        {lines.map((line, index) => <li className={index === currentLine ? 'current-code-line' : ''} aria-current={index === currentLine ? 'step' : undefined} key={`${line}-${index}`}>{line}</li>)}
      </ol>
    </section>
  )
}
