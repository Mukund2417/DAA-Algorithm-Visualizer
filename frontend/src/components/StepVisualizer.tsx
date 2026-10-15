import type { JsonObject } from '../types'

function isArray(value: unknown): value is unknown[] { return Array.isArray(value) }

function ArrayView({ state }: { state: JsonObject }) {
  const values = (state.array as Array<number | string>) ?? []
  const low = state.low as number | undefined
  const high = state.high as number | undefined
  const mid = state.mid as number | undefined
  const pivot = state.pivot as number | undefined
  const found = state.found as number | undefined
  const active = isArray(state.active) ? state.active as number[] : []
  return <div className="array-stage">{values.map((value, index) => {
    const focused = (low !== undefined && high !== undefined && index >= low && index <= high) || (active.length === 2 && index >= active[0] && index <= active[1])
    const classes = ['array-cell', focused ? 'in-range' : '', index === mid ? 'mid' : '', index === pivot ? 'pivot' : '', index === found ? 'found' : ''].filter(Boolean).join(' ')
    return <div className={classes} key={`${index}-${value}`}><small>{index}</small><strong>{value}</strong></div>
  })}</div>
}

interface SearchTreeNode { key: string; left?: SearchTreeNode | null; right?: SearchTreeNode | null }

function BinaryTreeNode({ node }: { node: SearchTreeNode }) {
  return <li><span className="tree-node-label"><strong>{node.key}</strong></span>{node.left || node.right ? <ul>{node.left ? <BinaryTreeNode node={node.left} /> : <li><span className="tree-empty-node">∅</span></li>}{node.right ? <BinaryTreeNode node={node.right} /> : <li><span className="tree-empty-node">∅</span></li>}</ul> : null}</li>
}

function TableView({ state }: { state: JsonObject }) {
  const table = (state.table as Array<Array<number | null>>) ?? []
  const rows = (state.rows as string[]) ?? []
  const columns = (state.columns as string[]) ?? []
  const active = (state.active as number[]) ?? [-1, -1]
  return <div className="table-wrap"><div><table className="dp-table"><thead><tr><th></th>{columns.map((item, i) => <th key={`${item}-${i}`}>{item}</th>)}</tr></thead><tbody>{table.map((line, row) => <tr key={row}><th>{rows[row] ?? row}</th>{line.map((value, column) => <td className={active[0] === row && active[1] === column ? 'active-cell' : ''} key={column}>{value}</td>)}</tr>)}</tbody></table>{state.solution ? <p className="solution-callout">{String(state.solution_label ?? 'Reconstructed sequence')}: <strong>{String(state.solution)}</strong></p> : null}{state.tree ? <div className="bst-tree" aria-label="Reconstructed optimal binary search tree"><p className="string-label">Optimal search tree</p><ul><BinaryTreeNode node={state.tree as SearchTreeNode} /></ul></div> : null}</div></div>
}

function BoardView({ state }: { state: JsonObject }) {
  const board = (state.board as string[]) ?? []
  return <div className="chessboard" style={{ gridTemplateColumns: `repeat(${board.length || 1}, 1fr)` }}>{board.flatMap((row, rowIndex) => [...row].map((square, columnIndex) => <div className={(rowIndex + columnIndex) % 2 ? 'dark-square' : 'light-square'} key={`${rowIndex}-${columnIndex}`}>{square === 'Q' ? '♛' : ''}</div>))}</div>
}

