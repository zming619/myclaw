from __future__ import annotations

import base64
import hashlib
import json
import re
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable, Dict, List, Protocol
from urllib import error as urllib_error
from urllib import request as urllib_request

RUNTIME_ROOT = Path(__file__).resolve().parents[1] / ".runtime"


@dataclass
class ComputerUseConversation:
    source_name: str
    source_type: str
    latest_user_message: str
    conversation_messages: List[Dict[str, str]] = field(default_factory=list)
    observation_text: str | None = None
    screenshot_path: str | None = None
    provider: str | None = None
    vision_model: str | None = None
    read_status: str = "read"
    read_reason: str | None = None


class ComputerUsePlatform(Protocol):
    def has_unread_messages(self) -> bool: ...
    def read_new_messages(
        self,
        *,
        max_sessions: int,
        config: Dict[str, Any],
        request: Any,
    ) -> List[ComputerUseConversation]: ...
    def send_message(self, text: str) -> None: ...
    def send_image(self, image_path: str) -> None: ...


class MacOSWeChatComputerUsePlatform:
    def __init__(self, automation: Any):
        self.automation = automation

    def has_unread_messages(self) -> bool:
        return self.automation._menu_item_enabled("显示", "显示下一个未读会话")

    def read_new_messages(
        self,
        *,
        max_sessions: int,
        config: Dict[str, Any],
        request: Any,
    ) -> List[ComputerUseConversation]:
        conversations: List[ComputerUseConversation] = []

        while len(conversations) < max_sessions and self.has_unread_messages():
            self.automation._click_menu_item("显示", "显示下一个未读会话")
            self.automation._pause(0.85)

            screenshot_path = self._capture_current_chat_screenshot()
            response = self._read_screenshot(screenshot_path, config, request)

            conversations.append(
                ComputerUseConversation(
                    source_name=str(response.get("sourceName") or "当前会话"),
                    source_type=str(response.get("sourceType") or "user"),
                    latest_user_message=str(response.get("latestUserMessage") or "").strip(),
                    conversation_messages=_normalize_conversation_messages(
                        response.get("conversationMessages")
                    ),
                    observation_text=_string_or_none(response.get("observationText")),
                    screenshot_path=str(screenshot_path),
                    provider=_string_or_none(response.get("provider")),
                    vision_model=_string_or_none(response.get("visionModel")),
                    read_status=str(response.get("status") or "failed"),
                    read_reason=_string_or_none(response.get("reason")),
                )
            )
            time.sleep(0.2)

        return conversations

    def read_current_conversation(
        self,
        *,
        config: Dict[str, Any],
        request: Any,
        source_hint: str | None = None,
        source_type_hint: str | None = None,
    ) -> ComputerUseConversation:
        screenshot_path = self._capture_current_chat_screenshot()
        response = self._read_screenshot(
            screenshot_path,
            config,
            request,
            source_hint=source_hint,
            source_type_hint=source_type_hint,
        )

        return ComputerUseConversation(
            source_name=str(response.get("sourceName") or "当前会话"),
            source_type=str(response.get("sourceType") or "user"),
            latest_user_message=str(response.get("latestUserMessage") or "").strip(),
            conversation_messages=_normalize_conversation_messages(
                response.get("conversationMessages")
            ),
            observation_text=_string_or_none(response.get("observationText")),
            screenshot_path=str(screenshot_path),
            provider=_string_or_none(response.get("provider")),
            vision_model=_string_or_none(response.get("visionModel")),
            read_status=str(response.get("status") or "failed"),
            read_reason=_string_or_none(response.get("reason")),
        )

    def focus_target(self, target_name: str, target_kind: str) -> None:
        self.automation._open_contact(
            SimpleNamespace(name=target_name, kind=target_kind)
        )

    def send_message(self, text: str) -> None:
        self.automation._send_message(text)

    def send_image(self, image_path: str) -> None:
        script = [
            f'tell application "{self.automation._app_name()}" to activate',
            "delay 0.15",
            f'set the clipboard to (read (POSIX file "{str(Path(image_path))}") as TIFF picture)',
            'tell application "System Events"',
            f'  tell process "{self.automation._process_name()}"',
            "    set frontmost to true",
            '    keystroke "v" using {command down}',
            "    delay 0.15",
            "    key code 36",
            "  end tell",
            "end tell",
            'return "ok"',
        ]
        self.automation._run_script(script, description="发送微信图片", timeout=12)

    def _capture_current_chat_screenshot(self) -> Path:
        window_rect = self.automation._window_rect()
        if not window_rect:
            raise RuntimeError("无法读取微信窗口位置，不能执行 computer use 截图。")

        left, top, width, height = window_rect
        # Focus on the chat pane and input area, trimming the left conversation list.
        capture_left = left + int(width * 0.30)
        capture_top = top + 8
        capture_width = max(320, int(width * 0.70))
        capture_height = max(320, height - 16)
        screenshot_path = _runtime_file(
            "computer-use",
            f"wechat-{int(time.time() * 1000)}.png",
        )

        subprocess.run(
            [
                "screencapture",
                "-x",
                "-R",
                f"{capture_left},{capture_top},{capture_width},{capture_height}",
                str(screenshot_path),
            ],
            capture_output=True,
            text=True,
            timeout=10,
            check=True,
        )
        return screenshot_path

    def _read_screenshot(
        self,
        screenshot_path: Path,
        config: Dict[str, Any],
        request: Any,
        *,
        source_hint: str | None = None,
        source_type_hint: str | None = None,
    ) -> Dict[str, Any]:
        local_bridge_url = str(config.get("localBridgeUrl") or "").strip()
        server_url = str(config.get("serverUrl") or "").strip()

        if local_bridge_url:
            endpoint = local_bridge_url.rstrip("/") + "/computer-use/wechat/read-messages"
            payload = {
                "screenshotPath": str(screenshot_path),
            }
            if request.device.get("id"):
                payload["deviceId"] = request.device.get("id")
            if request.device.get("alias"):
                payload["deviceAlias"] = request.device.get("alias")
            if source_hint:
                payload["sourceHint"] = source_hint
            if source_type_hint in {"user", "group"}:
                payload["sourceTypeHint"] = source_type_hint
        elif server_url:
            endpoint = server_url.rstrip("/") + "/api/internal/wechat-computer-use/read-messages"
            payload = {
                "screenshotDataUrl": _file_to_data_url(screenshot_path),
            }
            if request.device.get("id"):
                payload["deviceId"] = request.device.get("id")
            if request.device.get("alias"):
                payload["deviceAlias"] = request.device.get("alias")
            if source_hint:
                payload["sourceHint"] = source_hint
            if source_type_hint in {"user", "group"}:
                payload["sourceTypeHint"] = source_type_hint
        else:
            raise RuntimeError("未配置 localBridgeUrl 或 serverUrl，无法执行 computer use 截图读消息。")

        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib_request.Request(
            endpoint,
            data=body,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )

        try:
            with urllib_request.urlopen(req, timeout=45) as response:
                raw = response.read().decode("utf-8")
        except urllib_error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"computer use 截图读消息接口返回 HTTP {error.code}: {detail or error.reason}") from error
        except urllib_error.URLError as error:
            raise RuntimeError(f"computer use 截图读消息接口不可达：{error.reason}") from error

        payload_data = json.loads(raw or "{}")
        data = payload_data.get("data")
        if not isinstance(data, dict):
            raise RuntimeError(payload_data.get("error") or "computer use 截图读消息接口未返回 data 字段。")
        return data


