"""Request and response models shared by the API endpoints."""

from typing import Any

from pydantic import BaseModel, Field


class AlgorithmRequest(BaseModel):
    algorithm_id: str
    input: dict[str, Any] = Field(default_factory=dict)


class BenchmarkRequest(BaseModel):
    algorithm_id: str
    sizes: list[int] = Field(default_factory=lambda: [10, 100, 500, 1000], min_length=1, max_length=8)
    trials: int = Field(default=5, ge=1, le=25)
    case_type: str = Field(default="random", pattern="^(random|sorted|reversed|best|average|worst)$")


class CompareRequest(BaseModel):
    algorithm_ids: list[str] = Field(min_length=2, max_length=5)
    input: dict[str, Any] = Field(default_factory=dict)


class SaveExperimentRequest(BaseModel):
    algorithm_id: str
    input: dict[str, Any]
    result: dict[str, Any]
    metrics: dict[str, Any]
    title: str | None = Field(default=None, max_length=120)


class RunResponse(BaseModel):
    algorithm_id: str
    result: dict[str, Any]
    steps: list[dict[str, Any]]
    metrics: dict[str, Any]
