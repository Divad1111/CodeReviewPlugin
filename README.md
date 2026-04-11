# SVN Audit Assistant (SVN 增量代码审计助手)

[English](#english) | [中文](#chinese)

---

<h2 id="english">English</h2>
## English

**SVN Audit Assistant** is a VS Code extension designed for SVN developers to simplify the incremental code review process. It aggregates code changes by author and time period, providing line-level comments, AI-assisted reviews, and automated report exports to help teams efficiently control code quality.

### ✨ Key Features
*   **📂 Audit Session Management**: Create audit sessions based on SVN URLs, specific developers, and time ranges. All data is stored in a local SQLite database.
*   **🔍 Incremental Diff & Annotation**: One-click internal Diff view with line-level comments (via `Enter` key).
*   **🤖 AI-Powered Review**: Built-in support for DeepSeek, OpenAI, Claude, Gemini, Kimi, GLM, etc. AI can automatically analyze code and generate work summaries.
*   **📊 Report Export**: Export audit results for the entire session or specific individuals to standard Markdown documents.

### 🚀 Quick Start
1.  **Config**: Click the **SVN Audit** icon -> **Settings**. Configure SVN credentials and AI Engine.
2.  **Create Session**: Click **+ (New Review Session)**. Enter SVN URL, authors, and time range.
3.  **Audit**: Expand the session, select a file, and press `Enter` to add a comment in the Diff view.
4.  **Export**: Click the **Export** button next to a session or person to save the report.

### 🖥️ Server Mode & Deployment
If you want team members to share data (sessions/comments/summaries), deploy the backend server in the `server/` directory and configure the extension to use server mode.

#### Option A: One-click Script Deployment
- **macOS**
```bash
cd server/deploy
bash deploy-macos.sh
```
- **Linux**
```bash
cd server/deploy
bash deploy-linux.sh
```
- **Windows (CMD)**
```bat
cd server\deploy
deploy-windows.bat
```

The deploy scripts will:
- Check Node.js (18+) and MongoDB availability.
- Install dependencies and build TypeScript output.
- Create `.env` from `.env.example` if missing.
- Start server using `pm2` with process name `code-review-server`.

#### Option B: Docker Compose Deployment
```bash
cd server/deploy
docker compose up -d --build
```

This starts:
- `mongodb` on port `27017`
- `code-review-server` on port `3000`

#### Environment Variables (`server/.env`)
- `PORT=3000`
- `MONGODB_URI=mongodb://localhost:27017/code_review` (local mode)
- `JWT_SECRET=your-secret-key-change-this` (change in production)
- `JWT_EXPIRES_IN=7d`

#### Verify Server Status
- Health endpoint: `http://localhost:3000/api/health`
- PM2 status (script deploy): `pm2 status`
- Docker status (compose deploy): `docker compose ps`

#### Connect Extension to Server
Open extension settings and enable server mode, then set the server base URL (for example: `http://localhost:3000`).

---

<h2 id="chinese">中文</h2>
## 中文

**SVN Audit Assistant** 是一款专为 SVN 开发者设计的 VS Code 插件，旨在简化增量代码审查流程。它通过按人员和时间段聚合代码修改，提供行级批注、AI 辅助审查以及自动化报告导出功能，助力团队高效把控代码质量。

### ✨ 核心功能
*   **📂 审计会话管理 (Audit Sessions)**：按 SVN 地址、开发人员及时间范围创建会话。所有数据持久化存储在本地 SQLite 中。
*   **🔍 增量对比与批注**：内置 Diff 视图，支持在差异窗口直接通过 `Enter` 键添加行级批注。
*   **🤖 AI 智能辅助 (AI Power)**：支持 DeepSeek、OpenAI、Claude、Kimi 等主流模型。AI 可自动分析代码漏洞并生成工作总结。
*   **📊 报告导出**：支持将审计结果（含批注、修改点）一键导出为标准 Markdown 报表。

### 🚀 快速上手
1.  **基础配置**：点击侧边栏图标 -> **设置 (Settings)**，配置 SVN 账号及 AI 引擎。
2.  **创建会话**：点击标题栏的 **+** 按钮。输入 SVN 地址、人员列表及时间范围。
3.  **开始审计**：在侧边栏选中文件，点击打开 Diff 视图，按 `Enter` 键添加评论。
4.  **导出结果**：点击会话或人员旁的 **导出 (Export)** 按钮即可生成报告。

### 🖥️ 服务器模式与部署
如果你希望团队成员共享会话、评论和总结数据，可部署 `server/` 目录下的后端服务，并在插件中启用服务器模式。

#### 方案 A：脚本一键部署
- **macOS**
```bash
cd server/deploy
bash deploy-macos.sh
```
- **Linux**
```bash
cd server/deploy
bash deploy-linux.sh
```
- **Windows (CMD)**
```bat
cd server\deploy
deploy-windows.bat
```

脚本会自动完成：
- 检查 Node.js（18+）与 MongoDB 是否可用。
- 安装依赖并构建 TypeScript。
- 若不存在 `.env`，会从 `.env.example` 自动生成。
- 使用 `pm2` 启动服务，进程名为 `code-review-server`。

#### 方案 B：Docker Compose 部署
```bash
cd server/deploy
docker compose up -d --build
```

该方式会启动：
- `mongodb`（端口 `27017`）
- `code-review-server`（端口 `3000`）

#### 环境变量（`server/.env`）
- `PORT=3000`
- `MONGODB_URI=mongodb://localhost:27017/code_review`（本地模式）
- `JWT_SECRET=your-secret-key-change-this`（生产环境请务必修改）
- `JWT_EXPIRES_IN=7d`

#### 部署后验证
- 健康检查：`http://localhost:3000/api/health`
- PM2 状态（脚本部署）：`pm2 status`
- Docker 状态（Compose 部署）：`docker compose ps`

#### 插件连接服务端
在插件设置中启用服务器模式，并填写服务地址（例如 `http://localhost:3000`）。

---

## ⌨️ Shortcuts (快捷键)
*   **Enter**: Add/Edit comment in Diff View (在差异视图中添加/编辑评论)。

## 🌐 Multi-language Support
The extension UI language will automatically switch with the VS Code language setting.
插件界面语言将跟随 VS Code 语言设置自动切换。

---

> [!TIP]
> Enabling "Debug Mode" allows you to view detailed AI request payloads and bodies in the output window for easy debugging.
