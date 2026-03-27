from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from urllib import error as urllib_error
from urllib import request as urllib_request

from .models import EngineMode, ExecutionRequest, StepDefinition

WECHAT_BUNDLE_ID = "com.tencent.xinWeChat"
WECHAT_APP_NAME_CANDIDATES = ("WeChat", "微信", "Weixin")
WECHAT_APP_FILE_CANDIDATES = ("WeChat.app", "微信.app", "Weixin.app")
RUNTIME_ROOT = Path(__file__).resolve().parents[1] / ".runtime"
WECHAT_SEARCH_POPUP_SETTLE_SECONDS = 0.8
WECHAT_RESULT_OPEN_SETTLE_SECONDS = 1.6
TIMESTAMP_PATTERN = re.compile(
    r"^(昨天|前天|星期[一二三四五六日天]|周[一二三四五六日天]|今天|刚刚|\d{1,2}:\d{2}|上午\s*\d{1,2}:\d{2}|下午\s*\d{1,2}:\d{2}|\d{4}[/-]\d{1,2}[/-]\d{1,2})$"
)
NOISE_TEXTS = {
    "微信",
    "WeChat",
    "聊天",
    "通讯录",
    "发现",
    "我",
    "搜索",
    "搜索网络结果",
    "公众号",
    "小程序",
    "服务号",
    "订阅号",
    "按 Enter 发送",
    "按enter发送",
    "按Enter发送",
    "查看更多消息",
}


@dataclass(frozen=True)
class RecipientTarget:
    name: str
    kind: str = "auto"


@dataclass(frozen=True)
class ConversationTextNode:
    text: str
    x: int | None = None
    y: int | None = None
    kind: str = "text"


@dataclass
class ConversationSnapshot:
    source_name: str
    source_type: str
    message_content: str
    conversation_messages: List[Dict[str, str]] = field(default_factory=list)
    extracted: bool = False
    title: str | None = None
    text_node_count: int = 0
    raw_preview: List[str] = field(default_factory=list)


@dataclass
class MacWechatProbe:
    available: bool
    detail: str
    reason: str = "unsupported"
    app_path: str | None = None
    osascript_path: str | None = None
    app_name: str | None = None
    process_name: str | None = None


@dataclass
class AccessibilityProbe:
    error: str | None
    process_name: str | None = None


def is_macos_platform() -> bool:
    return sys.platform == "darwin"


def detect_mac_wechat() -> MacWechatProbe:
    if not is_macos_platform():
        return MacWechatProbe(available=False, detail="当前不是 macOS 环境", reason="unsupported")

    osascript_path = shutil.which("osascript")
    if not osascript_path:
        return MacWechatProbe(
            available=False,
            detail="系统未提供 osascript，无法驱动 mac 微信",
            reason="osascript-missing",
        )

    app_path = _find_wechat_app()
    if not app_path:
        return MacWechatProbe(
            available=False,
            detail="未检测到 WeChat.app / 微信.app，请先安装并手动登录 mac 微信",
            reason="app-missing",
            osascript_path=osascript_path,
        )

    app_name = Path(app_path).stem
    activate_error = _activate_wechat_app(app_path)
    if activate_error:
        return MacWechatProbe(
            available=False,
            detail=activate_error,
            reason="launch-failed",
            app_path=app_path,
            osascript_path=osascript_path,
            app_name=app_name,
        )
    access_probe = _probe_accessibility_permission(osascript_path)
    if access_probe.error:
        reason = "permission-missing"
        detail = access_probe.error
        if "未检测到微信进程" in detail or "未启动或未登录" in detail:
            reason = "process-missing"
        elif "微信主窗口未就绪" in detail:
            reason = "session-missing"
        elif "未检测到 WeChat.app / 微信.app" in detail:
            reason = "process-missing"
            detail = "已检测到 mac 微信客户端，但当前未启动或未登录，请先打开并登录微信。"

        return MacWechatProbe(
            available=False,
            detail=detail,
            reason=reason,
            app_path=app_path,
            osascript_path=osascript_path,
            app_name=app_name,
            process_name=access_probe.process_name,
        )

    return MacWechatProbe(
        available=True,
        detail=f"已检测到 mac 微信客户端：{app_path}",
        reason="ready",
        app_path=app_path,
        osascript_path=osascript_path,
        app_name=app_name,
        process_name=access_probe.process_name or app_name,
    )


