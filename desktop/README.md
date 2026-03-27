# MyClaw Desktop

Electron 桌面端，面向“设备在线执行 + 远程任务下发 + AI/RAG + 工作流编排”的执行场景。

## 当前架构

- `src/electron/main`: Electron 主进程、任务队列、设备心跳、本地网关、Python RPA Bridge
- `src/renderer`: 星云指挥台、任务中心、AI/RAG 对话、设备管理
- `rpa/nebula_rpa`: Python SOP 引擎，负责把群发、获客、矩阵分发、私域激活等动作编排成标准执行链路

## 已实现

- 星云指挥台总览
- 多设备在线状态与心跳监控
- 远程文本 / JSON 指令下发与自动轮询
- Electron 调用 Python CLI 执行 SOP
- AI 对话与 RAG 知识检索
- AI 员工工作流开关
- 全平台矩阵运营视图

## 运行

```bash
npm install
npm run dev
```

## Python RPA 巡检

```bash
cd rpa
python3.12 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/python -m playwright install chromium
.venv/bin/python -m nebula_rpa.cli doctor
```

桌面端运行后，会把本地心跳和任务结果写入 Electron `userData` 目录下的 `runtime-gateway/`。当前版本已经是“Electron 客户端 + Python SOP 引擎”联动版；真实平台自动化和后台上报接口仍预留在主进程与 Python 适配层中。

## macOS 微信自动化

- 当前已优先接入 mac 微信前台 UI Automation，支持激活微信、校验登录态、按联系人搜索并发送消息。
- 桌面端“设备管理”页现在会展示 Python RPA / mac 微信巡检状态，并支持手动“重新巡检”。
- 首次使用前，需要在“系统设置 -> 隐私与安全性”里给 Terminal 或桌面客户端授权“辅助功能”和“自动化”。
- 群发、SOP 推送、主动激活这三类微信模板建议先用 `dryRun: true` 校验联系人和文案，再改成 `false` 正式执行。
- 自动回复守护现在会写入守护配置，并可基于“显示下一个未读会话”菜单按兜底话术逐个处理未读会话；当前还没有正文解析，所以关键词命中仍是下一阶段能力。
- 朋友圈发布当前是 hybrid 模式：会切到朋友圈、生成草稿并把文案写入剪贴板，但仍需要人工最后确认发布。
- 好友标签管理当前是 hybrid 模式：会写入本地标签台账，并可逐个定位联系人供人工确认，还不是 WeChat 内原生标签的全自动点击流。
