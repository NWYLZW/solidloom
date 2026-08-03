# SolidLoom

本地优先、面向人类与 Agent 的可编程三维建模工作台。目前仓库提供项目骨架、模型元数据与特征存储、Web 编辑器、Node.js API、CLI，以及由同一份 capability registry 生成的 Agent 文档。

项目不包含 MCP，也不会依赖仓库内 Skill 才能被 Agent 使用。Agent 从本地服务的 `/llms.txt`、`/capabilities.json`、路径级 `/skill.md` 或 CLI 的 `--llms` 逐步发现能力。

## 本地启动

要求 Node.js 22.13 或更高版本。

```bash
npm install
npm run dev
```

- Web：<http://127.0.0.1:4311>
- API：<http://127.0.0.1:4310>
- OpenAPI：<http://127.0.0.1:4310/docs>
- Agent 入口：<http://127.0.0.1:4310/llms.txt>

## CLI

```bash
npm run cli -- --help
npm run cli -- --llms
npm run cli -- models list
npm run cli -- models create --name "Desk hook"
```

安装或链接 `@solidloom/cli` 后，也可以直接使用 `solidloom` 命令。

## 项目结构

```text
apps/
  web/          React + TypeScript + Vite 工作台
  server/       Node.js + Fastify 本地 API
  cli/          人类和 Agent 共用的命令行客户端
packages/
  shared/       类型、JSON Schema、capability registry、文档生成器
  cad-engine/   CAD 引擎适配边界与基础特征检查
```

SQLite 数据默认写入 `data/solidloom.db`。第一阶段只建立参数化特征图和 CAD 引擎适配边界；真实 B-Rep 求值、布尔运算和 STL/STEP 导出会在后续阶段接入。
