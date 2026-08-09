import test from "node:test";
import assert from "node:assert/strict";
import {
  isClaimable,
  needsVisualEvidence,
  parseCliArgs,
  parseDependencies,
  parseMarkdownSection,
  parseOwnedPaths,
  slugifyTitle,
} from "./lib.mjs";

const issueBody = `## 目标

完成契约。

## 前置依赖

- #13
- #16

## Owned paths

- packages/shared/src/domain-packages/**
- \`tests/domain-packages.test.ts\`

## 验收标准

- 可加载。
`;

test("解析 Markdown 协作字段", () => {
  assert.equal(parseMarkdownSection(issueBody, "前置依赖"), "- #13\n- #16");
  assert.deepEqual(parseDependencies(issueBody), [13, 16]);
  assert.deepEqual(parseOwnedPaths(issueBody), [
    "packages/shared/src/domain-packages/**",
    "tests/domain-packages.test.ts",
  ]);
});

test("根据实时依赖和标签判断任务是否可认领", () => {
  const issue = {
    state: "OPEN",
    body: issueBody,
    labels: ["kind:task", "status:ready"],
    assignees: [],
  };
  assert.equal(isClaimable(issue, new Map([[13, "CLOSED"], [16, "CLOSED"]])), true);
  assert.equal(isClaimable(issue, new Map([[13, "CLOSED"], [16, "OPEN"]])), false);
  assert.equal(isClaimable({ ...issue, body: "## 前置依赖\n\n无" }, new Map()), false);
});

test("生成稳定分支后缀并识别视觉证据要求", () => {
  assert.equal(slugifyTitle("定义领域包 manifest、版本和迁移契约"), "manifest");
  assert.equal(slugifyTitle("只有中文"), "task");
  assert.equal(needsVisualEvidence(["area:3d"], ["area:react-ui", "area:3d"]), true);
});

test("解析命令行位置参数、布尔项和值", () => {
  assert.deepEqual(parseCliArgs(["17", "--dry-run", "--base", "main", "--mobile=无影响"]), {
    positionals: ["17"],
    options: { "dry-run": true, base: "main", mobile: "无影响" },
  });
});
