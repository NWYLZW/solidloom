# SolidLoom 多机协作协议

这套协议解决的不是“把更多背景塞进提示词”，而是让仓库能够说明自己。稳定规则写在 `AGENTS.md`，产品需求写在 `.ai/specs/**`，本轮入口写在 `config.json`，任务状态、依赖、Owned paths 和验收标准以 GitHub Issue 的实时内容为准。

## 信息来源

按以下顺序读取，越靠前越接近当前修改范围：

1. 当前目录及父目录适用的 `AGENTS.md`。
2. 已认领的叶子 Issue、父工作流 Issue 和总 Issue。
3. Issue 链接的 `.ai/specs/**`。
4. 当前分支和 PR 的差异、评论与检查结果。

聊天提示词不是任务事实来源。它不应重复 Issue 编号候选、当前分支、Owned paths、前置依赖、验收清单或产品历史；这些内容会变化，复制后必然过期。

## 标准流程

### 1. 查看实时状态

```bash
npm run collab:status
```

命令从 `config.json` 指定的总 Issue 开始，读取原生子 Issue、标签、Assignee 和依赖状态，只把满足以下条件的任务列为“可认领”：

- Issue 仍为 Open。
- 是 `kind:task` 叶子任务。
- 带有 `status:ready`。
- 没有 Assignee。
- “前置依赖”章节中的 Issue 已全部关闭。

机器可用 `npm run collab:status -- --json` 获得结构化结果。

### 2. 原子化认领

```bash
npm run collab:claim -- 17
```

认领命令会在写入前重新检查任务，避免仅凭旧提示词开工。成功后它会：

1. 把当前 GitHub 账号设为唯一 Assignee。
2. 将 `status:ready` 改为 `status:claimed`。
3. 从本轮集成基线创建 `codex/issue-<number>-<slug>` 分支。
4. 推送分支，并把分支、基线、依赖和 Owned paths 评论到 Issue。

先用下面的命令查看计划而不产生修改：

```bash
npm run collab:claim -- 17 --dry-run
```

若本轮需要临时集成分支，只改 `config.json` 的 `baseBranch`；也可单次传入 `--base <branch>`。不要把临时分支写进给其他机器的提示词。

### 3. 实现

- 只修改 Issue 的 Owned paths；共享文件或范围外修改必须先评论说明。
- 按路径级 `AGENTS.md` 复用组件、样式和契约。
- 未完成能力继续标记 `planned`。
- 一个叶子 Issue 对应一个主要实现会话和一个 PR。
- UI、交互和模型任务在真实系统入口中验证，不以独立 `preview.html` 代替接入验收。

### 4. 交付审查

```bash
npm run collab:handoff -- 17 \
  --mobile "无移动端影响" \
  --evidence "https://github.com/.../screenshot"
```

命令默认执行 `config.json` 中的验证命令，推送当前分支，查找或创建 PR，写入 `Closes #17`，评论交付证据，并将 Issue 从 `status:claimed` 改为 `status:review`。它不会关闭 Issue，也不会绕过最终验收。

只有确有外部阻塞时才可使用 `--skip-checks --skip-reason "..."`；跳过原因会进入交付记录。所有任务都必须用 `--mobile` 明确移动端影响；带 `area:react-ui`、`area:3d` 或 `area:model` 的任务必须提供 `--evidence`。

## 给另一台电脑的最小提示词

```text
在仓库根目录工作。先完整阅读当前路径适用的 AGENTS.md，然后运行 npm run collab:status。只从命令输出的可认领叶子任务中自行选择一个，执行 npm run collab:claim -- <issue>，再严格按该 Issue 的 Owned paths、依赖、验收标准和链接规格实现。完成后提交代码，并用 npm run collab:handoff -- <issue> 交付；遇到冲突或范围不足时在 Issue 说明，不要从这段提示词推断任务事实。
```

这段提示词长期不携带具体任务状态。本轮换 Epic、换集成分支、增加并行任务或调整依赖时，只更新 GitHub 与 `config.json`。

## 配置边界

`config.json` 只保存本轮协作入口：

- `epicIssue`：总 Issue。
- `baseBranch`：本轮 PR 的集成基线，不代表长期 develop 分支。
- `branchPrefix`：任务分支前缀。
- `verificationCommands`：交付前统一执行的验证。
- `visualEvidenceLabels`：必须附视觉证据的任务区域。

产品需求、任务细节、Owned paths 和完成状态不得放入该配置。
