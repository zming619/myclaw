from __future__ import annotations

import argparse
import json
import re
import sys
import time
from pathlib import Path
from types import SimpleNamespace
from urllib import error as urllib_error
from urllib import request as urllib_request

from nebula_rpa.computer_use import _file_to_data_url, MacOSWeChatComputerUsePlatform
from nebula_rpa.mac_wechat import (
    MacWechatAutomation,
    RecipientTarget,
    _applescript_string,
    detect_mac_wechat,
)
from nebula_rpa.models import ExecutionRequest


DEFAULT_SERVER_URL = "http://127.0.0.1:3000"
DEFAULT_DEVICE_ALIAS = "星云执行器-01"
DEFAULT_POLL_SECONDS = 4.0
DEFAULT_MAX_MINUTES = 60.0
DEFAULT_FALLBACK_REPLY = "我先帮你记下需求，稍后给你一个明确回复。"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="持续跟进单个微信联系人/群聊，自动读取新消息并回复。")
    parser.add_argument("--target", required=True, help="联系人或群聊名称")
    parser.add_argument(
        "--kind",
        choices=("contact", "group"),
        default="contact",
        help="目标类型，默认 contact",
    )
    parser.add_argument("--server-url", default=DEFAULT_SERVER_URL, help="MyClaw server 地址")
    parser.add_argument("--device-alias", default=DEFAULT_DEVICE_ALIAS, help="设备别名")
    parser.add_argument("--poll-seconds", type=float, default=DEFAULT_POLL_SECONDS, help="轮询间隔秒数")
    parser.add_argument("--max-minutes", type=float, default=DEFAULT_MAX_MINUTES, help="最长运行分钟数")
    parser.add_argument(
        "--intro-message",
        default="继续进行 MyClaw 持续联调测试。我会在你回复后自动继续响应；如果打扰到你了，直接跟我说一声，我就停。",
        help="启动时发送的告知消息；传空字符串可关闭",
    )
    parser.add_argument(
        "--goodbye-message",
        default="这轮 MyClaw 持续联调先到这里，我先走了，晚点再聊。",
        help="结束时发送的收尾消息；传空字符串可关闭",
    )
    parser.add_argument(
        "--fallback-reply",
        default=DEFAULT_FALLBACK_REPLY,
        help="模型不可用时的兜底回复",
    )
    return parser.parse_args()


def sanitize_name(value: str) -> str:
    normalized = re.sub(r"[^\w\u4e00-\u9fff-]+", "-", value).strip("-")
    return normalized or "target"


def append_log(log_path: Path, payload: dict) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def post_json(url: str, payload: dict, timeout: int = 80) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib_request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib_request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"HTTP {error.code}: {detail or error.reason}") from error
    except urllib_error.URLError as error:
        raise RuntimeError(f"请求失败：{error.reason}") from error


def build_conversation(read_response: dict, screenshot_path: Path, target_name: str) -> SimpleNamespace:
    return SimpleNamespace(
        source_name=read_response.get("sourceName") or target_name,
        source_type=read_response.get("sourceType") or "user",
        latest_user_message=(read_response.get("latestUserMessage") or "").strip(),
        conversation_messages=read_response.get("conversationMessages") or [],
        observation_text=read_response.get("observationText"),
        screenshot_path=str(screenshot_path),
        provider=read_response.get("provider"),
        vision_model=read_response.get("visionModel"),
        read_status=read_response.get("status"),
        read_reason=read_response.get("reason"),
    )


def normalize_name(value: object) -> str:
    text = re.sub(r"\s+", "", str(value or "")).strip().lower()
    text = re.sub(r"[（(]\d+[)）]$", "", text)
    return text


def is_target_view(read_response: dict, target_name: str) -> bool:
    actual = normalize_name(read_response.get("sourceName"))
    target = normalize_name(target_name)
    if not actual or not target:
        return False
    return actual == target


def has_pending_user_message(read_response: dict) -> bool:
    messages = read_response.get("conversationMessages")
    if not isinstance(messages, list) or not messages:
        return False

    for item in reversed(messages):
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        content = str(item.get("content") or "").strip()
        if role not in {"user", "assistant"} or not content:
            continue
        return role == "user"
    return False


