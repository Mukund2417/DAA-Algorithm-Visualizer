import { useMemo, useState } from 'react'
import type { Algorithm, ComparisonResult } from '../types'
import { api } from '../services/api'

const compatibleIds = ['merge-sort', 'quick-sort', 'insertion-sort', 'selection-sort', 'heap-sort']
const initialValues: Array<number | string> = [29, 10, 14, 37, 13, 5, 42]

export function ComparisonLab({ algorithms }: { algorithms: Algorithm[] }) {
  const compatible = useMemo(() => algorithms.filter((item) => compatibleIds.includes(item.id)), [algorithms])
  const [selectedIds, setSelectedIds] = useState<string[]>(compatibleIds)
  const [values, setValues] = useState<Array<number | string>>(initialValues)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (compatible.length < 2) return <main className="comparison-page"><div className="empty-state"><h1>Comparison unavailable</h1><p>The registry must contain at least two sorting algorithms.</p></div></main>

  const changeValues = (next: Array<number | string>) => { setValues(next); setResult(null); setError('') }
  const toggleAlgorithm = (id: string, checked: boolean) => {
    setSelectedIds((current) => checked ? [...current, id] : current.filter((item) => item !== id))
    setResult(null); setError('')
  }

  const run = async () => {
    if (selectedIds.length < 2) { setError('Choose at least two sorting algorithms to compare.'); return }
    if (values.length > 5000 || values.some((value) => value === '' || typeof value !== 'number' || !Number.isFinite(value))) {
      setResult(null); setError('Enter numbers in every box. You can compare up to 5,000 values.'); return
    }
    setLoading(true); setError(''); setResult(null)
    try {
      setResult(await api.compare(selectedIds, { array: values as number[] }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Comparison could not be run.')
    } finally { setLoading(false) }
  }

  const numericValues = values as number[]
  const expected = [...numericValues].sort((first, second) => first - second)
  const titleFor = (id: string) => algorithms.find((algorithm) => algorithm.id === id)?.name ?? id
  const availableIds = new Set(compatible.map((item) => item.id))

  return <main className="comparison-page">
    <section className="page-heading compact-heading"><div><p className="eyebrow">Same input / multiple strategies</p><h1>Compare sorting algorithms</h1><p>Run two or more sorting methods on one shared array and compare their sorted output, operation counts, and local timings.</p></div></section>
    <div className="comparison-layout">
      <section className="comparison-input panel">
        <div className="panel-heading"><span>Choose algorithms</span><span className="subtle-label">2–5 methods</span></div>
        <div className="comparison-algorithm-list">{compatible.map((algorithm) => <label className="comparison-algorithm-choice" key={algorithm.id}>
          <input type="checkbox" checked={selectedIds.includes(algorithm.id)} disabled={loading || (!selectedIds.includes(algorithm.id) && selectedIds.length >= 5) || (selectedIds.includes(algorithm.id) && selectedIds.length <= 2)} onChange={(event) => toggleAlgorithm(algorithm.id, event.target.checked)} />
          <span>{algorithm.name}</span>
        </label>)}</div>
        <div className="comparison-input-heading"><strong>Shared number array</strong><span>{values.length} values</span></div>
        <div className="comparison-values">{values.map((value, index) => <div className="comparison-value-box" key={index}><label>Value {index + 1}<input type="number" step="any" disabled={loading} value={value} onChange={(event) => changeValues(values.map((entry, row) => row === index ? event.target.value === '' ? '' : Number(event.target.value) : entry))} /></label><button type="button" aria-label={`Remove value ${index + 1}`} disabled={loading} onClick={() => changeValues(values.filter((_, row) => row !== index))}>×</button></div>)}</div>
        <button className="comparison-add-value" type="button" disabled={loading || values.length >= 5000} onClick={() => changeValues([...values, 0])}>+ Add number</button>
        <p>All selected methods receive the exact same values.</p>
        <button className="button button-primary full-width" disabled={loading || selectedIds.filter((id) => availableIds.has(id)).length < 2} onClick={run}>{loading ? 'Comparing…' : 'Run comparison'}</button>
        {error ? <p className="status error" role="alert">{error}</p> : null}
      </section>
      <section className="comparison-results">
        {result ? <>
          <div className="comparison-result-grid">{result.runs.map((run) => {
            const output = run.result.sorted_array as number[] | undefined
            const correct = JSON.stringify(output) === JSON.stringify(expected)
            const algorithm = algorithms.find((item) => item.id === run.algorithm_id)
            return <article className="comparison-card panel" key={run.algorithm_id}>
              <div className="comparison-title"><span className="tag">{algorithm?.category ?? 'Sorting'}</span><h2>{titleFor(run.algorithm_id)}</h2></div>
              <span className={correct ? 'result-check correct' : 'result-check incorrect'}>{correct ? 'Output matches sorted reference' : 'Output differs from sorted reference'}</span>
              <div className="comparison-output"><span>Sorted output</span><code>{output?.join(', ') ?? 'No output'}</code></div>
              <div className="comparison-metrics"><div><strong>{run.metrics.comparisons ?? 0}</strong><span>comparisons</span></div><div><strong>{run.metrics.writes ?? 0}</strong><span>assignments</span></div><div><strong>{run.execution_time_ms.toFixed(5)} ms</strong><span>single local run</span></div></div>
              <div className="comparison-theory"><span>Theoretical worst case</span><strong>{algorithm?.worst_case}</strong><span>Auxiliary space</span><strong>{algorithm?.space_complexity}</strong></div>
            </article>
          })}</div>
          <p className="comparison-note">{result.note} A single local timing is included as context only; use repeated Benchmarks for steadier timing summaries.</p>
        </> : <div className="comparison-empty panel"><span aria-hidden="true">↔</span><h2>Equivalent inputs make a fair comparison.</h2><p>Select at least two sorting algorithms, enter one shared array, then run the comparison.</p></div>}
      </section>
    </div>
  </main>
}