function DijkstraView({ state }: { state: JsonObject }) {
  const vertices = (state.vertices as string[]) ?? []
  const edges = (state.edges as Array<[string, string, number]>) ?? []
  const distances = (state.distances as Record<string, number | null>) ?? {}
  const previous = (state.previous as Record<string, string | null>) ?? {}
  const settled = new Set((state.visited as string[]) ?? [])
  const current = state.current as string | undefined
  const start = String(state.start ?? vertices[0] ?? '')
  const activeEdge = state.edge as [string, string] | undefined
  const directed = state.directed === true
  const radius = Math.max(145, (vertices.length * 54) / (2 * Math.PI))
  const width = Math.max(600, radius * 2 + 100)
  const height = Math.max(370, radius * 2 + 90)
  const center = { x: width / 2, y: height / 2 }
  const points = new Map(vertices.map((vertex, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(vertices.length, 1)
    return [vertex, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }]
  }))
  const samePair = (left: string, right: string, from: string, to: string) => left === from && right === to || (!directed && left === to && right === from)
  const selected = (from: string, to: string) => Object.entries(previous).some(([vertex, parent]) => parent !== null && samePair(from, to, parent, vertex))
  const distanceLabel = (value: number | null | undefined) => value === null || value === undefined ? '∞' : Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
  const routeFor = (vertex: string) => {
    if (distances[vertex] === null || distances[vertex] === undefined) return 'Unreachable'
    const route = [vertex]
    const seen = new Set(route)
    let cursor = vertex
    while (cursor !== start && previous[cursor] && !seen.has(previous[cursor]!)) {
      cursor = previous[cursor]!
      route.unshift(cursor)
      seen.add(cursor)
    }
    return route.join(' → ')
  }
  const startLabel = current ? `${start} → ${current}` : start
  return <div className="dijkstra-stage">
    <div className="dijkstra-summary">
      <div><span>Source</span><strong>{start}</strong></div>
      <div><span>Processing</span><strong>{current ?? '—'}</strong></div>
      <div><span>Settled vertices</span><strong>{settled.size} / {vertices.length}</strong></div>
    </div>
    <div className="dijkstra-graph-wrap"><svg className="dijkstra-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Dijkstra weighted graph with tentative shortest distances">
      <defs><marker id="dijkstra-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path className="dijkstra-arrow" d="M0,0 L8,4 L0,8 z" /></marker></defs>
      <g className="dijkstra-edges">{edges.map(([fromName, toName, weight], index) => {
        const from = points.get(fromName)
        const to = points.get(toName)
        if (!from || !to) return null
        const dx = to.x - from.x
        const dy = to.y - from.y
        const length = Math.hypot(dx, dy) || 1
        const ux = dx / length
        const uy = dy / length
        const x1 = from.x + ux * 26
        const y1 = from.y + uy * 26
        const x2 = to.x - ux * 29
        const y2 = to.y - uy * 29
        const selectedEdge = selected(fromName, toName)
        const active = activeEdge ? samePair(fromName, toName, activeEdge[0], activeEdge[1]) : false
        const labelX = (x1 + x2) / 2 - uy * 9
        const labelY = (y1 + y2) / 2 + ux * 9
        const marker = directed ? 'url(#dijkstra-arrow)' : undefined
        return <g key={`${fromName}-${toName}-${index}`}>
          <line className="dijkstra-edge-base" x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={marker}><title>{`${fromName} ${directed ? 'to' : '—'} ${toName}, weight ${weight}`}</title></line>
          {selectedEdge ? <line className="dijkstra-edge-tree" x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={marker} /> : null}
          {active ? <line className="dijkstra-edge-active" x1={x1} y1={y1} x2={x2} y2={y2} markerEnd={marker} /> : null}
          <g className="dijkstra-weight"><rect x={labelX - 13} y={labelY - 8} width="26" height="16" rx="7" /><text x={labelX} y={labelY + 3}>{weight}</text></g>
        </g>
      })}</g>
      <g className="dijkstra-nodes">{vertices.map((vertex) => {
        const point = points.get(vertex)!
        const distance = distances[vertex]
        const classes = ['dijkstra-node', settled.has(vertex) ? 'settled' : '', vertex === current ? 'current' : '', vertex === start ? 'source' : '', distance === null ? 'unreachable' : ''].filter(Boolean).join(' ')
        return <g className={classes} key={vertex}><title>{`${vertex}: ${distanceLabel(distance)}${settled.has(vertex) ? ', finalized' : ', tentative distance'}`}</title><circle cx={point.x} cy={point.y} r="25" /><text className="dijkstra-node-name" x={point.x} y={point.y - 2}>{vertex}</text><text className="dijkstra-node-distance" x={point.x} y={point.y + 13}>{distanceLabel(distance)}</text>{vertex === start ? <text className="dijkstra-source-label" x={point.x} y={point.y + 39}>SOURCE</text> : null}</g>
      })}</g>
    </svg><div className="dijkstra-legend"><span><i className="dijkstra-legend-tree" />Shortest-path tree</span><span><i className="dijkstra-legend-active" />Relaxing edge</span><span><i className="dijkstra-legend-settled" />Finalized distance</span></div></div>
    <div className="dijkstra-routes" aria-label="Current shortest paths">{vertices.map((vertex) => <div className={`dijkstra-route ${settled.has(vertex) ? 'finalized' : ''}`} key={vertex}><strong>{vertex}</strong><span>{distanceLabel(distances[vertex])}</span><small>{routeFor(vertex)}</small></div>)}</div>
    <p className="graph-note">{directed ? 'Arrows show edge direction.' : 'Edges are undirected.'} Node labels show the current tentative distance; finalized distances will not change.</p>
    <span className="sr-only">Current processing edge: {activeEdge ? `${activeEdge[0]} to ${activeEdge[1]}` : startLabel}</span>
  </div>
}

