#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
  dependenciesSatisfied,
  isClaimable,
  needsVisualEvidence,
  normalizeIssueNode,
  parseCliArgs,
  parseDependencies,
  parseOwnedPaths,
  slugifyTitle,
  statusLabel,
} from "./lib.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(readFileSync(new URL("../../.ai/collaboration/config.json", import.meta.url), "utf8"));

function run(program, args, { allowFailure = false, inherit = false, shell = false } = {}) {
  const result = spawnSync(program, args, {
    cwd: root,
    encoding: "utf8",
    shell,
    stdio: inherit ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    throw new Error(`${program} 执行失败${detail ? `：\n${detail}` : ""}`);
  }
  return result;
}

function output(program, args) {
  return run(program, args).stdout.trim();
}

function ghJson(args) {
  const value = output("gh", args);
  return value ? JSON.parse(value) : null;
}

function gitStatus(args) {
  return run("git", args, { allowFailure: true }).status;
}

function optionValue(options, name, fallback) {
  const value = options[name];
  return typeof value === "string" ? value : fallback;
}

function issueNumber(positionals) {
  const number = Number(positionals[0]);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error("请提供有效的叶子 Issue 编号，例如：npm run collab:claim -- 17");
  }
  return number;
}

function repositoryContext() {
  const repository = ghJson(["repo", "view", "--json", "nameWithOwner,defaultBranchRef,url"]);
  const [owner, name] = repository.nameWithOwner.split("/");
  return {
    ...repository,
    owner,
    name,
    defaultBranch: repository.defaultBranchRef.name,
  };
}

function viewIssue(number) {
  return normalizeIssueNode(ghJson([
    "issue",
    "view",
    String(number),
    "--json",
    "number,title,state,body,url,labels,assignees",
  ]));
}

function querySubIssues(repository, number) {
  const query = `
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          subIssues(first: 100) {
            nodes {
              number
              title
              state
              body
              url
              labels(first: 50) { nodes { name } }
              assignees(first: 20) { nodes { login } }
            }
          }
        }
      }
    }
  `;
  const response = ghJson([
    "api",
    "graphql",
    "-f",
    `query=${query}`,
    "-F",
    `owner=${repository.owner}`,
    "-F",
    `name=${repository.name}`,
    "-F",
    `number=${number}`,
  ]);
  return (response.data.repository.issue?.subIssues.nodes ?? []).map(normalizeIssueNode);
}

function allIssueStates() {
  const issues = ghJson([
    "issue",
    "list",
    "--state",
    "all",
    "--limit",
    "500",
    "--json",
    "number,state,title",
  ]);
  return new Map(issues.map((issue) => [issue.number, issue.state]));
}

function currentLogin() {
  return output("gh", ["api", "user", "--jq", ".login"]);
}

function currentBranch() {
  return output("git", ["branch", "--show-current"]);
}

function trackedWorktreeChanges() {
  return output("git", ["status", "--porcelain", "--untracked-files=no"]);
}

function branchForIssue(issue) {
  return `${config.branchPrefix}${issue.number}-${slugifyTitle(issue.title)}`;
}

function dependencySummary(issue, issueStates) {
  const dependencies = parseDependencies(issue.body);
  if (dependencies.length === 0) return "无";
  return dependencies
    .map((number) => `#${number} ${issueStates.get(number) === "CLOSED" ? "已完成" : "未完成"}`)
    .join("、");
}

function assertClaimable(issue, issueStates) {
  if (issue.state !== "OPEN") throw new Error(`#${issue.number} 已关闭，不能认领。`);
  if (!issue.labels.includes("kind:task")) throw new Error(`#${issue.number} 不是叶子任务（缺少 kind:task）。`);
  if (!issue.labels.includes("status:ready")) throw new Error(`#${issue.number} 当前是 ${statusLabel(issue.labels)}，不能认领。`);
  if (issue.assignees.length > 0) throw new Error(`#${issue.number} 已由 ${issue.assignees.join("、")} 认领。`);
  const dependencies = parseDependencies(issue.body);
  if (!dependenciesSatisfied(dependencies, issueStates)) {
    throw new Error(`#${issue.number} 仍有未完成依赖：${dependencySummary(issue, issueStates)}`);
  }
  const ownedPaths = parseOwnedPaths(issue.body);
  if (ownedPaths.length === 0) throw new Error(`#${issue.number} 没有声明 Owned paths，先完善 Issue 再认领。`);
}

