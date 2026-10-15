export type JsonObject = Record<string, unknown>

export interface Algorithm {
  id: string
  name: string
  category: string
  description: string
  best_case: string
  average_case: string
  worst_case: string
  space_complexity: string
  implementation_status: 'implemented' | 'partial' | 'theory-only'
  input_example: JsonObject
  pseudocode: string[]
}

export interface StepEvent {
  step: number
  event: string
  description: string
  state: JsonObject
  metrics: Record<string, number>
}

export interface Execution {
  algorithm_id: string
  result: JsonObject
  steps: StepEvent[]
  metrics: Record<string, number>
}

export interface BenchmarkPoint {
  input_size: number
  median_time_ms: number
  median_operations: number
}

export interface BenchmarkResult {
  algorithm_id: string
  case_type: string
  trials: number
  environment: { python_version: string; platform: string; timer: string }
  points: BenchmarkPoint[]
  note: string
}

export interface RecentBenchmark {
  algorithm_id: string
  case_type: string
  created_at: string
  trials: number
  points: BenchmarkPoint[]
}

export interface ComparisonRun {
  algorithm_id: string
  result: JsonObject
  metrics: Record<string, number>
  execution_time_ms: number
}

export interface ComparisonResult {
  runs: ComparisonRun[]
  note: string
}

export interface Experiment {
  id: number
  algorithm_id: string
  title: string | null
  input: JsonObject
  result: JsonObject
  metrics: Record<string, number>
  created_at: string
}

export interface ExperimentSummary {
  total: number
  recent: Experiment[]
}