def build_pending_signature(read_response: dict) -> str | None:
    if not has_pending_user_message(read_response):
        return None

    source_name = str(read_response.get("sourceName") or "").strip()
    source_type = str(read_response.get("sourceType") or "user").strip()
    latest = str(read_response.get("latestUserMessage") or "").strip()
    if not latest:
        return None
    return "|".join((source_type.lower(), source_name, latest))


def should_retry_model(reply_plan: dict) -> bool:
    strategy = str(reply_plan.get("strategy") or "").strip().lower()
    if strategy != "fallback":
        return False
    return not reply_plan.get("recordId") and not reply_plan.get("autoReplyModel")


def main() -> int:
    args = parse_args()
    probe = detect_mac_wechat()
    if not probe.available:
        print(json.dumps({"status": "error", "reason": probe.detail}, ensure_ascii=False))
        return 1

    automation = MacWechatAutomation(probe, "hybrid")
    platform = MacOSWeChatComputerUsePlatform(automation)
    request = ExecutionRequest(
        task_id=f"continuous-guard-{int(time.time())}",
        template_id="auto_reply",
        task_name=f"{args.target} 持续模式联调",
        sop_code="wechat.reply.guard",
        platforms=["微信"],
        payload={},
        device={"alias": args.device_alias},
    )
    target = RecipientTarget(name=args.target, kind=args.kind)
    config = {
        "serverUrl": args.server_url,
        "fallbackReply": args.fallback_reply,
        "keywordReplies": {},
    }
    runtime_root = Path(__file__).resolve().parents[1] / ".runtime" / "guard"
    log_path = runtime_root / f"continuous-{sanitize_name(args.target)}.jsonl"
    started_at = time.time()
    deadline = started_at + max(60.0, args.max_minutes * 60.0)
    processed_signatures: set[str] = set()
    reply_count = 0
    stop_reason = "completed"
    last_heartbeat_at = 0.0

    automation.ensure_session(request)

    def log_event(kind: str, **payload: object) -> None:
        event = {
            "kind": kind,
            "target": args.target,
            "targetKind": args.kind,
            "at": time.strftime("%Y-%m-%dT%H:%M:%S"),
            **payload,
        }
        append_log(log_path, event)
        print(json.dumps(event, ensure_ascii=False), flush=True)

    def read_current_view() -> tuple[Path, dict]:
        automation._activate_app()
        automation._focus_chat_workspace()
        screenshot_path = platform._capture_current_chat_screenshot()
        response = post_json(
            args.server_url.rstrip("/") + "/api/internal/wechat-computer-use/read-messages",
            {
                "screenshotDataUrl": _file_to_data_url(screenshot_path),
                "deviceAlias": request.device.get("alias"),
            },
        )
        data = response.get("data")
        if not isinstance(data, dict):
            raise RuntimeError(response.get("error") or "读消息接口返回异常。")
        return screenshot_path, data

    def search_target(selection: str) -> None:
        script = [
            f'tell application "{automation._app_name()}" to activate',
            "delay 0.2",
            f"set the clipboard to {_applescript_string(args.target)}",
            'tell application "System Events"',
            f'  if not (exists process "{automation._process_name()}") then error "未检测到微信进程"',
            f'  tell process "{automation._process_name()}"',
            "    set frontmost to true",
            '    keystroke "f" using {command down}',
            "    delay 0.3",
            '    keystroke "a" using {command down}',
            "    delay 0.1",
            '    keystroke "v" using {command down}',
            "    delay 0.8",
        ]
        if selection == "down-enter":
            script.extend(
                [
                    "    key code 125",
                    "    delay 0.2",
                ]
            )
        script.extend(
            [
                "    key code 36",
                "  end tell",
                "end tell",
                'return "ok"',
            ]
        )
        automation._run_script(script, description=f"搜索并打开目标会话 {args.target}", timeout=15)
        automation._pause(1.2)

    def ensure_target_view() -> tuple[Path, dict, bool]:
        screenshot_path, read_response = read_current_view()
        if is_target_view(read_response, args.target):
            return screenshot_path, read_response, False

        log_event(
            "view_mismatch",
            sourceName=read_response.get("sourceName"),
            latestUserMessage=read_response.get("latestUserMessage"),
            screenshotPath=str(screenshot_path),
        )
        for selection in ("enter", "down-enter"):
            search_target(selection)
            screenshot_path, read_response = read_current_view()
            log_event(
                "refocus_attempt",
                selection=selection,
                sourceName=read_response.get("sourceName"),
                screenshotPath=str(screenshot_path),
            )
            if is_target_view(read_response, args.target):
                return screenshot_path, read_response, True
        return screenshot_path, read_response, True

    try:
        baseline_path, baseline_read, baseline_refocused = ensure_target_view()
        baseline_latest = (baseline_read.get("latestUserMessage") or "").strip()
        baseline_signature = build_pending_signature(baseline_read)
        if baseline_signature:
            processed_signatures.add(baseline_signature)
        log_event(
            "started",
            logPath=str(log_path),
            baselineLatest=baseline_latest,
            screenshotPath=str(baseline_path),
            baselinePending=has_pending_user_message(baseline_read),
            baselineRefocused=baseline_refocused,
            baselineSignatureSeeded=bool(baseline_signature),
        )

        if args.intro_message.strip():
            automation._send_message(args.intro_message.strip())
            log_event("intro_sent", message=args.intro_message.strip())

        while time.time() < deadline:
            screenshot_path, read_response, refocused = ensure_target_view()
            latest = (read_response.get("latestUserMessage") or "").strip()
            read_status = str(read_response.get("status") or "failed")
            pending_signature = build_pending_signature(read_response)
            target_matched = is_target_view(read_response, args.target)

            if time.time() - last_heartbeat_at >= 60:
                last_heartbeat_at = time.time()
                log_event(
                    "heartbeat",
                    readStatus=read_status,
                    latestUserMessage=latest,
                    sourceName=read_response.get("sourceName"),
                    targetMatched=target_matched,
                    pendingReply=bool(pending_signature),
                    refocused=refocused,
                    screenshotPath=str(screenshot_path),
                )

            if read_status != "read":
                time.sleep(max(1.0, args.poll_seconds))
                continue

            if not target_matched:
                log_event("target_not_found", sourceName=read_response.get("sourceName"), screenshotPath=str(screenshot_path))
                time.sleep(max(1.0, args.poll_seconds))
                continue

            if not pending_signature or pending_signature in processed_signatures:
                time.sleep(max(1.0, args.poll_seconds))
                continue

            processed_signatures.add(pending_signature)
            conversation = build_conversation(read_response, screenshot_path, args.target)
            reply_plan = automation._plan_guard_reply_from_computer_use(conversation, config, request)
            if should_retry_model(reply_plan):
                time.sleep(1.5)
                reply_plan = automation._plan_guard_reply_from_computer_use(conversation, config, request)
            reply_content = str(reply_plan.get("replyContent") or "").strip()
            if reply_plan.get("skipReply") or not reply_content:
                log_event(
                    "skipped",
                    latestUserMessage=latest,
                    reason=reply_plan.get("reason"),
                    screenshotPath=str(screenshot_path),
                )
                time.sleep(max(1.0, args.poll_seconds))
                continue

            automation._send_message(reply_content)
            reply_count += 1
            log_event(
                "reply_sent",
                replyCount=reply_count,
                latestUserMessage=latest,
                replyContent=reply_content,
                replyStrategy=reply_plan.get("strategy"),
                reason=reply_plan.get("reason"),
                recordId=reply_plan.get("recordId"),
                autoReplyModel=reply_plan.get("autoReplyModel"),
                screenshotPath=str(screenshot_path),
            )
            time.sleep(max(1.0, args.poll_seconds))
    except KeyboardInterrupt:
        stop_reason = "interrupted"
    except Exception as error:  # noqa: BLE001
        stop_reason = "error"
        log_event("error", reason=str(error))
        return 1
    finally:
        if args.goodbye_message.strip():
            try:
                automation._send_message(args.goodbye_message.strip())
                log_event("goodbye_sent", message=args.goodbye_message.strip())
            except Exception as error:  # noqa: BLE001
                log_event("goodbye_failed", reason=str(error))

        log_event(
            "stopped",
            reason=stop_reason,
            replyCount=reply_count,
            ranSeconds=int(time.time() - started_at),
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