function GraphView({ state }: { state: JsonObject }) {
  if (state.graph_type === 'dijkstra') return <DijkstraView state={state} />
  const distances = (state.distances as Record<string, number | null>) ?? {}
  const colors = (state.colors as Record<string, string>) ?? {}
  const palette = (state.palette as string[]) ?? []
  const current = state.current as string | undefined
  const visited = (state.visited as string[]) ?? []
  const vertices = (state.vertices as string[]) ?? Object.keys(distances)
  const edges = (state.edges as unknown as Array<[string, string, number] | [string, string]>) ?? []
  const selectedEdges = (state.selected_edges as unknown as Array<[string, string, number] | [string, string]>) ?? []
  const currentEdge = (state.edge as unknown as [string, string, number] | undefined)
  const directed = state.directed === true
  const samePair = (edge: readonly unknown[], pair: readonly unknown[]) => edge[0] === pair[0] && edge[1] === pair[1] || (!directed && edge[0] === pair[1] && edge[1] === pair[0])
  return <div className="graph-stage"><div className="graph-nodes">{vertices.map((node) => {
    const distance = distances[node]
    const colorIndex = palette.indexOf(colors[node])
    const hasDistance = Object.prototype.hasOwnProperty.call(distances, node)
    const label = colors[node] ?? (hasDistance ? (distance === null ? '∞' : distance) : visited.includes(node) ? 'in tree' : '')
    return <div className={`graph-node ${node === current ? 'current-node' : ''} ${visited.includes(node) ? 'settled-node' : ''} ${colorIndex >= 0 ? `color-node color-${colorIndex % 6}` : ''}`} key={node}><strong>{node}</strong>{label !== '' ? <span>{label}</span> : null}</div>
  })}</div>{edges.length ? <div className="graph-edge-list" aria-label="Graph edges">{edges.map((edge, index) => {
    const selected = selectedEdges.some((item) => samePair(item, edge))
    const active = currentEdge ? samePair(currentEdge, edge) : false
    const weight = edge[2] === undefined ? '' : ` · ${edge[2]}`
    const status = selected ? 'selected' : active ? 'active' : ''
    return <div className={`graph-edge ${status}`} key={`${edge[0]}-${edge[1]}-${index}`}><span>{edge[0]} {directed ? '→' : '—'} {edge[1]}{weight}</span><small>{selected ? 'in tree' : active ? 'current edge' : ''}</small></div>
  })}</div> : null}<p className="graph-note">{Object.keys(colors).length ? 'Color labels show the current constraint assignment.' : selectedEdges.length ? 'Accepted edges are distinguished from the edge currently being considered.' : 'Distance labels update when a relaxation improves the known path.'}</p></div>
}

