"""A common execution contract for visualizable DAA algorithms.

Each runner returns immutable snapshots.  The frontend can consequently replay
them forwards or backwards without rerunning the underlying algorithm.
"""

from __future__ import annotations

import heapq
from collections import deque
from dataclasses import dataclass, field
from math import inf
from typing import Any, Callable


class AlgorithmInputError(ValueError):
    """A clear error caused by user-supplied input."""


@dataclass
class Execution:
    result: dict[str, Any]
    steps: list[dict[str, Any]]
    metrics: dict[str, Any]


@dataclass
class Trace:
    capture_steps: bool = True
    comparisons: int = 0
    writes: int = 0
    expanded_nodes: int = 0
    events: list[dict[str, Any]] = field(default_factory=list)

    def event(self, event: str, description: str, state: dict[str, Any], **extra: Any) -> None:
        if not self.capture_steps:
            return
        self.events.append(
            {
                "step": len(self.events) + 1,
                "event": event,
                "description": description,
                "state": state,
                "metrics": {
                    "comparisons": self.comparisons,
                    "writes": self.writes,
                    "expanded_nodes": self.expanded_nodes,
                    **extra,
                },
            }
        )

    def metrics(self) -> dict[str, int]:
        return {
            "comparisons": self.comparisons,
            "writes": self.writes,
            "expanded_nodes": self.expanded_nodes,
        }


def _number_list(value: Any, field_name: str = "array", max_size: int = 10000) -> list[float | int]:
    if not isinstance(value, list):
        raise AlgorithmInputError(f"'{field_name}' must be a list of numbers.")
    if len(value) > max_size:
        raise AlgorithmInputError(f"'{field_name}' can contain at most {max_size} values for this run.")
    if any(isinstance(item, bool) or not isinstance(item, (int, float)) for item in value):
        raise AlgorithmInputError(f"Every value in '{field_name}' must be a number.")
    return value.copy()


def _final(trace: Trace, result: dict[str, Any]) -> Execution:
    return Execution(result=result, steps=trace.events, metrics=trace.metrics())


