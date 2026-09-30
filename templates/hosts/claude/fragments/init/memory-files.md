由当前会话直接生成/更新项目根目录的 `AGENTS.md`（单 Agent 模式，无外部技能委托）：以 `参数`（项目摘要或名称）为线索，结合当前仓库结构，写清模块职责、入口与启动方式、核心类型、构建/测试命令、关键约定。已存在时增量更新，不推翻既有内容、不删除既有章节。

随后产出或更新项目根目录的 `CLAUDE.md`，使 Claude Code 实际加载项目指令（Claude Code 仅在项目无 `CLAUDE.md` 时读取 `AGENTS.md`）：

- `CLAUDE.md` 不存在 → 新建一个薄导入文件，首行为 `@AGENTS.md`（Claude Code 的记忆文件导入语法），`AGENTS.md` 保持为唯一的主文件，SHALL NOT 在 `CLAUDE.md` 中复制 `AGENTS.md` 的正文。
- `CLAUDE.md` 已存在且含用户内容 → 增量更新：未包含 `@AGENTS.md` 导入行时在文首追加该行；保留既有章节，SHALL NOT 整体覆盖或删除用户内容。已包含导入行 → 不改动。
