import { homedir } from 'node:os'
import { join } from 'pathe'

// ═══════════════════════════════════════════════════════
// claude 宿主路径常量（宿主包私有；共享层经适配器 defaultPaths 取值）
// ═══════════════════════════════════════════════════════

/** claude 宿主根目录（~/.claude，存在即视为用户在用 Claude Code） */
export const CLAUDE_HOME_DIR = join(homedir(), '.claude')
/** 用户级 skills 目录（~/.claude/skills；lyx 命令安装为 lyx-<cmd>/SKILL.md） */
export const CLAUDE_SKILLS_DIR = join(CLAUDE_HOME_DIR, 'skills')
/** 用户级子代理定义目录（~/.claude/agents；lyx 子代理安装为 lyx-*.md） */
export const CLAUDE_AGENTS_DIR = join(CLAUDE_HOME_DIR, 'agents')
/** 本包在 claude 宿主下的私有目录（~/.claude/lyx） */
export const CLAUDE_LY_DIR = join(CLAUDE_HOME_DIR, 'lyx')
/** claude 宿主配置文件（~/.claude/lyx/config.toml） */
export const CLAUDE_CONFIG_FILE = join(CLAUDE_LY_DIR, 'config.toml')
/** 角色词目录（claude 宿主不安装角色词，角色设定在子代理定义正文中；保留路径以统一形态） */
export const CLAUDE_PROMPTS_DIR = join(CLAUDE_LY_DIR, 'prompts')
