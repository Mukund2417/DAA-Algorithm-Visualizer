import { useEffect, useMemo, useState } from 'react'
import type { Algorithm, Execution, JsonObject } from '../types'
import { api } from '../services/api'
import { AlgorithmControls } from './AlgorithmControls'
import { CodePanel } from './CodePanel'
import { ComplexityCard } from './ComplexityCard'
import { StepVisualizer, TraceResult } from './StepVisualizer'

interface Props { algorithms: Algorithm[]; selectedId: string; onSelect: (id: string) => void; initialRun?: { algorithmId: string; input: JsonObject; key: number } | null }

type InputNumber = number | string
interface KnapsackDraft { capacity: InputNumber; items: Array<{ name: string; weight: InputNumber; value: InputNumber }> }

function parseKnapsackDraft(source: string): KnapsackDraft {
  try {
    const input = JSON.parse(source) as { capacity?: unknown; items?: unknown }
    const numberInput = (value: unknown, fallback: number): InputNumber => typeof value === 'number' || typeof value === 'string' ? value : fallback
    return {
      capacity: numberInput(input.capacity, 10),
      items: Array.isArray(input.items) ? input.items.map((item, index) => {
        const row = item && typeof item === 'object' ? item as Record<string, unknown> : {}
        return { name: String(row.name ?? `Item ${index + 1}`), weight: numberInput(row.weight, 1), value: numberInput(row.value, 1) }
      }) : [],
    }
  } catch {
    return { capacity: 10, items: [] }
  }
}

function parseInputNumber(value: string): InputNumber { return value === '' ? '' : Number(value) }

function cloneDraft<T,>(value: T): T { return JSON.parse(JSON.stringify(value)) as T }

function inputLabel(key: string) { return key.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) }

function ScalarInput({ label, value, template, onChange }: { label: string; value: unknown; template: unknown; onChange: (next: unknown) => void }) {
  if (typeof value === 'boolean') return <label className="generic-field generic-checkbox"><span>{inputLabel(label)}</span><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /></label>
  if (label === 'strategy' && typeof value === 'string') return <label className="generic-field"><span>{inputLabel(label)}</span><select value={value} onChange={(event) => onChange(event.target.value)}><option value="FIFO">FIFO</option><option value="LIFO">LIFO</option><option value="least-cost">Least cost</option></select></label>
  const numeric = typeof value === 'number' || typeof template === 'number'
  const shown = value === null || value === undefined ? '' : String(value)
  return <label className="generic-field"><span>{inputLabel(label)}</span><input type={numeric ? 'number' : 'text'} step={numeric ? 'any' : undefined} value={shown} onChange={(event) => onChange(numeric ? parseInputNumber(event.target.value) : event.target.value)} /></label>
}

