import { homedir } from 'node:os'
import { join } from 'pathe'

// ═══════════════════════════════════════════════════════
// codex 宿主路径常量（宿主包私有；共享层经适配器 defaultPaths 取值）
// ═══════════════════════════════════════════════════════

/** codex 宿主根目录（~/.codex，存在即视为用户在用 codex） */
export const CODEX_HOME_DIR = join(homedir(), '.codex')
/** codex skills 安装位（~/.agents/skills，v0.2.0 起：Codex 官方 skill 发现目录） */
export const AGENTS_SKILLS_DIR = join(homedir(), '.agents', 'skills')
/** 旧 custom prompts 安装位（~/.codex/prompts，v0.2.0 前；仅用于升级残留清理） */
export const CODE_PROMPTS_DIR = join(CODEX_HOME_DIR, 'prompts')
/** 本包在 codex 宿主下的私有目录（~/.codex/lyx） */
export const LY_DIR = join(CODEX_HOME_DIR, 'lyx')
/** codex 宿主配置文件（~/.codex/lyx/config.toml） */
export const CONFIG_FILE = join(LY_DIR, 'config.toml')
/** 角色词目录（~/.codex/lyx/prompts） */
export const PROMPTS_DIR = join(LY_DIR, 'prompts')
