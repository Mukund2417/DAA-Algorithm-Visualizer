import { useMemo, useState } from 'react'
import type { Algorithm } from '../types'

interface Props { algorithms: Algorithm[]; onLaunch: (id: string) => void }

const statusLabel: Record<Algorithm['implementation_status'], string> = {
  implemented: 'Implemented',
  partial: 'Partial',
  'theory-only': 'Theory only',
}

export function AlgorithmExplorer({ algorithms, onLaunch }: Props) {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleAlgorithms = useMemo(() => algorithms.filter((algorithm) => {
    const matchesCategory = categoryFilter === 'all' || algorithm.category === categoryFilter
    const matchesStatus = statusFilter === 'all' || algorithm.implementation_status === statusFilter
    const searchable = `${algorithm.name} ${algorithm.category} ${algorithm.description}`.toLocaleLowerCase()
    return matchesCategory && matchesStatus && (!normalizedQuery || searchable.includes(normalizedQuery))
  }), [algorithms, categoryFilter, statusFilter, normalizedQuery])
  const implementedCount = algorithms.filter((algorithm) => algorithm.implementation_status === 'implemented').length
  const categories = [...new Set(algorithms.map((algorithm) => algorithm.category))].sort()

  return <main className="catalogue-page">
    <section className="catalogue-intro">
      <div>
        <p className="eyebrow">Design and Analysis of Algorithms</p>
        <h1>Algorithm Explorer</h1>
        <p>Choose a topic to inspect its theory, provide an input, and follow the decisions made by its implementation.</p>
      </div>
      <div className="catalogue-count" aria-label={`${implementedCount} algorithms implemented across ${categories.length} categories`}>
        <strong>{implementedCount}<span> / {algorithms.length}</span></strong>
        <small>registered algorithms implemented</small>
        <small>{categories.length} technique categories</small>
      </div>
    </section>

    <section className="catalogue-tools" aria-label="Filter algorithms">
      <label className="search-control"><span className="search-symbol" aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search algorithms, strategies, or topics" aria-label="Search algorithms" />{query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear search">Clear</button> : null}</label>
      <div className="advanced-filters">
        <label>Category<select aria-label="Filter by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
        <label>Implementation<select aria-label="Filter by implementation status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="implemented">Implemented</option><option value="partial">Partial</option><option value="theory-only">Theory only</option></select></label>
      </div>
    </section>

    <section className="catalogue-list" aria-label="Algorithms">
      <div className="catalogue-list-head"><span>Algorithm / explanation</span><span>Strategy</span><span>Time · best / average / worst</span><span>Auxiliary space</span><span>Status</span><span></span></div>
      {visibleAlgorithms.map((algorithm) => <article className="catalogue-row" key={algorithm.id}>
        <div className="algorithm-name"><div><h2>{algorithm.name}</h2><p>{algorithm.description}</p></div></div>
        <span className="strategy-name">{algorithm.category}</span>
        <div className="complexity-values" aria-label={`Best ${algorithm.best_case}, average ${algorithm.average_case}, worst ${algorithm.worst_case}`}><code>{algorithm.best_case}</code><code>{algorithm.average_case}</code><code>{algorithm.worst_case}</code><small>best&nbsp;&nbsp;&nbsp; avg&nbsp;&nbsp;&nbsp; worst</small></div>
        <code className="space-value">{algorithm.space_complexity}</code>
        <span className={`implementation-status status-${algorithm.implementation_status}`}>{statusLabel[algorithm.implementation_status]}</span>
        <button className="open-algorithm" onClick={() => onLaunch(algorithm.id)} aria-label={`Open ${algorithm.name} in the algorithm lab`}>Open <span aria-hidden="true">↗</span></button>
      </article>)}
      {visibleAlgorithms.length === 0 ? <div className="catalogue-empty"><strong>No matching algorithms</strong><p>Try a different search term, category, or implementation status.</p><button className="button button-secondary" onClick={() => { setQuery(''); setCategoryFilter('all'); setStatusFilter('all') }}>Clear filters</button></div> : null}
    </section>
    <p className="catalogue-footnote">Complexities are theoretical references from the registry. Measured timings are shown separately in Benchmarks.</p>
  </main>
}
