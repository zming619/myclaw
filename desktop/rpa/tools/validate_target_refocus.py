from __future__ import annotations

import argparse
import json
from types import SimpleNamespace
from urllib import request as urllib_request

from nebula_rpa.computer_use import _file_to_data_url, MacOSWeChatComputerUsePlatform
from nebula_rpa.mac_wechat import MacWechatAutomation, _applescript_string, detect_mac_wechat
from nebula_rpa.models import ExecutionRequest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="验证 current-view 识别和目标重定向流程。")
    parser.add_argument("--target", required=True, help="要切回的目标联系人/群")
    parser.add_argument("--other", required=True, help="先切过去的其他联系人/群")
    parser.add_argument("--server-url", default="http://127.0.0.1:3000", help="MyClaw server 地址")
    parser.add_argument("--device-alias", default="星云执行器-01", help="设备别名")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    probe = detect_mac_wechat()
    if not probe.available:
        raise SystemExit(probe.detail)

    automation = MacWechatAutomation(probe, "hybrid")
    platform = MacOSWeChatComputerUsePlatform(automation)
    request = ExecutionRequest(
        task_id="validate-target-refocus",
        template_id="auto_reply",
        task_name="验证 current-view/refocus",
        sop_code="wechat.reply.guard",
        platforms=["微信"],
        payload={},
        device={"alias": args.device_alias},
    )
    automation.ensure_session(request)

    def read_current() -> tuple[str, dict]:
        automation._activate_app()
        automation._focus_chat_workspace()
        screenshot_path = platform._capture_current_chat_screenshot()
        body = json.dumps(
            {
                "screenshotDataUrl": _file_to_data_url(screenshot_path),
                "deviceAlias": request.device.get("alias"),
            },
            ensure_ascii=False,
        ).encode("utf-8")
        req = urllib_request.Request(
            args.server_url.rstrip("/") + "/api/internal/wechat-computer-use/read-messages",
            data=body,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib_request.urlopen(req, timeout=80) as response:
            data = json.loads(response.read().decode("utf-8"))["data"]
        return str(screenshot_path), data

    def search_target(name: str, selection: str) -> None:
        script = [
            f'tell application "{automation._app_name()}" to activate',
            "delay 0.2",
            f"set the clipboard to {_applescript_string(name)}",
            'tell application "System Events"',
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
        automation._run_script(script, description=f"search {name} {selection}", timeout=15)
        automation._pause(1.2)

    automation._open_contact(SimpleNamespace(name=args.other, kind="contact"))
    other_screenshot, other_data = read_current()

    search_target(args.target, "enter")
    enter_screenshot, enter_data = read_current()

    final_screenshot, final_data = enter_screenshot, enter_data
    normalized_enter = str(enter_data.get("sourceName") or "").replace(" ", "")
    normalized_target = args.target.replace(" ", "")
    if normalized_enter != normalized_target:
        search_target(args.target, "down-enter")
        final_screenshot, final_data = read_current()

    print(
        json.dumps(
            {
                "other": {
                    "screenshot": other_screenshot,
                    "sourceName": other_data.get("sourceName"),
                },
                "afterEnter": {
                    "screenshot": enter_screenshot,
                    "sourceName": enter_data.get("sourceName"),
                },
                "final": {
                    "screenshot": final_screenshot,
                    "sourceName": final_data.get("sourceName"),
                },
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