function JsonInputField({ label, value, template, onChange }: { label: string; value: unknown; template: unknown; onChange: (next: unknown) => void }) {
  if (Array.isArray(value)) {
    const templateItem = Array.isArray(template) ? template[0] : undefined
    if (value.some(Array.isArray) || Array.isArray(templateItem)) {
      const tupleTemplate = Array.isArray(templateItem) ? templateItem : (value.find(Array.isArray) as unknown[] | undefined) ?? []
      const columns = tupleTemplate.length
      const columnName = (index: number) => columns === 3 ? ['From', 'To', 'Weight'][index] : columns === 2 ? ['From', 'To'][index] : `Value ${index + 1}`
      return <section className="generic-field generic-array-field"><div className="generic-field-heading"><span>{inputLabel(label)}</span><button type="button" onClick={() => onChange([...value, cloneDraft(tupleTemplate)])}>Add row</button></div><div className="generic-tuple-list">{value.map((tuple, rowIndex) => <div className="generic-tuple-row" key={rowIndex}>{(Array.isArray(tuple) ? tuple : []).map((cell, cellIndex) => <ScalarInput key={cellIndex} label={columnName(cellIndex)} value={cell} template={tupleTemplate[cellIndex]} onChange={(next) => onChange(value.map((entry, index) => index === rowIndex && Array.isArray(entry) ? entry.map((field, column) => column === cellIndex ? next : field) : entry))} />)}<button className="generic-remove" type="button" aria-label={`Remove ${inputLabel(label)} row ${rowIndex + 1}`} onClick={() => onChange(value.filter((_, index) => index !== rowIndex))}>×</button></div>)}</div></section>
    }
    if (templateItem !== null && typeof templateItem === 'object') {
      const itemTemplate = templateItem as Record<string, unknown>
      return <section className="generic-field generic-array-field"><div className="generic-field-heading"><span>{inputLabel(label)}</span><button type="button" onClick={() => onChange([...value, cloneDraft(itemTemplate)])}>Add item</button></div><div className="generic-object-list">{value.map((item, rowIndex) => {
        const row = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
        return <div className="generic-object-row" key={rowIndex}>{Object.entries(itemTemplate).map(([key, fieldTemplate]) => <JsonInputField key={key} label={key} value={row[key] ?? fieldTemplate} template={fieldTemplate} onChange={(next) => onChange(value.map((entry, index) => index === rowIndex ? { ...row, [key]: next } : entry))} />)}<button className="generic-remove" type="button" aria-label={`Remove ${inputLabel(label)} item ${rowIndex + 1}`} onClick={() => onChange(value.filter((_, index) => index !== rowIndex))}>×</button></div>
      })}</div></section>
    }
    const primitiveTemplate = templateItem ?? (value.length ? value[0] : '')
    return <section className="generic-field generic-array-field"><div className="generic-field-heading"><span>{inputLabel(label)}</span><button type="button" onClick={() => onChange([...value, cloneDraft(primitiveTemplate)])}>Add value</button></div><div className="generic-primitive-list">{value.map((entry, index) => <div key={index}><ScalarInput label={`${inputLabel(label)} ${index + 1}`} value={entry} template={primitiveTemplate} onChange={(next) => onChange(value.map((item, row) => row === index ? next : item))} /><button className="generic-remove" type="button" aria-label={`Remove ${inputLabel(label)} value ${index + 1}`} onClick={() => onChange(value.filter((_, row) => row !== index))}>×</button></div>)}</div></section>
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    const example = template !== null && typeof template === 'object' && !Array.isArray(template) ? template as Record<string, unknown> : {}
    const entries = Object.entries(record)
    const mapValueTemplate = Object.values(example)[0] ?? ''
    return <section className="generic-field generic-array-field"><div className="generic-field-heading"><span>{inputLabel(label)}</span><button type="button" onClick={() => onChange({ ...record, [`Symbol ${entries.length + 1}`]: cloneDraft(mapValueTemplate) })}>Add entry</button></div><div className="generic-map-list">{entries.map(([key, entry]) => <div className="generic-map-row" key={key}><label className="generic-field"><span>Symbol / key</span><input value={key} onChange={(event) => { const next = { ...record }; delete next[key]; next[event.target.value] = entry; onChange(next) }} /></label><ScalarInput label="Frequency / value" value={entry} template={example[key] ?? mapValueTemplate} onChange={(next) => onChange({ ...record, [key]: next })} /><button className="generic-remove" type="button" aria-label={`Remove ${key}`} onClick={() => { const next = { ...record }; delete next[key]; onChange(next) }}>×</button></div>)}</div></section>
  }
  return <ScalarInput label={label} value={value} template={template} onChange={onChange} />
}

function AlgorithmInputForm({ value, template, disabled, onChange }: { value: JsonObject; template: JsonObject; disabled: boolean; onChange: (next: JsonObject) => void }) {
  return <fieldset className="generic-form-fieldset" disabled={disabled}><div className="generic-input-form">{Object.entries(value).map(([key, entry]) => <JsonInputField key={key} label={key} value={entry} template={template[key]} onChange={(next) => onChange({ ...value, [key]: next })} />)}</div></fieldset>
}

function parseGenericDraft(source: string, fallback: JsonObject): JsonObject {
  try {
    const value = JSON.parse(source)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : cloneDraft(fallback)
  } catch { return cloneDraft(fallback) }
}

