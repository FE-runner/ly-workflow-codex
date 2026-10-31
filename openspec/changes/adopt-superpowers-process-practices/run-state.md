# Run State

- Change: adopt-superpowers-process-practices
- Stage: propose
- Source branch: main
- Development branch: codex/superpowers-alignment
- Last good commit: dce2466
- Next safe action: review-plan after propose commit

## Task Evidence

- Planning artifacts created; implementation tasks not started.

## Review State

- Review rounds: 0
- Termination type: not-started

## Verification

- `openspec validate --changes adopt-superpowers-process-practices`: exit 0, 1/1 change valid

## Rulings

- Ruling: 使用独立 `templates/skill-references/` 源目录；理由：保持命令注册与单文件主模板假设；错误代价：安装器需新增 sidecar 复制逻辑。
- Ruling: run-state 受版本控制；理由：避免未跟踪运行文件触发全仓 dirty 例外；错误代价：各阶段 commit 需显式包含 run-state 变更。