class WechatComputerUseAgent:
    def __init__(
        self,
        platform: ComputerUsePlatform,
        reply_planner: Callable[[ComputerUseConversation], Dict[str, Any]],
    ):
        self.platform = platform
        self.reply_planner = reply_planner

    def run_guard(
        self,
        *,
        config: Dict[str, Any],
        request: Any,
    ) -> Dict[str, Any]:
        max_sessions = int(config.get("maxUnreadSessions") or 3)
        duplicate_cooldown_seconds = max(
            30, int(config.get("duplicateCooldownSeconds") or 600)
        )
        reply_state = _load_guard_reply_state()

        target_name = _string_or_none(config.get("targetName"))
        if target_name:
            result = self._run_target_guard(
                target_name=target_name,
                target_kind=str(config.get("targetKind") or "contact"),
                config=config,
                request=request,
                reply_state=reply_state,
                duplicate_cooldown_seconds=duplicate_cooldown_seconds,
            )
            _persist_guard_reply_state(
                reply_state,
                duplicate_cooldown_seconds,
            )
            return result

        conversations = self.platform.read_new_messages(
            max_sessions=max_sessions,
            config=config,
            request=request,
        )

        processed_sessions = 0
        model_reply_count = 0
        keyword_reply_count = 0
        welcome_reply_count = 0
        fallback_reply_count = 0
        skipped_reply_count = 0
        skipped_duplicate_count = 0
        sessions: List[Dict[str, Any]] = []

        for conversation in conversations:
            signature = _build_conversation_signature(conversation)
            if (
                conversation.read_status != "read"
                or not conversation.latest_user_message.strip()
            ):
                skipped_reply_count += 1
                sessions.append(
                    {
                        "sourceName": conversation.source_name,
                        "sourceType": conversation.source_type,
                        "messageContent": conversation.latest_user_message,
                        "conversationMessages": conversation.conversation_messages,
                        "observationText": conversation.observation_text,
                        "screenshotPath": conversation.screenshot_path,
                        "readStatus": conversation.read_status,
                        "readReason": conversation.read_reason,
                        "readProvider": conversation.provider,
                        "visionModel": conversation.vision_model,
                        "replyStrategy": "skip",
                        "replyContent": None,
                        "reason": conversation.read_reason
                        or "未从微信截图中提取到可回复的消息，本轮跳过自动回复。",
                        "duplicateSignature": signature,
                    }
                )
                continue

            welcome_reply = _build_guard_welcome_reply(
                reply_state,
                conversation,
                config,
            )
            if welcome_reply:
                reply_plan = {
                    "strategy": "welcome",
                    "replyContent": welcome_reply,
                    "reason": "识别为首次会话，已发送欢迎语。",
                    "autoReplyModel": None,
                    "provider": None,
                    "knowledgeMatched": False,
                    "recordId": None,
                }
            elif _should_skip_duplicate_reply(
                reply_state,
                signature,
                duplicate_cooldown_seconds,
            ):
                skipped_reply_count += 1
                skipped_duplicate_count += 1
                sessions.append(
                    {
                        "sourceName": conversation.source_name,
                        "sourceType": conversation.source_type,
                        "messageContent": conversation.latest_user_message,
                        "conversationMessages": conversation.conversation_messages,
                        "observationText": conversation.observation_text,
                        "screenshotPath": conversation.screenshot_path,
                        "readStatus": conversation.read_status,
                        "readReason": conversation.read_reason,
                        "readProvider": conversation.provider,
                        "visionModel": conversation.vision_model,
                        "replyStrategy": "duplicate_skip",
                        "replyContent": None,
                        "reason": "命中去重窗口，已跳过重复自动回复。",
                        "duplicateSignature": signature,
                    }
                )
                continue

            else:
                reply_plan = self.reply_planner(conversation)
            strategy = str(reply_plan.get("strategy") or "fallback")
            if reply_plan.get("skipReply"):
                skipped_reply_count += 1
                sessions.append(
                    {
                        "sourceName": conversation.source_name,
                        "sourceType": conversation.source_type,
                        "messageContent": conversation.latest_user_message,
                        "conversationMessages": conversation.conversation_messages,
                        "observationText": conversation.observation_text,
                        "screenshotPath": conversation.screenshot_path,
                        "readStatus": conversation.read_status,
                        "readReason": conversation.read_reason,
                        "readProvider": conversation.provider,
                        "visionModel": conversation.vision_model,
                        "replyStrategy": strategy,
                        "replyContent": None,
                        "autoReplyModel": reply_plan.get("autoReplyModel"),
                        "provider": reply_plan.get("provider"),
                        "knowledgeMatched": reply_plan.get("knowledgeMatched"),
                        "recordId": reply_plan.get("recordId"),
                        "reason": reply_plan.get("reason"),
                        "duplicateSignature": signature,
                    }
                )
                continue

            reply_content = str(reply_plan.get("replyContent") or "").strip()
            if not reply_content:
                skipped_reply_count += 1
                continue

            self.platform.send_message(reply_content)
            processed_sessions += 1
            if strategy == "model":
                model_reply_count += 1
            elif strategy == "keyword":
                keyword_reply_count += 1
            elif strategy == "welcome":
                welcome_reply_count += 1
            else:
                fallback_reply_count += 1
            _remember_guard_reply(
                reply_state,
                signature,
                conversation=conversation,
                reply_content=reply_content,
                strategy=strategy,
            )

            sessions.append(
                {
                    "sourceName": conversation.source_name,
                    "sourceType": conversation.source_type,
                    "messageContent": conversation.latest_user_message,
                    "conversationMessages": conversation.conversation_messages,
                    "observationText": conversation.observation_text,
                    "screenshotPath": conversation.screenshot_path,
                    "readStatus": conversation.read_status,
                    "readReason": conversation.read_reason,
                    "readProvider": conversation.provider,
                    "visionModel": conversation.vision_model,
                    "replyStrategy": strategy,
                    "replyContent": reply_content,
                    "autoReplyModel": reply_plan.get("autoReplyModel"),
                    "provider": reply_plan.get("provider"),
                    "knowledgeMatched": reply_plan.get("knowledgeMatched"),
                    "recordId": reply_plan.get("recordId"),
                    "reason": reply_plan.get("reason"),
                    "duplicateSignature": signature,
                }
            )

        _persist_guard_reply_state(
            reply_state,
            duplicate_cooldown_seconds,
        )
        return {
            "processedSessions": processed_sessions,
            "modelReplyCount": model_reply_count,
            "keywordReplyCount": keyword_reply_count,
            "welcomeReplyCount": welcome_reply_count,
            "fallbackReplyCount": fallback_reply_count,
            "skippedReplyCount": skipped_reply_count,
            "skippedDuplicateCount": skipped_duplicate_count,
            "sessions": sessions,
        }

    def _run_target_guard(
        self,
        *,
        target_name: str,
        target_kind: str,
        config: Dict[str, Any],
        request: Any,
        reply_state: Dict[str, Any],
        duplicate_cooldown_seconds: int,
    ) -> Dict[str, Any]:
        processed_sessions = 0
        model_reply_count = 0
        keyword_reply_count = 0
        welcome_reply_count = 0
        fallback_reply_count = 0
        skipped_reply_count = 0
        skipped_duplicate_count = 0
        sessions: List[Dict[str, Any]] = []

        conversation = self.platform.read_current_conversation(
            config=config,
            request=request,
        )
        refocused = False

        if not _matches_target_name(conversation.source_name, target_name):
            sessions.append(
                {
                    "sourceName": conversation.source_name,
                    "sourceType": conversation.source_type,
                    "messageContent": conversation.latest_user_message,
                    "conversationMessages": conversation.conversation_messages,
                    "observationText": conversation.observation_text,
                    "screenshotPath": conversation.screenshot_path,
                    "readStatus": conversation.read_status,
                    "readReason": conversation.read_reason,
                    "readProvider": conversation.provider,
                    "visionModel": conversation.vision_model,
                    "replyStrategy": "view_mismatch",
                    "replyContent": None,
                    "reason": f"当前聊天窗口不是目标会话 {target_name}，准备搜索切回。",
                    "targetName": target_name,
                }
            )
            self.platform.focus_target(target_name, target_kind)
            refocused = True
            conversation = self.platform.read_current_conversation(
                config=config,
                request=request,
            )

        signature = _build_conversation_signature(conversation)
        if conversation.read_status != "read":
            skipped_reply_count += 1
            sessions.append(
                {
                    "sourceName": conversation.source_name,
                    "sourceType": conversation.source_type,
                    "messageContent": conversation.latest_user_message,
                    "conversationMessages": conversation.conversation_messages,
                    "observationText": conversation.observation_text,
                    "screenshotPath": conversation.screenshot_path,
                    "readStatus": conversation.read_status,
                    "readReason": conversation.read_reason,
                    "readProvider": conversation.provider,
                    "visionModel": conversation.vision_model,
                    "replyStrategy": "skip",
                    "replyContent": None,
                    "reason": conversation.read_reason
                    or "未从微信截图中提取到可回复的消息，本轮跳过自动回复。",
                    "targetName": target_name,
                    "refocused": refocused,
                }
            )
            return {
                "processedSessions": processed_sessions,
                "modelReplyCount": model_reply_count,
                "keywordReplyCount": keyword_reply_count,
                "fallbackReplyCount": fallback_reply_count,
                "skippedReplyCount": skipped_reply_count,
                "skippedDuplicateCount": skipped_duplicate_count,
                "sessions": sessions,
            }

        if not _matches_target_name(conversation.source_name, target_name):
            skipped_reply_count += 1
            sessions.append(
                {
                    "sourceName": conversation.source_name,
                    "sourceType": conversation.source_type,
                    "messageContent": conversation.latest_user_message,
                    "conversationMessages": conversation.conversation_messages,
                    "observationText": conversation.observation_text,
                    "screenshotPath": conversation.screenshot_path,
                    "readStatus": conversation.read_status,
                    "readReason": conversation.read_reason,
                    "readProvider": conversation.provider,
                    "visionModel": conversation.vision_model,
                    "replyStrategy": "target_not_found",
                    "replyContent": None,
                    "reason": f"搜索后仍未定位到目标会话 {target_name}，本轮跳过。",
                    "targetName": target_name,
                    "refocused": refocused,
                }
            )
            return {
                "processedSessions": processed_sessions,
                "modelReplyCount": model_reply_count,
                "keywordReplyCount": keyword_reply_count,
                "fallbackReplyCount": fallback_reply_count,
                "skippedReplyCount": skipped_reply_count,
                "skippedDuplicateCount": skipped_duplicate_count,
                "sessions": sessions,
            }

        if not _has_pending_user_message(conversation):
            skipped_reply_count += 1
            sessions.append(
                {
                    "sourceName": conversation.source_name,
                    "sourceType": conversation.source_type,
                    "messageContent": conversation.latest_user_message,
                    "conversationMessages": conversation.conversation_messages,
                    "observationText": conversation.observation_text,
                    "screenshotPath": conversation.screenshot_path,
                    "readStatus": conversation.read_status,
                    "readReason": conversation.read_reason,
                    "readProvider": conversation.provider,
                    "visionModel": conversation.vision_model,
                    "replyStrategy": "no_pending_user_message",
                    "replyContent": None,
                    "reason": "当前最后一条消息不是对方发的，无需自动回复。",
                    "targetName": target_name,
                    "refocused": refocused,
                    "duplicateSignature": signature,
                }
            )
            return {
                "processedSessions": processed_sessions,
                "modelReplyCount": model_reply_count,
                "keywordReplyCount": keyword_reply_count,
                "fallbackReplyCount": fallback_reply_count,
                "skippedReplyCount": skipped_reply_count,
                "skippedDuplicateCount": skipped_duplicate_count,
                "sessions": sessions,
            }

        welcome_reply = _build_guard_welcome_reply(
            reply_state,
            conversation,
            config,
        )
        if welcome_reply:
            reply_plan = {
                "strategy": "welcome",
                "replyContent": welcome_reply,
                "reason": "识别为首次会话，已发送欢迎语。",
                "autoReplyModel": None,
                "provider": None,
                "knowledgeMatched": False,
                "recordId": None,
            }
        elif _should_skip_duplicate_reply(
            reply_state,
            signature,
            duplicate_cooldown_seconds,
        ):
            skipped_reply_count += 1
            skipped_duplicate_count += 1
            sessions.append(
                {
                    "sourceName": conversation.source_name,
                    "sourceType": conversation.source_type,
                    "messageContent": conversation.latest_user_message,
                    "conversationMessages": conversation.conversation_messages,
                    "observationText": conversation.observation_text,
                    "screenshotPath": conversation.screenshot_path,
                    "readStatus": conversation.read_status,
                    "readReason": conversation.read_reason,
                    "readProvider": conversation.provider,
                    "visionModel": conversation.vision_model,
                    "replyStrategy": "duplicate_skip",
                    "replyContent": None,
                    "reason": "命中去重窗口，已跳过重复自动回复。",
                    "targetName": target_name,
                    "refocused": refocused,
                    "duplicateSignature": signature,
                }
            )
            return {
                "processedSessions": processed_sessions,
                "modelReplyCount": model_reply_count,
                "keywordReplyCount": keyword_reply_count,
                "fallbackReplyCount": fallback_reply_count,
                "skippedReplyCount": skipped_reply_count,
                "skippedDuplicateCount": skipped_duplicate_count,
                "sessions": sessions,
            }

        else:
            reply_plan = self.reply_planner(conversation)
        strategy = str(reply_plan.get("strategy") or "fallback")
        if reply_plan.get("skipReply"):
            skipped_reply_count += 1
            sessions.append(
                {
                    "sourceName": conversation.source_name,
                    "sourceType": conversation.source_type,
                    "messageContent": conversation.latest_user_message,
                    "conversationMessages": conversation.conversation_messages,
                    "observationText": conversation.observation_text,
                    "screenshotPath": conversation.screenshot_path,
                    "readStatus": conversation.read_status,
                    "readReason": conversation.read_reason,
                    "readProvider": conversation.provider,
                    "visionModel": conversation.vision_model,
                    "replyStrategy": strategy,
                    "replyContent": None,
                    "autoReplyModel": reply_plan.get("autoReplyModel"),
                    "provider": reply_plan.get("provider"),
                    "knowledgeMatched": reply_plan.get("knowledgeMatched"),
                    "recordId": reply_plan.get("recordId"),
                    "reason": reply_plan.get("reason"),
                    "targetName": target_name,
                    "refocused": refocused,
                    "duplicateSignature": signature,
                }
            )
            return {
                "processedSessions": processed_sessions,
                "modelReplyCount": model_reply_count,
                "keywordReplyCount": keyword_reply_count,
                "fallbackReplyCount": fallback_reply_count,
                "skippedReplyCount": skipped_reply_count,
                "skippedDuplicateCount": skipped_duplicate_count,
                "sessions": sessions,
            }

        reply_content = str(reply_plan.get("replyContent") or "").strip()
        if not reply_content:
            skipped_reply_count += 1
            return {
                "processedSessions": processed_sessions,
                "modelReplyCount": model_reply_count,
                "keywordReplyCount": keyword_reply_count,
                "fallbackReplyCount": fallback_reply_count,
                "skippedReplyCount": skipped_reply_count,
                "skippedDuplicateCount": skipped_duplicate_count,
                "sessions": sessions,
            }

        self.platform.send_message(reply_content)
        processed_sessions += 1
        if strategy == "model":
            model_reply_count += 1
        elif strategy == "keyword":
            keyword_reply_count += 1
        elif strategy == "welcome":
            welcome_reply_count += 1
        else:
            fallback_reply_count += 1
        _remember_guard_reply(
            reply_state,
            signature,
            conversation=conversation,
            reply_content=reply_content,
            strategy=strategy,
        )
        sessions.append(
            {
                "sourceName": conversation.source_name,
                "sourceType": conversation.source_type,
                "messageContent": conversation.latest_user_message,
                "conversationMessages": conversation.conversation_messages,
                "observationText": conversation.observation_text,
                "screenshotPath": conversation.screenshot_path,
                "readStatus": conversation.read_status,
                "readReason": conversation.read_reason,
                "readProvider": conversation.provider,
                "visionModel": conversation.vision_model,
                "replyStrategy": strategy,
                "replyContent": reply_content,
                "autoReplyModel": reply_plan.get("autoReplyModel"),
                "provider": reply_plan.get("provider"),
                "knowledgeMatched": reply_plan.get("knowledgeMatched"),
                "recordId": reply_plan.get("recordId"),
                "reason": reply_plan.get("reason"),
                "targetName": target_name,
                "refocused": refocused,
                "duplicateSignature": signature,
            }
        )
        return {
            "processedSessions": processed_sessions,
            "modelReplyCount": model_reply_count,
            "keywordReplyCount": keyword_reply_count,
            "welcomeReplyCount": welcome_reply_count,
            "fallbackReplyCount": fallback_reply_count,
            "skippedReplyCount": skipped_reply_count,
            "skippedDuplicateCount": skipped_duplicate_count,
            "sessions": sessions,
        }


