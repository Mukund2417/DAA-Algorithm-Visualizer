import { useState } from 'react'

const curves = [
  { id: 'constant', label: '1', color: '#737d75', fn: (_n: number) => 1 },
  { id: 'logarithmic', label: 'log₂ n', color: '#697f9b', fn: (n: number) => Math.log2(n) },
  { id: 'linear', label: 'n', color: '#26734d', fn: (n: number) => n },
  { id: 'linearithmic', label: 'n log₂ n', color: '#a27835', fn: (n: number) => n * Math.log2(n) },
  { id: 'quadratic', label: 'n²', color: '#8d5c61', fn: (n: number) => n * n },
  { id: 'exponential', label: '2ⁿ', color: '#536f72', fn: (n: number) => 2 ** n },
]

function GrowthChart() {
  const width = 720, height = 265
  const left = 44, right = 14, top = 16, bottom = 34
  const plotWidth = width - left - right, plotHeight = height - top - bottom
  const [maxInputSize, setMaxInputSize] = useState(20)
  const maxValue = curves[curves.length - 1].fn(maxInputSize)
  const pathFor = (fn: (n: number) => number) => Array.from({ length: 20 }, (_, index) => {
    const n = 1 + (index / 19) * (maxInputSize - 1)
    const x = left + (index / 19) * plotWidth
    const y = top + plotHeight - (fn(n) / maxValue) * plotHeight
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
  return <div className="growth-chart-wrap">
    <svg className="growth-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="growth-title growth-desc">
      <title id="growth-title">Illustrative theoretical growth functions</title>
      <desc id="growth-desc">Normalized curves for constant, logarithmic, linear, linearithmic, quadratic, and exponential functions. These are mathematical shapes, not measured runtimes.</desc>
      {[0, 1, 2, 3].map((line) => { const y = top + (line / 3) * plotHeight; return <line key={line} x1={left} x2={width - right} y1={y} y2={y} stroke="#e7eae5" strokeWidth="1" /> })}
      <line x1={left} x2={width - right} y1={height - bottom} y2={height - bottom} stroke="#aeb7ae" />
      <line x1={left} x2={left} y1={top} y2={height - bottom} stroke="#aeb7ae" />
      {curves.map((curve) => <path key={curve.id} d={pathFor(curve.fn)} fill="none" stroke={curve.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
      <text x={width / 2} y={height - 7} textAnchor="middle" fill="#68716d" fontSize="10">Input size, n</text>
      <text x="12" y={height / 2} textAnchor="middle" fill="#68716d" fontSize="10" transform={`rotate(-90 12 ${height / 2})`}>Relative operation growth</text>
      <text x={left} y={height - bottom + 14} textAnchor="middle" fill="#68716d" fontSize="9">1</text>
      <text x={width - right} y={height - bottom + 14} textAnchor="middle" fill="#68716d" fontSize="9">{maxInputSize}</text>
    </svg>
    <div className="curve-legend">{curves.map((curve) => <span key={curve.id}><i style={{ background: curve.color }}></i>{curve.label}</span>)}</div>
    <label className="growth-size-control">Chart input-size range: 1 to {maxInputSize}<input type="range" min="8" max="40" step="1" value={maxInputSize} onChange={(event) => setMaxInputSize(Number(event.target.value))} aria-label="Maximum input size in the complexity growth chart" /></label>
    <p className="chart-caption">Illustrative normalized functions over n = 1…{maxInputSize}. Values are mathematical, not timing measurements.</p>
  </div>
}

export function Foundations({ onOpenBenchmark }: { onOpenBenchmark: () => void }) {
  return <main className="foundations-page">
    <section className="page-heading"><div><p className="eyebrow">Analysis foundations</p><h1>Reason about efficiency</h1><p>Asymptotic analysis describes how resource use grows with input size. Experiments show what happened in a particular environment.</p></div><button className="button button-primary" onClick={onOpenBenchmark}>Configure an input-size experiment</button></section>
    <div className="foundations-grid">
      <section className="foundation-section panel growth-section"><div className="panel-heading"><span>Classes of functions</span><span className="subtle-label">Theoretical curves</span></div><GrowthChart /></section>
      <section className="foundation-section panel"><div className="panel-heading"><span>Asymptotic notation</span><span className="subtle-label">For sufficiently large n</span></div><dl className="notation-list"><div><dt><code>O(g(n))</code></dt><dd>Asymptotic upper bound: f(n) grows no faster than a constant multiple of g(n), beyond some threshold.</dd></div><div><dt><code>Ω(g(n))</code></dt><dd>Asymptotic lower bound: f(n) grows at least as fast as a constant multiple of g(n), beyond some threshold.</dd></div><div><dt><code>Θ(g(n))</code></dt><dd>Tight asymptotic bound: both an upper and lower bound hold, up to constant factors.</dd></div></dl></section>
      <section className="foundation-section panel"><div className="panel-heading"><span>Algorithm analysis</span><span className="subtle-label">Resource accounting</span></div><div className="concept-copy"><p><strong>An algorithm</strong> is a finite, definite, effective sequence of steps that maps permitted input to output. Its characteristics include well-defined input and output, unambiguous steps, termination, and executable operations.</p><p><strong>Time complexity</strong> counts the growth of chosen primitive operations as input size increases. The exact operation model should be stated.</p><p><strong>Auxiliary space</strong> is extra memory used by the algorithm, excluding the input itself. Recursion stacks and temporary tables count as auxiliary space.</p><p><strong>Best, average, and worst cases</strong> describe different input families of the same size. The average case depends on a stated input distribution.</p></div></section>
      <section className="foundation-section panel"><div className="panel-heading"><span>What an experiment can show</span><span className="subtle-label">Measured data</span></div><div className="concept-copy"><p>Run the same implementation at increasing input sizes, record deterministic operation counts, and repeat timing trials. Report the statistic and the test case.</p><p>A measured curve can support an explanation of observed behavior. It cannot prove an asymptotic bound from a finite set of runs.</p></div><div className="callout-note">In AlgoScope, benchmark charts are generated from executions. The curves above are separate theoretical illustrations.</div></section>
      <section className="foundation-section panel classification-section"><div className="panel-heading"><span>Complexity classes</span><span className="subtle-label">Conceptual guide</span></div><div className="class-grid"><article><h2>P</h2><p>Decision problems solvable by a deterministic algorithm in polynomial time.</p></article><article><h2>NP</h2><p>Decision problems whose proposed yes-certificates can be verified in polynomial time by a deterministic algorithm.</p></article><article><h2>NP-hard</h2><p>Problems at least as hard as every problem in NP under polynomial-time reductions. An NP-hard problem need not itself be in NP.</p></article><article><h2>NP-complete</h2><p>Problems that are both in NP and NP-hard: the hardest problems within NP under the standard reductions.</p></article></div><p className="subset-note"><strong>P ⊆ NP.</strong> Whether P = NP remains open. A few executions on sample inputs cannot establish a problem’s class.</p></section>
      <section className="foundation-section panel"><div className="panel-heading"><span>Nondeterministic algorithms</span><span className="subtle-label">A computational model</span></div><div className="concept-copy"><p>A nondeterministic polynomial-time computation can be viewed as guessing a certificate and then checking it in polynomial time. This is a model for defining NP, not a claim that ordinary hardware explores all guesses instantly.</p><p>For SAT, a satisfying assignment is a certificate; checking whether it satisfies every clause is polynomial in the formula size.</p></div></section>
    </div>
  </main>
}
