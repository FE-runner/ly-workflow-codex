## Purpose

定义 lyx 的宿主适配层与多宿主安装契约：安装器只依赖宿主注册表与适配器接口，宿主专属知识（路径、模板、配置字段、渲染规则）各自自包含，使新增宿主不必改动共享安装流程。

## ADDED Requirements

### Requirement: 宿主适配层与共享安装流程解耦

lyx 的安装、卸载与安装后校验 SHALL 经宿主注册表与适配器接口完成，共享流程 SHALL NOT 硬编码任何具体宿主的名称或路径。新增一个宿主 SHALL 只需新增该宿主自包含的定义并在注册表登记，SHALL NOT 要求修改共享安装流程的分支逻辑。

#### Scenario: 注册表新增宿主不改共享流程

- **WHEN** 向宿主注册表登记一个此前未支持的宿主
- **THEN** 共享安装流程无需新增宿主分支即可对该宿主完成模板渲染、安装与卸载

#### Scenario: 共享层不出现宿主专属路径

- **WHEN** 检查共享安装与配置读写模块
- **THEN** 其中不出现任何具体宿主的安装目录、角色词路径或配置文件名，这些取值全部来自对应宿主的适配器定义

### Requirement: 每宿主一个自包含配置文件

宿主作用域配置 SHALL 按宿主分别存放：codex 宿主为 `~/.codex/lyx/config.toml`，claude 宿主为 `~/.claude/lyx/config.toml`。每个文件 SHALL 自包含该宿主的通用信息（版本、语言、已安装工作流）、路径与宿主专属字段，SHALL NOT 依赖任何跨宿主的共享状态文件。lyx SHALL NOT 再把"已安装宿主集合"作为持久化字段维护；某宿主是否已安装 SHALL 由该宿主的配置文件是否存在判定。

#### Scenario: 两宿主并存互不覆盖

- **WHEN** 用户先后安装 codex 宿主与 claude 宿主
- **THEN** 两个宿主的配置文件分别位于各自目录，任一侧的写入不修改另一侧文件

#### Scenario: 配置文件即安装标记

- **WHEN** 某个宿主的配置文件不存在
- **THEN** lyx 将该宿主视为未安装，遍历宿主的运维命令不对其产出做任何处理

#### Scenario: 配置文件记录本宿主版本

- **WHEN** 用户分别在不同时间安装两个宿主
- **THEN** 每个配置文件记录自己那次安装的包版本，`lycx update` 可据此只刷新落后的宿主

### Requirement: 历史配置形态兼容读取

读取 codex 宿主配置时，lyx SHALL 兼容历史版本写入的宿主配置节名，按新版宿主字段语义解析其执行者与模型字段，SHALL NOT 因节名沿用旧形态而丢失用户既有配置。历史版本写入的"已安装宿主集合"字段 SHALL 被忽略，SHALL NOT 作为已安装判据，也 SHALL NOT 被写回新配置。

#### Scenario: 老配置升级后字段保留

- **WHEN** `~/.codex/lyx/config.toml` 中存在历史宿主机节，用户运行 `lycx init`
- **THEN** 该节内的执行者、模型与推理档取值被正确读取为默认值，并在重写后以新版字段语义保留，不出现静默清空

#### Scenario: 历史已安装集合字段不再生效

- **WHEN** 历史配置中记录的已安装宿主集合与磁盘上实际存在的宿主配置文件不一致
- **THEN** lyx 以磁盘上的配置文件为准，SHALL NOT 依据该历史字段推断宿主是否已安装

### Requirement: 宿主选择安装

`lycx init` 交互模式 SHALL 显式询问本次安装哪些宿主，并按磁盘上是否存在 `~/.codex` 与 `~/.claude` 给出默认勾选。非交互模式（`--skip-prompt`）SHALL 以磁盘上已存在的宿主配置文件集合为安装集合重装，SHALL NOT 因此新增必填参数。仅选择部分宿主时，SHALL NOT 改动未选择宿主的配置文件与产物。

#### Scenario: 按磁盘现状给出默认勾选

- **WHEN** 用户运行 `lycx init`，`~/.codex` 与 `~/.claude` 均存在
- **THEN** 宿主选择步骤默认勾选两个宿主，用户可取消其中任意一项

#### Scenario: 非交互重装沿用已安装集合

- **WHEN** 用户运行 `lycx update`（内部以 `--skip-prompt` 重装），磁盘上只有 claude 宿主的配置文件
- **THEN** 只重装 claude 宿主，不因缺少显式参数而报错，也不擅自创建 codex 宿主

#### Scenario: 部分安装不影响另一宿主

- **WHEN** 用户只勾选 claude 宿主执行安装，磁盘上已存在 codex 宿主的配置与产物
- **THEN** codex 宿主的配置文件与已安装命令保持原样

### Requirement: 遍历宿主的运维命令

`lycx uninstall`、`lycx doctor`、`lycx status`、`lycx update` SHALL 按宿主分别报告与处理，并 SHALL 支持只作用于单一宿主。作用于单一宿主时，SHALL NOT 删除、修改或报告另一宿主的产物与配置。

#### Scenario: 单宿主卸载

- **WHEN** 用户指定只卸载 claude 宿主
- **THEN** claude 宿主的配置与产物被移除，codex 宿主的配置与产物完全保留

#### Scenario: doctor 分宿主输出

- **WHEN** 两个宿主均已安装，用户运行 `lycx doctor`
- **THEN** 体检结果按宿主分组，各自的命令目录、角色词或子代理定义分别检查并分别报告

### Requirement: 跨宿主不变量由遍历断言

对多个宿主共有的行为不变量（提交正文与 trailer 规范、审查分级与准出条件、实施阶段对软上下文文件的引用、快照写入纪律等），项目 SHALL 以遍历全部宿主的方式断言，SHALL NOT 为每个宿主各维护一份等价断言。

#### Scenario: 不变量测试遍历宿主

- **WHEN** 运行宿主不变量测试
- **THEN** 同一组断言对注册表中的每个宿主执行一遍，任一宿主缺失该不变量时测试失败

#### Scenario: 新增宿主自动纳入不变量覆盖

- **WHEN** 注册表新增一个宿主
- **THEN** 既有不变量断言无需新增用例即覆盖该宿主
