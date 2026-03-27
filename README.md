# myclaw

企业级超级数字员工项目，当前包含两个前端入口：

- `fe/`: 管理后台，基于 Vite 8 + React + TypeScript
- `desktop/`: Electron 桌面执行端，提供设备指挥、任务队列、AI/RAG、工作流与矩阵运营控制台

## Desktop

桌面端采用 Electron 初始化，当前版本内置本地模拟编排层，方便后续对接：

- PHP / REST API 后端
- Python RPA 执行引擎
- 多模型 AI 服务
- 远程任务队列与设备心跳

启动方式：

```bash
cd desktop
npm install
npm run dev
```