def binary_search(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    values = _number_list(data.get("array"))
    target = data.get("target")
    if isinstance(target, bool) or not isinstance(target, (int, float)):
        raise AlgorithmInputError("'target' must be a number.")
    if values != sorted(values):
        raise AlgorithmInputError("Binary Search requires the array to be sorted in ascending order.")
    trace = Trace(capture_steps)
    low, high = 0, len(values) - 1
    trace.event("start", "Start with the complete sorted search interval.", {"kind": "array", "array": values, "low": low, "high": high, "target": target})
    while low <= high:
        mid = (low + high) // 2
        trace.comparisons += 1
        trace.event("compare", f"Compare target {target} with middle value {values[mid]}.", {"kind": "array", "array": values, "low": low, "high": high, "mid": mid, "target": target})
        if values[mid] == target:
            trace.event("found", f"Target {target} is at index {mid}.", {"kind": "array", "array": values, "low": low, "high": high, "mid": mid, "target": target, "found": mid})
            return _final(trace, {"found": True, "index": mid, "value": values[mid]})
        if values[mid] < target:
            low = mid + 1
            trace.event("discard", "The target is larger, so discard the left half.", {"kind": "array", "array": values, "low": low, "high": high, "target": target})
        else:
            high = mid - 1
            trace.event("discard", "The target is smaller, so discard the right half.", {"kind": "array", "array": values, "low": low, "high": high, "target": target})
    trace.event("not_found", "The interval is empty; the target is not present.", {"kind": "array", "array": values, "low": low, "high": high, "target": target})
    return _final(trace, {"found": False, "index": -1})


def merge_sort(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    values = _number_list(data.get("array"), max_size=500 if capture_steps else 10000)
    trace = Trace(capture_steps)
    if capture_steps:
        trace.event("start", "Divide the array until each part has one element.", {"kind": "array", "array": values.copy(), "active": [0, len(values) - 1]})

    def sort(left: int, right: int) -> None:
        if left >= right:
            return
        middle = (left + right) // 2
        sort(left, middle)
        sort(middle + 1, right)
        temp: list[float | int] = []
        first, second = left, middle + 1
        while first <= middle and second <= right:
            trace.comparisons += 1
            if values[first] <= values[second]:
                temp.append(values[first])
                first += 1
            else:
                temp.append(values[second])
                second += 1
        temp.extend(values[first : middle + 1])
        temp.extend(values[second : right + 1])
        values[left : right + 1] = temp
        trace.writes += len(temp)
        if capture_steps:
            trace.event("merge", f"Merge sorted ranges [{left}…{middle}] and [{middle + 1}…{right}].", {"kind": "array", "array": values.copy(), "active": [left, right], "mid": middle})

    sort(0, len(values) - 1)
    if capture_steps:
        trace.event("complete", "Every divided range has been merged into sorted order.", {"kind": "array", "array": values.copy(), "sorted": True})
    return _final(trace, {"sorted_array": values})


def quick_sort(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    values = _number_list(data.get("array"), max_size=500 if capture_steps else 10000)
    trace = Trace(capture_steps)
    if capture_steps:
        trace.event("start", "Partition the array around a pivot, then recurse on both sides.", {"kind": "array", "array": values.copy(), "active": [0, len(values) - 1]})

    def partition(left: int, right: int) -> int:
        pivot = values[right]
        store = left
        for index in range(left, right):
            trace.comparisons += 1
            if values[index] <= pivot:
                if store != index:
                    values[store], values[index] = values[index], values[store]
                    trace.writes += 2
                store += 1
        if store != right:
            values[store], values[right] = values[right], values[store]
            trace.writes += 2
        if capture_steps:
            trace.event("partition", f"Place pivot {pivot} at its final position {store}.", {"kind": "array", "array": values.copy(), "active": [left, right], "pivot": store})
        return store

    # An explicit stack preserves the last-element-pivot behavior (including its
    # worst case) without risking Python's recursion limit on sorted inputs.
    ranges = [(0, len(values) - 1)]
    while ranges:
        left, right = ranges.pop()
        if left < right:
            pivot_index = partition(left, right)
            ranges.append((pivot_index + 1, right))
            ranges.append((left, pivot_index - 1))
    if capture_steps:
        trace.event("complete", "All partitions are in sorted order.", {"kind": "array", "array": values.copy(), "sorted": True})
    return _final(trace, {"sorted_array": values})


def insertion_sort(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    values = _number_list(data.get("array"), max_size=500 if capture_steps else 10000)
    trace = Trace(capture_steps)
    if capture_steps:
        trace.event("start", "Insert each next value into the sorted prefix to its left.", {"kind": "array", "array": values.copy(), "active": [0, len(values) - 1]})
    for index in range(1, len(values)):
        value = values[index]
        position = index
        while position > 0:
            trace.comparisons += 1
            if values[position - 1] <= value:
                break
            values[position] = values[position - 1]
            trace.writes += 1
            position -= 1
        if position != index:
            values[position] = value
            trace.writes += 1
        if capture_steps:
            trace.event("insert", f"Insert {value:g} at position {position} in the sorted prefix.", {"kind": "array", "array": values.copy(), "active": [position, index], "pivot": position})
    if capture_steps:
        trace.event("complete", "The full array is now sorted in ascending order.", {"kind": "array", "array": values.copy(), "sorted": True})
    return _final(trace, {"sorted_array": values})


def selection_sort(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    values = _number_list(data.get("array"), max_size=500 if capture_steps else 10000)
    trace = Trace(capture_steps)
    if capture_steps:
        trace.event("start", "Scan the unsorted suffix for its smallest value, then place it next.", {"kind": "array", "array": values.copy(), "active": [0, len(values) - 1]})
    for start in range(len(values)):
        minimum = start
        for index in range(start + 1, len(values)):
            trace.comparisons += 1
            if values[index] < values[minimum]:
                minimum = index
        if minimum != start:
            values[start], values[minimum] = values[minimum], values[start]
            trace.writes += 2
        if capture_steps:
            trace.event("select", f"Place the smallest remaining value {values[start]:g} at position {start}.", {"kind": "array", "array": values.copy(), "active": [start, len(values) - 1], "pivot": start})
    if capture_steps:
        trace.event("complete", "The full array is now sorted in ascending order.", {"kind": "array", "array": values.copy(), "sorted": True})
    return _final(trace, {"sorted_array": values})


def heap_sort(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    values = _number_list(data.get("array"), max_size=500 if capture_steps else 10000)
    trace = Trace(capture_steps)
    if capture_steps:
        trace.event("start", "Build a max heap, then repeatedly move its root to the sorted suffix.", {"kind": "array", "array": values.copy(), "active": [0, len(values) - 1]})

    def sift_down(root: int, end: int) -> None:
        while (child := 2 * root + 1) <= end:
            if child + 1 <= end:
                trace.comparisons += 1
                if values[child] < values[child + 1]:
                    child += 1
            trace.comparisons += 1
            if values[root] >= values[child]:
                break
            values[root], values[child] = values[child], values[root]
            trace.writes += 2
            if capture_steps:
                trace.event("heapify", f"Move {values[root]:g} down to restore the max heap.", {"kind": "array", "array": values.copy(), "active": [root, end], "pivot": child})
            root = child

    for root in range(len(values) // 2 - 1, -1, -1):
        sift_down(root, len(values) - 1)
        if capture_steps:
            trace.event("heapify", f"Max-heap property is established for root position {root}.", {"kind": "array", "array": values.copy(), "active": [root, len(values) - 1], "pivot": root})
    for end in range(len(values) - 1, 0, -1):
        values[0], values[end] = values[end], values[0]
        trace.writes += 2
        if capture_steps:
            trace.event("extract", f"Move maximum {values[end]:g} into its final position {end}.", {"kind": "array", "array": values.copy(), "active": [0, end], "pivot": end})
        sift_down(0, end - 1)
    if capture_steps:
        trace.event("complete", "All extracted values form the sorted array.", {"kind": "array", "array": values.copy(), "sorted": True})
    return _final(trace, {"sorted_array": values})


def fractional_knapsack(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    capacity = data.get("capacity")
    items = data.get("items")
    if isinstance(capacity, bool) or not isinstance(capacity, (int, float)) or capacity <= 0:
        raise AlgorithmInputError("'capacity' must be a positive number.")
    if not isinstance(items, list):
        raise AlgorithmInputError("'items' must be a list of {name, value, weight} objects.")
    normalized = []
    for position, item in enumerate(items):
        if not isinstance(item, dict) or isinstance(item.get("value"), bool) or not isinstance(item.get("value"), (int, float)) or isinstance(item.get("weight"), bool) or not isinstance(item.get("weight"), (int, float)) or item["weight"] <= 0:
            raise AlgorithmInputError(f"Item {position + 1} needs numeric 'value' and positive 'weight'.")
        normalized.append({"name": str(item.get("name", f"Item {position + 1}")), "value": item["value"], "weight": item["weight"], "ratio": item["value"] / item["weight"]})
    ordered = sorted(normalized, key=lambda item: item["ratio"], reverse=True)
    trace = Trace(capture_steps)
    trace.event("sort", "Sort candidates by value-to-weight ratio.", {"kind": "knapsack", "items": ordered, "capacity": capacity, "remaining": capacity, "selected": []})
    selected, remaining, total = [], float(capacity), 0.0
    for item in ordered:
        trace.comparisons += 1
        fraction = min(1.0, remaining / item["weight"])
        if fraction <= 0:
            break
        taken_value = item["value"] * fraction
        selected.append({**item, "fraction": round(fraction, 4), "taken_value": round(taken_value, 4)})
        remaining -= item["weight"] * fraction
        total += taken_value
        trace.writes += 1
        action = "Take the whole item" if fraction == 1 else "Take the remaining fraction of this item"
        trace.event("select", f"{action}: {item['name']}.", {"kind": "knapsack", "items": ordered, "capacity": capacity, "remaining": round(remaining, 4), "selected": selected.copy()})
    return _final(trace, {"maximum_value": round(total, 4), "remaining_capacity": round(remaining, 4), "selected": selected})


def job_sequencing(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    jobs = data.get("jobs")
    if not isinstance(jobs, list) or len(jobs) > 100:
        raise AlgorithmInputError("'jobs' must be a list containing at most 100 jobs.")
    normalized = []
    seen: set[str] = set()
    for index, job in enumerate(jobs):
        if not isinstance(job, dict):
            raise AlgorithmInputError(f"Job {index + 1} must be an object with id, deadline, and profit.")
        identifier, deadline, profit = str(job.get("id", f"J{index + 1}")), job.get("deadline"), job.get("profit")
        if not identifier or identifier in seen:
            raise AlgorithmInputError("Job identifiers must be non-empty and unique.")
        if isinstance(deadline, bool) or not isinstance(deadline, int) or deadline < 1:
            raise AlgorithmInputError(f"Job {identifier} needs a positive integer deadline.")
        if isinstance(profit, bool) or not isinstance(profit, (int, float)) or profit < 0:
            raise AlgorithmInputError(f"Job {identifier} needs a non-negative numeric profit.")
        seen.add(identifier)
        normalized.append({"id": identifier, "deadline": deadline, "profit": profit})
    if normalized and max(job["deadline"] for job in normalized) > 100:
        raise AlgorithmInputError("Job deadlines must be at most 100.")
    ordered = sorted(normalized, key=lambda job: (-job["profit"], job["deadline"], job["id"]))
    slots: list[dict[str, Any] | None] = [None] * min(max((job["deadline"] for job in ordered), default=0), len(ordered))
    trace = Trace(capture_steps)
    trace.event("sort", "Process jobs in non-increasing profit order.", {"kind": "schedule", "jobs": ordered, "slots": slots.copy(), "profit": 0})
    total_profit = 0
    for job in ordered:
        placed = False
        for slot in range(min(job["deadline"], len(slots)) - 1, -1, -1):
            trace.comparisons += 1
            if slots[slot] is None:
                slots[slot] = job
                total_profit += job["profit"]
                trace.writes += 1
                placed = True
                trace.event("schedule", f"Place job {job['id']} in slot {slot + 1} before its deadline.", {"kind": "schedule", "jobs": ordered, "slots": slots.copy(), "current": job["id"], "outcome": "scheduled", "profit": total_profit})
                break
        if not placed:
            trace.event("reject", f"No free slot remains before job {job['id']}'s deadline.", {"kind": "schedule", "jobs": ordered, "slots": slots.copy(), "current": job["id"], "outcome": "rejected", "profit": total_profit})
    scheduled = [job for job in slots if job is not None]
    return _final(trace, {"schedule": scheduled, "total_profit": total_profit})


def huffman_coding(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    frequencies = data.get("frequencies")
    if not isinstance(frequencies, dict) or not 1 <= len(frequencies) <= 64:
        raise AlgorithmInputError("'frequencies' must be an object with 1 to 64 symbol-frequency pairs.")
    if any(not isinstance(symbol, str) or not symbol or isinstance(frequency, bool) or not isinstance(frequency, (int, float)) or frequency <= 0 for symbol, frequency in frequencies.items()):
        raise AlgorithmInputError("Every Huffman symbol needs a non-empty label and a positive numeric frequency.")
    trace = Trace(capture_steps)
    sequence = 0
    queue: list[tuple[float, int, dict[str, Any]]] = []
    for symbol, frequency in sorted(frequencies.items()):
        heapq.heappush(queue, (frequency, sequence, {"symbol": symbol, "frequency": frequency, "left": None, "right": None}))
        sequence += 1
    trace.event("start", "Create a leaf for each symbol and place it in the min-priority queue.", {"kind": "tree", "forest": [entry[2] for entry in sorted(queue)]})
    while len(queue) > 1:
        left_frequency, _, left = heapq.heappop(queue)
        right_frequency, _, right = heapq.heappop(queue)
        parent = {"symbol": f"{left['symbol']},{right['symbol']}", "frequency": left_frequency + right_frequency, "left": left, "right": right}
        trace.comparisons += 1
        trace.writes += 1
        heapq.heappush(queue, (parent["frequency"], sequence, parent))
        sequence += 1
        trace.event("merge", f"Combine {left['symbol']} ({left_frequency:g}) and {right['symbol']} ({right_frequency:g}) into frequency {parent['frequency']:g}.", {"kind": "tree", "forest": [entry[2] for entry in sorted(queue)], "active_merge": {"left": left["symbol"], "left_frequency": left_frequency, "right": right["symbol"], "right_frequency": right_frequency, "parent": parent["symbol"], "frequency": parent["frequency"]}})

    root = queue[0][2]
    codes: dict[str, str] = {}

    def assign_codes(node: dict[str, Any], prefix: str) -> None:
        if node["left"] is None and node["right"] is None:
            codes[node["symbol"]] = prefix or "0"
            return
        assign_codes(node["left"], prefix + "0")
        assign_codes(node["right"], prefix + "1")

    assign_codes(root, "")
    trace.event("complete", "The final prefix tree assigns a unique code to every symbol.", {"kind": "tree", "forest": [root], "codes": codes.copy()})
    return _final(trace, {"codes": codes, "weighted_path_length": sum(frequencies[symbol] * len(code) for symbol, code in codes.items()), "tree": root})


def graph_coloring(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    vertices, edges = data.get("vertices"), data.get("edges")
    colors = data.get("colors")
    if not isinstance(vertices, list) or not 1 <= len(vertices) <= 12 or any(not isinstance(vertex, str) or not vertex for vertex in vertices) or len(set(vertices)) != len(vertices):
        raise AlgorithmInputError("'vertices' must contain 1 to 12 unique, non-empty labels for the trace.")
    if not isinstance(edges, list):
        raise AlgorithmInputError("'edges' must be a list of [vertex, vertex] pairs.")
    if isinstance(colors, int) and not isinstance(colors, bool):
        if not 1 <= colors <= 6:
            raise AlgorithmInputError("Use between 1 and 6 colors.")
        palette = [f"Color {index + 1}" for index in range(colors)]
    elif isinstance(colors, list) and 1 <= len(colors) <= 6 and all(isinstance(color, str) and color for color in colors):
        palette = list(dict.fromkeys(colors))
        if len(palette) != len(colors):
            raise AlgorithmInputError("Color labels must be unique.")
    else:
        raise AlgorithmInputError("'colors' must be a number from 1 to 6 or a list of color labels.")
    adjacency = {vertex: set() for vertex in vertices}
    parsed_edges = []
    for edge in edges:
        if not isinstance(edge, list) or len(edge) != 2 or edge[0] not in adjacency or edge[1] not in adjacency or edge[0] == edge[1]:
            raise AlgorithmInputError("Every coloring edge must connect two distinct listed vertices.")
        left, right = edge
        adjacency[left].add(right)
        adjacency[right].add(left)
        parsed_edges.append([left, right])
    assigned: dict[str, str] = {}
    trace = Trace(capture_steps)

    def state(current: str | None = None) -> dict[str, Any]:
        return {"kind": "coloring", "vertices": vertices, "edges": parsed_edges, "colors": assigned.copy(), "palette": palette, "current": current}

    trace.event("start", "Color vertices one at a time, rejecting a color already used by a neighbor.", state())

    def paint(index: int) -> bool:
        if index == len(vertices):
            return True
        vertex = vertices[index]
        for color in palette:
            trace.comparisons += 1
            conflict = any(assigned.get(neighbor) == color for neighbor in adjacency[vertex])
            if conflict:
                trace.event("conflict", f"Reject {color} for {vertex}: an adjacent vertex already has that color.", state(vertex))
                continue
            assigned[vertex] = color
            trace.writes += 1
            trace.event("assign", f"Assign {color} to {vertex} and continue with the next vertex.", state(vertex))
            if paint(index + 1):
                return True
            del assigned[vertex]
            trace.event("backtrack", f"Remove the color from {vertex}; this choice led to a dead end.", state(vertex))
        return False

    solved = paint(0)
    trace.event("complete" if solved else "no_solution", "A valid coloring was found." if solved else "No coloring exists with the available palette.", state())
    return _final(trace, {"solved": solved, "coloring": assigned.copy(), "colors_used": len(set(assigned.values())) if solved else 0})


def n_queens(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    size = data.get("size", 4)
    if isinstance(size, bool) or not isinstance(size, int) or not 1 <= size <= 8:
        raise AlgorithmInputError("'size' must be an integer between 1 and 8 for step-by-step use.")
    trace, columns = Trace(capture_steps), []

    def board() -> list[str]:
        return ["".join("Q" if columns[row] == col else "·" for col in range(size)) if row < len(columns) else "·" * size for row in range(size)]

    def safe(row: int, column: int) -> bool:
        return all(column != existing and abs(column - existing) != row - previous_row for previous_row, existing in enumerate(columns))

    def place(row: int) -> bool:
        if row == size:
            return True
        for column in range(size):
            trace.comparisons += 1
            trace.expanded_nodes += 1
            if safe(row, column):
                columns.append(column)
                trace.writes += 1
                trace.event("place", f"Place a queen at row {row + 1}, column {column + 1}.", {"kind": "board", "board": board(), "active": [row, column]})
                if place(row + 1):
                    return True
                columns.pop()
                trace.event("backtrack", f"No completion from row {row + 1}, column {column + 1}; remove the queen.", {"kind": "board", "board": board(), "active": [row, column]})
            else:
                trace.event("conflict", f"Row {row + 1}, column {column + 1} conflicts with an existing queen.", {"kind": "board", "board": board(), "active": [row, column]})
        return False

    solved = place(0)
    return _final(trace, {"solved": solved, "columns": columns, "board": board()})


def lcs(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    first, second = data.get("first"), data.get("second")
    if not isinstance(first, str) or not isinstance(second, str):
        raise AlgorithmInputError("'first' and 'second' must be strings.")
    if len(first) > 20 or len(second) > 20:
        raise AlgorithmInputError("Use strings of up to 20 characters for the animated table.")
    table = [[0] * (len(second) + 1) for _ in range(len(first) + 1)]
    trace = Trace(capture_steps)
    for row, left_character in enumerate(first, start=1):
        for column, right_character in enumerate(second, start=1):
            trace.comparisons += 1
            if left_character == right_character:
                table[row][column] = table[row - 1][column - 1] + 1
                note = f"'{left_character}' matches: extend the diagonal subsequence."
                event_name = "match"
            else:
                table[row][column] = max(table[row - 1][column], table[row][column - 1])
                note = f"'{left_character}' and '{right_character}' differ: keep the better neighbor."
                event_name = "choose"
            trace.writes += 1
            trace.event(event_name, note, {"kind": "table", "table": [line.copy() for line in table], "rows": ["∅", *first], "columns": ["∅", *second], "active": [row, column]})
    row, column, answer = len(first), len(second), []
    while row and column:
        if first[row - 1] == second[column - 1]:
            answer.append(first[row - 1])
            row, column = row - 1, column - 1
        elif table[row - 1][column] >= table[row][column - 1]:
            row -= 1
        else:
            column -= 1
    subsequence = "".join(reversed(answer))
    trace.event("reconstruct", f"Trace the table backwards to reconstruct “{subsequence}”.", {"kind": "table", "table": table, "rows": ["∅", *first], "columns": ["∅", *second], "active": [len(first), len(second)], "solution": subsequence})
    return _final(trace, {"length": table[-1][-1], "subsequence": subsequence})


def matrix_chain_multiplication(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    dimensions = data.get("dimensions")
    if not isinstance(dimensions, list) or not 2 <= len(dimensions) <= 9 or any(isinstance(value, bool) or not isinstance(value, int) or value <= 0 for value in dimensions):
        raise AlgorithmInputError("'dimensions' must contain 2 to 9 positive integers for matrices A₁…Aₙ.")
    count = len(dimensions) - 1
    labels = [f"A{index + 1}" for index in range(count)]
    costs: list[list[int | None]] = [[0 if row == column else None for column in range(count)] for row in range(count)]
    splits = [[-1] * count for _ in range(count)]
    trace = Trace(capture_steps)
    trace.event("start", "Set each single-matrix chain to zero cost; try every split for longer chains.", {"kind": "table", "table": [row.copy() for row in costs], "rows": labels, "columns": labels, "active": [-1, -1]})
    for length in range(2, count + 1):
        for left in range(count - length + 1):
            right = left + length - 1
            best = inf
            for split in range(left, right):
                candidate = int(costs[left][split]) + int(costs[split + 1][right]) + dimensions[left] * dimensions[split + 1] * dimensions[right + 1]
                trace.comparisons += 1
                if candidate < best:
                    best, splits[left][right] = candidate, split
            costs[left][right] = int(best)
            trace.writes += 1
            trace.event("fill", f"The cheapest split for {labels[left]}…{labels[right]} costs {int(best)} scalar multiplications.", {"kind": "table", "table": [row.copy() for row in costs], "rows": labels, "columns": labels, "active": [left, right]})

    def parenthesize(left: int, right: int) -> str:
        if left == right:
            return labels[left]
        split = splits[left][right]
        return f"({parenthesize(left, split)} × {parenthesize(split + 1, right)})"

    expression = parenthesize(0, count - 1)
    trace.event("reconstruct", f"Reconstruct the optimal order: {expression}.", {"kind": "table", "table": [row.copy() for row in costs], "rows": labels, "columns": labels, "active": [0, count - 1], "solution": expression, "solution_label": "Optimal parenthesization"})
    return _final(trace, {"minimum_multiplications": costs[0][count - 1], "parenthesization": expression})


def zero_one_knapsack(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    capacity, raw_items = data.get("capacity"), data.get("items")
    if isinstance(capacity, bool) or not isinstance(capacity, int) or not 0 <= capacity <= 5000:
        raise AlgorithmInputError("'capacity' must be a whole number between 0 and 5,000.")
    if not isinstance(raw_items, list) or len(raw_items) > 100:
        raise AlgorithmInputError("'items' must be a list containing at most 100 objects.")
    if (len(raw_items) + 1) * (capacity + 1) > 100_000:
        raise AlgorithmInputError("The item-capacity table is limited to 100,000 states.")
    items = []
    for index, item in enumerate(raw_items):
        if not isinstance(item, dict) or isinstance(item.get("weight"), bool) or not isinstance(item.get("weight"), int) or item["weight"] <= 0 or isinstance(item.get("value"), bool) or not isinstance(item.get("value"), (int, float)) or item["value"] < 0:
            raise AlgorithmInputError(f"Item {index + 1} needs a non-negative value and positive whole-number weight.")
        items.append({"name": str(item.get("name", f"Item {index + 1}")), "value": item["value"], "weight": item["weight"]})
    if capture_steps and (len(items) + 1) * (capacity + 1) > 1200:
        raise AlgorithmInputError("For a readable animated DP table, use at most 1,200 item-capacity states.")
    table = [[0] * (capacity + 1) for _ in range(len(items) + 1)]
    row_labels = ["0", *[item["name"] for item in items]]
    column_labels = [str(weight) for weight in range(capacity + 1)]
    trace = Trace(capture_steps)
    if capture_steps:
        trace.event("start", "For each item and capacity, compare excluding the item with including it.", {"kind": "table", "table": [row.copy() for row in table], "rows": row_labels, "columns": column_labels, "active": [-1, -1]})
    for row, item in enumerate(items, start=1):
        for current_capacity in range(capacity + 1):
            excluded = table[row - 1][current_capacity]
            included = item["value"] + table[row - 1][current_capacity - item["weight"]] if item["weight"] <= current_capacity else -1
            table[row][current_capacity] = max(excluded, included)
            trace.comparisons += 1
            trace.writes += 1
            if capture_steps:
                trace.event("choose", f"At capacity {current_capacity}, keep the better of excluding or including {item['name']}.", {"kind": "table", "table": [line.copy() for line in table], "rows": row_labels, "columns": column_labels, "active": [row, current_capacity]})
    chosen = []
    remaining = capacity
    for row in range(len(items), 0, -1):
        if table[row][remaining] != table[row - 1][remaining]:
            item = items[row - 1]
            chosen.append(item)
            remaining -= item["weight"]
    chosen.reverse()
    selected_names = ", ".join(item["name"] for item in chosen) or "none"
    if capture_steps:
        trace.event("reconstruct", f"Trace the table back to recover the selected items: {selected_names}.", {"kind": "table", "table": [line.copy() for line in table], "rows": row_labels, "columns": column_labels, "active": [len(items), capacity], "solution": selected_names, "solution_label": "Selected items"})
    return _final(trace, {"maximum_value": table[-1][-1], "total_weight": sum(item["weight"] for item in chosen), "selected": chosen})


def optimal_bst(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    keys, probabilities, gaps = data.get("keys"), data.get("successful_frequencies"), data.get("unsuccessful_frequencies")
    if not isinstance(keys, list) or not 1 <= len(keys) <= 10 or any(not isinstance(key, str) or not key for key in keys) or len(set(keys)) != len(keys):
        raise AlgorithmInputError("'keys' must contain 1 to 10 unique, non-empty string labels.")
    if keys != sorted(keys):
        raise AlgorithmInputError("Optimal BST keys must be in sorted order.")
    if not isinstance(probabilities, list) or len(probabilities) != len(keys) or any(isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0 for value in probabilities):
        raise AlgorithmInputError("'successful_frequencies' must contain one non-negative number per key.")
    if not isinstance(gaps, list) or len(gaps) != len(keys) + 1 or any(isinstance(value, bool) or not isinstance(value, (int, float)) or value < 0 for value in gaps):
        raise AlgorithmInputError("'unsuccessful_frequencies' must contain one non-negative value before, between, and after the keys.")
    count = len(keys)
    costs = [[0.0] * (count + 2) for _ in range(count + 2)]
    weights = [[0.0] * (count + 2) for _ in range(count + 2)]
    roots = [[0] * (count + 2) for _ in range(count + 2)]
    for index in range(1, count + 2):
        costs[index][index - 1] = gaps[index - 1]
        weights[index][index - 1] = gaps[index - 1]
    for left in range(1, count + 1):
        for right in range(left, count + 1):
            weights[left][right] = weights[left][right - 1] + probabilities[right - 1] + gaps[right]
    trace = Trace(capture_steps)
    def view(active: list[int]) -> dict[str, Any]:
        table = [[round(costs[row + 1][column + 1], 5) if column >= row else None for column in range(count)] for row in range(count)]
        return {"kind": "table", "table": table, "rows": keys, "columns": keys, "active": active}
    trace.event("start", "Initialize empty-search costs from unsuccessful frequencies, then try every key as a root.", view([-1, -1]))
    for length in range(1, count + 1):
        for left in range(1, count - length + 2):
            right = left + length - 1
            best = inf
            for root in range(left, right + 1):
                candidate = costs[left][root - 1] + costs[root + 1][right] + weights[left][right]
                trace.comparisons += 1
                if candidate < best:
                    best, roots[left][right] = candidate, root
            costs[left][right] = best
            trace.writes += 1
            trace.event("choose", f"Choose {keys[roots[left][right] - 1]} as the root for keys {keys[left - 1]}…{keys[right - 1]}.", view([left - 1, right - 1]))

    def build(left: int, right: int) -> dict[str, Any] | None:
        if left > right:
            return None
        root = roots[left][right]
        return {"key": keys[root - 1], "left": build(left, root - 1), "right": build(root + 1, right)}

    tree = build(1, count)
    trace.event("reconstruct", "Follow the stored root choices to reconstruct the optimal search tree.", {**view([0, count - 1]), "tree": tree})
    return _final(trace, {"weighted_search_cost": round(costs[1][count], 6), "root": keys[roots[1][count] - 1], "tree": tree})


def _graph_input(data: dict[str, Any], allow_negative: bool = True) -> tuple[list[str], list[tuple[str, str, float]], str, bool]:
    vertices, edges, start, directed = data.get("vertices"), data.get("edges"), data.get("start"), data.get("directed", False)
    if not isinstance(directed, bool):
        raise AlgorithmInputError("'directed' must be true or false.")
    if not isinstance(vertices, list) or not vertices or any(not isinstance(vertex, str) or not vertex for vertex in vertices):
        raise AlgorithmInputError("'vertices' must be a non-empty list of labels.")
    if len(vertices) > 40:
        raise AlgorithmInputError("Interactive graph algorithms accept at most 40 vertices per run.")
    if len(set(vertices)) != len(vertices):
        raise AlgorithmInputError("Vertex labels must be unique.")
    if not isinstance(edges, list):
        raise AlgorithmInputError("'edges' must be a list of [from, to, weight] entries.")
    if len(edges) > 160:
        raise AlgorithmInputError("Interactive graph algorithms accept at most 160 edges per run.")
    parsed = []
    for edge in edges:
        if not isinstance(edge, list) or len(edge) != 3 or edge[0] not in vertices or edge[1] not in vertices or isinstance(edge[2], bool) or not isinstance(edge[2], (int, float)):
            raise AlgorithmInputError("Every edge must use known vertices and have a numeric weight.")
        if not allow_negative and edge[2] < 0:
            raise AlgorithmInputError("Dijkstra's algorithm does not accept negative edge weights.")
        parsed.append((edge[0], edge[1], float(edge[2])))
    if start not in vertices:
        raise AlgorithmInputError("'start' must be one of the listed vertices.")
    return vertices, parsed, start, bool(directed)


def travelling_salesperson(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    vertices, edges, start, directed = _graph_input(data, allow_negative=False)
    if directed:
        raise AlgorithmInputError("Travelling Salesperson branch-and-bound expects an undirected complete graph.")
    if not 3 <= len(vertices) <= 8:
        raise AlgorithmInputError("Use 3 to 8 vertices for the bounded TSP trace.")
    strategy = data.get("strategy", "least-cost")
    if strategy not in {"FIFO", "LIFO", "least-cost"}:
        raise AlgorithmInputError("'strategy' must be FIFO, LIFO, or least-cost.")
    weights = {vertex: {other: inf for other in vertices} for vertex in vertices}
    for left, right, weight in edges:
        if left == right:
            continue
        weights[left][right] = min(weights[left][right], weight)
        weights[right][left] = min(weights[right][left], weight)
    if any(weights[left][right] == inf for left in vertices for right in vertices if left != right):
        raise AlgorithmInputError("TSP input must include an edge between every pair of distinct vertices.")

    trace = Trace(capture_steps)
    best_cost, best_tour = inf, []

    def lower_bound(path: list[str], cost: float) -> float:
        remaining = [vertex for vertex in vertices if vertex not in path]
        current = path[-1]
        if not remaining:
            return cost + weights[current][start]
        if len(remaining) == 1:
            only = remaining[0]
            return cost + weights[current][only] + weights[only][start]
        # MST(unvisited) plus the two required connections is an admissible bound.
        included = {remaining[0]}
        mst_cost = 0.0
        while len(included) < len(remaining):
            weight, _, next_vertex = min((weights[left][right], left, right) for left in included for right in remaining if right not in included)
            mst_cost += weight
            included.add(next_vertex)
        return cost + mst_cost + min(weights[current][vertex] for vertex in remaining) + min(weights[start][vertex] for vertex in remaining)

    def state(path: list[str], bound_value: float, candidate: str | None = None) -> dict[str, Any]:
        graph_edges = [[left, right, weights[left][right]] for index, left in enumerate(vertices) for right in vertices[index + 1:]]
        path_cost = sum(weights[left][right] for left, right in zip(path, path[1:]))
        return {"kind": "search", "search_type": "tsp", "strategy": strategy, "vertices": vertices.copy(), "edges": graph_edges, "start": start, "path": path.copy(), "candidate": candidate, "cost": path_cost, "bound": bound_value, "best_tour": best_tour.copy(), "best_cost": (None if best_cost == inf else best_cost)}

    root = {"path": [start], "cost": 0.0, "bound": lower_bound([start], 0.0)}
    trace.event("start", f"Start at {start} using {strategy}; bound each partial tour before extending it.", state([start], root["bound"]))
    fifo: deque[dict[str, Any]] = deque()
    lifo: list[dict[str, Any]] = []
    least_cost: list[tuple[float, int, dict[str, Any]]] = []
    sequence = 0

    def enqueue(node: dict[str, Any]) -> None:
        nonlocal sequence
        if strategy == "FIFO":
            fifo.append(node)
        elif strategy == "LIFO":
            lifo.append(node)
        else:
            heapq.heappush(least_cost, (node["bound"], sequence, node))
            sequence += 1

    def dequeue() -> dict[str, Any]:
        if strategy == "FIFO":
            return fifo.popleft()
        if strategy == "LIFO":
            return lifo.pop()
        return heapq.heappop(least_cost)[2]

    def has_nodes() -> bool:
        return bool(fifo if strategy == "FIFO" else lifo if strategy == "LIFO" else least_cost)

    enqueue(root)
    while has_nodes():
        node = dequeue()
        path, cost, bound_value = node["path"], node["cost"], node["bound"]
        if bound_value >= best_cost:
            trace.event("prune", f"Prune {path}: lower bound {bound_value:g} cannot improve the best tour {best_cost:g}.", state(path, bound_value))
            continue
        trace.expanded_nodes += 1
        if len(path) == len(vertices):
            closed_tour_cost = cost + weights[path[-1]][start]
            if closed_tour_cost < best_cost:
                best_cost, best_tour = closed_tour_cost, [*path, start]
                trace.event("best", f"Complete tour costs {closed_tour_cost:g}; it is the best found so far.", state(best_tour, closed_tour_cost))
            continue
        candidates = sorted((vertex for vertex in vertices if vertex not in path), key=lambda vertex: (weights[path[-1]][vertex], vertex))
        if strategy == "LIFO":
            candidates.reverse()
        for vertex in candidates:
            child_path = [*path, vertex]
            child_cost = cost + weights[path[-1]][vertex]
            child_bound = lower_bound(child_path, child_cost)
            if child_bound >= best_cost:
                trace.event("prune", f"Reject extension to {vertex}: lower bound {child_bound:g} cannot beat the incumbent.", state(child_path, child_bound, vertex))
            else:
                trace.event("expand", f"Add {vertex} to the partial tour; its lower bound is {child_bound:g}.", state(child_path, child_bound, vertex))
                enqueue({"path": child_path, "cost": child_cost, "bound": child_bound})
    return _final(trace, {"minimum_cost": best_cost, "tour": best_tour, "strategy": strategy})


def knapsack_branch_bound(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    capacity, raw_items = data.get("capacity"), data.get("items")
    if isinstance(capacity, bool) or not isinstance(capacity, (int, float)) or capacity < 0:
        raise AlgorithmInputError("'capacity' must be a non-negative number.")
    if not isinstance(raw_items, list) or len(raw_items) > 15:
        raise AlgorithmInputError("'items' must be a list of at most 15 objects for branch-and-bound visualization.")
    items = []
    for index, item in enumerate(raw_items):
        if not isinstance(item, dict) or isinstance(item.get("weight"), bool) or not isinstance(item.get("weight"), (int, float)) or item["weight"] <= 0 or isinstance(item.get("value"), bool) or not isinstance(item.get("value"), (int, float)) or item["value"] < 0:
            raise AlgorithmInputError(f"Item {index + 1} needs a non-negative value and positive weight.")
        items.append({"name": str(item.get("name", f"Item {index + 1}")), "value": item["value"], "weight": item["weight"], "original_index": index})
    items.sort(key=lambda item: (-(item["value"] / item["weight"]), item["original_index"]))
    trace = Trace(capture_steps)

    def bound(level: int, weight: float, value: float) -> float:
        if weight >= capacity:
            return value
        remaining = capacity - weight
        estimate = value
        for item in items[level:]:
            if item["weight"] <= remaining:
                estimate += item["value"]
                remaining -= item["weight"]
            else:
                estimate += item["value"] * remaining / item["weight"]
                break
        return estimate

    def node_state(node: dict[str, Any], node_bound: float, current_best: float) -> dict[str, Any]:
        names = {item["original_index"]: item["name"] for item in items}
        best_weight = sum(item["weight"] for item in items if item["original_index"] in best_choices)
        return {
            "kind": "search",
            "search_type": "knapsack",
            **node,
            "capacity": capacity,
            "items": [{"name": item["name"], "weight": item["weight"], "value": item["value"], "ratio": item["value"] / item["weight"], "original_index": item["original_index"]} for item in items],
            "bound": node_bound,
            "best_value": current_best,
            "best_weight": best_weight,
            "best_choices": best_choices.copy(),
            "selected_items": [names[index] for index in node["choices"]],
        }

    sequence, best_value, best_choices = 0, 0.0, []
    root = {"level": 0, "weight": 0.0, "value": 0.0, "choices": []}
    frontier: list[tuple[float, int, dict[str, Any]]] = [(-bound(0, 0, 0), sequence, root)]
    trace.event("start", "Use the fractional relaxation as an upper bound; expand the live node with greatest bound first.", node_state(root, bound(0, 0, 0), best_value))
    while frontier:
        _, _, node = heapq.heappop(frontier)
        node_bound = bound(node["level"], node["weight"], node["value"])
        if node_bound <= best_value:
            trace.event("prune", f"Prune node at item {node['level']}: bound {node_bound:g} cannot beat value {best_value:g}.", node_state(node, node_bound, best_value))
            continue
        trace.expanded_nodes += 1
        trace.event("expand", f"Expand item decision {node['level'] + 1}; current bound is {node_bound:g}.", node_state(node, node_bound, best_value))
        if node["level"] == len(items):
            continue
        item = items[node["level"]]
        children = []
        included_weight = node["weight"] + item["weight"]
        if included_weight <= capacity:
            children.append({"level": node["level"] + 1, "weight": included_weight, "value": node["value"] + item["value"], "choices": [*node["choices"], item["original_index"]]})
        children.append({"level": node["level"] + 1, "weight": node["weight"], "value": node["value"], "choices": node["choices"].copy()})
        for child in children:
            if child["value"] > best_value:
                best_value, best_choices = child["value"], child["choices"].copy()
                trace.event("incumbent", f"A feasible selection improves the best value to {best_value:g}.", node_state(child, bound(child["level"], child["weight"], child["value"]), best_value))
            child_bound = bound(child["level"], child["weight"], child["value"])
            if child_bound > best_value:
                heapq.heappush(frontier, (-child_bound, sequence, child))
                sequence += 1
            else:
                trace.event("prune", f"Discard child node: its valid upper bound {child_bound:g} cannot improve {best_value:g}.", node_state(child, child_bound, best_value))
    chosen_indices = set(best_choices)
    selected = [item for item in items if item["original_index"] in chosen_indices]
    return _final(trace, {"maximum_value": best_value, "total_weight": sum(item["weight"] for item in selected), "selected": [{"name": item["name"], "value": item["value"], "weight": item["weight"]} for item in selected]})


def dijkstra(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    vertices, edges, start, directed = _graph_input(data, allow_negative=False)
    adjacency = {vertex: [] for vertex in vertices}
    for source, target, weight in edges:
        adjacency[source].append((target, weight))
        if not directed:
            adjacency[target].append((source, weight))
    distance, previous, unvisited = {vertex: inf for vertex in vertices}, {vertex: None for vertex in vertices}, set(vertices)
    distance[start], trace = 0, Trace(capture_steps)

    def state(current: str | None = None, edge: list[str] | None = None) -> dict[str, Any]:
        return {
            "kind": "graph",
            "graph_type": "dijkstra",
            "vertices": vertices.copy(),
            "edges": [list(item) for item in edges],
            "distances": {vertex: (None if value == inf else value) for vertex, value in distance.items()},
            "previous": previous.copy(),
            "selected_edges": [[parent, vertex] for vertex, parent in previous.items() if parent is not None],
            "visited": sorted(set(vertices) - unvisited),
            "current": current,
            "edge": edge,
            "start": start,
            "directed": directed,
        }

    trace.event("start", f"Set the distance to {start} to zero.", state(start))
    while unvisited:
        current = min(unvisited, key=lambda vertex: distance[vertex])
        if distance[current] == inf:
            break
        unvisited.remove(current)
        trace.expanded_nodes += 1
        for neighbor, weight in adjacency[current]:
            if neighbor not in unvisited:
                continue
            trace.comparisons += 1
            candidate = distance[current] + weight
            if candidate < distance[neighbor]:
                distance[neighbor], previous[neighbor], trace.writes = candidate, current, trace.writes + 1
                trace.event("relax", f"Relax {current} → {neighbor}: distance becomes {candidate:g}.", state(current, [current, neighbor]))
        trace.event("settle", f"The shortest distance to {current} is finalized.", state(current))
    clean_distances = {vertex: (None if value == inf else value) for vertex, value in distance.items()}
    return _final(trace, {"distances": clean_distances, "previous": previous})


def kruskal(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    vertices, edges, _, directed = _graph_input(data)
    if directed:
        raise AlgorithmInputError("Kruskal's algorithm requires an undirected graph.")
    parent = {vertex: vertex for vertex in vertices}
    rank = {vertex: 0 for vertex in vertices}
    chosen: list[list[Any]] = []
    trace = Trace(capture_steps)

    def find(vertex: str) -> str:
        if parent[vertex] != vertex:
            parent[vertex] = find(parent[vertex])
        return parent[vertex]

    def state(current: list[Any] | None = None) -> dict[str, Any]:
        return {"kind": "graph", "vertices": vertices, "edges": [list(edge) for edge in edges], "selected_edges": chosen.copy(), "edge": current, "directed": False}

    trace.event("start", "Sort edges by weight; add an edge only when it joins two different components.", state())
    total = 0.0
    for source, target, weight in sorted(edges, key=lambda edge: (edge[2], edge[0], edge[1])):
        trace.comparisons += 1
        left_root, right_root = find(source), find(target)
        if left_root == right_root:
            trace.event("reject", f"Reject {source}–{target} ({weight:g}); it would create a cycle.", state([source, target, weight]))
            continue
        if rank[left_root] < rank[right_root]:
            parent[left_root] = right_root
        elif rank[left_root] > rank[right_root]:
            parent[right_root] = left_root
        else:
            parent[right_root] = left_root
            rank[left_root] += 1
        chosen.append([source, target, weight])
        total += weight
        trace.writes += 1
        trace.event("accept", f"Accept {source}–{target} ({weight:g}); the components merge.", state([source, target, weight]))
        if len(chosen) == len(vertices) - 1:
            break
    if len(chosen) != len(vertices) - 1:
        raise AlgorithmInputError("The graph is disconnected; no minimum spanning tree exists.")
    trace.event("complete", f"The minimum spanning tree has total weight {total:g}.", state())
    return _final(trace, {"connected": True, "total_weight": total, "edges": chosen})


def prim(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    vertices, edges, start, directed = _graph_input(data)
    if directed:
        raise AlgorithmInputError("Prim's algorithm requires an undirected graph.")
    adjacency = {vertex: [] for vertex in vertices}
    for left, right, weight in edges:
        adjacency[left].append((right, weight))
        adjacency[right].append((left, weight))
    key, previous = {vertex: inf for vertex in vertices}, {vertex: None for vertex in vertices}
    key[start] = 0.0
    unvisited = set(vertices)
    chosen: list[list[Any]] = []
    trace = Trace(capture_steps)

    def state(current: str | None = None, edge: list[Any] | None = None) -> dict[str, Any]:
        return {"kind": "graph", "vertices": vertices, "edges": [list(item) for item in edges], "selected_edges": chosen.copy(), "edge": edge, "distances": {vertex: (None if value == inf else value) for vertex, value in key.items()}, "visited": sorted(set(vertices) - unvisited), "current": current, "directed": False, "labels": {vertex: previous[vertex] for vertex in vertices if previous[vertex] is not None}}

    trace.event("start", f"Start the tree at {start}; maintain the cheapest edge that crosses the current cut.", state(start))
    total = 0.0
    while unvisited:
        current = min(unvisited, key=lambda vertex: key[vertex])
        if key[current] == inf:
            raise AlgorithmInputError("The graph is disconnected; no minimum spanning tree exists.")
        unvisited.remove(current)
        if previous[current] is not None:
            edge = [previous[current], current, key[current]]
            chosen.append(edge)
            total += key[current]
            trace.writes += 1
            trace.event("accept", f"Add minimum cut edge {edge[0]}–{edge[1]} ({edge[2]:g}) to the tree.", state(current, edge))
        for neighbor, weight in adjacency[current]:
            if neighbor not in unvisited:
                continue
            trace.comparisons += 1
            if weight < key[neighbor]:
                key[neighbor], previous[neighbor] = weight, current
                trace.writes += 1
                trace.event("update", f"Edge {current}–{neighbor} with weight {weight:g} is the new cheapest connection to {neighbor}.", state(current, [current, neighbor, weight]))
        trace.event("settle", f"Add {current} to the growing tree.", state(current))
    trace.event("complete", f"The minimum spanning tree has total weight {total:g}.", state())
    return _final(trace, {"connected": True, "total_weight": total, "edges": chosen})


def bellman_ford(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    vertices, edges, start, directed = _graph_input(data, allow_negative=True)
    arcs = list(edges)
    if not directed:
        arcs.extend((target, source, weight) for source, target, weight in edges)
    distance, previous = {vertex: inf for vertex in vertices}, {vertex: None for vertex in vertices}
    distance[start] = 0.0
    trace = Trace(capture_steps)

    def state(edge: list[Any] | None = None, pass_number: int = 0) -> dict[str, Any]:
        return {"kind": "graph", "vertices": vertices, "edges": [list(item) for item in edges], "distances": {vertex: (None if value == inf else value) for vertex, value in distance.items()}, "previous": previous.copy(), "edge": edge, "pass": pass_number, "directed": directed, "negative_cycle": False}

    trace.event("start", f"Set source {start} to distance zero; relax every edge for up to |V|−1 passes.", state())
    for pass_number in range(1, len(vertices)):
        changed = False
        for source, target, weight in arcs:
            trace.comparisons += 1
            if distance[source] != inf and distance[source] + weight < distance[target]:
                distance[target] = distance[source] + weight
                previous[target] = source
                trace.writes += 1
                changed = True
                trace.event("relax", f"Pass {pass_number}: relax {source} → {target}; distance becomes {distance[target]:g}.", state([source, target, weight], pass_number))
            else:
                trace.event("check", f"Pass {pass_number}: edge {source} → {target} does not improve the known distance.", state([source, target, weight], pass_number))
        trace.expanded_nodes += 1
        if not changed:
            break
    for source, target, weight in arcs:
        if distance[source] != inf and distance[source] + weight < distance[target]:
            trace.event("negative_cycle", f"A reachable negative-weight cycle can still improve the distance to {target}; shortest distances are undefined.", {**state([source, target, weight], len(vertices)), "negative_cycle": True})
            return _final(trace, {"negative_cycle": True, "affected_vertex": target, "distances": {vertex: (None if value == inf else value) for vertex, value in distance.items()}, "previous": previous})
    trace.event("complete", "No reachable negative cycle exists; the distances are final.", state())
    return _final(trace, {"negative_cycle": False, "distances": {vertex: (None if value == inf else value) for vertex, value in distance.items()}, "previous": previous})


def rabin_karp(data: dict[str, Any], capture_steps: bool = True) -> Execution:
    text, pattern = data.get("text"), data.get("pattern")
    if not isinstance(text, str) or not isinstance(pattern, str) or not pattern:
        raise AlgorithmInputError("'text' and a non-empty 'pattern' are required.")
    if len(pattern) > len(text):
        raise AlgorithmInputError("The pattern cannot be longer than the text.")
    if len(text) > (2000 if capture_steps else 10000):
        limit = 2000 if capture_steps else 10000
        raise AlgorithmInputError(f"'text' can contain at most {limit} characters for this run.")
    base, modulus, width = 256, 101, len(pattern)
    high = pow(base, width - 1, modulus)
    pattern_hash = text_hash = 0
    for index in range(width):
        pattern_hash = (base * pattern_hash + ord(pattern[index])) % modulus
        text_hash = (base * text_hash + ord(text[index])) % modulus
    trace, matches = Trace(capture_steps), []
    for start in range(len(text) - width + 1):
        trace.comparisons += 1
        window = text[start : start + width]
        trace.event("hash", f"Compare pattern hash {pattern_hash} with window hash {text_hash}.", {"kind": "string", "text": text, "pattern": pattern, "window": [start, start + width - 1], "pattern_hash": pattern_hash, "window_hash": text_hash})
        if pattern_hash == text_hash:
            trace.comparisons += width
            if window == pattern:
                matches.append(start)
                trace.event("match", f"Hashes and characters match at position {start}.", {"kind": "string", "text": text, "pattern": pattern, "window": [start, start + width - 1], "match": start})
            else:
                trace.event("collision", "Hashes match, but character verification rejects this window.", {"kind": "string", "text": text, "pattern": pattern, "window": [start, start + width - 1]})
        if start < len(text) - width:
            text_hash = (base * (text_hash - ord(text[start]) * high) + ord(text[start + width])) % modulus
    return _final(trace, {"matches": matches, "count": len(matches)})


@dataclass(frozen=True)
class Algorithm:
    id: str
    name: str
    module: int
    category: str
    description: str
    best_case: str
    average_case: str
    worst_case: str
    space_complexity: str
    input_example: dict[str, Any]
    pseudocode: list[str]
    runner: Callable[[dict[str, Any], bool], Execution]


MODULES = [
    {"number": 1, "title": "Introduction & Analysis", "description": "Complexity, asymptotic notation and experimental analysis."},
    {"number": 2, "title": "Divide & Conquer / Greedy", "description": "Recursive decomposition and locally optimal choices."},
    {"number": 3, "title": "Backtracking & Branch and Bound", "description": "Constraint search, pruning and decision trees."},
    {"number": 4, "title": "Dynamic Programming", "description": "Reusable subproblems, states and reconstruction."},
    {"number": 5, "title": "Graph Algorithms & Classification", "description": "Paths, spanning structures, matching and complexity classes."},
]


_GRAPH_EXAMPLE = {"vertices": ["A", "B", "C", "D", "E"], "edges": [["A", "B", 4], ["A", "C", 1], ["C", "B", 2], ["B", "D", 1], ["C", "D", 5], ["D", "E", 3]], "start": "A", "directed": False}
_TSP_EXAMPLE = {"vertices": ["A", "B", "C", "D"], "edges": [["A", "B", 10], ["A", "C", 15], ["A", "D", 20], ["B", "C", 35], ["B", "D", 25], ["C", "D", 30]], "start": "A", "directed": False, "strategy": "least-cost"}
_BELLMAN_FORD_EXAMPLE = {"vertices": ["S", "A", "B", "C"], "edges": [["S", "A", 4], ["S", "B", 5], ["A", "B", -2], ["B", "C", 3], ["A", "C", 4]], "start": "S", "directed": True}

ALGORITHMS = [
    Algorithm("binary-search", "Binary Search", 2, "Divide and Conquer", "Find a target by repeatedly halving a sorted interval.", "O(1)", "O(log n)", "O(log n)", "O(1)", {"array": [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], "target": 23}, ["low ← 0; high ← n − 1", "while low ≤ high", "  mid ← floor((low + high) / 2)", "  compare target with A[mid]", "  discard the half that cannot contain target"], binary_search),
    Algorithm("merge-sort", "Merge Sort", 2, "Divide and Conquer", "Split an array, recursively sort halves, then merge them.", "O(n log n)", "O(n log n)", "O(n log n)", "O(n)", {"array": [38, 27, 43, 3, 9, 82, 10]}, ["if range has one item: return", "split at middle", "sort left and right recursively", "merge both sorted ranges"], merge_sort),
    Algorithm("quick-sort", "Quick Sort", 2, "Divide and Conquer", "Partition around a pivot and iteratively process the remaining ranges.", "O(n log n)", "O(n log n)", "O(n²)", "O(n) worst case", {"array": [29, 10, 14, 37, 13, 5, 42]}, ["choose the rightmost pivot", "partition values ≤ pivot to the left", "put pivot in its final position", "process both partitions"], quick_sort),
    Algorithm("insertion-sort", "Insertion Sort", 2, "Sorting", "Build a sorted prefix by inserting each next value into its correct position.", "O(n)", "O(n²)", "O(n²)", "O(1)", {"array": [9, 4, 7, 1, 3, 6]}, ["treat the first value as a sorted prefix", "take the next value as the key", "shift larger prefix values one position right", "insert the key into the open position"], insertion_sort),
    Algorithm("selection-sort", "Selection Sort", 2, "Sorting", "Repeatedly find the smallest value in the unsorted suffix and place it next.", "O(n²)", "O(n²)", "O(n²)", "O(1)", {"array": [7, 2, 9, 1, 5, 3]}, ["start at the first unsorted position", "scan the suffix for its minimum", "swap the minimum into the current position", "continue with the next suffix"], selection_sort),
    Algorithm("heap-sort", "Heap Sort", 2, "Sorting", "Build a max heap and repeatedly extract its root into the sorted suffix.", "O(n log n)", "O(n log n)", "O(n log n)", "O(1)", {"array": [8, 3, 6, 1, 9, 2, 5]}, ["build a max heap from the array", "swap the root maximum with the last heap item", "shrink the heap and restore its max-heap property", "repeat until the suffix is fully sorted"], heap_sort),
    Algorithm("fractional-knapsack", "Fractional Knapsack", 2, "Greedy", "Maximize value by taking the greatest value-to-weight ratios first.", "O(n log n)", "O(n log n)", "O(n log n)", "O(n)", {"capacity": 50, "items": [{"name": "Gold", "value": 60, "weight": 10}, {"name": "Silver", "value": 100, "weight": 20}, {"name": "Bronze", "value": 120, "weight": 30}]}, ["compute value / weight for every item", "sort items by decreasing ratio", "take as much as possible of each item", "stop when capacity is exhausted"], fractional_knapsack),
    Algorithm("job-sequencing", "Job Sequencing with Deadlines", 2, "Greedy", "Schedule at most one unit-time job per slot to maximize profit before deadlines.", "O(n log n)", "O(n log n)", "O(n²)", "O(n)", {"jobs": [{"id": "J1", "deadline": 2, "profit": 100}, {"id": "J2", "deadline": 1, "profit": 19}, {"id": "J3", "deadline": 2, "profit": 27}, {"id": "J4", "deadline": 1, "profit": 25}, {"id": "J5", "deadline": 3, "profit": 15}]}, ["sort jobs by decreasing profit", "for each job, find the latest free slot by its deadline", "schedule the job if a slot exists", "sum profits of scheduled jobs"], job_sequencing),
    Algorithm("huffman-coding", "Huffman Coding", 2, "Greedy", "Build an optimal prefix code by repeatedly merging the two least-frequent trees.", "O(n log n)", "O(n log n)", "O(n log n)", "O(n)", {"frequencies": {"A": 45, "B": 13, "C": 12, "D": 16, "E": 9, "F": 5}}, ["insert every symbol as a weighted leaf", "remove the two least-frequent roots", "merge them under a new parent", "repeat until one prefix tree remains"], huffman_coding),
    Algorithm("n-queens", "N-Queens", 3, "Backtracking", "Place queens row by row, undoing placements that cannot lead to a solution.", "O(n²)", "Input dependent", "O(n!)", "O(n)", {"size": 4}, ["try each column in the current row", "reject positions attacked by an earlier queen", "place a safe queen and recurse", "backtrack if no later row can be completed"], n_queens),
    Algorithm("graph-coloring", "Graph Coloring", 3, "Backtracking", "Assign a color to each vertex while rejecting choices that conflict with neighbors.", "O(V + E)", "Input dependent", "O(k^V)", "O(V + E)", {"vertices": ["A", "B", "C", "D"], "edges": [["A", "B"], ["A", "C"], ["B", "C"], ["B", "D"], ["C", "D"]], "colors": ["Red", "Green", "Blue"]}, ["choose the next uncolored vertex", "try each available color", "reject a color used by an adjacent vertex", "recurse, then backtrack if no color works"], graph_coloring),
    Algorithm("travelling-salesperson", "Travelling Salesperson (Branch and Bound)", 3, "Branch and Bound", "Explore partial tours and prune any whose admissible completion bound cannot beat the best tour.", "O(n²)", "Input dependent", "O(n!)", "O(n²)", _TSP_EXAMPLE, ["select a FIFO, LIFO, or least-cost live-node strategy", "compute an MST-based lower bound on each partial tour", "prune if the bound is no better than the incumbent", "branch to an unvisited city and update the best tour"], travelling_salesperson),
    Algorithm("knapsack-branch-bound", "Knapsack (Branch and Bound)", 3, "Branch and Bound", "Search include/exclude choices in descending fractional upper-bound order.", "O(n log n)", "Input dependent", "O(2^n)", "O(2^n)", {"capacity": 50, "items": [{"name": "A", "value": 60, "weight": 10}, {"name": "B", "value": 100, "weight": 20}, {"name": "C", "value": 120, "weight": 30}]}, ["sort items by value-to-weight ratio", "bound the best possible fractional completion", "expand the live node with greatest bound", "prune nodes whose bound cannot beat the incumbent"], knapsack_branch_bound),
    Algorithm("matrix-chain-multiplication", "Matrix Chain Multiplication", 4, "Dynamic Programming", "Choose a minimum-cost parenthesization for a fixed sequence of matrices.", "O(n³)", "O(n³)", "O(n³)", "O(n²)", {"dimensions": [40, 20, 30, 10, 30]}, ["set the cost of each one-matrix chain to zero", "increase chain length", "try every split point", "store the cheapest cost and split", "reconstruct the parenthesization"], matrix_chain_multiplication),
    Algorithm("longest-common-subsequence", "Longest Common Subsequence", 4, "Dynamic Programming", "Fill a table of optimal prefix subsequences, then reconstruct one answer.", "O(mn)", "O(mn)", "O(mn)", "O(mn)", {"first": "AGGTAB", "second": "GXTXAYB"}, ["create a (m + 1) × (n + 1) table", "if characters match: use diagonal + 1", "otherwise: keep the larger neighbor", "trace backwards to reconstruct a subsequence"], lcs),
    Algorithm("zero-one-knapsack", "0/1 Knapsack", 4, "Dynamic Programming", "Compare including or excluding each whole item at each capacity state.", "O(nW)", "O(nW)", "O(nW)", "O(nW)", {"capacity": 7, "items": [{"name": "A", "value": 16, "weight": 2}, {"name": "B", "value": 19, "weight": 3}, {"name": "C", "value": 23, "weight": 4}, {"name": "D", "value": 28, "weight": 5}]}, ["initialize a table for item prefixes and capacities", "compare excluding each item with including it", "store the larger feasible value", "trace the table backwards to recover selected items"], zero_one_knapsack),
    Algorithm("optimal-binary-search-tree", "Optimal Binary Search Tree", 4, "Dynamic Programming", "Choose roots for key intervals to minimize weighted successful and unsuccessful search cost.", "O(n³)", "O(n³)", "O(n³)", "O(n²)", {"keys": ["A", "B", "C"], "successful_frequencies": [0.3, 0.2, 0.5], "unsuccessful_frequencies": [0.1, 0.05, 0.05, 0.1]}, ["initialize empty-interval costs from unsuccessful frequencies", "increase interval length", "try each key as root", "store minimum weighted search cost and its root", "reconstruct the tree"], optimal_bst),
    Algorithm("kruskal", "Kruskal's Minimum Spanning Tree", 5, "Graph", "Select increasing-weight edges that join different components; reject cycle-forming edges.", "O(E log E)", "O(E log E)", "O(E log E)", "O(V + E)", _GRAPH_EXAMPLE, ["sort edges by non-decreasing weight", "initialize each vertex as its own component", "accept an edge if its endpoints have different roots", "stop after V − 1 accepted edges"], kruskal),
    Algorithm("prim", "Prim's Minimum Spanning Tree", 5, "Graph", "Grow a minimum spanning tree using the cheapest edge crossing the current cut.", "O(V² + E)", "O(V² + E)", "O(V² + E)", "O(V + E)", _GRAPH_EXAMPLE, ["set the starting vertex key to zero", "choose the unvisited vertex with smallest key", "add its connecting edge to the tree", "update keys of adjacent unvisited vertices"], prim),
    Algorithm("bellman-ford", "Bellman–Ford Shortest Paths", 5, "Graph", "Relax all edges up to V − 1 times and report reachable negative cycles.", "O(E)", "O(VE)", "O(VE)", "O(V + E)", _BELLMAN_FORD_EXAMPLE, ["set source distance to zero", "repeat edge relaxation up to V − 1 times", "stop early if a pass makes no change", "scan once more to detect a reachable negative cycle"], bellman_ford),
    Algorithm("dijkstra", "Dijkstra's Shortest Path", 5, "Graph", "Find shortest paths from one source when all edge weights are non-negative.", "O(V² + E)", "O(V² + E)", "O(V² + E)", "O(V + E)", _GRAPH_EXAMPLE, ["set source distance to zero", "scan for the unvisited vertex with smallest distance", "relax its outgoing edges", "mark the selected vertex settled"], dijkstra),
    Algorithm("rabin-karp", "Rabin–Karp", 5, "String Matching", "Use rolling hashes to find candidate pattern positions before verifying characters.", "O(n + m)", "O(n + m)", "O(nm)", "O(1)", {"text": "ABCCDDAEFG", "pattern": "CDD"}, ["hash the pattern and first text window", "compare the two hashes", "verify characters after a hash match", "roll the window hash forward"], rabin_karp),
]

BY_ID = {algorithm.id: algorithm for algorithm in ALGORITHMS}


def catalogue() -> list[dict[str, Any]]:
    return [
        {**{key: value for key, value in algorithm.__dict__.items() if key != "runner"}, "implementation_status": "implemented"}
        for algorithm in ALGORITHMS
    ]


def algorithm_detail(algorithm_id: str) -> dict[str, Any]:
    algorithm = BY_ID.get(algorithm_id)
    if algorithm is None:
        raise KeyError(algorithm_id)
    return {**{key: value for key, value in algorithm.__dict__.items() if key != "runner"}, "implementation_status": "implemented"}


def run_algorithm(algorithm_id: str, payload: dict[str, Any], capture_steps: bool = True) -> Execution:
    algorithm = BY_ID.get(algorithm_id)
    if algorithm is None:
        raise KeyError(algorithm_id)
    return algorithm.runner(payload, capture_steps)
