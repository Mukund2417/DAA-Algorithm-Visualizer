import type { Algorithm } from '../types'

export function ComplexityCard({ algorithm }: { algorithm: Algorithm }) {
  return <section className="complexity panel"><div className="panel-heading"><span>Complexity lens</span><small>Theory, not a timing claim</small></div><div className="complexity-grid"><div><span>Best</span><strong>{algorithm.best_case}</strong></div><div><span>Average</span><strong>{algorithm.average_case}</strong></div><div><span>Worst</span><strong>{algorithm.worst_case}</strong></div><div><span>Auxiliary space</span><strong>{algorithm.space_complexity}</strong></div></div><p>Operation counters and benchmark timings are observed measurements. They help compare runs but do not establish an asymptotic bound.</p></section>
}