function ScheduleView({ state }: { state: JsonObject }) {
  const slots = (state.slots as Array<{ id: string; deadline: number; profit: number } | null>) ?? []
  const jobs = (state.jobs as Array<{ id: string; deadline: number; profit: number }>) ?? []
  const activeJob = String(state.current ?? '')
  const outcome = String(state.outcome ?? '')
  const scheduledIds = new Set(slots.flatMap((job) => job ? [job.id] : []))
  return <div className="schedule-stage">
    <section className="schedule-jobs" aria-label="Jobs ordered by profit">
      <div className="schedule-jobs-heading"><strong>Jobs · highest profit first</strong><span>{jobs.length} total</span></div>
      <div className="schedule-job-list">{jobs.map((job, index) => {
        const active = job.id === activeJob
        const scheduled = scheduledIds.has(job.id)
        const status = active ? outcome === 'rejected' ? 'No slot' : outcome === 'scheduled' ? 'Placed' : 'Current' : scheduled ? 'Placed' : 'Waiting'
        return <div className={`schedule-job ${active ? 'active' : ''} ${scheduled ? 'scheduled' : ''} ${active && outcome === 'rejected' ? 'rejected' : ''}`} key={job.id}>
          <span className="schedule-job-rank">{index + 1}</span><strong>{job.id}</strong><span>deadline {job.deadline}</span><span>profit {job.profit}</span><small>{status}</small>
        </div>
      })}</div>
    </section>
    <div className="schedule-slots" aria-label="Job time slots">{slots.map((job, index) => <div className={job ? 'schedule-slot filled' : 'schedule-slot'} key={index}><small>Slot {index + 1}</small><strong>{job?.id ?? '—'}</strong><span>{job ? `profit ${job.profit} · deadline ${job.deadline}` : 'empty'}</span></div>)}</div>
    <p className="graph-note">Scheduled jobs: {slots.filter(Boolean).map((job) => job?.id).join(' → ') || 'none'} · total profit {String(state.profit ?? 0)}</p>
  </div>
}

interface HuffmanNode { symbol: string; frequency: number; left?: HuffmanNode | null; right?: HuffmanNode | null }

interface HuffmanPoint { node: HuffmanNode; key: string; x: number; y: number }
interface HuffmanLink { key: string; parent: HuffmanPoint; child: HuffmanPoint; bit: '0' | '1' }

function HuffmanTreeGraphic({ root, activeRoot = false }: { root: HuffmanNode; activeRoot?: boolean }) {
  const nodes: HuffmanPoint[] = []
  const links: HuffmanLink[] = []
  let leafIndex = 0
  let maxDepth = 0
  const visit = (node: HuffmanNode, depth: number, key: string): HuffmanPoint => {
    maxDepth = Math.max(maxDepth, depth)
    const point: HuffmanPoint = { node, key, x: 0, y: 28 + depth * 74 }
    const left = node.left ? visit(node.left, depth + 1, `${key}0`) : undefined
    const right = node.right ? visit(node.right, depth + 1, `${key}1`) : undefined
    if (left && right) {
      point.x = (left.x + right.x) / 2
      links.push({ key: `${key}0`, parent: point, child: left, bit: '0' }, { key: `${key}1`, parent: point, child: right, bit: '1' })
    } else if (left || right) {
      const child = left ?? right!
      const bit = left ? '0' : '1'
      point.x = child.x
      links.push({ key: `${key}${bit}`, parent: point, child, bit })
    } else {
      point.x = 34 + leafIndex * 82
      leafIndex += 1
    }
    nodes.push(point)
    return point
  }

  visit(root, 0, 'root')
  const width = 68 + Math.max(0, leafIndex - 1) * 82
  const height = 64 + maxDepth * 74
  const radius = 22
  return <svg className="huffman-tree-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={`Huffman tree rooted at ${root.symbol} with frequency ${root.frequency}`}>
    <g className="huffman-tree-edges">{links.map((link) => {
      const x = (link.parent.x + link.child.x) / 2
      const y = (link.parent.y + link.child.y) / 2
      return <g key={link.key}>
        <line x1={link.parent.x} y1={link.parent.y + radius} x2={link.child.x} y2={link.child.y - radius} />
        <circle className="huffman-bit-bg" cx={x} cy={y} r="9" />
        <text className="huffman-bit" x={x} y={y + 3}>{link.bit}</text>
      </g>
    })}</g>
    <g className="huffman-tree-nodes">{nodes.map(({ node, key, x, y }) => {
      const leaf = !node.left && !node.right
      const active = key === 'root' && activeRoot
      const label = leaf ? (node.symbol.length > 6 ? `${node.symbol.slice(0, 5)}…` : node.symbol) : 'Σ'
      return <g className={`huffman-node ${leaf ? 'leaf' : 'internal'} ${active ? 'active-merge' : ''}`} key={key}>
        <title>{`${leaf ? `Symbol ${node.symbol}` : `Combined node ${node.symbol}`}, frequency ${node.frequency}`}</title>
        <circle cx={x} cy={y} r={radius} />
        <text className="huffman-node-symbol" x={x} y={y - 2}>{label}</text>
        <text className="huffman-node-frequency" x={x} y={y + 13}>{node.frequency}</text>
      </g>
    })}</g>
  </svg>
}

