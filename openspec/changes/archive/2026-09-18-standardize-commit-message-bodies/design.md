## Context

现有 `@lyx-commit` 模板只在阶段 4 写了“消息体：动机、实现要点、影响范围”，没有最低结构或自检；propose/apply/archive/review 修复等自动提交模板只规定 subject + trailer。项目已有 `commit-conventions` 规范承载 CC 前缀、trailer、审查对象定位与 index 隔离协议，因此本次应扩展该能力，而不是新增另一套提交规范。release/publish 目前依赖 `npm version` 的默认 commit，是唯一会绕过模板 message 的路径。

## Goals / Non-Goals

**Goals:**

- 让 `@lyx-commit` 成为 lyx 生成提交的正文规范来源。
- 让所有自动阶段提交复用该正文规范，并保留既有 trailer、定位协议和提交范围隔离协议。
- 让 release/publish 的版本提交不再依赖工具默认短 message。
- 用模板断言和 OpenSpec spec scenario 固定可审查行为。

**Non-Goals:**

- 不约束用户在终端直接执行的裸 `git commit`。
- 不约束 git 原生生成的 merge / revert / cherry-pick 默认 message；只约束模板显式写 message 的 lyx 提交。
- 不改变 Conventional Commits 前缀、`Change-Stage` / `Change-Name` trailer 的语义或定位方式。
- 不新增 commitlint/husky 类外部依赖，也不实现运行时提交信息校验器。
- 不改变 changelog 分组、SemVer 推导和 release/publish 分支流程。

## Decisions

### 1. 正文规范单一来源：`commit-conventions` + `@lyx-commit`

`commit-conventions` 定义可审查的行为契约，`@lyx-commit` 提供用户可执行的 message 生成规范与示例。其他 skill 模板只引用该规范并补充阶段重点，不复制完整规则。

理由：避免 10 个模板各写一套规则后漂移。替代方案是把完整正文规范复制到每个自动模板，可读性略好但维护成本高；本次不采用。

“lyx 生成提交”限定为 message 由 `@lyx-commit` 或 lyx skill 模板显式生成的提交，包括 change 生命周期提交、WIP、worktree `.gitignore`、init/release/changelog/publish。`git merge` / `git revert` / `git cherry-pick` 等由 git 直接生成的默认 message 不在范围内，避免为结构性提交强塞无意义正文。

### 2. 自动提交统一使用完整 message 文件

自动阶段提交应先生成完整 message，再通过 `git commit -F .git/COMMIT_EDITMSG` 提交；使用 `git commit --only` 隔离 index 时同样保留 `-F` 形式。message 结构固定为：

```text
<type>(<scope>): <subject>

- 动机：...
- 改动：...
- 影响：...

Change-Stage: <stage>
Change-Name: <change-name>
```

理由：`-m` 多段拼接容易在 shell 引号、换行和 trailer 空行上出错；完整 message 文件与 `@lyx-commit` 现有执行方式一致。替代方案是多个 `-m`，本次不采用。

中英文标签规则沿用 `@lyx-commit` 的语言判断：中文提交用 `- 动机：` / `- 改动：` / `- 影响：`，英文提交用 `- Motivation:` / `- Change:` / `- Impact:`。`--emoji` 保留为兼容扩展，默认自动阶段提交不带 emoji。

### 3. `npm version` 不再生成默认 commit

release/publish 需要版本提交时，改用 `npm version <level> --no-git-tag-version` 更新版本文件，随后按规范生成 message 并 commit，最后用 `git tag v<version>` 打 tag。若某路径原本由 CI 或 `npm version` 负责 tag，仍保持最终 tag 存在。

理由：`npm version` 默认 message 只有版本号，无法满足正文规范；虽然可传 `-m`，但多行正文转义脆弱。替代方案是继续用 `npm version` 并传自定义 message，本次不作为默认方案。

### 4. 阶段正文只补充阶段重点

基础三条 bullet 固定为动机、改动、影响；阶段模板追加自己的内容重点，例如 apply 写验证、review 修复写 Critical。理由：保证跨阶段一致性，同时不强迫每个阶段使用完全相同的长正文。

## Risks / Trade-offs

- [提交信息变长] → 限制为三条基础 bullet + 必要阶段说明，避免写成变更日志。
- [模板文本断言可能脆弱] → 测试只断言关键结构（正文标签、trailer、`-F` / `--no-git-tag-version`），不逐字锁定完整文案。
- [release/publish tag 时序变化] → 在模板中明确“更新版本文件 → 规范提交 → 打 tag”，保留现有发布产物和 tag 名称。
- [历史 commit 不受影响] → 新规范只约束后续 lyx 生成提交；审查定位继续兼容旧前缀。