async function showStatus(options) {
  const repository = repositoryContext();
  const epicNumber = Number(optionValue(options, "epic", config.epicIssue));
  const epic = viewIssue(epicNumber);
  const topLevel = querySubIssues(repository, epicNumber);
  const tracks = [];
  const directTasks = [];

  for (const item of topLevel) {
    if (item.labels.includes("kind:track")) {
      tracks.push({ issue: item, tasks: querySubIssues(repository, item.number) });
    } else if (item.labels.includes("kind:task")) {
      directTasks.push(item);
    }
  }

  if (directTasks.length > 0) {
    tracks.push({ issue: { number: epic.number, title: "总计划直属任务", url: epic.url }, tasks: directTasks });
  }

  const issueStates = allIssueStates();
  const tasks = tracks.flatMap((track) => track.tasks.map((issue) => ({
    ...issue,
    track: { number: track.issue.number, title: track.issue.title, url: track.issue.url },
    dependencies: parseDependencies(issue.body),
    ownedPaths: parseOwnedPaths(issue.body),
    claimable: isClaimable(issue, issueStates),
  })));
  const result = {
    repository: repository.nameWithOwner,
    baseBranch: optionValue(options, "base", config.baseBranch || repository.defaultBranch),
    epic: { number: epic.number, title: epic.title, url: epic.url },
    summary: {
      claimable: tasks.filter((task) => task.claimable).length,
      claimed: tasks.filter((task) => task.labels.includes("status:claimed")).length,
      review: tasks.filter((task) => task.labels.includes("status:review")).length,
      blocked: tasks.filter((task) => task.labels.includes("status:blocked")).length,
    },
    tasks,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n协作总计划：#${epic.number} ${epic.title}`);
  console.log(`${epic.url}`);
  console.log(`集成基线：${result.baseBranch}`);
  console.log(`可认领 ${result.summary.claimable} · 进行中 ${result.summary.claimed} · 待审查 ${result.summary.review} · 阻塞 ${result.summary.blocked}\n`);

  const claimable = tasks.filter((task) => task.claimable);
  console.log("可认领叶子任务");
  if (claimable.length === 0) console.log("  当前没有满足依赖且无人认领的 ready 任务。");
  for (const task of claimable) {
    console.log(`  #${task.number} ${task.title}`);
    console.log(`    工作流 #${task.track.number} · 依赖 ${dependencySummary(task, issueStates)}`);
    console.log(`    npm run collab:claim -- ${task.number}`);
  }

  const active = tasks.filter((task) => task.labels.includes("status:claimed") || task.labels.includes("status:review"));
  console.log("\n在途任务");
  if (active.length === 0) console.log("  无。 ");
  for (const task of active) {
    console.log(`  #${task.number} ${statusLabel(task.labels)} · ${task.title} · ${task.assignees.join("、") || "未分配"}`);
  }
  console.log("");
}

function rollbackClaim(number, login) {
  run("gh", [
    "issue", "edit", String(number),
    "--remove-assignee", login,
    "--remove-label", "status:claimed",
    "--add-label", "status:ready",
  ], { allowFailure: true });
}

async function claimIssue(positionals, options) {
  const number = issueNumber(positionals);
  const repository = repositoryContext();
  const issue = viewIssue(number);
  const issueStates = allIssueStates();
  assertClaimable(issue, issueStates);

  const baseBranch = optionValue(options, "base", process.env.COLLAB_BASE_BRANCH || config.baseBranch || repository.defaultBranch);
  const branch = optionValue(options, "branch", branchForIssue(issue));
  const ownedPaths = parseOwnedPaths(issue.body);

  console.log(`\n准备认领 #${issue.number} ${issue.title}`);
  console.log(`分支：${branch}（基于 ${baseBranch}）`);
  console.log(`依赖：${dependencySummary(issue, issueStates)}`);
  console.log("Owned paths：");
  for (const path of ownedPaths) console.log(`  - ${path}`);

  if (options["dry-run"]) {
    console.log("\n仅预演：未修改 Issue、分支或远端。\n");
    return;
  }

  if (trackedWorktreeChanges()) {
    throw new Error("当前存在未提交的已跟踪文件修改。请先提交或处理后再认领，未跟踪文件不会阻止认领。");
  }
  run("git", ["fetch", "origin", baseBranch]);
  if (gitStatus(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]) === 0) {
    throw new Error(`本地分支 ${branch} 已存在，请用 --branch 指定新分支或先处理旧分支。`);
  }
  if (output("git", ["ls-remote", "--heads", "origin", branch])) {
    throw new Error(`远端分支 ${branch} 已存在，任务可能已被其他机器认领。`);
  }

  const latest = viewIssue(number);
  assertClaimable(latest, allIssueStates());
  const login = currentLogin();
  run("gh", [
    "issue", "edit", String(number),
    "--add-assignee", login,
    "--remove-label", "status:ready",
    "--add-label", "status:claimed",
  ], { inherit: true });

  const claimed = viewIssue(number);
  if (claimed.assignees.length !== 1 || claimed.assignees[0] !== login) {
    rollbackClaim(number, login);
    throw new Error(`认领发生竞争，当前 Assignee 为：${claimed.assignees.join("、") || "无"}。已撤销本机认领。`);
  }

  try {
    run("git", ["switch", "-c", branch, `origin/${baseBranch}`], { inherit: true });
    run("git", ["push", "-u", "origin", branch], { inherit: true });
  } catch (error) {
    rollbackClaim(number, login);
    throw error;
  }

  const comment = [
    `@${login} 已通过仓库协作命令认领。`,
    "",
    `- 分支：\`${branch}\``,
    `- 集成基线：\`${baseBranch}\``,
    `- 前置依赖：${dependencySummary(issue, issueStates)}`,
    "- Owned paths：",
    ...ownedPaths.map((path) => `  - \`${path}\``),
    "- 交付：一个主要实现会话、一个 PR，并按 Issue 验收与验证要求提交证据。",
  ].join("\n");
  run("gh", ["issue", "comment", String(number), "--body", comment], { inherit: true });
  console.log(`\n认领完成：${issue.url}\n`);
}