function TreeView({ state }: { state: JsonObject }) {
  const forest = (state.forest as HuffmanNode[]) ?? []
  const codes = (state.codes as Record<string, string>) ?? {}
  const activeMerge = state.active_merge as { left: string; left_frequency: number; right: string; right_frequency: number; parent: string; frequency: number } | undefined
  const activeRootIndex = activeMerge ? forest.findIndex((root) => root.symbol === activeMerge.parent && root.frequency === activeMerge.frequency) : -1
  return <div className="tree-stage">{activeMerge ? <p className="tree-merge-callout"><span>Current merge</span><strong>{activeMerge.left} ({activeMerge.left_frequency}) + {activeMerge.right} ({activeMerge.right_frequency}) → {activeMerge.parent} ({activeMerge.frequency})</strong></p> : null}<div className="huffman-forest" aria-label="Current Huffman forest">{forest.map((root, index) => <HuffmanTreeGraphic root={root} activeRoot={index === activeRootIndex} key={`${root.symbol}-${index}`} />)}</div>{Object.keys(codes).length ? <div className="huffman-codes" aria-label="Final Huffman codes">{Object.entries(codes).map(([symbol, code]) => <span key={symbol}><strong>{symbol}</strong><code>{code}</code></span>)}</div> : null}</div>
}

