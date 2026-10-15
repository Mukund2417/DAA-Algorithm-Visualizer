import { useMemo, useState } from 'react'
import type { Algorithm, BenchmarkResult } from '../types'
import { api } from '../services/api'

const benchmarkIds = ['merge-sort', 'quick-sort', 'binary-search']

export function BenchmarkLab({ algorithms }: { algorithms: Algorithm[] }) {
  const available = useMemo(() => algorithms.filter((item) => benchmarkIds.includes(item.id)), [algorithms])
  const [algorithm, setAlgorithm] = useState('merge-sort')
  const [caseType, setCaseType] = useState('random')
  const [sizeSource, setSizeSource] = useState('10, 100, 500, 1000, 2500')
  const [result, setResult] = useState<BenchmarkResult | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const isSearch = algorithm === 'binary-search'
  const selected = available.find((item) => item.id === algorithm)

  const run = async () => {
    const sizes = sizeSource.split(',').map((value) => Number(value.trim()))
    if (sizes.length === 0 || sizes.length > 8 || sizes.some((size) => !Number.isInteger(size) || size < 2 || size > 10000)) {
      setResult(null); setMessage('Enter 1 to 8 whole input sizes between 2 and 10,000, separated by commas.'); return
    }
    try {
      setLoading(true); setMessage(''); setResult(null)
      setResult(await api.benchmark(algorithm, sizes, caseType))
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not run benchmark.') }
    finally { setLoading(false) }
  }
  const maxTime = Math.max(...(result?.points.map((point) => point.median_time_ms) ?? [1]), 0.00001)
  const maxOps = Math.max(...(result?.points.map((point) => point.median_operations) ?? [1]), 1)
  const caseOptions = isSearch
    ? [['best', 'Best case'], ['average', 'Average case'], ['worst', 'Worst case']]
    : [['random', 'Shuffled input'], ['sorted', 'Already sorted'], ['reversed', 'Reverse sorted']]

  return <main className="benchmark-page">
    <section className="page-heading"><div><p className="eyebrow">Performance lab / measured results</p><h1>Run a repeatable experiment</h1><p>Timings come from real executions with visualization snapshots disabled. Medians summarize local runs; they do not establish theoretical bounds.</p></div></section>
    <section className="benchmark-controls panel" aria-label="Benchmark configuration">
      <label>Algorithm<select disabled={loading} value={algorithm} onChange={(event) => { const next = event.target.value; setAlgorithm(next); setCaseType(next === 'binary-search' ? 'average' : 'random'); setResult(null) }}>{available.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>{isSearch ? 'Search scenario' : 'Input order'}<select disabled={loading} value={caseType} onChange={(event) => { setCaseType(event.target.value); setResult(null) }}>{caseOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label className="sizes-field">Input sizes, n<input disabled={loading} value={sizeSource} onChange={(event) => { setSizeSource(event.target.value); setResult(null) }} placeholder="10, 100, 500" inputMode="numeric" /></label>
      <button className="button button-primary" onClick={run} disabled={loading || available.length === 0}>{loading ? 'Measuring…' : 'Run 5 trials'}</button>
    </section>
    {message ? <p className="status error" role="alert">{message}</p> : null}
    {result ? <section className="benchmark-results" aria-label="Benchmark charts">
      <div className="benchmark-context panel"><div><span>Algorithm</span><strong>{selected?.name}</strong></div><div><span>Input case</span><strong>{caseOptions.find(([value]) => value === result.case_type)?.[1] ?? result.case_type}</strong></div><div><span>Summary</span><strong>Median of {result.trials} trials</strong></div><div><span>Input sizes</span><strong>{result.points.map((point) => point.input_size).join(', ')}</strong></div></div>
      <div className="chart-grid">
        <section className="chart-card panel"><div className="panel-heading"><span>Execution time by input size</span><small>measured · milliseconds</small></div><div className="chart-area"><span className="axis-label y-axis">Median time (ms)</span><div className="bar-chart">{result.points.map((point) => <div className="bar-group" key={point.input_size}><div className="bar time" style={{ height: `${Math.max(3, (point.median_time_ms / maxTime) * 170)}px` }} title={`${point.median_time_ms} milliseconds`}></div><strong>{point.input_size.toLocaleString()}</strong><span>{point.median_time_ms.toFixed(5)}</span></div>)}</div><span className="axis-label x-axis">Input size, n</span></div><p className="chart-caption">Each bar is the median elapsed algorithm time for the input size below it.</p></section>
        <section className="chart-card panel"><div className="panel-heading"><span>Instrumented work by input size</span><small>comparisons + array assignments</small></div><div className="chart-area"><span className="axis-label y-axis">Count</span><div className="bar-chart">{result.points.map((point) => <div className="bar-group" key={point.input_size}><div className="bar ops" style={{ height: `${Math.max(3, (point.median_operations / maxOps) * 170)}px` }} title={`${point.median_operations} instrumented operations`}></div><strong>{point.input_size.toLocaleString()}</strong><span>{point.median_operations.toLocaleString()}</span></div>)}</div><span className="axis-label x-axis">Input size, n</span></div><p className="chart-caption">Counts are collected by the implementation; timing noise is environment dependent.</p></section>
      </div>
      <p className="benchmark-note">{result.note} This run uses the local API process and Python’s monotonic high-resolution timer. Benchmark input generation and visualization rendering are outside the timed interval; input validation and algorithm execution are inside it.</p>
      <p className="environment-note">Environment: Python {result.environment.python_version} · {result.environment.platform} · {result.environment.timer}</p>
    </section> : <section className="empty-benchmark panel"><strong>Configure an experiment to begin.</strong><p>{isSearch ? 'Search cases select targets to represent the requested best, average, or worst comparison path.' : 'Choose input order and sizes to observe how this implementation behaves.'}</p></section>}
  </main>
}
