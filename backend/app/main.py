"""FastAPI entry point for the Interactive DAA Algorithm Visualizer."""

from __future__ import annotations

import copy
import os
import platform
import random
import statistics
import time
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.algorithms.registry import (
    ALGORITHMS,
    MODULES,
    AlgorithmInputError,
    algorithm_detail,
    catalogue,
    run_algorithm,
)
from app.database import (
    experiment_summary,
    initialize_database,
    list_experiments,
    list_recent_benchmarks,
    save_benchmark_rows,
    save_experiment,
    sync_catalogue,
)
from app.schemas import (
    AlgorithmRequest,
    BenchmarkRequest,
    CompareRequest,
    RunResponse,
    SaveExperimentRequest,
)


@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    sync_catalogue(MODULES, catalogue())
    yield


app = FastAPI(title="Interactive DAA Visualizer API", version="0.1.0", lifespan=lifespan)

# Allow local frontend ports as well as production deployments
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

# If FRONTEND_URL is set in deployment environment variables, add it
frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if os.getenv("RENDER") else origins,  # Open for deployment or use configured origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _run_or_422(algorithm_id: str, input_data: dict[str, Any], capture_steps: bool = True):
    try:
        return run_algorithm(algorithm_id, input_data, capture_steps)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown algorithm '{algorithm_id}'.") from None
    except AlgorithmInputError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/modules")
def get_modules() -> list[dict[str, Any]]:
    return MODULES


@app.get("/api/algorithms")
def get_algorithms() -> list[dict[str, Any]]:
    return catalogue()


