## REMOVED Requirements

### Requirement: proposal.md 声明复审的审查未修项

**Reason**: 复审机制整体移除（见 `review-findings-snapshot` 删除「追加式复审说明」）；`@lyx-archive` 不再消费该小节，保留声明只会产出无效内容。

**Migration**: `/ly:propose` 不再生成 `## 复审的审查未修项` 小节；需要记录"修复没站住"时，在新 change 中按常规处理该问题，由审查关卡重新产出 Warning。已存在于在途 change `proposal.md` 中的该小节在归档时被忽略。
