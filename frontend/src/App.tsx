import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlgorithmLab } from './components/AlgorithmLab'
import { BenchmarkLab } from './components/BenchmarkLab'
import { ComparisonLab } from './components/ComparisonLab'
import { AlgorithmExplorer } from './components/Dashboard'
import { ExperimentHistory } from './components/ExperimentHistory'
import { Foundations } from './components/Foundations'
import { OverviewDashboard } from './components/OverviewDashboard'
import { api } from './services/api'
import type { Algorithm, JsonObject } from './types'

type Page = 'dashboard' | 'explorer' | 'foundations' | 'lab' | 'compare' | 'benchmark' | 'history'
type RegistryState = 'loading' | 'ready' | 'error'
interface InitialRun { algorithmId: string; input: JsonObject; key: number }

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [algorithms, setAlgorithms] = useState<Algorithm[]>([])
  const [selectedId, setSelectedId] = useState('merge-sort')
  const [initialRun, setInitialRun] = useState<InitialRun | null>(null)
  const [registryState, setRegistryState] = useState<RegistryState>('loading')
  const [registryError, setRegistryError] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [globalQuery, setGlobalQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const globalSearchRef = useRef<HTMLInputElement>(null)
  const loadRegistry = useCallback(async () => {
    setRegistryState('loading')
    setRegistryError('')
    try {
      const loadedAlgorithms = await api.algorithms()
      setAlgorithms(loadedAlgorithms)
      setSelectedId((current) => loadedAlgorithms.some((item) => item.id === current) ? current : loadedAlgorithms[0]?.id ?? '')
      setRegistryState('ready')
    } catch (error) {
      setRegistryError(error instanceof Error ? error.message : 'The algorithm service could not be reached.')
      setRegistryState('error')
    }
  }, [])
  useEffect(() => { void loadRegistry() }, [loadRegistry])
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        globalSearchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  const navigate = useCallback((nextPage: Page) => {
    setPage(nextPage)
    setMobileMenuOpen(false)
    setSearchOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])
  const launch = useCallback((id: string, input?: JsonObject) => {
    setSelectedId(id)
    setInitialRun(input ? { algorithmId: id, input, key: Date.now() } : null)
    navigate('lab')
  }, [navigate])
  const searchResults = useMemo(() => {
    const query = globalQuery.trim().toLocaleLowerCase()
    return query ? algorithms.filter((algorithm) => `${algorithm.name} ${algorithm.category} ${algorithm.description}`.toLocaleLowerCase().includes(query)).slice(0, 6) : []
  }, [algorithms, globalQuery])
  const currentTitle = ({ dashboard: 'Dashboard', explorer: 'Algorithm Explorer', foundations: 'Foundations', lab: 'Algorithm Lab', compare: 'Algorithm Comparison', benchmark: 'Performance Lab', history: 'Experiments & Reports' } as Record<Page, string>)[page]

  const pageLink = (target: Page, label: string, marker: string) => {
    const active = page === target
    return <button className={`side-link${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} title={sidebarCollapsed ? label : undefined} aria-label={label} onClick={() => navigate(target)} key={label}>
      <span className="side-icon" aria-hidden="true">{marker}</span><span className="side-label">{label}</span>
    </button>
  }

  return <div className={`app-frame${sidebarCollapsed ? ' sidebar-collapsed' : ''}${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
    <aside className="app-sidebar" aria-label="Application navigation">
      <button className="brand" onClick={() => navigate('dashboard')} aria-label="AlgoScope dashboard"><span className="brand-mark">A</span><span className="brand-name">AlgoScope</span></button>
      <div className="sidebar-section"><p className="sidebar-heading">Workspace</p>{pageLink('dashboard', 'Dashboard', '⌂')}{pageLink('explorer', 'Algorithm Explorer', '⌕')}{pageLink('lab', 'Algorithm Lab', '▷')}</div>
      <div className="sidebar-section"><p className="sidebar-heading">Analysis</p>{pageLink('benchmark', 'Performance Lab', '⌁')}{pageLink('compare', 'Algorithm Comparison', '⇄')}{pageLink('history', 'Experiments & Reports', '▤')}{pageLink('foundations', 'Foundations', '∑')}</div>
      <button className="sidebar-collapse" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed}><span aria-hidden="true">{sidebarCollapsed ? '»' : '«'}</span><span className="side-label">Collapse sidebar</span></button>
    </aside>
    <button className="sidebar-backdrop" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu" tabIndex={mobileMenuOpen ? 0 : -1}></button>

    <div className="main-region">
      <header className="app-header">
        <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen((open) => !open)} aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen}><span></span><span></span><span></span></button>
        <div className="breadcrumbs"><span>AlgoScope</span><span aria-hidden="true">/</span><strong>{currentTitle}</strong></div>
        <div className="global-search-wrap">
          <label className="global-search"><span aria-hidden="true">⌕</span><input ref={globalSearchRef} type="search" value={globalQuery} onFocus={() => setSearchOpen(true)} onBlur={() => window.setTimeout(() => setSearchOpen(false), 100)} onChange={(event) => { setGlobalQuery(event.target.value); setSearchOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') { setGlobalQuery(''); setSearchOpen(false) } else if (event.key === 'Enter' && searchResults[0]) { launch(searchResults[0].id); setGlobalQuery('') } }} placeholder="Search algorithms…" aria-label="Search the algorithm registry" aria-expanded={searchOpen && globalQuery.trim().length > 0} aria-controls="global-search-results" role="combobox" aria-autocomplete="list" />{globalQuery ? <button aria-label="Clear search" onClick={() => { setGlobalQuery(''); setSearchOpen(false) }}>×</button> : <kbd>Ctrl K</kbd>}</label>
          {searchOpen && globalQuery.trim() ? <div className="global-search-results" id="global-search-results" role="listbox">{searchResults.length ? searchResults.map((algorithm) => <button role="option" aria-selected="false" key={algorithm.id} onMouseDown={(event) => event.preventDefault()} onClick={() => { launch(algorithm.id); setGlobalQuery('') }}><span className="search-category">{algorithm.category}</span><span><strong>{algorithm.name}</strong><small>{algorithm.worst_case}</small></span><span aria-hidden="true">↗</span></button>) : <p>No registered algorithms match that search.</p>}</div> : null}
        </div>
        <div className={`api-status ${registryState}`} aria-live="polite"><span></span>{registryState === 'ready' ? 'API connected' : registryState === 'loading' ? 'Connecting' : 'API unavailable'}</div>
      </header>
      {registryState === 'loading' ? <main className="app-state" role="status"><span className="loading-mark" aria-hidden="true"></span><p>Connecting to the algorithm registry…</p></main> : null}
      {registryState === 'error' ? <main className="app-state" role="alert"><p className="eyebrow">Algorithm service</p><h1>Could not load the catalogue.</h1><p>{registryError}</p><p className="state-help">Check that the FastAPI server is running at <code>127.0.0.1:8000</code>, then try again.</p><button className="button button-primary" onClick={() => void loadRegistry()}>Retry connection</button></main> : null}
      {registryState === 'ready' && page === 'dashboard' && <OverviewDashboard algorithms={algorithms} onNavigate={navigate} onRerun={launch} />}
      {registryState === 'ready' && page === 'explorer' && <AlgorithmExplorer algorithms={algorithms} onLaunch={(id) => launch(id)} />}
      {registryState === 'ready' && page === 'foundations' && <Foundations onOpenBenchmark={() => navigate('benchmark')} />}
      {registryState === 'ready' && page === 'lab' && <AlgorithmLab algorithms={algorithms} selectedId={selectedId} onSelect={setSelectedId} initialRun={initialRun} />}
      {registryState === 'ready' && page === 'compare' && <ComparisonLab algorithms={algorithms} />}
      {registryState === 'ready' && page === 'benchmark' && <BenchmarkLab algorithms={algorithms} />}
      {registryState === 'ready' && page === 'history' && <ExperimentHistory algorithms={algorithms} onRerun={launch} />}
    </div>
  </div>
}