function runVerificationCommands(commands) {
  for (const command of commands) {
    console.log(`\n[验证] ${command}`);
    const result = run(command, [], { shell: true, inherit: true, allowFailure: true });
    if (result.status !== 0) throw new Error(`验证失败：${command}`);
  }
}

function findOrCreatePullRequest(issue, branch, baseBranch, summary, checks, evidence, mobile) {
  const pulls = ghJson([
    "pr", "list", "--state", "open", "--head", branch,
    "--json", "number,url,title,body,baseRefName,headRefName",
  ]);
  const verification = checks.map((command) => `- [x] \`${command}\``).join("\n");
  const body = [
    "## 交付摘要",
    "",
    summary,
    "",
    "## 验证",
    "",
    verification,
    "",
    "## 视觉证据",
    "",
    evidence || "不涉及可见界面、交互或模型变化。",
    "",
    "## 移动端影响",
    "",
    mobile,
    "",
    `Closes #${issue.number}`,
  ].join("\n");

  if (pulls.length === 0) {
    const url = output("gh", [
      "pr", "create",
      "--base", baseBranch,
      "--head", branch,
      "--title", `#${issue.number} ${issue.title}`,
      "--body", body,
    ]);
    return ghJson(["pr", "view", url, "--json", "number,url,title,body,baseRefName,headRefName"]);
  }

  const pull = pulls[0];
  if (pull.baseRefName !== baseBranch) {
    throw new Error(`现有 PR #${pull.number} 的 base 是 ${pull.baseRefName}，与协作基线 ${baseBranch} 不一致。`);
  }
  const closingPattern = new RegExp(`(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s+#${issue.number}\\b`, "i");
  if (!closingPattern.test(pull.body ?? "")) {
    run("gh", ["pr", "edit", String(pull.number), "--body", `${pull.body ?? ""}\n\nCloses #${issue.number}`]);
  }
  return pull;
}