function TspView({ state }: { state: JsonObject }) {
  const vertices = (state.vertices as string[]) ?? []
  const edges = (state.edges as Array<[string, string, number]>) ?? []
  const path = (state.path as string[]) ?? []
  const bestTour = (state.best_tour as string[]) ?? []
  const candidate = state.candidate as string | undefined
  const start = String(state.start ?? path[0] ?? '')
  const center = { x: 300, y: 166 }
  const radius = 124
  const points = new Map(vertices.map((vertex, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / Math.max(vertices.length, 1)
    return [vertex, { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius }]
  }))
  const edgeKey = (left: string, right: string) => [left, right].sort().join('|')
  const tourEdges = (tour: string[]) => new Set(tour.slice(1).map((vertex, index) => edgeKey(tour[index], vertex)))
  const activeEdges = tourEdges(path)
  const incumbentEdges = tourEdges(bestTour)
  const candidateFrom = candidate ? path[path.length - 2] : undefined
  const candidateKey = candidateFrom && candidate ? edgeKey(candidateFrom, candidate) : undefined
  const isCandidate = state.candidate !== undefined && state.candidate !== null
  const formatted = (value: unknown) => typeof value === 'number' ? value.toFixed(2).replace(/\.00$/, '') : '—'
  return <div className="tsp-stage">
    <div className="tsp-metrics">
      <div><span>Lower bound</span><strong>{formatted(state.bound)}</strong></div>
      <div><span>Branch cost</span><strong>{formatted(state.cost)}</strong></div>
      <div><span>Best tour</span><strong>{formatted(state.best_cost)}</strong></div>
      <div><span>Branch depth</span><strong>{Math.max(0, path.length - 1)} / {vertices.length - 1}</strong></div>
    </div>
    <div className="tsp-graph-wrap">
      <svg className="tsp-graph" viewBox="0 0 600 332" role="img" aria-label="Weighted complete graph for the travelling salesperson search">
        <g className="tsp-edges">
          {edges.map(([left, right, weight]) => {
            const from = points.get(left)
            const to = points.get(right)
            if (!from || !to) return null
            const key = edgeKey(left, right)
            const dx = to.x - from.x
            const dy = to.y - from.y
            const length = Math.hypot(dx, dy) || 1
            const labelX = (from.x + to.x) / 2 - (dy / length) * 10
            const labelY = (from.y + to.y) / 2 + (dx / length) * 10
            return <g key={key}>
              <line className="tsp-edge-base" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
              {activeEdges.has(key) ? <line className="tsp-edge-active" x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null}
              {incumbentEdges.has(key) ? <line className="tsp-edge-best" x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null}
              {candidateKey === key ? <line className="tsp-edge-candidate" x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null}
              <g className="tsp-edge-label"><rect x={labelX - 14} y={labelY - 9} width="28" height="18" rx="8" /><text x={labelX} y={labelY + 3}>{weight}</text></g>
            </g>
          })}
        </g>
        <g className="tsp-nodes">{vertices.map((vertex) => {
          const point = points.get(vertex)!
          const inPath = path.includes(vertex)
          const inBest = bestTour.includes(vertex)
          const current = vertex === path[path.length - 1]
          const pending = vertex === candidate && isCandidate
          const home = vertex === start
          const status = [current ? 'current' : '', pending ? 'candidate' : '', inBest ? 'best' : '', inPath ? 'visited' : '', home ? 'home' : ''].filter(Boolean).join(' ')
          return <g className={`tsp-node ${status}`} key={vertex}>
            <circle cx={point.x} cy={point.y} r="23" />
            <text className="tsp-node-label" x={point.x} y={point.y + 4}>{vertex}</text>
            {home ? <text className="tsp-home-label" x={point.x} y={point.y + 37}>START</text> : null}
          </g>
        })}</g>
      </svg>
      <div className="tsp-legend"><span><i className="legend-current" />Current branch</span><span><i className="legend-candidate" />Candidate edge</span><span><i className="legend-best" />Best tour</span></div>
    </div>
    <div className="tsp-routes">
      <div className={`tsp-route current-route ${isCandidate ? 'has-candidate' : ''}`}><span>{isCandidate ? 'Trying next' : 'Current branch'}</span><strong>{path.join(' → ') || '—'}</strong></div>
      <div className="tsp-route best-route"><span>Incumbent tour</span><strong>{bestTour.length ? bestTour.join(' → ') : 'No complete tour found yet'}</strong></div>
    </div>
    <p className="tsp-caption">{String(state.strategy ?? 'Least-cost')} branch and bound · edge labels show travel cost</p>
  </div>
}

interface BoundedKnapsackItem { name: string; weight: number; value: number; ratio: number; original_index: number }

