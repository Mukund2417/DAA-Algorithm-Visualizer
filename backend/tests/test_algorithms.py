import pytest

from app.algorithms.registry import ALGORITHMS, AlgorithmInputError, run_algorithm


def test_binary_search_traces_and_finds_value():
    result = run_algorithm("binary-search", {"array": [1, 3, 5, 7, 9], "target": 7})
    assert result.result == {"found": True, "index": 3, "value": 7}
    assert result.steps[-1]["event"] == "found"
    assert result.metrics["comparisons"] > 0


def test_binary_search_returns_not_found_for_empty_array():
    result = run_algorithm("binary-search", {"array": [], "target": 7})
    assert result.result == {"found": False, "index": -1}


def test_merge_sort_returns_sorted_values():
    result = run_algorithm("merge-sort", {"array": [5, 1, 3, 1, 2]})
    assert result.result["sorted_array"] == [1, 1, 2, 3, 5]
    assert result.steps[-1]["state"]["sorted"] is True


def test_merge_sort_accepts_empty_array():
    result = run_algorithm("merge-sort", {"array": []})
    assert result.result["sorted_array"] == []


def test_additional_comparison_sorts_sort_and_report_work():
    values = [8, 3, -1, 7, 3, 0]
    for algorithm_id in ("insertion-sort", "selection-sort", "heap-sort"):
        result = run_algorithm(algorithm_id, {"array": values})
        assert result.result["sorted_array"] == sorted(values)
        assert result.steps[-1]["state"]["sorted"] is True
        assert result.metrics["comparisons"] > 0


def test_dijkstra_calculates_shortest_paths():
    result = run_algorithm(
        "dijkstra",
        {"vertices": ["A", "B", "C"], "edges": [["A", "B", 4], ["A", "C", 1], ["C", "B", 2]], "start": "A"},
    )
    assert result.result["distances"] == {"A": 0, "B": 3.0, "C": 1.0}
    start_state = result.steps[0]["state"]
    assert start_state["graph_type"] == "dijkstra"
    assert start_state["start"] == "A"
    relax_state = next(step["state"] for step in result.steps if step["event"] == "relax")
    assert relax_state["edge"] is not None
    assert relax_state["selected_edges"]


def test_dijkstra_rejects_negative_weights():
    try:
        run_algorithm("dijkstra", {"vertices": ["A", "B"], "edges": [["A", "B", -1]], "start": "A"})
    except AlgorithmInputError as error:
        assert "negative" in str(error)
    else:
        raise AssertionError("Expected a user input error")


def test_lcs_reconstructs_known_example():
    result = run_algorithm("longest-common-subsequence", {"first": "AGGTAB", "second": "GXTXAYB"})
    assert result.result == {"length": 4, "subsequence": "GTAB"}


def test_lcs_accepts_an_empty_string():
    result = run_algorithm("longest-common-subsequence", {"first": "", "second": "ABC"})
    assert result.result == {"length": 0, "subsequence": ""}


def test_fractional_knapsack_accepts_no_items():
    result = run_algorithm("fractional-knapsack", {"capacity": 10, "items": []})
    assert result.result["maximum_value"] == 0
    assert result.result["remaining_capacity"] == 10


def test_quick_sort_handles_adversarial_input_without_python_recursion():
    values = list(range(1100))
    result = run_algorithm("quick-sort", {"array": values}, capture_steps=False)
    assert result.result["sorted_array"] == values
    assert result.metrics["comparisons"] == len(values) * (len(values) - 1) // 2


def test_every_registered_example_runs_and_emits_a_trace():
    assert len(ALGORITHMS) == 22
    for algorithm in ALGORITHMS:
        execution = run_algorithm(algorithm.id, algorithm.input_example)
        assert execution.steps, algorithm.id


def test_job_sequencing_respects_deadlines_and_maximizes_profit():
    result = run_algorithm("job-sequencing", ALGORITHMS[[item.id for item in ALGORITHMS].index("job-sequencing")].input_example)
    assert result.result["total_profit"] == 142
    assert len({job["id"] for job in result.result["schedule"]}) == len(result.result["schedule"])
    assert all(slot + 1 <= job["deadline"] for slot, job in enumerate(result.result["schedule"]))
    first_state = result.steps[0]["state"]
    assert first_state["kind"] == "schedule"
    assert [job["id"] for job in first_state["jobs"]] == ["J1", "J3", "J4", "J2", "J5"]
    assert any(step["state"].get("outcome") in {"scheduled", "rejected"} for step in result.steps)


def test_huffman_codes_are_prefix_free_and_use_all_symbols():
    execution = run_algorithm("huffman-coding", {"frequencies": {"a": 5, "b": 2, "c": 1, "d": 1}})
    result = execution.result
    codes = result["codes"]
    assert set(codes) == {"a", "b", "c", "d"}
    assert all(not other.startswith(code) for symbol, code in codes.items() for other_symbol, other in codes.items() if symbol != other_symbol)
    assert result["weighted_path_length"] == 15
    merge_steps = [step for step in execution.steps if step["event"] == "merge"]
    assert merge_steps
    assert merge_steps[0]["state"]["active_merge"]["frequency"] == 2


