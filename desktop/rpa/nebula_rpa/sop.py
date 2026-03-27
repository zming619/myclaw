from __future__ import annotations

from dataclasses import replace
from typing import Iterable, List

from .models import ExecutionRequest, StepDefinition


def _spread_progress(steps: Iterable[StepDefinition]) -> List[StepDefinition]:
    step_list = list(steps)
    if not step_list:
        return []

    total = len(step_list)
    normalized: List[StepDefinition] = []
    for index, step in enumerate(step_list, start=1):
        progress = min(95, int(index / total * 90))
        normalized.append(replace(step, progress=max(8, progress)))
    return normalized


def build_sop(request: ExecutionRequest) -> List[StepDefinition]:
    template_id = request.template_id

    if template_id == "broadcast_message":
        return _spread_progress(
            [
                StepDefinition("wx-session", "检查微信登录态", "wechat", "ensure_session", "校验桌面端微信登录态", 0),
                StepDefinition("wx-segment", "筛选群发对象", "wechat", "segment_contacts", "按标签筛选群发对象", 0),
                StepDefinition("wx-broadcast", "执行群发", "wechat", "send_broadcast", "批量发送微信消息", 0),
            ]
        )

    if template_id == "auto_reply":
        return _spread_progress(
            [
                StepDefinition("reply-session", "校验微信窗口", "wechat", "ensure_session", "检查微信会话上下文", 0),
                StepDefinition("reply-guard", "启动自动回复守护", "wechat", "enable_guard", "加载 AI + 关键词 + 欢迎语", 0),
            ]
        )

    if template_id == "push_sop":
        return _spread_progress(
            [
                StepDefinition("sop-session", "校验微信登录态", "wechat", "ensure_session", "准备 SOP 推送环境", 0),
                StepDefinition("sop-segment", "筛选客户分组", "wechat", "segment_contacts", "按标签筛选客户", 0),
                StepDefinition("sop-push", "执行 SOP 推送", "wechat", "push_sop", "按节点分批推送内容", 0),
            ]
        )

    if template_id == "activate_customers":
        return _spread_progress(
            [
                StepDefinition("reactivate-session", "校验微信状态", "wechat", "ensure_session", "准备私域激活执行链路", 0),
                StepDefinition("reactivate-segment", "筛选沉默客户", "wechat", "segment_contacts", "定位沉默客户分组", 0),
                StepDefinition("reactivate-run", "执行激活计划", "wechat", "reactivate", "发送提醒、案例和促销内容", 0),
            ]
        )

    if template_id == "moments_campaign":
        return _spread_progress(
            [
                StepDefinition("moments-session", "校验微信环境", "wechat", "ensure_session", "准备朋友圈营销发布环境", 0),
                StepDefinition("moments-publish", "发布朋友圈", "wechat", "publish_moments", "发布素材并安排互动", 0),
            ]
        )

    if template_id == "tag_management":
        return _spread_progress(
            [
                StepDefinition("tag-session", "校验微信环境", "wechat", "ensure_session", "准备标签管理流程", 0),
                StepDefinition("tag-run", "执行标签管理", "wechat", "apply_tags", "批量识别好友并应用标签", 0),
            ]
        )

    if template_id == "publish_video":
        platforms = request.payload.get("platforms") or request.platforms or ["抖音", "快手", "小红书"]
        steps = [
            StepDefinition("video-validate", "检查视频素材", "content", "validate_assets", "检查标题、素材和封面", 0),
        ]
        for platform in platforms:
            steps.append(
                StepDefinition(
                    f"publish-{platform}",
                    f"{platform} 发布视频",
                    "content",
                    "publish_video",
                    f"向 {platform} 提交视频发布任务",
                    0,
                    {"platform": platform},
                )
            )
        return _spread_progress(steps)

    if template_id == "lead_capture":
        platforms = request.payload.get("platforms") or request.platforms or ["抖音", "快手", "小红书"]
        steps = []
        for platform in platforms:
            steps.append(
                StepDefinition(
                    f"leads-scan-{platform}",
                    f"{platform} 评论区扫描",
                    "public_leads",
                    "scan_comments",
                    f"扫描 {platform} 评论区关键词",
                    0,
                    {"platform": platform},
                )
            )
            steps.append(
                StepDefinition(
                    f"leads-engage-{platform}",
                    f"{platform} 线索建联",
                    "public_leads",
                    "engage_leads",
                    f"对 {platform} 命中线索执行评论 / 关注 / 私信",
                    0,
                    {"platform": platform},
                )
            )
        steps.extend(
            [
                StepDefinition("leads-qualify", "筛选高意向线索", "public_leads", "qualify_leads", "按关键词和权重筛选线索", 0),
                StepDefinition("leads-export", "回传 CRM 线索", "public_leads", "export_leads", "生成线索回传记录", 0),
            ]
        )
        return _spread_progress(steps)

    if template_id == "video_edit_batch":
        return _spread_progress(
            [
                StepDefinition("media-optimize", "视频批量处理", "media", "optimize_assets", "去水印、去字幕、超分处理", 0),
            ]
        )

    if template_id == "jianying_draft":
        return _spread_progress(
            [
                StepDefinition("draft-optimize", "准备素材", "media", "optimize_assets", "检查草稿素材与字幕模版", 0),
                StepDefinition("draft-generate", "生成剪映草稿", "media", "generate_draft", "生成待审核草稿", 0),
            ]
        )

    if template_id == "auto_exposure":
        platforms = request.payload.get("platforms") or ["抖音", "快手", "小红书"]
        steps = []
        for platform in platforms:
            steps.append(
                StepDefinition(
                    f"exposure-{platform}",
                    f"{platform} 自动曝光",
                    "content",
                    "auto_exposure",
                    f"在 {platform} 执行点赞、评论、关注和浏览动作",
                    0,
                    {"platform": platform},
                )
            )
        return _spread_progress(steps)

    if template_id == "device_status_query":
        return _spread_progress(
            [
                StepDefinition("device-status", "采集设备状态", "device", "status", "采集设备在线状态与队列负载", 0),
            ]
        )

    raise ValueError(f"Unsupported template: {template_id}")
