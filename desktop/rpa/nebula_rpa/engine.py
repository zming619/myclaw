from __future__ import annotations

from typing import Any, Callable, Dict

from .models import ExecutionRequest, ExecutionResult
from .runtime import AutomationAdapterHub, detect_runtime
from .sop import build_sop

Emitter = Callable[[Dict[str, Any]], None]


class SopExecutionEngine:
    def __init__(self) -> None:
        self.probe = detect_runtime()
        self.adapters = AutomationAdapterHub(self.probe)

    def execute(self, request: ExecutionRequest, emit: Emitter) -> ExecutionResult:
        steps = build_sop(request)
        artifacts: Dict[str, Any] = {}
        logs = []

        emit(
            {
                "type": "run_started",
                "message": f"已装载 SOP {request.sop_code}，共 {len(steps)} 个步骤",
                "progress": 2,
                "engineMode": self.probe.mode,
            }
        )

        for step in steps:
            emit(
                {
                    "type": "step_started",
                    "stepId": step.id,
                    "message": f"{step.title}：{step.description}",
                    "progress": max(3, step.progress - 8),
                    "engineMode": self.probe.mode,
                }
            )
            artifact = self.adapters.execute(step, request)
            artifacts[step.id] = artifact
            logs.append(f"{step.title}: {artifact.get('summary', '步骤完成')}")
            emit(
                {
                    "type": "step_completed",
                    "stepId": step.id,
                    "message": artifact.get("summary", f"{step.title} 已完成"),
                    "progress": step.progress,
                    "engineMode": self.probe.mode,
                    "artifacts": {step.id: artifact},
                }
            )

        summary = self._build_summary(request)
        emit(
            {
                "type": "run_completed",
                "message": summary,
                "summary": summary,
                "progress": 100,
                "engineMode": self.probe.mode,
                "artifacts": artifacts,
            }
        )
        return ExecutionResult(
            task_id=request.task_id,
            status="completed",
            summary=summary,
            engine_mode=self.probe.mode,
            artifacts=artifacts,
            logs=logs,
        )

    def _build_summary(self, request: ExecutionRequest) -> str:
        if request.template_id == "broadcast_message":
            return "微信群发 SOP 已执行完成，等待后台同步送达结果。"
        if request.template_id == "publish_video":
            return "矩阵发布 SOP 已提交到目标平台，等待平台审核。"
        if request.template_id == "lead_capture":
            return "公域获客 SOP 已完成评论区扫描、建联和线索回传。"
        if request.template_id == "push_sop":
            return "客户 SOP 推送已完成当前批次执行。"
        if request.template_id == "auto_reply":
            return "微信自动回复守护 SOP 已开启。"
        if request.template_id == "device_status_query":
            return "设备状态已采集并生成回传数据。"
        return f"{request.task_name} 已按 SOP 执行完成。"