export function AlgorithmLab({ algorithms, selectedId, onSelect, initialRun }: Props) {
  const selected = useMemo(() => algorithms.find((algorithm) => algorithm.id === selectedId) ?? algorithms[0], [algorithms, selectedId])
  const [source, setSource] = useState('')
  const [execution, setExecution] = useState<Execution | null>(null)
  const [executedInput, setExecutedInput] = useState<JsonObject | null>(null)
  const [position, setPosition] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(700)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (selected) {
      const input = initialRun?.algorithmId === selected.id ? initialRun.input : selected.input_example
      setSource(JSON.stringify(input, null, 2))
    }
    setExecution(null); setExecutedInput(null); setPosition(0); setPlaying(false); setMessage(null)
  }, [selected?.id, initialRun?.key])

  useEffect(() => {
    if (!playing || !execution) return
    const timer = window.setInterval(() => setPosition((step) => {
      return Math.min(execution.steps.length - 1, step + 1)
    }), speed)
    return () => window.clearInterval(timer)
  }, [playing, execution, speed])
  useEffect(() => {
    if (playing && execution && position >= execution.steps.length - 1) setPlaying(false)
  }, [playing, execution, position])

  if (!selected) return null
  const current = execution?.steps[position]
  const run = async () => {
    setBusy(true); setMessage(null); setPlaying(false); setExecution(null); setExecutedInput(null); setPosition(0)
    try {
      const input = JSON.parse(source) as JsonObject
      const result = await api.execute(selected.id, input)
      setExecution(result); setExecutedInput(input); setPosition(0)
      setMessage(`${result.steps.length} replayable steps are ready.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to run the algorithm.')
    } finally { setBusy(false) }
  }
  const save = async () => {
    if (!execution || !executedInput || saving) return
    setSaving(true)
    try {
      await api.saveExperiment(selected.id, executedInput, execution.result, execution.metrics)
      setMessage('Experiment saved to the local history.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save experiment.') }
    finally { setSaving(false) }
  }
  const metrics = current?.metrics ?? execution?.metrics
  const isBranchBoundKnapsack = selected.id === 'knapsack-branch-bound'
  const knapsackDraft = isBranchBoundKnapsack ? parseKnapsackDraft(source) : null
  const genericDraft = isBranchBoundKnapsack ? null : parseGenericDraft(source, selected.input_example)
  const updateKnapsackDraft = (next: KnapsackDraft) => {
    setSource(JSON.stringify(next, null, 2)); setExecution(null); setExecutedInput(null); setPosition(0); setPlaying(false); setMessage(null)
  }
  const updateGenericDraft = (next: JsonObject) => {
    setSource(JSON.stringify(next, null, 2)); setExecution(null); setExecutedInput(null); setPosition(0); setPlaying(false); setMessage(null)
  }

  return <main className="lab-layout">
    <aside className="algorithm-sidebar panel">
      <p className="eyebrow">Algorithm catalogue</p>
      <select aria-label="Select algorithm" value={selected.id} disabled={busy} onChange={(event) => onSelect(event.target.value)}>
        {algorithms.map((algorithm) => <option value={algorithm.id} key={algorithm.id}>{algorithm.name}</option>)}
      </select>
      <div className="algorithm-summary"><span className="tag">{selected.category}</span><h1>{selected.name}</h1><p>{selected.description}</p></div>
      <div className="input-head"><span>{isBranchBoundKnapsack ? 'Problem inputs' : 'Input fields'}</span><button className="text-button" disabled={busy} onClick={() => { setSource(JSON.stringify(selected.input_example, null, 2)); setExecution(null); setExecutedInput(null); setPosition(0); setPlaying(false); setMessage(null) }}>Restore example</button></div>
      {isBranchBoundKnapsack && knapsackDraft ? <div className="knapsack-form" aria-describedby="input-help">
        <label className="knapsack-capacity-field">Capacity<input type="number" min="0" step="any" disabled={busy} value={knapsackDraft.capacity} onChange={(event) => updateKnapsackDraft({ ...knapsackDraft, capacity: parseInputNumber(event.target.value) })} /></label>
        <div className="knapsack-input-heading"><strong>Items</strong><span>Name · weight · value</span></div>
        <div className="knapsack-input-list">{knapsackDraft.items.map((item, index) => <div className="knapsack-input-row" key={index}>
          <label>Item name<input type="text" disabled={busy} value={item.name} onChange={(event) => updateKnapsackDraft({ ...knapsackDraft, items: knapsackDraft.items.map((entry, row) => row === index ? { ...entry, name: event.target.value } : entry) })} /></label>
          <label>Weight<input type="number" min="0" step="any" disabled={busy} value={item.weight} onChange={(event) => updateKnapsackDraft({ ...knapsackDraft, items: knapsackDraft.items.map((entry, row) => row === index ? { ...entry, weight: parseInputNumber(event.target.value) } : entry) })} /></label>
          <label>Value<input type="number" min="0" step="any" disabled={busy} value={item.value} onChange={(event) => updateKnapsackDraft({ ...knapsackDraft, items: knapsackDraft.items.map((entry, row) => row === index ? { ...entry, value: parseInputNumber(event.target.value) } : entry) })} /></label>
          <button className="remove-knapsack-item" type="button" aria-label={`Remove ${item.name || `item ${index + 1}`}`} disabled={busy} onClick={() => updateKnapsackDraft({ ...knapsackDraft, items: knapsackDraft.items.filter((_, row) => row !== index) })}>×</button>
        </div>)}</div>
        <button className="add-knapsack-item" type="button" disabled={busy || knapsackDraft.items.length >= 15} onClick={() => updateKnapsackDraft({ ...knapsackDraft, items: [...knapsackDraft.items, { name: `Item ${knapsackDraft.items.length + 1}`, weight: 1, value: 1 }] })}>+ Add item</button>
      </div> : genericDraft ? <AlgorithmInputForm value={genericDraft} template={selected.input_example} disabled={busy} onChange={updateGenericDraft} /> : null}
      <p className="input-help" id="input-help">{isBranchBoundKnapsack ? 'Enter a capacity and up to 15 whole items. Editing clears the previous trace.' : 'Enter values in the boxes below. Use Add or Remove to change list entries.'}</p>
      <button className="run-button" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run algorithm'}</button>
      {message ? <p className={message.includes('ready') || message.includes('saved') ? 'status success' : 'status error'}>{message}</p> : null}
    </aside>
    <section className="workspace">
      <div className="stage panel"><div className="stage-heading"><div><p className="eyebrow">Interactive trace</p><h2>{current ? current.description : 'A clear state at every decision'}</h2></div>{current ? <span className={`event-pill event-${current.event}`}>{current.event.replace('_', ' ')}</span> : null}</div><StepVisualizer state={current?.state} />{execution ? <TraceResult algorithmId={selected.id} result={execution.result} /> : null}<AlgorithmControls current={position} total={execution?.steps.length ?? 0} playing={playing} disabled={!execution} onReset={() => { setPosition(0); setPlaying(false) }} onBack={() => { setPosition((index) => Math.max(0, index - 1)); setPlaying(false) }} onForward={() => { setPosition((index) => Math.min((execution?.steps.length ?? 1) - 1, index + 1)); setPlaying(false) }} onPlayToggle={() => setPlaying((value) => !value)} /><label className="speed-control">Speed <input type="range" min="250" max="1500" step="50" value={1750 - speed} onChange={(event) => setSpeed(1750 - Number(event.target.value))} /></label></div>
      <div className="below-stage"><CodePanel algorithmId={selected.id} lines={selected.pseudocode} event={current?.event} /><section className="metrics panel"><div className="panel-heading"><span>Live counters</span><button className="text-button" onClick={save} disabled={!execution || saving}>{saving ? 'Saving…' : 'Save run'}</button></div><div className="metric-grid">{Object.entries(metrics ?? { comparisons: 0, writes: 0, expanded_nodes: 0 }).map(([name, value]) => <div key={name}><strong>{value}</strong><span>{name.replace('_', ' ')}</span></div>)}</div></section></div>
      <ComplexityCard algorithm={selected} />
    </section>
  </main>
}
