## ADDED Requirements

### Requirement: release / publish / changelog 提交使用增强正文

`/ly:release`、`/ly:publish` 与 `/ly:changelog` 中由命令生成的提交 SHALL 遵守 `commit-conventions` 的“非 change 生命周期 lyx 提交遵守正文规范但不追加 Change trailer”要求。版本 bump、changelog 更新与 publish 相关提交 SHALL 包含动机、改动、影响正文，SHALL NOT 使用只有版本号或只有单行说明的默认 message。

#### Scenario: release 版本 bump 使用规范正文
- **WHEN** `/ly:release` 需要创建版本 bump commit
- **THEN** 该 commit 包含版本变更动机、版本文件/变更日志改动与影响，而不是默认短 message

#### Scenario: publish 路径不绕过规范
- **WHEN** `/ly:publish` 计划通过 `npm version` 完成版本提交
- **THEN** 命令改用 `--no-git-tag-version` 后按规范手动提交再打 tag，或提供等价的完整 message，SHALL NOT 接受 npm 默认短 message

#### Scenario: changelog 提交不携带 Change trailer
- **WHEN** `@lyx-changelog` 更新日志后创建提交
- **THEN** commit message 包含正文，但不携带 `Change-Stage` / `Change-Name` trailer