def _file_to_data_url(path: Path) -> str:
    mime_type = "image/png"
    if path.suffix.lower() in {".jpg", ".jpeg"}:
        mime_type = "image/jpeg"
    elif path.suffix.lower() == ".webp":
        mime_type = "image/webp"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def _runtime_file(folder: str, filename: str) -> Path:
    path = RUNTIME_ROOT / folder / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _normalize_conversation_messages(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []

    normalized: List[Dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        content = str(item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        normalized.append({"role": role, "content": content})
    return normalized[-12:]


def _string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _normalize_chat_name(value: str) -> str:
    text = re.sub(r"\s+", "", value or "").strip().lower()
    return re.sub(r"[（(]\d+[)）]$", "", text)


def _matches_target_name(source_name: str, target_name: str) -> bool:
    if not source_name or not target_name:
        return False
    return _normalize_chat_name(source_name) == _normalize_chat_name(target_name)


def _has_pending_user_message(conversation: ComputerUseConversation) -> bool:
    for item in reversed(conversation.conversation_messages):
        role = str(item.get("role") or "").strip()
        content = str(item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        return role == "user"
    return bool(conversation.latest_user_message.strip())


def _guard_state_path() -> Path:
    return _runtime_file("guard", "auto_reply_guard_state.json")


def _load_guard_reply_state() -> Dict[str, Any]:
    path = _guard_state_path()
    if not path.exists():
        return {"signatures": {}, "welcomes": {}}

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        return {"signatures": {}, "welcomes": {}}

    if not isinstance(data, dict):
        return {"signatures": {}, "welcomes": {}}

    signatures = data.get("signatures")
    if not isinstance(signatures, dict):
        data["signatures"] = {}
    welcomes = data.get("welcomes")
    if not isinstance(welcomes, dict):
        data["welcomes"] = {}
    return data


def _persist_guard_reply_state(
    state: Dict[str, Any],
    duplicate_cooldown_seconds: int,
) -> None:
    signatures = state.get("signatures")
    if not isinstance(signatures, dict):
        signatures = {}

    now = time.time()
    retention_seconds = max(duplicate_cooldown_seconds * 3, 3600)
    pruned = {
        key: value
        for key, value in signatures.items()
        if isinstance(value, dict)
        and isinstance(value.get("repliedAtEpoch"), (int, float))
        and now - float(value["repliedAtEpoch"]) <= retention_seconds
    }
    state["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(now))
    state["signatures"] = pruned
    _guard_state_path().write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _build_conversation_signature(conversation: ComputerUseConversation) -> str:
    digest = hashlib.sha1()
    digest.update(conversation.source_type.strip().lower().encode("utf-8"))
    digest.update(b"\n")
    digest.update(conversation.source_name.strip().encode("utf-8"))
    digest.update(b"\n")
    digest.update(conversation.latest_user_message.strip().encode("utf-8"))
    return digest.hexdigest()


def _should_skip_duplicate_reply(
    state: Dict[str, Any],
    signature: str,
    duplicate_cooldown_seconds: int,
) -> bool:
    signatures = state.get("signatures")
    if not isinstance(signatures, dict):
        return False

    record = signatures.get(signature)
    if not isinstance(record, dict):
        return False

    event_epoch = record.get("repliedAtEpoch")
    if not isinstance(event_epoch, (int, float)):
        event_epoch = record.get("seenAtEpoch")
    if not isinstance(event_epoch, (int, float)):
        return False

    return time.time() - float(event_epoch) <= duplicate_cooldown_seconds


def _remember_guard_baseline(
    state: Dict[str, Any],
    signature: str,
    *,
    conversation: ComputerUseConversation,
) -> None:
    signatures = state.get("signatures")
    if not isinstance(signatures, dict):
        signatures = {}
        state["signatures"] = signatures

    now = time.time()
    signatures[signature] = {
        "sourceName": conversation.source_name,
        "sourceType": conversation.source_type,
        "messageContent": conversation.latest_user_message,
        "seenAtEpoch": now,
        "seenAt": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(now)),
        "strategy": "baseline",
    }


def _remember_guard_reply(
    state: Dict[str, Any],
    signature: str,
    *,
    conversation: ComputerUseConversation,
    reply_content: str,
    strategy: str,
) -> None:
    signatures = state.get("signatures")
    if not isinstance(signatures, dict):
        signatures = {}
        state["signatures"] = signatures

    now = time.time()
    signatures[signature] = {
        "sourceName": conversation.source_name,
        "sourceType": conversation.source_type,
        "messageContent": conversation.latest_user_message,
        "replyContent": reply_content,
        "strategy": strategy,
        "repliedAtEpoch": now,
        "repliedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(now)),
    }
    if strategy == "welcome":
        welcomes = state.get("welcomes")
        if not isinstance(welcomes, dict):
            welcomes = {}
            state["welcomes"] = welcomes
        welcomes[_build_welcome_key(conversation)] = {
            "sourceName": conversation.source_name,
            "sourceType": conversation.source_type,
            "replyContent": reply_content,
            "repliedAtEpoch": now,
            "repliedAt": time.strftime("%Y-%m-%dT%H:%M:%S%z", time.localtime(now)),
        }


def _build_guard_welcome_reply(
    state: Dict[str, Any],
    conversation: ComputerUseConversation,
    config: Dict[str, Any],
) -> str | None:
    welcome = str(config.get("welcome") or "").strip()
    if not welcome:
        return None
    if conversation.source_type != "user":
        return None
    if _has_assistant_history(conversation):
        return None

    welcomes = state.get("welcomes")
    if not isinstance(welcomes, dict):
        return welcome

    if _build_welcome_key(conversation) in welcomes:
        return None
    return welcome


def _has_assistant_history(conversation: ComputerUseConversation) -> bool:
    for item in conversation.conversation_messages:
        role = str(item.get("role") or "").strip()
        content = str(item.get("content") or "").strip()
        if role == "assistant" and content:
            return True
    return False


def _build_welcome_key(conversation: ComputerUseConversation) -> str:
    return f"{conversation.source_type.strip().lower()}::{_normalize_chat_name(conversation.source_name)}"