@app.get("/api/algorithms/{algorithm_id}")
def get_algorithm(algorithm_id: str) -> dict[str, Any]:
    try:
        return algorithm_detail(algorithm_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Algorithm not found.") from None


@app.post("/api/execute", response_model=RunResponse)
def execute_algorithm(request: AlgorithmRequest) -> dict[str, Any]:
    execution = _run_or_422(request.algorithm_id, request.input)
    return {"algorithm_id": request.algorithm_id, "result": execution.result, "steps": execution.steps, "metrics": execution.metrics}


def _benchmark_input(algorithm_id: str, size: int, case_type: str) -> dict[str, Any]:
    if algorithm_id not in {"binary-search", "merge-sort", "quick-sort"}:
        raise HTTPException(status_code=422, detail="Benchmark Lab currently supports Binary Search, Merge Sort and Quick Sort.")
    values = list(range(size))
    if algorithm_id == "binary-search":
        values.sort()
        if case_type == "best":
            target = values[(size - 1) // 2]
        elif case_type == "worst":
            def comparisons(candidate: int) -> int:
                low, high, count = 0, size - 1, 0
                while low <= high:
                    middle = (low + high) // 2
                    count += 1
                    if values[middle] == candidate:
                        return count
                    if values[middle] < candidate:
                        low = middle + 1
                    else:
                        high = middle - 1
                return count
            target = max(values, key=comparisons)
        else:
            target = values[random.Random(size).randrange(size)]
        return {"array": values, "target": target}
    if case_type in {"random", "average"}:
        random.Random(size).shuffle(values)
    elif case_type == "reversed":
        values.reverse()
    return {"array": values}


@app.post("/api/benchmark")
def benchmark(request: BenchmarkRequest) -> dict[str, Any]:
    if request.algorithm_id == "binary-search" and request.case_type not in {"best", "average", "worst"}:
        raise HTTPException(status_code=422, detail="Binary Search benchmark cases must be best, average, or worst.")
    if request.algorithm_id in {"merge-sort", "quick-sort"} and request.case_type not in {"random", "sorted", "reversed"}:
        raise HTTPException(status_code=422, detail="Sorting benchmark cases must be random, sorted, or reversed.")
    if any(size < 2 or size > 10000 for size in request.sizes):
        raise HTTPException(status_code=422, detail="Every benchmark size must be between 2 and 10,000.")
    rows: list[dict[str, Any]] = []
    for size in sorted(set(request.sizes)):
        timings, operations = [], []
        for trial in range(request.trials):
            test_input = _benchmark_input(request.algorithm_id, size, request.case_type)
            prepared_input = copy.deepcopy(test_input)
            started = time.perf_counter_ns()
            execution = _run_or_422(request.algorithm_id, prepared_input, capture_steps=False)
            elapsed = (time.perf_counter_ns() - started) / 1_000_000
            timings.append(elapsed)
            operations.append(sum(execution.metrics.values()))
            rows.append({"algorithm_id": request.algorithm_id, "input_size": size, "case_type": request.case_type, "trial_number": trial + 1, "execution_time_ms": elapsed, "operation_count": sum(execution.metrics.values()), "python_version": platform.python_version(), "platform": platform.platform(), "timer": "time.perf_counter_ns"})
    save_benchmark_rows(rows)
    summary = []
    for size in sorted(set(request.sizes)):
        size_rows = [row for row in rows if row["input_size"] == size]
        summary.append({"input_size": size, "median_time_ms": round(statistics.median(row["execution_time_ms"] for row in size_rows), 5), "median_operations": round(statistics.median(row["operation_count"] for row in size_rows), 1)})
    return {"algorithm_id": request.algorithm_id, "case_type": request.case_type, "trials": request.trials, "environment": {"python_version": platform.python_version(), "platform": platform.platform(), "timer": "time.perf_counter_ns"}, "points": summary, "note": "Timing uses repeated local runs. It illustrates measured behavior; it does not prove an asymptotic bound."}


@app.post("/api/compare")
def compare(request: CompareRequest) -> dict[str, Any]:
    compatible_ids = {"merge-sort", "quick-sort", "insertion-sort", "selection-sort", "heap-sort"}
    if len(request.algorithm_ids) != len(set(request.algorithm_ids)) or len(request.algorithm_ids) < 2 or not set(request.algorithm_ids) <= compatible_ids:
        raise HTTPException(status_code=422, detail="Compare mode accepts 2 to 5 distinct sorting algorithms on the same array input.")
    if "array" not in request.input:
        raise HTTPException(status_code=422, detail="Comparison input must include an array.")
    if not isinstance(request.input["array"], list) or len(request.input["array"]) > 5000:
        raise HTTPException(status_code=422, detail="Comparison input must be an array with at most 5,000 numbers.")
    results = []
    for algorithm_id in request.algorithm_ids:
        started = time.perf_counter_ns()
        execution = _run_or_422(algorithm_id, copy.deepcopy(request.input), capture_steps=False)
        elapsed = (time.perf_counter_ns() - started) / 1_000_000
        results.append({"algorithm_id": algorithm_id, "result": execution.result, "metrics": execution.metrics, "execution_time_ms": round(elapsed, 5)})
    return {"runs": results, "note": "Every algorithm receives the same array. Operation counts are instrumented; wall-clock timings are single local runs, so use repeated benchmarks for steadier timing comparisons."}


@app.post("/api/experiments")
def create_experiment(request: SaveExperimentRequest) -> dict[str, Any]:
    try:
        algorithm_detail(request.algorithm_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Algorithm not found.") from None
    execution = _run_or_422(request.algorithm_id, request.input, capture_steps=False)
    if request.result != execution.result or request.metrics != execution.metrics:
        raise HTTPException(status_code=422, detail="The supplied result or counters do not match this algorithm's execution for the saved input.")
    saved = save_experiment({
        "algorithm_id": request.algorithm_id,
        "title": request.title,
        "input": request.input,
        "result": execution.result,
        "metrics": execution.metrics,
    })
    return {"message": "Experiment saved.", **saved}


@app.get("/api/experiments")
def get_experiments() -> list[dict[str, Any]]:
    return list_experiments()


@app.get("/api/experiments/summary")
def get_experiment_summary() -> dict[str, Any]:
    return experiment_summary()


@app.get("/api/benchmarks/recent")
def get_recent_benchmarks() -> list[dict[str, Any]]:
    return list_recent_benchmarks()