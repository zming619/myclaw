from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict


def _slug(value: str) -> str:
    return (
        value.replace("/", "-")
        .replace(" ", "-")
        .replace("·", "-")
        .replace("号", "hao")
        .replace("站", "zhan")
    )


def platform_url(platform: str, action: str) -> str:
    mapping = {
        "抖音": "https://www.douyin.com/",
        "快手": "https://www.kuaishou.com/",
        "小红书": "https://www.xiaohongshu.com/",
        "B站": "https://www.bilibili.com/",
        "视频号": "https://channels.weixin.qq.com/",
    }

    if action == "publish_video" and platform == "B站":
        return "https://member.bilibili.com/"

    return mapping.get(platform, "https://www.douyin.com/")


def run_playwright_action(task_id: str, platform: str, action: str, mode: str) -> Dict[str, Any]:
    from playwright.sync_api import sync_playwright

    runtime_root = Path(__file__).resolve().parent.parent / ".runtime"
    profile_dir = runtime_root / "profiles" / _slug(platform)
    artifact_dir = runtime_root / "artifacts" / task_id
    profile_dir.mkdir(parents=True, exist_ok=True)
    artifact_dir.mkdir(parents=True, exist_ok=True)

    target_url = platform_url(platform, action)
    screenshot_path = artifact_dir / f"{_slug(platform)}-{action}.png"
    headless = os.getenv("MYCLAW_RPA_HEADLESS") == "1"

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=headless,
            viewport={"width": 1440, "height": 900},
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(target_url, wait_until="domcontentloaded")
        page.wait_for_timeout(800)
        page.screenshot(path=str(screenshot_path), full_page=False)
        context.close()

    return {
        "summary": f"已使用 Playwright 打开 {platform} 页面并接管 {action} 动作",
        "driver": "playwright",
        "mode": mode,
        "targetUrl": target_url,
        "screenshot": str(screenshot_path),
        "profileDir": str(profile_dir),
    }
