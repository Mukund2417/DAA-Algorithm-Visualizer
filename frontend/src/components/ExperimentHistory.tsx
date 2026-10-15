import { useEffect, useState } from 'react'
import type { Algorithm, Experiment } from '../types'
import { api } from '../services/api'

export function ExperimentHistory({ algorithms, onRerun }: { algorithms: Algorithm[]; onRerun: (algorithmId: string, input: Experiment['input']) => void }) {
  const [items, setItems] = useState<Experiment[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try { setItems(await api.experiments()); setMessage('') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load history.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const titleFor = (id: string) => algorithms.find((algorithm) => algorithm.id === id)?.name ?? id
  const exportData = () => {
    const report = { generated_at: new Date().toISOString(), source: 'Saved AlgoScope experiments', experiments: items }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `algoscope-experiments-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return <main className="history-page">
    <section className="page-heading"><div><p className="eyebrow">Saved experiments / SQLite</p><h1>Experiment history</h1><p>Saved inputs, verified outputs, and operation counters from your local runs.</p></div></section>
    <div className="history-actions"><button className="outline-button" onClick={() => void load()} disabled={loading}>{loading ? 'Loading…' : 'Refresh history'}</button><button className="button button-secondary" onClick={exportData} disabled={loading || items.length === 0}>Export saved data (JSON)</button><span>{items.length} saved {items.length === 1 ? 'experiment' : 'experiments'}</span></div>
    {message ? <div className="history-error" role="alert"><p>History could not be loaded: {message}</p><button className="button button-secondary" onClick={() => void load()}>Try again</button></div> : null}
    {loading ? <div className="empty-benchmark panel" role="status">Loading saved experiments…</div> : null}
    {!loading && !message && items.length === 0 ? <div className="empty-benchmark panel"><strong>No saved experiments yet.</strong><p>Run an algorithm and choose “Save run” to store its input and computed result.</p></div> : null}
    {!loading && !message && items.length > 0 ? <section className="history-list" aria-label="Saved experiments">{items.map((item) => <article className="history-row panel" key={item.id}><div><span className="tag">Run #{item.id} · verified</span><h2>{item.title || titleFor(item.algorithm_id)}</h2><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time></div><div className="history-result"><span>Computed result</span><code>{JSON.stringify(item.result)}</code><span className="history-input-label">Input</span><code>{JSON.stringify(item.input)}</code></div><div className="history-metrics">{Object.entries(item.metrics).map(([key, value]) => <span key={key}><strong>{value}</strong> {key.replace('_', ' ')}</span>)}</div><button className="button button-secondary" onClick={() => onRerun(item.algorithm_id, item.input)}>Rerun input</button></article>)}</section> : null}
  </main>
}
