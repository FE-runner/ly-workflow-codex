## ADDED Requirements

### Requirement: 归档前验证结果写入 run-state
`@lyx-archive` 在执行测试、类型检查和构建后 SHALL 把每类命令、退出码和关键结果摘要写入 `run-state.md`，并记录 final testMode 来源。任一验证失败时 SHALL 写入失败证据且不移动 change；全部通过后 SHALL 把当前阶段更新为 archive-ready，再执行归档。

#### Scenario: testMode=off 的归档
- **WHEN** 最终测试模式为 off
- **THEN** run-state 明确记录测试已按策略跳过，同时记录 typecheck 和 build 的新鲜通过证据

#### Scenario: 完整验证成功
- **WHEN** 测试、类型检查和构建全部通过
- **THEN** run-state 记录命令、退出码和摘要，归档 commit 包含最终状态