def _find_wechat_app() -> str | None:
    candidates = []
    for app_name in WECHAT_APP_FILE_CANDIDATES:
        candidates.extend(
            [
                Path("/Applications") / app_name,
                Path.home() / "Applications" / app_name,
            ]
        )
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)

    mdfind_path = shutil.which("mdfind")
    if not mdfind_path:
        return None

    try:
        result = subprocess.run(
            [mdfind_path, f"kMDItemCFBundleIdentifier == '{WECHAT_BUNDLE_ID}'"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except Exception:  # noqa: BLE001
        return None

    first = next((line.strip() for line in result.stdout.splitlines() if line.strip()), None)
    return first


def _probe_accessibility_permission(osascript_path: str) -> AccessibilityProbe:
    for process_name in WECHAT_APP_NAME_CANDIDATES:
        result = _run_osascript(
            osascript_path,
            [
                'tell application "System Events"',
                f'  if exists process "{process_name}" then',
                f'    tell process "{process_name}"',
                '      return (count of windows) as string',
                '    end tell',
                '  end if',
                'end tell',
                'return "missing"',
            ],
            description=f"探测微信进程 {process_name}",
            timeout=5,
        )

        if result["ok"]:
            output = str(result["output"]).strip()
            if output and output != "missing":
                if output == "0":
                    return AccessibilityProbe(
                        error="微信主窗口未就绪，请先登录并保持窗口可见",
                        process_name=process_name,
                    )
                return AccessibilityProbe(error=None, process_name=process_name)

        normalized = _normalize_osascript_error(str(result["output"]).strip())
        if normalized and "未授予" in normalized:
            return AccessibilityProbe(error=normalized, process_name=process_name)

    return AccessibilityProbe(error="未检测到微信进程，请先启动并登录 mac 微信。")


class MacWechatAutomation:
    def __init__(self, probe: MacWechatProbe, engine_mode: EngineMode):
        self.probe = probe
        self.engine_mode = engine_mode

    def execute(self, step: StepDefinition, request: ExecutionRequest) -> Dict[str, Any]:
        if step.action == "ensure_session":
            return self.ensure_session(request)
        if step.action == "segment_contacts":
            return self.segment_contacts(request)
        if step.action == "send_broadcast":
            return self.send_messages(request, "broadcast")
        if step.action == "push_sop":
            return self.send_messages(request, "push_sop")
        if step.action == "reactivate":
            return self.send_messages(request, "reactivate")
        if step.action == "enable_guard":
            return self.enable_guard(request)
        if step.action == "publish_moments":
            return self.publish_moments(request)
        if step.action == "apply_tags":
            return self.apply_tags(request)
        raise RuntimeError(f"mac 微信尚未支持动作 {step.action}")

    def ensure_session(self, request: ExecutionRequest) -> Dict[str, Any]:
        self._ensure_available()
        self._activate_app()
        self._ensure_window_visible()
        self._run_script(
            [
                'tell application "System Events"',
                f'  if not (exists process "{self._process_name()}") then error "未检测到微信进程"',
                f'  tell process "{self._process_name()}"',
                "    set frontmost to true",
                '    if (count of windows) is 0 then error "微信主窗口未就绪，请先登录并保持窗口可见"',
                "  end tell",
                "end tell",
                'return "ok"',
            ],
            description="校验 mac 微信登录态",
            timeout=20,
        )
        return {
            "summary": "已激活 mac 微信并校验主窗口可用",
            "driver": "mac-wechat-ui",
            "mode": self.engine_mode,
            "device": request.device.get("alias"),
            "appPath": self.probe.app_path,
            "processName": self._process_name(),
        }

    def segment_contacts(self, request: ExecutionRequest) -> Dict[str, Any]:
        contacts = [target.name for target in _resolve_recipient_targets(request.payload)]
        tags = _resolve_tags(request.payload)
        if contacts:
            return {
                "summary": f"已解析 {len(contacts)} 个微信接收方，准备在 mac 微信逐个搜索执行",
                "driver": "mac-wechat-ui",
                "mode": self.engine_mode,
                "device": request.device.get("alias"),
                "processName": self._process_name(),
                "contacts": contacts,
                "tags": tags,
            }

        if tags:
            return {
                "summary": "已记录标签条件，但 mac 微信桌面端暂不支持按标签直接检索；请在 payload 里补充 contacts。",
                "driver": "mac-wechat-ui",
                "mode": self.engine_mode,
                "device": request.device.get("alias"),
                "processName": self._process_name(),
                "tags": tags,
            }

        return {
            "summary": "未提供 contacts，后续发送步骤会要求显式联系人列表。",
            "driver": "mac-wechat-ui",
            "mode": self.engine_mode,
            "device": request.device.get("alias"),
            "processName": self._process_name(),
        }

    def send_messages(self, request: ExecutionRequest, action: str) -> Dict[str, Any]:
        self._ensure_available()
        recipient_targets = _resolve_recipient_targets(request.payload)
        contacts = [target.name for target in recipient_targets]
        if not recipient_targets:
            raise RuntimeError("mac 微信发送任务需要在 payload 中提供 contacts / groups / recipients / targetContacts / targetGroups 列表。")

        messages = _resolve_messages(request.payload, action)
        if not messages:
            raise RuntimeError("mac 微信发送任务需要在 payload 中提供 content 或 messages。")

        self.ensure_session(request)

        dry_run = bool(request.payload.get("dryRun"))
        if dry_run:
            return {
                "summary": f"已生成 mac 微信发送计划：{len(contacts)} 个联系人，{len(messages)} 条消息（dryRun 未实际发送）",
                "driver": "mac-wechat-ui",
                "mode": self.engine_mode,
                "device": request.device.get("alias"),
                "appPath": self.probe.app_path,
                "processName": self._process_name(),
                "contacts": contacts,
                "messages": messages,
                "dryRun": True,
            }

        for target in recipient_targets:
            self._open_contact(target)
            for message in messages:
                self._send_message(message)

        return {
            "summary": f"已通过 mac 微信完成 {len(contacts)} 个联系人、共 {len(contacts) * len(messages)} 条消息发送",
            "driver": "mac-wechat-ui",
            "mode": self.engine_mode,
            "device": request.device.get("alias"),
            "appPath": self.probe.app_path,
            "processName": self._process_name(),
            "contacts": contacts,
            "messageCount": len(messages),
            "dryRun": False,
        }

    def enable_guard(self, request: ExecutionRequest) -> Dict[str, Any]:
        self._ensure_available()
        config = self._build_guard_config(request.payload)
        guard_path = _runtime_file("guard", "auto_reply_guard.json")
        guard_run_path = _runtime_file("guard", "auto_reply_guard_run.json")
        _write_json(guard_path, config)

        if not config["enabled"]:
            return {
                "summary": "自动回复守护已关闭，仅保留当前配置。",
                "driver": "mac-wechat-guard",
                "mode": self.engine_mode,
                "device": request.device.get("alias"),
                "guardConfigPath": str(guard_path),
                "dryRun": bool(config["dryRun"]),
                "enabled": False,
            }

        fallback_reply = config["fallbackReply"]
        max_unread_sessions = int(config["maxUnreadSessions"])
        dry_run = bool(config["dryRun"])
        bootstrap_only = bool(request.payload.get("bootstrapOnly"))
        unread_available = self._menu_item_enabled("显示", "显示下一个未读会话")
        model_enabled = bool(config["localBridgeUrl"] or config["serverUrl"])
        read_mode = str(config.get("readMode") or "computer_use")

        if bootstrap_only and not dry_run:
            baseline_seeded = False
            baseline_reason = None
            baseline_source_name = None
            baseline_message_content = None
            if read_mode == "computer_use" and config.get("targetName"):
                try:
                    from .computer_use import (
                        MacOSWeChatComputerUsePlatform,
                        _build_conversation_signature,
                        _has_pending_user_message,
                        _load_guard_reply_state,
                        _matches_target_name,
                        _persist_guard_reply_state,
                        _remember_guard_baseline,
                    )

                    platform = MacOSWeChatComputerUsePlatform(self)
                    baseline_conversation = platform.read_current_conversation(
                        config=config,
                        request=request,
                    )
                    if not _matches_target_name(
                        baseline_conversation.source_name,
                        str(config.get("targetName") or ""),
                    ):
                        platform.focus_target(
                            str(config.get("targetName") or ""),
                            str(config.get("targetKind") or "contact"),
                        )
                        baseline_conversation = platform.read_current_conversation(
                            config=config,
                            request=request,
                        )

                    baseline_source_name = baseline_conversation.source_name
                    baseline_message_content = baseline_conversation.latest_user_message
                    if (
                        baseline_conversation.read_status == "read"
                        and _matches_target_name(
                            baseline_conversation.source_name,
                            str(config.get("targetName") or ""),
                        )
                        and _has_pending_user_message(baseline_conversation)
                    ):
                        baseline_state = _load_guard_reply_state()
                        _remember_guard_baseline(
                            baseline_state,
                            _build_conversation_signature(baseline_conversation),
                            conversation=baseline_conversation,
                        )
                        _persist_guard_reply_state(
                            baseline_state,
                            int(config.get("duplicateCooldownSeconds") or 600),
                        )
                        baseline_seeded = True
                    else:
                        baseline_reason = "启动时未发现需要冻结的待回复消息。"
                except Exception as error:  # noqa: BLE001
                    baseline_reason = str(error)
            return {
                "summary": (
                    f"已保存自动回复守护配置，目标会话：{config.get('targetName') or '未指定'}，"
                    f"后台将按 {int(config['pollIntervalSeconds'])} 秒间隔持续轮询。"
                ),
                "driver": "mac-wechat-guard",
                "mode": self.engine_mode,
                "device": request.device.get("alias"),
                "guardConfigPath": str(guard_path),
                "fallbackReply": fallback_reply,
                "maxUnreadSessions": max_unread_sessions,
                "unreadAvailable": unread_available,
                "modelEnabled": model_enabled,
                "readMode": read_mode,
                "dryRun": False,
                "enabled": True,
                "bootstrapOnly": True,
                "baselineSeeded": baseline_seeded,
                "baselineReason": baseline_reason,
                "baselineSourceName": baseline_source_name,
                "baselineMessageContent": baseline_message_content,
            }

        if dry_run:
            return {
                "summary": (
                    f"已更新自动回复守护配置，当前未读会话入口{'可用' if unread_available else '不可用'}，"
                    f"{'已配置模型桥接' if model_enabled else '未配置模型桥接'}，"
                    f"当前读消息模式：{read_mode}，dryRun 未实际回复。"
                ),
                "driver": "mac-wechat-guard",
                "mode": self.engine_mode,
                "device": request.device.get("alias"),
                "guardConfigPath": str(guard_path),
                "fallbackReply": fallback_reply,
                "maxUnreadSessions": max_unread_sessions,
                "unreadAvailable": unread_available,
                "modelEnabled": model_enabled,
                "readMode": read_mode,
                "dryRun": True,
            }

        processed = 0
        model_reply_count = 0
        keyword_reply_count = 0
        welcome_reply_count = 0
        fallback_reply_count = 0
        skipped_reply_count = 0
        skipped_duplicate_count = 0
        sessions: List[Dict[str, Any]] = []

        if read_mode == "computer_use":
            from .computer_use import (
                MacOSWeChatComputerUsePlatform,
                WechatComputerUseAgent,
            )

            platform = MacOSWeChatComputerUsePlatform(self)
            agent = WechatComputerUseAgent(
                platform,
                lambda conversation: self._plan_guard_reply_from_computer_use(
                    conversation,
                    config,
                    request,
                ),
            )
            guard_result = agent.run_guard(config=config, request=request)
            processed = int(guard_result.get("processedSessions") or 0)
            model_reply_count = int(guard_result.get("modelReplyCount") or 0)
            keyword_reply_count = int(guard_result.get("keywordReplyCount") or 0)
            welcome_reply_count = int(guard_result.get("welcomeReplyCount") or 0)
            fallback_reply_count = int(guard_result.get("fallbackReplyCount") or 0)
            skipped_reply_count = int(guard_result.get("skippedReplyCount") or 0)
            skipped_duplicate_count = int(guard_result.get("skippedDuplicateCount") or 0)
            sessions = list(guard_result.get("sessions") or [])
        else:
            while processed < max_unread_sessions and self._menu_item_enabled("显示", "显示下一个未读会话"):
                self._click_menu_item("显示", "显示下一个未读会话")
                self._pause(0.8)

                snapshot = self._capture_conversation_snapshot()
                reply_plan = self._plan_guard_reply(snapshot, config, request)
                strategy = str(reply_plan.get("strategy") or "fallback")
                reply_content = str(reply_plan.get("replyContent") or "").strip()

                if reply_plan.get("skipReply") or not reply_content:
                    skipped_reply_count += 1
                    sessions.append(
                        {
                            "sourceName": snapshot.source_name,
                            "sourceType": snapshot.source_type,
                            "messageContent": snapshot.message_content,
                            "conversationMessages": snapshot.conversation_messages,
                            "title": snapshot.title,
                            "textNodeCount": snapshot.text_node_count,
                            "extracted": snapshot.extracted,
                            "rawPreview": snapshot.raw_preview,
                            "replyStrategy": strategy,
                            "replyContent": None,
                            "autoReplyModel": reply_plan.get("autoReplyModel"),
                            "provider": reply_plan.get("provider"),
                            "knowledgeMatched": reply_plan.get("knowledgeMatched"),
                            "recordId": reply_plan.get("recordId"),
                            "reason": reply_plan.get("reason"),
                            "processedAt": datetime.now().isoformat(),
                        }
                    )
                    self._pause(0.25)
                    continue

                self._send_message(reply_content)
                processed += 1
                if strategy == "model":
                    model_reply_count += 1
                elif strategy == "keyword":
                    keyword_reply_count += 1
                else:
                    fallback_reply_count += 1

                sessions.append(
                    {
                        "sourceName": snapshot.source_name,
                        "sourceType": snapshot.source_type,
                        "messageContent": snapshot.message_content,
                        "conversationMessages": snapshot.conversation_messages,
                        "title": snapshot.title,
                        "textNodeCount": snapshot.text_node_count,
                        "extracted": snapshot.extracted,
                        "rawPreview": snapshot.raw_preview,
                        "replyStrategy": strategy,
                        "replyContent": reply_content,
                        "autoReplyModel": reply_plan.get("autoReplyModel"),
                        "provider": reply_plan.get("provider"),
                        "knowledgeMatched": reply_plan.get("knowledgeMatched"),
                        "recordId": reply_plan.get("recordId"),
                        "reason": reply_plan.get("reason"),
                        "processedAt": datetime.now().isoformat(),
                    }
                )
                self._pause(0.25)

        _write_json(
            guard_run_path,
            {
                "updatedAt": datetime.now().isoformat(),
                "processedSessions": processed,
                "modelReplyCount": model_reply_count,
                "keywordReplyCount": keyword_reply_count,
                "welcomeReplyCount": welcome_reply_count,
                "fallbackReplyCount": fallback_reply_count,
                "skippedReplyCount": skipped_reply_count,
                "skippedDuplicateCount": skipped_duplicate_count,
                "readMode": read_mode,
                "sessions": sessions,
            },
        )

        return {
            "summary": (
                f"自动回复守护已处理 {processed} 个未读会话，其中模型回复 {model_reply_count} 个、"
                f"关键词回复 {keyword_reply_count} 个、欢迎语回复 {welcome_reply_count} 个、兜底回复 {fallback_reply_count} 个、"
                f"跳过 {skipped_reply_count} 个。"
            ),
            "driver": "mac-wechat-guard",
            "mode": self.engine_mode,
            "device": request.device.get("alias"),
            "guardConfigPath": str(guard_path),
            "guardRunPath": str(guard_run_path),
            "fallbackReply": fallback_reply,
            "processedSessions": processed,
            "dryRun": False,
            "keywordAware": bool(config["keywordReplies"]),
            "modelEnabled": model_enabled,
            "readMode": read_mode,
            "modelReplyCount": model_reply_count,
            "keywordReplyCount": keyword_reply_count,
            "welcomeReplyCount": welcome_reply_count,
            "fallbackReplyCount": fallback_reply_count,
            "skippedReplyCount": skipped_reply_count,
            "skippedDuplicateCount": skipped_duplicate_count,
            "sessions": sessions[:5],
        }

    def publish_moments(self, request: ExecutionRequest) -> Dict[str, Any]:
        self._ensure_available()
        payload = request.payload
        draft = {
            "taskId": request.task_id,
            "createdAt": datetime.now().isoformat(),
            "copy": str(payload.get("copy") or payload.get("content") or ""),
            "images": [str(item) for item in payload.get("images", [])] if isinstance(payload.get("images"), list) else [],
            "schedule": payload.get("schedule"),
            "dryRun": bool(payload.get("dryRun", True)),
        }
        draft_path = _runtime_file("moments", f"{request.task_id}-draft.json")
        _write_json(draft_path, draft)

        self._activate_app()
        switched = self._try_switch_workspace("朋友圈")
        if draft["copy"]:
            self._set_clipboard_text(draft["copy"])

        summary = (
            "已切换到朋友圈并将文案写入剪贴板，请人工确认后发布。"
            if switched
            else "已生成朋友圈草稿并写入剪贴板，但未能稳定切到朋友圈视图，请手动打开朋友圈继续发布。"
        )

        return {
            "summary": summary,
            "driver": "mac-wechat-moments",
            "mode": self.engine_mode,
            "device": request.device.get("alias"),
            "draftPath": str(draft_path),
            "clipboardPrepared": bool(draft["copy"]),
            "workspaceSwitched": switched,
            "manualRequired": True,
            "dryRun": bool(draft["dryRun"]),
        }

    def apply_tags(self, request: ExecutionRequest) -> Dict[str, Any]:
        self._ensure_available()
        contacts = _resolve_contacts(request.payload)
        tags = _resolve_tags(request.payload)
        dry_run = bool(request.payload.get("dryRun", True))

        if not contacts:
            raise RuntimeError("标签管理需要在 payload 中提供 contacts / recipients / targetContacts 列表。")
        if not tags:
            raise RuntimeError("标签管理需要在 payload 中提供 addTags / targetTags / customerTags。")

        ledger_path = _runtime_file("contacts", "tag-ledger.json")
        ledger = _read_json(ledger_path, {})
        contact_records = ledger.get("contacts", {})

        for contact in contacts:
            existing_tags = contact_records.get(contact, {}).get("tags", [])
            merged_tags = sorted({*(str(item) for item in existing_tags), *tags})
            contact_records[contact] = {
                "tags": merged_tags,
                "updatedAt": datetime.now().isoformat(),
            }

        ledger["contacts"] = contact_records
        ledger["updatedAt"] = datetime.now().isoformat()
        _write_json(ledger_path, ledger)

        focused_contacts: List[str] = []
        if not dry_run:
            for contact in contacts[:3]:
                try:
                    self._open_contact(RecipientTarget(name=contact, kind="contact"))
                    focused_contacts.append(contact)
                except Exception:  # noqa: BLE001
                    break

        summary = (
            f"已更新 {len(contacts)} 个联系人的本地标签台账，并定位 {len(focused_contacts)} 个联系人供人工确认。"
            if focused_contacts
            else f"已更新 {len(contacts)} 个联系人的本地标签台账。"
        )

        return {
            "summary": summary,
            "driver": "mac-wechat-tags",
            "mode": self.engine_mode,
            "device": request.device.get("alias"),
            "ledgerPath": str(ledger_path),
            "contacts": contacts,
            "tags": tags,
            "focusedContacts": focused_contacts,
            "manualRequired": True,
            "dryRun": dry_run,
        }

    def _open_contact(self, target: RecipientTarget) -> None:
        self._activate_app()
        self._focus_chat_workspace()
        script = [
            f'tell application "{self._app_name()}" to activate',
            "delay 0.2",
            f'set the clipboard to {_applescript_string(target.name)}',
            'tell application "System Events"',
            f'  if not (exists process "{self._process_name()}") then error "未检测到微信进程"',
            f'  tell process "{self._process_name()}"',
            "    set frontmost to true",
            '    keystroke "f" using {command down}',
            "    delay 0.3",
            '    keystroke "a" using {command down}',
            "    delay 0.1",
            '    keystroke "v" using {command down}',
            "  end tell",
            "end tell",
            'return "ok"',
        ]
        self._run_script(script, description=f"搜索联系人 {target.name}", timeout=15)
        self._pause(WECHAT_SEARCH_POPUP_SETTLE_SECONDS)
        self._submit_search_result()

    def _send_message(self, message: str) -> None:
        self._focus_message_input()
        script = [
            f'tell application "{self._app_name()}" to activate',
            "delay 0.15",
            f'set the clipboard to {_applescript_string(message)}',
            'tell application "System Events"',
            f'  if not (exists process "{self._process_name()}") then error "未检测到微信进程"',
            f'  tell process "{self._process_name()}"',
            "    set frontmost to true",
            '    keystroke "v" using {command down}',
            "    delay 0.15",
            "    key code 36",
            "    delay 0.45",
            "  end tell",
            "end tell",
            'return "ok"',
        ]
        self._run_script(script, description="发送微信消息", timeout=10)

    def _focus_message_input(self) -> None:
        window_rect = self._window_rect()
        if not window_rect:
            return

        left, top, width, height = window_rect
        input_x = left + int(width * 0.72)
        input_y = top + int(height * 0.93)
        self._run_script(
            [
                f'tell application "{self._app_name()}" to activate',
                "delay 0.12",
                'tell application "System Events"',
                f'  tell process "{self._process_name()}"',
                "    set frontmost to true",
                f"    click at {{{input_x}, {input_y}}}",
                "  end tell",
                "end tell",
                'return "ok"',
            ],
            description="聚焦微信消息输入框",
            timeout=8,
        )
        self._pause(0.12)

    def _ensure_available(self) -> None:
        if self.probe.available:
            return
        raise RuntimeError(self.probe.detail)

    def _activate_app(self) -> None:
        target = self.probe.app_path or WECHAT_APP_NAME_CANDIDATES[0]
        error = _activate_wechat_app(target)
        if error:
            raise RuntimeError(error)
        self._pause(0.35)

    def _ensure_window_visible(self) -> None:
        try:
            window_count = self._visible_window_count()
        except Exception:  # noqa: BLE001
            return

        if window_count > 0:
            return

        self._run_script(
            [
                f'tell application "{self._app_name()}" to activate',
                "delay 0.2",
                'tell application "System Events"',
                f'  tell process "{self._process_name()}"',
                "    set frontmost to true",
                '    keystroke "1" using {command down}',
                "  end tell",
                "end tell",
                'return "ok"',
            ],
            description="唤起微信聊天主窗口",
            timeout=8,
        )
        self._pause(0.5)

    def _app_name(self) -> str:
        return self.probe.app_name or WECHAT_APP_NAME_CANDIDATES[0]

    def _process_name(self) -> str:
        return self.probe.process_name or self.probe.app_name or WECHAT_APP_NAME_CANDIDATES[0]

    def _pause(self, seconds: float) -> None:
        time.sleep(seconds)

    def _set_clipboard_text(self, text: str) -> None:
        self._run_script(
            [f"set the clipboard to {_applescript_string(text)}", 'return "ok"'],
            description="写入剪贴板",
            timeout=5,
        )

    def _click_menu_item(self, menu_name: str, item_name: str) -> None:
        self._activate_app()
        self._run_script(
            [
                f'tell application "{self._app_name()}" to activate',
                "delay 0.15",
                'tell application "System Events"',
                f'  tell process "{self._process_name()}"',
                f'    click menu item "{item_name}" of menu 1 of menu bar item "{menu_name}" of menu bar 1',
                '  end tell',
                'end tell',
                'return "ok"',
            ],
            description=f"点击菜单 {menu_name} -> {item_name}",
            timeout=8,
        )

    def _menu_item_enabled(self, menu_name: str, item_name: str) -> bool:
        self._activate_app()
        output = self._run_script(
            [
                f'tell application "{self._app_name()}" to activate',
                "delay 0.15",
                'tell application "System Events"',
                f'  tell process "{self._process_name()}"',
                f'    return enabled of menu item "{item_name}" of menu 1 of menu bar item "{menu_name}" of menu bar 1',
                '  end tell',
                'end tell',
            ],
            description=f"读取菜单状态 {menu_name} -> {item_name}",
            timeout=5,
        )
        return output.strip().lower() == "true"

    def _visible_window_count(self) -> int:
        self._activate_app()
        output = self._run_script(
            [
                f'tell application "{self._app_name()}" to activate',
                "delay 0.15",
                'tell application "System Events"',
                f'  tell process "{self._process_name()}"',
                '    return (count of windows) as text',
                '  end tell',
                'end tell',
            ],
            description="读取微信窗口数量",
            timeout=5,
        )
        try:
            return int(output.strip())
        except Exception:  # noqa: BLE001
            return 0

    def _try_switch_workspace(self, workspace_name: str) -> bool:
        try:
            self._click_menu_item("窗口", workspace_name)
            self._pause(0.4)
            return True
        except Exception:  # noqa: BLE001
            return False

    def _focus_chat_workspace(self) -> None:
        self._ensure_window_visible()
        try:
            self._click_menu_item("窗口", "聊天")
            self._pause(0.35)
        except Exception:  # noqa: BLE001
            try:
                self._run_script(
                    [
                        f'tell application "{self._app_name()}" to activate',
                        "delay 0.15",
                        'tell application "System Events"',
                        f'  tell process "{self._process_name()}"',
                        "    set frontmost to true",
                        '    keystroke "1" using {command down}',
                        '  end tell',
                        'end tell',
                        'return "ok"',
                    ],
                    description="切到微信聊天视图",
                    timeout=6,
                )
                self._pause(0.35)
            except Exception:  # noqa: BLE001
                # Older WeChat builds may not expose the menu item consistently.
                pass

    def _submit_search_result(self) -> None:
        self._run_script(
            [
                f'tell application "{self._app_name()}" to activate',
                "delay 0.15",
                'tell application "System Events"',
                f'  tell process "{self._process_name()}"',
                "    set frontmost to true",
                "    key code 36",
                "  end tell",
                "end tell",
                'return "ok"',
            ],
            description="确认微信搜索结果",
            timeout=8,
        )
        self._pause(WECHAT_RESULT_OPEN_SETTLE_SECONDS)

    def _window_rect(self) -> tuple[int, int, int, int] | None:
        self._ensure_window_visible()
        output = self._run_script(
            [
                f'tell application "{self._app_name()}" to activate',
                "delay 0.15",
                'tell application "System Events"',
                f'  tell process "{self._process_name()}"',
                '    set p to position of window 1',
                '    set s to size of window 1',
                '    return (item 1 of p as text) & "," & (item 2 of p as text) & "," & (item 1 of s as text) & "," & (item 2 of s as text)',
                '  end tell',
                'end tell',
            ],
            description="读取微信窗口位置",
            timeout=6,
        )
        cleaned = output.replace(" ", "").strip()
        try:
            left, top, width, height = [int(item) for item in cleaned.split(",")]
        except Exception:  # noqa: BLE001
            return None
        return left, top, width, height

    def _build_guard_config(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        welcome = str(payload.get("welcome") or "你好，我是小云，我先帮你接住消息。")
        fallback_reply = str(
            payload.get("fallbackReply")
            or payload.get("fallback")
            or welcome
        )
        keyword_replies = payload.get("keywordReplies")
        if not isinstance(keyword_replies, dict):
            keyword_replies = {}
        target_name = str(payload.get("targetName") or payload.get("sourceName") or "").strip()
        target_kind = str(payload.get("targetKind") or "").strip().lower()
        if not target_name:
            recipient_targets = _resolve_recipient_targets(payload)
            if len(recipient_targets) == 1:
                target_name = recipient_targets[0].name
                target_kind = recipient_targets[0].kind
        if target_kind not in {"contact", "group"}:
            target_kind = "contact"
        local_bridge_url = str(
            payload.get("localBridgeUrl")
            or payload.get("bridgeUrl")
            or os.environ.get("MYCLAW_LOCAL_BRIDGE_URL")
            or ""
        ).strip()
        server_url = str(
            payload.get("serverUrl")
            or os.environ.get("MYCLAW_SERVER_URL")
            or ""
        ).strip()

        return {
            "enabled": bool(payload.get("enabled", True)),
            "strategy": str(payload.get("strategy") or "兜底自动回复"),
            "readMode": str(payload.get("readMode") or "computer_use"),
            "welcome": welcome,
            "fallbackReply": fallback_reply,
            "keywordReplies": keyword_replies,
            "targetName": target_name,
            "targetKind": target_kind,
            "maxUnreadSessions": int(payload.get("maxUnreadSessions") or 3),
            "pollIntervalSeconds": int(payload.get("pollIntervalSeconds") or 3),
            "duplicateCooldownSeconds": int(payload.get("duplicateCooldownSeconds") or 600),
            "localBridgeUrl": local_bridge_url,
            "serverUrl": server_url,
            "dryRun": bool(payload.get("dryRun", True)),
            "updatedAt": datetime.now().isoformat(),
        }

    def _capture_conversation_snapshot(self) -> ConversationSnapshot:
        nodes = self._read_conversation_text_nodes()
        window_rect = self._window_rect()
        source_name = self._extract_conversation_title(nodes, window_rect) or "当前会话"
        source_type = _infer_source_type(source_name)
        conversation_messages = self._extract_conversation_messages(nodes, window_rect, source_name)
        latest_user_message = next(
            (
                item["content"]
                for item in reversed(conversation_messages)
                if item.get("role") == "user" and item.get("content")
            ),
            "",
        )
        raw_preview = [node.text for node in nodes[:18]]

        return ConversationSnapshot(
            source_name=source_name,
            source_type=source_type,
            message_content=latest_user_message,
            conversation_messages=conversation_messages[-12:],
            extracted=bool(latest_user_message),
            title=source_name,
            text_node_count=len(nodes),
            raw_preview=raw_preview,
        )

    def _plan_guard_reply(
        self,
        snapshot: ConversationSnapshot,
        config: Dict[str, Any],
        request: ExecutionRequest,
    ) -> Dict[str, Any]:
        keyword_reply = self._match_keyword_reply(snapshot.message_content, config.get("keywordReplies", {}))
        if keyword_reply:
            return {
                "strategy": "keyword",
                "replyContent": keyword_reply,
                "reason": None,
                "autoReplyModel": None,
                "provider": None,
                "knowledgeMatched": False,
                "recordId": None,
            }

        if snapshot.message_content and (config.get("localBridgeUrl") or config.get("serverUrl")):
            try:
                response = self._request_guard_model_reply(snapshot, config, request)
                reply_content = str(response.get("replyContent") or "").strip()
                if response.get("status") == "answered" and reply_content:
                    return {
                        "strategy": "model",
                        "replyContent": reply_content,
                        "reason": response.get("reason"),
                        "autoReplyModel": response.get("autoReplyModel"),
                        "provider": response.get("provider"),
                        "knowledgeMatched": response.get("knowledgeMatched", False),
                        "recordId": response.get("recordId"),
                    }
                return {
                    "strategy": "fallback",
                    "replyContent": config["fallbackReply"],
                    "reason": response.get("reason") or f"模型返回状态 {response.get('status')}",
                    "autoReplyModel": response.get("autoReplyModel"),
                    "provider": response.get("provider"),
                    "knowledgeMatched": response.get("knowledgeMatched", False),
                    "recordId": response.get("recordId"),
                }
            except Exception as error:  # noqa: BLE001
                return {
                    "strategy": "fallback",
                    "replyContent": config["fallbackReply"],
                    "reason": str(error),
                    "autoReplyModel": None,
                    "provider": None,
                    "knowledgeMatched": False,
                    "recordId": None,
                }

        if not snapshot.message_content:
            return {
                "strategy": "skip",
                "skipReply": True,
                "replyContent": "",
                "reason": "未提取到可用消息内容，本轮不发送自动回复。",
                "autoReplyModel": None,
                "provider": None,
                "knowledgeMatched": False,
                "recordId": None,
            }

        missing_reason = "未配置模型桥接地址，已回退到兜底回复。"
        if not (config.get("localBridgeUrl") or config.get("serverUrl")):
            return {
                "strategy": "fallback",
                "replyContent": config["fallbackReply"],
                "reason": missing_reason,
                "autoReplyModel": None,
                "provider": None,
                "knowledgeMatched": False,
                "recordId": None,
            }

        return {
            "strategy": "skip",
            "skipReply": True,
            "replyContent": "",
            "reason": missing_reason,
            "autoReplyModel": None,
            "provider": None,
            "knowledgeMatched": False,
            "recordId": None,
        }

    def _plan_guard_reply_from_computer_use(
        self,
        conversation: Any,
        config: Dict[str, Any],
        request: ExecutionRequest,
    ) -> Dict[str, Any]:
        read_status = str(getattr(conversation, "read_status", "") or "failed")
        latest_user_message = str(getattr(conversation, "latest_user_message", "") or "").strip()
        if read_status != "read":
            return {
                "strategy": "skip",
                "skipReply": True,
                "replyContent": "",
                "reason": str(getattr(conversation, "read_reason", "") or "截图读消息失败，本轮跳过自动回复。"),
                "autoReplyModel": None,
                "provider": getattr(conversation, "provider", None),
                "knowledgeMatched": False,
                "recordId": None,
            }
        if not latest_user_message:
            return {
                "strategy": "skip",
                "skipReply": True,
                "replyContent": "",
                "reason": "截图已识别当前会话，但未提取到最新用户消息，本轮跳过自动回复。",
                "autoReplyModel": None,
                "provider": getattr(conversation, "provider", None),
                "knowledgeMatched": False,
                "recordId": None,
            }

        snapshot = ConversationSnapshot(
            source_name=str(getattr(conversation, "source_name", "") or "当前会话"),
            source_type=str(getattr(conversation, "source_type", "") or "user"),
            message_content=latest_user_message,
            conversation_messages=list(getattr(conversation, "conversation_messages", []) or []),
            extracted=bool(latest_user_message),
            title=str(getattr(conversation, "source_name", "") or "当前会话"),
            text_node_count=0,
            raw_preview=[],
        )
        return self._plan_guard_reply(snapshot, config, request)

    def _request_guard_model_reply(
        self,
        snapshot: ConversationSnapshot,
        config: Dict[str, Any],
        request: ExecutionRequest,
    ) -> Dict[str, Any]:
        base_url = str(config.get("localBridgeUrl") or "").strip()
        endpoint = ""
        unwrap_data = False
        if base_url:
            endpoint = base_url.rstrip("/") + "/wechat-auto-reply"
            unwrap_data = True
        else:
            server_url = str(config.get("serverUrl") or "").strip()
            if not server_url:
                raise RuntimeError("未配置 localBridgeUrl / serverUrl，无法调用自动回复模型。")
            endpoint = server_url.rstrip("/") + "/api/internal/wechat-auto-reply"
            unwrap_data = True

        payload: Dict[str, Any] = {
            "sourceType": snapshot.source_type,
            "sourceName": snapshot.source_name,
            "messageContent": snapshot.message_content,
            "messageTime": datetime.now().isoformat(),
            "deviceAlias": request.device.get("alias"),
        }
        if request.device.get("id"):
            payload["deviceId"] = request.device.get("id")
        if snapshot.conversation_messages:
            payload["conversationMessages"] = snapshot.conversation_messages[-12:]

        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib_request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )

        try:
            with urllib_request.urlopen(req, timeout=18) as response:
                raw = response.read().decode("utf-8")
        except urllib_error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"自动回复接口返回 HTTP {error.code}: {detail or error.reason}") from error
        except urllib_error.URLError as error:
            raise RuntimeError(f"自动回复接口不可达：{error.reason}") from error

        try:
            payload_data = json.loads(raw or "{}")
        except json.JSONDecodeError as error:
            raise RuntimeError("自动回复接口返回了无法解析的 JSON。") from error

        if unwrap_data:
            data = payload_data.get("data")
            if not isinstance(data, dict):
                raise RuntimeError(payload_data.get("error") or "自动回复接口未返回 data 字段。")
            return data

        if not isinstance(payload_data, dict):
            raise RuntimeError("自动回复接口返回了非对象数据。")
        return payload_data

    def _read_conversation_text_nodes(self) -> List[ConversationTextNode]:
        output = self._run_script(
            [
                f'tell application "{self._app_name()}" to activate',
                "delay 0.2",
                'tell application "System Events"',
                f'  tell process "{self._process_name()}"',
                '    if (count of windows) is 0 then error "微信主窗口未就绪，请先登录并保持窗口可见"',
                '    set outText to {}',
                '    repeat with elementRef in entire contents of window 1',
                '      try',
                '        set className to (class of elementRef) as text',
                '        if className is "static text" or className is "text field" or className is "text area" then',
                '          set rawText to ""',
                '          try',
                '            set rawText to (value of elementRef) as text',
                '          end try',
                '          if rawText is "" then',
                '            try',
                '              set rawText to (name of elementRef) as text',
                '            end try',
                '          end if',
                '          if rawText is not "" then',
                '            set rawText to my sanitize_text(rawText)',
                '            set posText to ""',
                '            try',
                '              set p to position of elementRef',
                '              set posText to (item 1 of p as text) & "," & (item 2 of p as text)',
                '            end try',
                '            set end of outText to className & "|||" & posText & "|||" & rawText',
                '          end if',
                '        end if',
                '      end try',
                '    end repeat',
                '    set AppleScript\'s text item delimiters to linefeed',
                '    set joinedText to outText as text',
                '    set AppleScript\'s text item delimiters to ""',
                '    return joinedText',
                '  end tell',
                'end tell',
                '',
                'on replace_text(inputText, delimiterValue)',
                '  set AppleScript\'s text item delimiters to delimiterValue',
                '  set textParts to text items of (inputText as text)',
                '  set AppleScript\'s text item delimiters to " "',
                '  set replacedText to textParts as text',
                '  set AppleScript\'s text item delimiters to ""',
                '  return replacedText',
                'end replace_text',
                '',
                'on sanitize_text(inputText)',
                '  set cleaned to inputText as text',
                '  set cleaned to my replace_text(cleaned, return)',
                '  set cleaned to my replace_text(cleaned, linefeed)',
                '  set cleaned to my replace_text(cleaned, tab)',
                '  return cleaned',
                'end sanitize_text',
            ],
            description="读取微信会话文本节点",
            timeout=10,
        )
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        nodes: List[ConversationTextNode] = []
        seen: set[tuple[str, int | None, int | None]] = set()
        for line in lines:
            parts = [part.strip() for part in line.split("|||", 2)]
            if len(parts) != 3:
                continue
            kind, pos_text, text = parts
            text = _normalize_text(text)
            if not text:
                continue
            x: int | None = None
            y: int | None = None
            if pos_text and "," in pos_text:
                raw_x, raw_y = pos_text.split(",", 1)
                try:
                    x = int(float(raw_x.strip()))
                    y = int(float(raw_y.strip()))
                except Exception:  # noqa: BLE001
                    x = None
                    y = None
            dedupe_key = (text, x, y)
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)
            nodes.append(ConversationTextNode(text=text, x=x, y=y, kind=kind))
        return nodes

    def _extract_conversation_title(
        self,
        nodes: List[ConversationTextNode],
        window_rect: tuple[int, int, int, int] | None,
    ) -> str | None:
        if not nodes:
            return None

        candidates = nodes
        if window_rect:
            left, top, width, height = window_rect
            right_start = left + int(width * 0.28)
            top_limit = top + int(height * 0.22)
            candidates = [
                node
                for node in nodes
                if (node.x is None or node.x >= right_start)
                and (node.y is None or node.y <= top_limit)
            ]

        for node in sorted(
            candidates,
            key=lambda item: (item.y if item.y is not None else 10**9, len(item.text) * -1),
        ):
            if _is_plausible_title(node.text):
                return node.text

        for node in nodes:
            if _is_plausible_title(node.text):
                return node.text
        return None

    def _extract_conversation_messages(
        self,
        nodes: List[ConversationTextNode],
        window_rect: tuple[int, int, int, int] | None,
        title: str,
    ) -> List[Dict[str, str]]:
        filtered = nodes
        if window_rect:
            left, top, width, height = window_rect
            right_start = left + int(width * 0.28)
            header_bottom = top + int(height * 0.18)
            input_top = top + int(height * 0.84)
            filtered = [
                node
                for node in nodes
                if (node.x is None or node.x >= right_start)
                and (node.y is None or header_bottom <= node.y <= input_top)
            ]

        messages: List[Dict[str, str]] = []
        seen_texts: List[str] = []
        assistant_threshold = None
        if window_rect:
            left, _, width, _ = window_rect
            assistant_threshold = left + int(width * 0.66)

        for node in sorted(filtered, key=lambda item: ((item.y if item.y is not None else 0), (item.x if item.x is not None else 0))):
            text = _normalize_text(node.text)
            if not text or text == title or _is_noise_text(text):
                continue
            if seen_texts and seen_texts[-1] == text:
                continue

            role = "user"
            if assistant_threshold is not None and node.x is not None and node.x >= assistant_threshold:
                role = "assistant"

            if role == "user" and len(text) <= 3 and messages and messages[-1]["role"] == "user":
                # Group-chat sender labels often appear as short lines immediately before the real content.
                continue

            messages.append({"role": role, "content": text})
            seen_texts.append(text)

        return messages[-20:]

    def _match_keyword_reply(self, message: str, keyword_replies: Dict[str, Any]) -> str | None:
        normalized_message = _normalize_text(message)
        if not normalized_message or not isinstance(keyword_replies, dict):
            return None
        for keyword, reply in keyword_replies.items():
            keyword_text = _normalize_text(str(keyword))
            reply_text = _normalize_text(str(reply))
            if keyword_text and reply_text and keyword_text in normalized_message:
                return reply_text
        return None

    def _run_script(self, lines: List[str], description: str, timeout: int) -> str:
        osascript = self.probe.osascript_path or shutil.which("osascript")
        if not osascript:
            raise RuntimeError("系统未提供 osascript，无法执行 mac 微信自动化。")

        command = [osascript]
        for line in lines:
            command.extend(["-e", line])

        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise RuntimeError(f"{description}超时：{error}") from error

        output = "\n".join(item.strip() for item in [result.stdout, result.stderr] if item and item.strip())
        if result.returncode == 0:
            return result.stdout.strip()
        raise RuntimeError(_normalize_osascript_error(output or description))


