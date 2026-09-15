## MODIFIED Requirements

### Requirement: CLI 在但 opsx 技能缺失时非阻断提示
openspec CLI 已安装但 opsx 技能缺失时，安装器必须（SHALL）给出非阻断提示。技能存在性判定必须（SHALL）按本次安装选择的宿主集合确定检测路径：claude 宿主检测 `~/.claude` 侧技能，codex 宿主检测 `~/.codex/prompts/` 下的 opsx 自定义 prompt（opsx-explore/opsx-propose/opsx-apply/opsx-archive 任一存在即可），both 宿主任一侧齐备即视为满足。多宿主检测缺失时提示内容必须（SHALL）指明缺失的宿主侧与对应安装途径。宿主集合的确定时序：默认动作与 menu 入口双侧都检测并按缺侧提示；init 入口在宿主选择步骤之后补检所选宿主侧（preflight 主检测仍在主流程前，宿主化补检不改变非阻断语义）。

#### Scenario: 仅选 codex 宿主且 codex 侧无 opsx prompt
- **WHEN** 用户在仅装 openspec CLI、无 opsx 技能与 opsx prompt 的机器上选择仅 codex 宿主运行 init
- **THEN** 安装器提示"codex 宿主缺少 opsx 编排 prompt"并给出安装途径（如 openspec init 对应的 codex 侧初始化说明），不阻断本次 codex 宿主安装

#### Scenario: both 宿主单侧齐备
- **WHEN** claude 侧 opsx 技能齐备而 codex 侧无 opsx prompt，用户选择 both 宿主
- **THEN** 提示仅针对 codex 侧缺失，claude 侧不重复提示
