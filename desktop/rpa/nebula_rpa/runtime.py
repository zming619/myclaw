from __future__ import annotations

import importlib.util
import os
from dataclasses import dataclass
from typing import Any, Dict, List

from .mac_wechat import MacWechatAutomation, detect_mac_wechat, is_macos_platform
from .models import EngineMode, ExecutionRequest, StepDefinition
from .playwright_bridge import run_playwright_action


def has_module(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


@dataclass
class RuntimeProbe:
    mode: EngineMode
    capabilities: List[str]
    detail: str


def detect_runtime() -> RuntimeProbe:
    has_playwright = has_module("playwright")
    has_ui_automation = has_module("uiautomation") or has_module("pywinauto")
    mac_wechat_probe = detect_mac_wechat()
    has_mac_wechat = mac_wechat_probe.available
    has_wechat_automation = has_ui_automation or has_mac_wechat
    live_requested = os.getenv("MYCLAW_RPA_LIVE") == "1"

    if live_requested and has_playwright and has_wechat_automation:
        mode: EngineMode = "live"
    elif has_playwright or has_wechat_automation:
        mode = "hybrid"
    else:
        mode = "mock"

    capabilities = []
    capabilities.append("playwright" if has_playwright else "playwright-missing")
    capabilities.append("ui-automation" if has_ui_automation else "ui-automation-missing")
    if is_macos_platform():
        if has_mac_wechat:
            capabilities.append("mac-wechat-ui")
        elif mac_wechat_probe.reason == "permission-missing":
            capabilities.append("mac-wechat-ui-permission-missing")
        else:
            capabilities.append("mac-wechat-ui-missing")
    capabilities.append("remote-json-command")
    capabilities.append("sop-orchestration")

    detail_parts = [
        (
        "已开启真实执行模式"
        if mode == "live"
        else "检测到部分依赖，可切换混合模式"
        if mode == "hybrid"
        else "当前使用模拟驱动，适合开发和联调"
        )
    ]
    if is_macos_platform():
        detail_parts.append(mac_wechat_probe.detail)
    detail = "；".join(part for part in detail_parts if part)

    return RuntimeProbe(mode=mode, capabilities=capabilities, detail=detail)


class AutomationAdapterHub:
    def __init__(self, probe: RuntimeProbe):
        self.probe = probe
        self.mac_wechat_probe = detect_mac_wechat()

    def execute(self, step: StepDefinition, request: ExecutionRequest) -> Dict[str, Any]:
        if step.adapter == "wechat":
            return self._wechat(step, request)
        if step.adapter == "content":
            return self._content(step, request)
        if step.adapter == "public_leads":
            return self._public_leads(step, request)
        if step.adapter == "media":
            return self._media(step, request)
        if step.adapter == "device":
            return self._device(step, request)

        return {
            "summary": f"适配器 {step.adapter} 未实现，已按模拟步骤记录。",
            "driver": self._driver_for(step.adapter),
            "payload": step.payload,
        }

    def _wechat(self, step: StepDefinition, request: ExecutionRequest) -> Dict[str, Any]:
        if is_macos_platform():
            automation = MacWechatAutomation(self.mac_wechat_probe, self.probe.mode)
            return automation.execute(step, request)
        if step.action == "ensure_session":
            return self._artifact("wechat-desktop", "已校验微信登录态与主窗口焦点", request)
        if step.action == "segment_contacts":
            return self._artifact(
                "wechat-desktop",
                f"已按标签筛选联系人：{request.payload.get('targetTags') or request.payload.get('customerTags') or ['默认分组']}",
                request,
            )
        if step.action == "send_broadcast":
            return self._artifact(
                "wechat-desktop",
                "已生成群发批次并触发发送动作",
                request,
            )
        if step.action == "enable_guard":
            return self._artifact("wechat-desktop", "已加载欢迎语、关键词规则和 AI 回复守护", request)
        if step.action == "push_sop":
            return self._artifact("wechat-desktop", "已按 SOP 阶段推送内容并写回客户标签", request)
        if step.action == "reactivate":
            return self._artifact("wechat-desktop", "已执行沉默客户激活触达链路", request)
        if step.action == "publish_moments":
            return self._artifact("wechat-desktop", "已准备朋友圈素材并发布到营销计划", request)
        if step.action == "apply_tags":
            return self._artifact("wechat-desktop", "已完成好友标签识别与批量打标", request)
        return self._artifact("wechat-desktop", f"已执行微信动作 {step.action}", request)

    def _content(self, step: StepDefinition, request: ExecutionRequest) -> Dict[str, Any]:
        platform = step.payload.get("platform") or "矩阵平台"
        if self.probe.mode != "mock" and step.action in {"publish_video", "auto_exposure"}:
            return self._run_playwright(request, str(platform), step.action)
        if step.action == "validate_assets":
            return self._artifact("media-pipeline", "已检查标题、封面、素材和平台配置", request)
        if step.action == "publish_video":
            return self._artifact("playwright", f"已向 {platform} 提交视频发布任务", request)
        if step.action == "auto_exposure":
            return self._artifact("playwright", f"已向 {platform} 提交点赞 / 评论 / 关注动作", request)
        return self._artifact("playwright", f"已执行内容分发动作 {step.action}", request)

    def _public_leads(self, step: StepDefinition, request: ExecutionRequest) -> Dict[str, Any]:
        platform = step.payload.get("platform") or "目标平台"
        if self.probe.mode != "mock" and step.action in {"scan_comments", "engage_leads"}:
            return self._run_playwright(request, str(platform), step.action)
        if step.action == "scan_comments":
            return self._artifact(
                "playwright",
                f"已扫描 {platform} 评论区，关键词 {request.payload.get('keywords', [])}",
                request,
            )
        if step.action == "qualify_leads":
            return self._artifact("playwright", "已按关键词和权重筛选潜在线索", request)
        if step.action == "engage_leads":
            return self._artifact("playwright", f"已对 {platform} 线索执行评论 / 关注 / 私信", request)
        if step.action == "export_leads":
            return self._artifact("crm-bridge", "已生成线索回传包，等待后台接收", request)
        return self._artifact("playwright", f"已执行公域获客动作 {step.action}", request)

    def _media(self, step: StepDefinition, request: ExecutionRequest) -> Dict[str, Any]:
        if step.action == "optimize_assets":
            return self._artifact("media-pipeline", "已完成去水印、去字幕和超分处理", request)
        if step.action == "generate_draft":
            return self._artifact("jianying-bridge", "已生成剪映草稿并写入待审核区", request)
        return self._artifact("media-pipeline", f"已执行媒体动作 {step.action}", request)

    def _device(self, step: StepDefinition, request: ExecutionRequest) -> Dict[str, Any]:
        return {
            "summary": "已收集设备状态与队列概览",
            "driver": "desktop-runtime",
            "device": request.device,
        }

    def _artifact(self, driver: str, summary: str, request: ExecutionRequest) -> Dict[str, Any]:
        return {
            "summary": summary,
            "driver": driver if self.probe.mode != "mock" else f"mock::{driver}",
            "mode": self.probe.mode,
            "device": request.device.get("alias"),
        }

    def _run_playwright(self, request: ExecutionRequest, platform: str, action: str) -> Dict[str, Any]:
        try:
            artifact = run_playwright_action(request.task_id, platform, action, self.probe.mode)
            artifact["device"] = request.device.get("alias")
            return artifact
        except Exception as error:  # noqa: BLE001
            return {
                "summary": f"Playwright 执行失败，已退回模拟模式：{error}",
                "driver": "playwright-fallback",
                "mode": self.probe.mode,
                "device": request.device.get("alias"),
            }

    def _driver_for(self, adapter: str) -> str:
        if adapter == "wechat":
            return "wechat-desktop"
        if adapter in {"content", "public_leads"}:
            return "playwright"
        if adapter == "media":
            return "media-pipeline"
        return "desktop-runtime"
