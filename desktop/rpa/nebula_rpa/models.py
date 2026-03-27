from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional

EngineMode = Literal["mock", "hybrid", "live"]


@dataclass
class StepDefinition:
    id: str
    title: str
    adapter: str
    action: str
    description: str
    progress: int
    payload: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExecutionRequest:
    task_id: str
    template_id: str
    task_name: str
    sop_code: str
    platforms: List[str]
    payload: Dict[str, Any]
    device: Dict[str, Any]
    raw_command: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExecutionRequest":
        return cls(
            task_id=str(data["taskId"]),
            template_id=str(data["templateId"]),
            task_name=str(data["taskName"]),
            sop_code=str(data["sopCode"]),
            platforms=[str(item) for item in data.get("platforms", [])],
            payload=dict(data.get("payload", {})),
            device=dict(data.get("device", {})),
            raw_command=data.get("rawCommand"),
        )


@dataclass
class ExecutionResult:
    task_id: str
    status: Literal["completed", "failed"]
    summary: str
    engine_mode: EngineMode
    artifacts: Dict[str, Any] = field(default_factory=dict)
    logs: List[str] = field(default_factory=list)
