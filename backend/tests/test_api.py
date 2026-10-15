def test_execute_benchmark_and_save_experiment(api_client):
    execution = api_client.post("/api/execute", json={"algorithm_id": "merge-sort", "input": {"array": [4, 1, 3, 2]}})
    assert execution.status_code == 200
    body = execution.json()
    assert body["result"]["sorted_array"] == [1, 2, 3, 4]
    assert body["steps"]

    benchmark = api_client.post(
        "/api/benchmark",
        json={"algorithm_id": "quick-sort", "sizes": [10, 20], "trials": 2, "case_type": "random"},
    )
    assert benchmark.status_code == 200
    assert len(benchmark.json()["points"]) == 2
    recent_benchmarks = api_client.get("/api/benchmarks/recent")
    assert recent_benchmarks.status_code == 200
    assert recent_benchmarks.json()[0]["algorithm_id"] == "quick-sort"
    assert recent_benchmarks.json()[0]["trials"] == 2
    assert [point["input_size"] for point in recent_benchmarks.json()[0]["points"]] == [10, 20]

    saved = api_client.post(
        "/api/experiments",
        json={"algorithm_id": "merge-sort", "input": {"array": [4, 1, 3, 2]}, "result": body["result"], "metrics": body["metrics"]},
    )
    assert saved.status_code == 200
    assert api_client.get("/api/experiments").status_code == 200
    experiment_summary = api_client.get("/api/experiments/summary")
    assert experiment_summary.status_code == 200
    assert experiment_summary.json()["total"] == 1
    assert experiment_summary.json()["recent"][0]["id"] == saved.json()["id"]

    forged = api_client.post(
        "/api/experiments",
        json={"algorithm_id": "merge-sort", "input": {"array": [4, 1, 3, 2]}, "result": {"sorted_array": [9]}, "metrics": body["metrics"]},
    )
    assert forged.status_code == 422


def test_api_returns_a_useful_validation_message(api_client):
    response = api_client.post("/api/execute", json={"algorithm_id": "dijkstra", "input": {"vertices": ["A", "B"], "edges": [["A", "B", -2]], "start": "A"}})
    assert response.status_code == 422
    assert "negative" in response.json()["detail"]


def test_compare_requires_compatible_inputs(api_client):
    supported = api_client.post(
        "/api/compare",
        json={"algorithm_ids": ["merge-sort", "quick-sort", "insertion-sort", "selection-sort", "heap-sort"], "input": {"array": [3, 1, 2]}},
    )
    rejected = api_client.post(
        "/api/compare",
        json={"algorithm_ids": ["dijkstra", "rabin-karp"], "input": {}},
    )
    assert supported.status_code == 200
    assert len(supported.json()["runs"]) == 5
    assert [run["result"]["sorted_array"] for run in supported.json()["runs"]] == [[1, 2, 3]] * 5
    assert rejected.status_code == 422


def test_binary_search_benchmark_scenarios_measure_best_and_worst_paths(api_client):
    best = api_client.post("/api/benchmark", json={"algorithm_id": "binary-search", "sizes": [32], "trials": 3, "case_type": "best"})
    worst = api_client.post("/api/benchmark", json={"algorithm_id": "binary-search", "sizes": [32], "trials": 3, "case_type": "worst"})
    assert best.status_code == 200
    assert worst.status_code == 200
    assert best.json()["points"][0]["median_operations"] == 1
    assert worst.json()["points"][0]["median_operations"] > best.json()["points"][0]["median_operations"]
    assert worst.json()["environment"]["timer"] == "time.perf_counter_ns"

    incompatible = api_client.post(
        "/api/benchmark",
        json={"algorithm_id": "binary-search", "sizes": [32], "trials": 1, "case_type": "reversed"},
    )
    assert incompatible.status_code == 422
