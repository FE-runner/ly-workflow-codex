---
description: '按 opsx:archive 编排流程归档完成的 change，完成后 commit'
argument-hint: '[<change-name>]'
---

# Archive

按 `~/.codex/prompts/opsx-archive.md`（opsx archive 编排 prompt）定义的流程归档指定 change（`$ARGUMENTS` 未指定时按 opsx:archive 流程的默认规则确定目标）。

## 提交归档改动

归档会把 `openspec/changes/<change-name>/` 移动到 `openspec/changes/archive/`，并可能同步更新 `openspec/specs/`。提交涉及的全部文件：

```bash
git add -- openspec/
git commit -m "archive: <change-name>"
```

若无可提交内容或 `git commit` 失败，跳过提交，如实报告原始错误，不视为归档失败。