function BoundedKnapsackView({ state }: { state: JsonObject }) {
  const items = (state.items as BoundedKnapsackItem[]) ?? []
  const choices = new Set((state.choices as number[]) ?? [])
  const bestChoices = new Set((state.best_choices as number[]) ?? [])
  const level = Math.max(0, Number(state.level ?? 0))
  const capacity = Number(state.capacity ?? 0)
  const weight = Number(state.weight ?? 0)
  const usedPercent = capacity > 0 ? Math.min(100, (weight / capacity) * 100) : 0
  const activeItem = items[level]
  const previousItem = level > 0 ? items[level - 1] : undefined
  const decisionText = previousItem
    ? `${choices.has(previousItem.original_index) ? 'Included' : 'Excluded'} ${previousItem.name}`
    : activeItem ? `Next decision: ${activeItem.name}` : 'All item decisions complete'
  const currentSelected = items.filter((item) => choices.has(item.original_index))
  const bestSelected = items.filter((item) => bestChoices.has(item.original_index))
  const numeric = (value: unknown) => typeof value === 'number' ? value.toFixed(2).replace(/\.00$/, '') : '0'
  return <div className="bnb-knapsack-stage">
    <div className="bnb-knapsack-metrics">
      <div><span>Current value</span><strong>{numeric(state.value)}</strong></div>
      <div><span>Upper bound</span><strong>{numeric(state.bound)}</strong></div>
      <div><span>Incumbent value</span><strong>{numeric(state.best_value)}</strong></div>
      <div><span>Decision level</span><strong>{level} / {items.length}</strong></div>
    </div>
    <div className="bnb-capacity-panel">
      <div className="bnb-capacity-heading"><strong>Current branch capacity</strong><span>{numeric(state.weight)} / {numeric(state.capacity)} weight</span></div>
      <div className="bnb-capacity-track"><span style={{ width: `${usedPercent}%` }} /></div>
      <p>{decisionText}{activeItem ? <span> · next item is ordered by value / weight</span> : null}</p>
    </div>
    <div className="bnb-items" aria-label="Items sorted by value-to-weight ratio">
      {items.map((item, index) => {
        const selected = choices.has(item.original_index)
        const best = bestChoices.has(item.original_index)
        const status = index < level ? selected ? 'included' : 'excluded' : index === level ? 'active' : 'pending'
        const statusLabel = status === 'included' ? 'Include' : status === 'excluded' ? 'Exclude' : status === 'active' ? 'Choose next' : 'Waiting'
        return <article className={`bnb-item-card ${status} ${best ? 'incumbent-item' : ''}`} key={item.original_index}>
          <div className="bnb-item-top"><span>Item {item.original_index + 1}</span>{best ? <small>BEST</small> : null}</div>
          <strong className="bnb-item-name">{item.name}</strong>
          <div className="bnb-item-data"><span>Weight <b>{numeric(item.weight)}</b></span><span>Value <b>{numeric(item.value)}</b></span></div>
          <div className="bnb-item-bottom"><span>{numeric(item.ratio)} value / weight</span><em>{statusLabel}</em></div>
          {status === 'active' ? <div className="bnb-branch-options"><span>Include</span><span>Exclude</span></div> : null}
        </article>
      })}
    </div>
    <div className="bnb-selections">
      <div className="bnb-selection current-selection"><span>Current branch</span><strong>{currentSelected.length ? currentSelected.map((item) => item.name).join(' + ') : 'No items included'} · value {numeric(state.value)}</strong></div>
      <div className="bnb-selection best-selection"><span>Best feasible selection</span><strong>{bestSelected.length ? bestSelected.map((item) => item.name).join(' + ') : 'No positive-value solution yet'} · {numeric(state.best_weight)} / {numeric(state.capacity)} capacity · value {numeric(state.best_value)}</strong></div>
    </div>
    <p className="bnb-knapsack-note">Items are processed from highest to lowest value / weight. The upper bound allows a fraction of the next item; actual selections remain whole items.</p>
  </div>
}

function SearchView({ state }: { state: JsonObject }) {
  if (state.search_type === 'tsp') return <TspView state={state} />
  if (state.search_type === 'knapsack') return <BoundedKnapsackView state={state} />
  const path = (state.path as string[]) ?? []
  const selectedItems = (state.selected_items as string[]) ?? []
  const depth = state.level ?? Math.max(0, path.length - 1)
  return <div className="search-stage"><div className="search-summary"><span>Knapsack decision</span><strong>{`${selectedItems.join(', ') || 'No items selected'} · item level ${String(state.level ?? 0)}`}</strong></div><div className="search-metrics"><div><span>Current bound</span><strong>{Number(state.bound ?? 0).toFixed(2)}</strong></div><div><span>Best feasible value</span><strong>{String(state.best_value ?? '—')}</strong></div><div><span>Search depth</span><strong>{String(depth)}</strong></div></div></div>
}

function StringView({ state }: { state: JsonObject }) {
  const text = String(state.text ?? '')
  const window = (state.window as number[]) ?? [-1, -1]
  return <div className="string-stage"><p className="string-label">Text</p><div className="characters">{[...text].map((character, index) => <span className={index >= window[0] && index <= window[1] ? 'in-window' : ''} key={index}>{character}</span>)}</div><p className="string-label">Pattern <code>{String(state.pattern ?? '')}</code></p>{state.match !== undefined ? <p className="success-text">Verified match at index {String(state.match)}.</p> : null}</div>
}

