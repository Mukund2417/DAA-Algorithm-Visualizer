import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Algorithm, ExperimentSummary, JsonObject, RecentBenchmark } from '../types'

type LoadState = 'loading' | 'ready' | 'error'
interface Props {
  algorithms: Algorithm[]
  onNavigate: (page: 'explorer' | 'lab' | 'compare' | 'benchmark' | 'history' | 'foundations') => void
  onRerun: (algorithmId: string, input: JsonObject) => void
}

export function OverviewDashboard({ algorithms, onNavigate, onRerun }: Props) {
  const [summary, setSummary] = useState<ExperimentSummary | null>(null)
  const [benchmarks, setBenchmarks] = useState<RecentBenchmark[]>([])
  const [historyState, setHistoryState] = useState<LoadState>('loading')
  const [benchmarkState, setBenchmarkState] = useState<LoadState>('loading')
  const [historyError, setHistoryError] = useState('')
  const [benchmarkError, setBenchmarkError] = useState('')

  const loadSavedData = useCallback(async () => {
    setHistoryState('loading'); setBenchmarkState('loading'); setHistoryError(''); setBenchmarkError('')
    const [historyResult, benchmarkResult] = await Promise.allSettled([api.experimentSummary(), api.recentBenchmarks()])
    if (historyResult.status === 'fulfilled') { setSummary(historyResult.value); setHistoryState('ready') }
    else { setHistoryError(historyResult.reason instanceof Error ? historyResult.reason.message : 'Could not load saved experiments.'); setHistoryState('error') }
    if (benchmarkResult.status === 'fulfilled') { setBenchmarks(benchmarkResult.value); setBenchmarkState('ready') }
    else { setBenchmarkError(benchmarkResult.reason instanceof Error ? benchmarkResult.reason.message : 'Could not load benchmark summaries.'); setBenchmarkState('error') }
  }, [])
  useEffect(() => { void loadSavedData() }, [loadSavedData])

  const implemented = algorithms.filter((algorithm) => algorithm.implementation_status === 'implemented')
  const latestBenchmark = benchmarks[0]
  const benchmarkAlgorithm = latestBenchmark && algorithms.find((algorithm) => algorithm.id === latestBenchmark.algorithm_id)
  const maxTime = Math.max(0.00001, ...(latestBenchmark?.points.map((point) => point.median_time_ms) ?? []))
  const categoryCount = new Set(algorithms.map((algorithm) => algorithm.category)).size

  return <main className="overview-page">
    <section className="overview-welcome"><div><p className="eyebrow">Design and Analysis of Algorithms</p><h1>Learn algorithms by following their decisions.</h1><p>Browse algorithms, replay real execution traces, and keep measured results separate from theoretical analysis.</p></div><button className="button button-primary" onClick={() => onNavigate('lab')}>Open Algorithm Lab</button></section>

    <section className="overview-facts" aria-label="Live workspace summary">
      <div><span>Registered runnable algorithms</span><strong>{implemented.length}</strong></div>
      <div><span>Technique categories</span><strong>{categoryCount}</strong></div>
      <div><span>Saved experiments</span><strong>{historyState === 'ready' ? summary?.total ?? 0 : historyState === 'error' ? '—' : '…'}</strong></div>
    </section>

    <section className="quick-actions" aria-label="Quick launch">
      <div className="section-title"><div><p className="eyebrow">Workspace</p><h2>Quick launch</h2></div></div>
      <div className="quick-action-grid">
        <button className="quick-action panel" onClick={() => onNavigate('explorer')}><span className="action-index">01</span><strong>Explore algorithms</strong><small>Search the live registry and filter by technique.</small><span className="action-arrow" aria-hidden="true">↗</span></button>
        <button className="quick-action panel" onClick={() => onNavigate('compare')}><span className="action-index">02</span><strong>Compare algorithms</strong><small>Compare five sorting algorithms on equivalent input.</small><span className="action-arrow" aria-hidden="true">↗</span></button>
        <button className="quick-action panel" onClick={() => onNavigate('benchmark')}><span className="action-index">03</span><strong>Measure performance</strong><small>Run repeated backend trials and inspect measured timings.</small><span className="action-arrow" aria-hidden="true">↗</span></button>
        <button className="quick-action panel" onClick={() => onNavigate('foundations')}><span className="action-index">04</span><strong>Read foundations</strong><small>Review asymptotic notation and complexity classes.</small><span className="action-arrow" aria-hidden="true">↗</span></button>
      </div>
    </section>

    <section className="overview-section overview-performance" aria-labelledby="benchmarks-heading"><div className="section-title"><div><p className="eyebrow">Measured data / SQLite</p><h2 id="benchmarks-heading">Performance overview</h2></div><button className="text-button" onClick={() => onNavigate('benchmark')}>Performance Lab</button></div>
        {benchmarkState === 'loading' ? <div className="overview-empty panel" role="status">Loading saved benchmark data…</div> : null}
        {benchmarkState === 'error' ? <div className="overview-empty panel" role="alert"><strong>Benchmark history is unavailable.</strong><p>{benchmarkError}</p><button className="button button-secondary" onClick={() => void loadSavedData()}>Retry</button></div> : null}
        {benchmarkState === 'ready' && !latestBenchmark ? <div className="overview-empty panel"><strong>No benchmark runs yet.</strong><p>Run a repeated experiment to create measured timing and operation-count data. Charts will appear here only after a real run.</p><button className="button button-secondary" onClick={() => onNavigate('benchmark')}>Run first benchmark</button></div> : null}
        {benchmarkState === 'ready' && latestBenchmark ? <div className="performance-card panel"><div className="performance-meta"><span>Latest completed benchmark</span><strong>{benchmarkAlgorithm?.name ?? latestBenchmark.algorithm_id}</strong><small>{latestBenchmark.case_type} input · median of {latestBenchmark.trials} trials · {new Date(latestBenchmark.created_at).toLocaleString()}</small></div><div className="performance-chart" role="img" aria-label={`Measured median execution time by input size for ${benchmarkAlgorithm?.name ?? latestBenchmark.algorithm_id}`}>
          {latestBenchmark.points.map((point) => <div className="performance-point" key={point.input_size}><div className="performance-bar" style={{ height: `${Math.max(4, (point.median_time_ms / maxTime) * 76)}px` }} title={`${point.median_time_ms} ms median`} /><strong>{point.input_size.toLocaleString()}</strong><span>{point.median_time_ms.toFixed(5)} ms</span></div>)}
        </div><div className="performance-foot"><span>Observed median time · per input size</span><span>Theoretical worst case <code>{benchmarkAlgorithm?.worst_case ?? '—'}</code></span></div></div> : null}
    </section>

    <section className="overview-section recent-section" aria-labelledby="recent-heading"><div className="section-title"><div><p className="eyebrow">Persistence / local saved runs</p><h2 id="recent-heading">Recent experiments</h2></div><div className="recent-actions"><button className="text-button" onClick={() => void loadSavedData()} disabled={historyState === 'loading'}>Refresh</button><button className="text-button" onClick={() => onNavigate('history')}>All experiments & reports</button></div></div>
      {historyState === 'loading' ? <div className="overview-empty panel" role="status">Loading saved experiments…</div> : null}
      {historyState === 'error' ? <div className="overview-empty panel" role="alert"><strong>Experiment history is unavailable.</strong><p>{historyError}</p><button className="button button-secondary" onClick={() => void loadSavedData()}>Retry</button></div> : null}
      {historyState === 'ready' && summary?.total === 0 ? <div className="overview-empty panel"><strong>No saved experiments yet.</strong><p>Run a visualization and select “Save run” to store its verified input, output, and counters.</p><button className="button button-secondary" onClick={() => onNavigate('lab')}>Start an algorithm run</button></div> : null}
      {historyState === 'ready' && summary && summary.total > 0 ? <><div className="recent-list">{summary.recent.slice(0, 4).map((experiment) => {
        const algorithm = algorithms.find((item) => item.id === experiment.algorithm_id)
        const totalOperations = Object.values(experiment.metrics).reduce((sum, value) => sum + value, 0)
        return <article className="recent-experiment panel" key={experiment.id}><div><span className="tag">{algorithm?.category ?? 'Algorithm run'}</span><h3>{experiment.title || algorithm?.name || experiment.algorithm_id}</h3><small>{algorithm?.name ?? experiment.algorithm_id} · {new Date(experiment.created_at).toLocaleString()}</small></div><div className="recent-input"><span>Input</span><code>{JSON.stringify(experiment.input)}</code></div><div className="recent-metric"><strong>{totalOperations}</strong><span>instrumented operations</span></div><button className="button button-secondary" onClick={() => onRerun(experiment.algorithm_id, experiment.input)}>Rerun</button></article>
      })}</div><p className="overview-footnote">Showing {summary.recent.length} of {summary.total} saved {summary.total === 1 ? 'experiment' : 'experiments'}.</p></> : null}
    </section>
    <p className="catalogue-footnote">Measured values depend on the local machine and test inputs. Registry complexity is a theoretical reference; it is not inferred from these runs.</p>
  </main>
}