def _run_osascript(
    osascript_path: str,
    lines: List[str],
    description: str,
    timeout: int,
) -> Dict[str, Any]:
    command = [osascript_path]
    for line in lines:
        command.extend(["-e", line])

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        return {"ok": False, "output": f"{description}超时：{error}"}

    output = "\n".join(item.strip() for item in [result.stdout, result.stderr] if item and item.strip())
    return {
        "ok": result.returncode == 0,
        "output": result.stdout.strip() if result.returncode == 0 else output,
    }


def _activate_wechat_app(target: str) -> str | None:
    try:
        result = subprocess.run(
            ["open", "-a", target],
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except Exception as error:  # noqa: BLE001
        return f"激活 mac 微信失败：{error}"

    if result.returncode == 0:
        return None

    output = "\n".join(item.strip() for item in [result.stdout, result.stderr] if item and item.strip())
    return _normalize_osascript_error(output or "激活 mac 微信失败。")


def _runtime_file(folder: str, filename: str) -> Path:
    path = RUNTIME_ROOT / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _read_json(path: Path, fallback: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return fallback.copy()


def _write_json(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _resolve_contacts(payload: Dict[str, Any]) -> List[str]:
    return [target.name for target in _resolve_recipient_targets(payload)]


def _resolve_recipients(payload: Dict[str, Any]) -> List[str]:
    return [target.name for target in _resolve_recipient_targets(payload)]


def _resolve_recipient_targets(payload: Dict[str, Any]) -> List[RecipientTarget]:
    ordered: List[RecipientTarget] = []
    by_name: Dict[str, RecipientTarget] = {}
    for key, kind in (
        ("contacts", "contact"),
        ("groups", "group"),
        ("recipients", "auto"),
        ("targetContacts", "contact"),
        ("targetGroups", "group"),
    ):
        raw = payload.get(key)
        if isinstance(raw, list):
            for item in raw:
                name = str(item).strip()
                if not name:
                    continue
                existing = by_name.get(name)
                if existing:
                    if existing.kind == "auto" and kind != "auto":
                        promoted = RecipientTarget(name=name, kind=kind)
                        by_name[name] = promoted
                        index = ordered.index(existing)
                        ordered[index] = promoted
                    continue
                target = RecipientTarget(name=name, kind=kind)
                by_name[name] = target
                ordered.append(target)
    return ordered


def _resolve_tags(payload: Dict[str, Any]) -> List[str]:
    tags: List[str] = []
    for key in ("targetTags", "customerTags", "addTags"):
        raw = payload.get(key)
        if isinstance(raw, list):
            tags.extend(str(item).strip() for item in raw if str(item).strip())
    return tags


def _resolve_messages(payload: Dict[str, Any], action: str) -> List[str]:
    raw_messages = payload.get("messages")
    if isinstance(raw_messages, list):
        normalized = [str(item).strip() for item in raw_messages if str(item).strip()]
        if normalized:
            return normalized

    content = payload.get("content")
    if isinstance(content, str) and content.strip():
        return [content.strip()]

    if action == "push_sop":
        sop_id = str(payload.get("sopId") or "默认SOP")
        return [f"当前正在执行 {sop_id}，这是一条 mac 微信自动推送消息。"]

    if action == "reactivate":
        campaign = str(payload.get("campaign") or "客户回访")
        style = str(payload.get("style") or "常规提醒")
        return [
            f"这里是 {campaign} 的回访提醒，给你同步一下最新安排。",
            f"当前触达策略：{style}，如果你方便，我继续把方案发你。",
        ]

    return []


def _applescript_string(value: str) -> str:
    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    parts = normalized.split("\n")
    if not parts:
        return '""'
    return " & return & ".join(_quoted_applescript_part(part) for part in parts)


def _quoted_applescript_part(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _normalize_osascript_error(output: str) -> str:
    lowered = output.lower()
    if "不能获得" in output and ("WeChat" in output or "微信" in output):
        return "未检测到 WeChat.app / 微信.app，请先安装并手动登录 mac 微信。"
    if "-1728" in output and ("WeChat" in output or "微信" in output):
        return "未检测到 WeChat.app / 微信.app，请先安装并手动登录 mac 微信。"
    if "未检测到微信进程" in output:
        return "未检测到微信进程，请先启动并登录 mac 微信，然后保持主窗口可见。"
    if "-10827" in output:
        return "未授予辅助功能或自动化权限，或当前会话不允许控制 System Events，请在系统设置里允许当前客户端控制 WeChat 和 System Events。"
    if "-25211" in output or "not allowed assistive access" in lowered or "不允许辅助访问" in output:
        return "未授予辅助功能权限，请在系统设置里允许当前执行器、Terminal 或打包后的 Electron 客户端控制 System Events。"
    if "-1743" in output or "not authorized" in lowered or "未获得授权" in output or "不允许" in output:
        return "未授予辅助功能或自动化权限，请在系统设置里允许当前客户端控制 WeChat 和 System Events。"
    if "system events got an error" in lowered and "not allowed assistive access" in lowered:
        return "未授予辅助功能权限，请先在系统设置中允许当前客户端访问辅助功能。"
    return output.strip() or "mac 微信 UI Automation 执行失败。"


def _normalize_text(value: str) -> str:
    return " ".join(str(value).replace("\u3000", " ").split()).strip()


def _is_noise_text(text: str) -> bool:
    normalized = _normalize_text(text)
    if not normalized:
        return True
    if normalized in NOISE_TEXTS:
        return True
    if TIMESTAMP_PATTERN.match(normalized):
        return True
    if normalized.startswith("搜索网络结果"):
        return True
    return False


def _is_plausible_title(text: str) -> bool:
    normalized = _normalize_text(text)
    if _is_noise_text(normalized):
        return False
    if len(normalized) > 48:
        return False
    if normalized.startswith("http://") or normalized.startswith("https://"):
        return False
    return True


def _infer_source_type(source_name: str) -> str:
    normalized = _normalize_text(source_name)
    if re.search(r"\(\d+\)$", normalized):
        return "group"
    if "群" in normalized:
        return "group"
    return "user"