async function handoffIssue(positionals, options) {
  const number = issueNumber(positionals);
  const repository = repositoryContext();
  const issue = viewIssue(number);
  const login = currentLogin();
  const branch = currentBranch();
  const baseBranch = optionValue(options, "base", process.env.COLLAB_BASE_BRANCH || config.baseBranch || repository.defaultBranch);
  const summary = optionValue(options, "summary", `完成 #${issue.number} 的实现与验证。`);
  const evidence = optionValue(options, "evidence", "");
  const mobile = optionValue(options, "mobile", "");
  const visualRequired = needsVisualEvidence(issue.labels, config.visualEvidenceLabels);
  const skipChecks = Boolean(options["skip-checks"]);
  const skipReason = optionValue(options, "skip-reason", "");

  if (issue.state !== "OPEN") throw new Error(`#${issue.number} 已关闭，不能交付。`);
  if (!issue.labels.includes("kind:task")) throw new Error(`#${issue.number} 不是叶子任务。`);
  if (!issue.labels.includes("status:claimed")) throw new Error(`#${issue.number} 当前是 ${statusLabel(issue.labels)}，不是 claimed。`);
  if (!issue.assignees.includes(login)) throw new Error(`#${issue.number} 未分配给当前账号 ${login}。`);
  if (!branch.startsWith(`${config.branchPrefix}${issue.number}-`)) {
    throw new Error(`当前分支 ${branch} 与 Issue #${issue.number} 不匹配。`);
  }
  if (visualRequired && !evidence) {
    throw new Error("该任务影响 UI、3D 或模型，请用 --evidence 提供 PR 附件、截图 URL 或仓库内证据路径。 ");
  }
  if (!mobile) {
    throw new Error("请用 --mobile 说明移动端影响；没有影响时可写“无移动端影响”。");
  }
  if (skipChecks && !skipReason) {
    throw new Error("跳过自动验证时必须使用 --skip-reason 记录原因。 ");
  }

  const checks = skipChecks
    ? [`跳过自动验证：${skipReason}`]
    : config.verificationCommands;
  console.log(`\n准备交付 #${issue.number} ${issue.title}`);
  console.log(`分支：${branch} → ${baseBranch}`);
  console.log(`验证：${checks.join("、")}`);
  console.log(`视觉证据：${evidence || "不要求"}`);
  console.log(`移动端：${mobile}`);

  if (options["dry-run"]) {
    console.log("\n仅预演：未执行验证、推送、PR 或 Issue 更新。\n");
    return;
  }
  if (trackedWorktreeChanges()) {
    throw new Error("当前存在未提交的已跟踪文件修改，请先提交后再交付；未跟踪文件不会阻止交付。 ");
  }
  if (!skipChecks) runVerificationCommands(config.verificationCommands);
  run("git", ["push", "-u", "origin", branch], { inherit: true });
  const pull = findOrCreatePullRequest(issue, branch, baseBranch, summary, checks, evidence, mobile);
  const comment = [
    `@${login} 已提交交付，进入审查。`,
    "",
    `- PR：${pull.url}`,
    `- 摘要：${summary}`,
    "- 验证：",
    ...checks.map((command) => `  - ${command}`),
    `- 视觉证据：${evidence || "不涉及可见变化"}`,
    `- 移动端影响：${mobile}`,
  ].join("\n");
  run("gh", ["issue", "comment", String(number), "--body", comment], { inherit: true });
  run("gh", [
    "issue", "edit", String(number),
    "--remove-label", "status:claimed",
    "--add-label", "status:review",
  ], { inherit: true });
  console.log(`\n交付完成：${pull.url}\n`);
}

function printHelp() {
  console.log(`
SolidLoom GitHub 协作命令

  npm run collab:status -- [--epic 2] [--json]
  npm run collab:claim -- <issue> [--dry-run] [--base main] [--branch codex/issue-...]
  npm run collab:handoff -- <issue> --mobile "无移动端影响" [--evidence <url-or-path>]

状态与任务事实来自 GitHub Issue；稳定协作规则来自 AGENTS.md 和 .ai/collaboration/README.md。
`);
}

const [command = "help", ...argv] = process.argv.slice(2);
const { positionals, options } = parseCliArgs(argv);

try {
  if (command === "status") await showStatus(options);
  else if (command === "claim") await claimIssue(positionals, options);
  else if (command === "handoff") await handoffIssue(positionals, options);
  else printHelp();
} catch (error) {
  console.error(`\n协作命令失败：${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