function KnapsackView({ state }: { state: JsonObject }) {
  const selected = (state.selected as Array<{ name: string; fraction: number; taken_value: number }>) ?? []
  return <div className="knapsack-stage"><div className="capacity"><span style={{ width: `${Math.min(100, 100 - (Number(state.remaining ?? state.capacity) / Number(state.capacity || 1)) * 100)}%` }}></span></div><p><strong>{String(state.remaining ?? state.capacity)}</strong> capacity remaining</p><div className="selection-list">{selected.length ? selected.map((item) => <div key={item.name}><span>{item.name}</span><span>{item.fraction * 100}% · value {item.taken_value}</span></div>) : <span className="muted">No item selected yet.</span>}</div></div>
}

export function StepVisualizer({ state }: { state?: JsonObject }) {
  if (!state) return <div className="empty-stage"><div>▶</div><p>Choose an algorithm, edit its JSON input, then run it to create a replayable trace.</p></div>
  const kind = state.kind
  if (kind === 'array') return <ArrayView state={state} />
  if (kind === 'table') return <TableView state={state} />
  if (kind === 'board') return <BoardView state={state} />
  if (kind === 'graph') return <GraphView state={state} />
  if (kind === 'coloring') return <GraphView state={state} />
  if (kind === 'string') return <StringView state={state} />
  if (kind === 'knapsack') return <KnapsackView state={state} />
  if (kind === 'schedule') return <ScheduleView state={state} />
  if (kind === 'tree') return <TreeView state={state} />
  if (kind === 'search') return <SearchView state={state} />
  return <pre className="fallback-state">{JSON.stringify(state, null, 2)}</pre>
}

function resultLabel(key: string) { return key.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }

function PlainOutputValue({ value, label = '' }: { value: unknown; label?: string }) {
  if (value === null || value === undefined) return <span>None</span>
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>
  if (Array.isArray(value)) {
    if (!value.length) return <span>None</span>
    if (value.every((entry) => entry === null || typeof entry !== 'object')) {
      const separator = /tour|path|sequence|traversal/i.test(label) ? ' → ' : ', '
      return <span>{value.map((entry) => entry === null ? 'None' : String(entry)).join(separator)}</span>
    }
    return <ul className="plain-result-list">{value.map((entry, index) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return <li key={index}><PlainOutputValue value={entry} label={label} /></li>
      const fields = Object.entries(entry as Record<string, unknown>)
      const primary = fields.find(([key]) => ['name', 'id', 'symbol', 'key'].includes(key))
      const rest = primary ? fields.filter(([key]) => key !== primary[0]) : fields
      return <li key={index}><div>{primary ? <strong>{String(primary[1])}</strong> : null}{rest.map(([key, field]) => <span key={key}>{primary ? `${resultLabel(key).toLowerCase()} ` : `${resultLabel(key)}: `}<PlainOutputValue value={field} label={key} /></span>)}</div></li>
    })}</ul>
  }
  if (typeof value === 'object') return <dl className="plain-result-nested">{Object.entries(value as Record<string, unknown>).map(([key, field]) => <div key={key}><dt>{resultLabel(key)}</dt><dd><PlainOutputValue value={field} label={key} /></dd></div>)}</dl>
  return <span>{String(value)}</span>
}

export function TraceResult({ result, algorithmId }: { result: JsonObject; algorithmId?: string }) {
  if (algorithmId === 'huffman-coding') {
    const codes = (result.codes as Record<string, string>) ?? {}
    return <section className="trace-result huffman-final-result" aria-label="Huffman coding result">
      <div className="trace-result-heading"><span>Final result</span></div>
      <div className="huffman-result-codes">{Object.entries(codes).map(([symbol, code]) => <span key={symbol}><strong>{symbol}</strong><code>{code}</code></span>)}</div>
      <p className="huffman-result-length">Weighted path length: <strong>{String(result.weighted_path_length ?? 0)} bits</strong></p>
    </section>
  }
  return <section className="trace-result" aria-label="Algorithm result">
    <div className="trace-result-heading"><span>Final result</span><span>Readable summary</span></div>
    <div className="plain-result-fields">{Object.entries(result).map(([key, value]) => <div className="plain-result-field" key={key}><span>{resultLabel(key)}</span><div><PlainOutputValue value={value} label={key} /></div></div>)}</div>
  </section>
}