def test_graph_coloring_solves_and_reports_an_uncolorable_triangle():
    graph = {"vertices": ["A", "B", "C"], "edges": [["A", "B"], ["B", "C"], ["A", "C"]], "colors": ["red", "blue", "green"]}
    result = run_algorithm("graph-coloring", graph)
    coloring = result.result["coloring"]
    assert result.result["solved"]
    assert all(coloring[left] != coloring[right] for left, right in graph["edges"])
    assert run_algorithm("graph-coloring", {**graph, "colors": ["red", "blue"]}).result["solved"] is False


def test_tsp_branch_and_bound_finds_the_minimum_tour_and_rejects_incomplete_graphs():
    example = next(item.input_example for item in ALGORITHMS if item.id == "travelling-salesperson")
    for strategy in ("FIFO", "LIFO", "least-cost"):
        result = run_algorithm("travelling-salesperson", {**example, "strategy": strategy})
        assert result.result["minimum_cost"] == 80
        assert result.result["strategy"] == strategy
        assert result.result["tour"][0] == result.result["tour"][-1] == "A"
        trace_state = result.steps[0]["state"]
        assert trace_state["vertices"] == example["vertices"]
        assert len(trace_state["edges"]) == 6
        branch = next(step["state"] for step in result.steps if step["event"] == "expand")
        assert branch["path"][0] == "A"
        assert branch["candidate"] in example["vertices"]
        assert branch["cost"] > 0
        distance = {(left, right): weight for left, right, weight in example["edges"]}
        assert sum(distance.get((left, right), distance.get((right, left))) for left, right in zip(result.result["tour"], result.result["tour"][1:])) == result.result["minimum_cost"]
    with pytest.raises(AlgorithmInputError, match="every pair"):
        run_algorithm("travelling-salesperson", {"vertices": ["A", "B", "C"], "edges": [["A", "B", 1], ["B", "C", 2]], "start": "A"})


def test_knapsack_branch_and_bound_matches_dynamic_programming():
    example = {"capacity": 9, "items": [{"name": "A", "weight": 4, "value": 8}, {"name": "B", "weight": 5, "value": 10}, {"name": "C", "weight": 6, "value": 12}, {"name": "D", "weight": 3, "value": 7}]}
    bounded = run_algorithm("knapsack-branch-bound", example)
    dynamic = run_algorithm("zero-one-knapsack", example)
    assert bounded.result["maximum_value"] == dynamic.result["maximum_value"] == 19
    state = bounded.steps[0]["state"]
    assert state["capacity"] == example["capacity"]
    assert [item["name"] for item in state["items"]] == ["D", "A", "B", "C"]
    branch = next(step["state"] for step in bounded.steps if step["state"]["level"] == 1 and step["state"]["choices"])
    assert branch["selected_items"] == ["D"]
    assert branch["best_choices"]


def test_dynamic_programming_runners_compute_costs_and_reconstruct_solutions():
    matrix = run_algorithm("matrix-chain-multiplication", {"dimensions": [40, 20, 30, 10, 30]})
    assert matrix.result["minimum_multiplications"] == 26000
    knapsack = run_algorithm("zero-one-knapsack", {"capacity": 7, "items": [{"name": "A", "weight": 2, "value": 16}, {"name": "B", "weight": 3, "value": 19}, {"name": "C", "weight": 4, "value": 23}, {"name": "D", "weight": 5, "value": 28}]})
    assert knapsack.result["maximum_value"] == 44
    assert {item["name"] for item in knapsack.result["selected"]} == {"A", "D"}
    bst = run_algorithm("optimal-binary-search-tree", {"keys": ["A", "B"], "successful_frequencies": [0.5, 0.5], "unsuccessful_frequencies": [0, 0, 0]})
    assert bst.result["weighted_search_cost"] == 1.5
    assert bst.result["root"] in {"A", "B"}


def test_kruskal_and_prim_agree_and_reject_disconnected_graphs():
    graph = {"vertices": ["A", "B", "C", "D"], "edges": [["A", "B", 4], ["A", "C", 1], ["C", "B", 2], ["B", "D", 1], ["C", "D", 5]], "start": "A"}
    kruskal = run_algorithm("kruskal", graph).result
    prim = run_algorithm("prim", graph).result
    assert kruskal["total_weight"] == prim["total_weight"] == 4
    disconnected = {"vertices": ["A", "B", "C"], "edges": [["A", "B", 1]], "start": "A"}
    with pytest.raises(AlgorithmInputError, match="disconnected"):
        run_algorithm("kruskal", disconnected)
    with pytest.raises(AlgorithmInputError, match="disconnected"):
        run_algorithm("prim", disconnected)


def test_bellman_ford_handles_negative_edges_and_reachable_negative_cycles():
    graph = {"vertices": ["S", "A", "B", "C"], "edges": [["S", "A", 4], ["S", "B", 5], ["A", "B", -2], ["B", "C", 3]], "start": "S", "directed": True}
    result = run_algorithm("bellman-ford", graph).result
    assert result["negative_cycle"] is False
    assert result["distances"] == {"S": 0.0, "A": 4.0, "B": 2.0, "C": 5.0}
    cycle = {"vertices": ["A", "B", "C"], "edges": [["A", "B", 1], ["B", "C", -3], ["C", "A", 1]], "start": "A", "directed": True}
    assert run_algorithm("bellman-ford", cycle).result["negative_cycle"] is True
    unreachable_cycle = {"vertices": ["S", "A", "B", "C"], "edges": [["S", "A", 2], ["B", "C", -3], ["C", "B", 1]], "start": "S", "directed": True}
    assert run_algorithm("bellman-ford", unreachable_cycle).result["negative_cycle"] is False
