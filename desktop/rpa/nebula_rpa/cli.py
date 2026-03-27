from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict

from .engine import SopExecutionEngine
from .mac_wechat import detect_mac_wechat
from .models import ExecutionRequest
from .runtime import detect_runtime


def emit(event: Dict[str, Any]) -> None:
    sys.stdout.write(json.dumps(event, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def command_doctor() -> int:
    probe = detect_runtime()
    wechat_probe = detect_mac_wechat()
    payload = {
        "ok": True,
        "mode": probe.mode,
        "pythonBinary": sys.executable,
        "capabilities": probe.capabilities,
        "detail": probe.detail,
        "liveRequested": os.getenv("MYCLAW_RPA_LIVE") == "1",
        "wechat": {
            "available": wechat_probe.available,
            "detail": wechat_probe.detail,
            "reason": wechat_probe.reason,
            "appPath": wechat_probe.app_path,
            "appName": wechat_probe.app_name,
            "processName": wechat_probe.process_name,
            "osascriptPath": wechat_probe.osascript_path,
        },
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()
    return 0


def command_execute() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        emit(
            {
                "type": "run_failed",
                "message": "未收到任务载荷，无法执行。",
                "progress": 100,
            }
        )
        return 1

    try:
        request = ExecutionRequest.from_dict(json.loads(raw))
        engine = SopExecutionEngine()
        engine.execute(request, emit)
        return 0
    except Exception as error:  # noqa: BLE001
        emit(
            {
                "type": "run_failed",
                "message": str(error),
                "progress": 100,
            }
        )
        return 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="nebula-rpa")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("doctor")
    subparsers.add_parser("execute")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.command == "doctor":
        return command_doctor()
    if args.command == "execute":
        return command_execute()
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
