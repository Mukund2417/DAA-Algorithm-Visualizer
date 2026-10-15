import type { Algorithm, BenchmarkResult, ComparisonResult, Execution, Experiment, ExperimentSummary, JsonObject, RecentBenchmark } from '../types'

const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({ detail: 'The server returned an unexpected error.' }))
    const detail = body.detail
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((item) => item?.msg ?? 'Invalid request').join('; ')
        : 'Request failed.'
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export const api = {
  algorithms: () => request<Algorithm[]>('/api/algorithms'),
  execute: (algorithmId: string, input: JsonObject) => request<Execution>('/api/execute', { method: 'POST', body: JSON.stringify({ algorithm_id: algorithmId, input }) }),
  benchmark: (algorithmId: string, sizes: number[], caseType: string) => request<BenchmarkResult>('/api/benchmark', { method: 'POST', body: JSON.stringify({ algorithm_id: algorithmId, sizes, trials: 5, case_type: caseType }) }),
  compare: (algorithmIds: string[], input: JsonObject) => request<ComparisonResult>('/api/compare', { method: 'POST', body: JSON.stringify({ algorithm_ids: algorithmIds, input }) }),
  saveExperiment: (algorithmId: string, input: JsonObject, result: JsonObject, metrics: Record<string, number>) => request<{ id: number; message: string }>('/api/experiments', { method: 'POST', body: JSON.stringify({ algorithm_id: algorithmId, input, result, metrics }) }),
  experiments: () => request<Experiment[]>('/api/experiments'),
  experimentSummary: () => request<ExperimentSummary>('/api/experiments/summary'),
  recentBenchmarks: () => request<RecentBenchmark[]>('/api/benchmarks/recent'),
}
