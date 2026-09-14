import { homedir } from 'node:os'
import { join } from 'pathe'

/** 包级常量收敛：包名、bin 名、宿主目录、issue 入口等统一在此管理 */
export const PACKAGE_NAME = 'ly-workflow-codex'
export const BIN_NAME = 'lycx'
/** 旧 custom prompts 安装位（~/.codex/prompts，v0.2.0 前；仅用于升级残留清理） */
export const CODE_PROMPTS_DIR = join(homedir(), '.codex', 'prompts')
/** codex skills 安装位（~/.agents/skills，v0.2.0 起：Codex 官方 skill 发现目录） */
export const AGENTS_SKILLS_DIR = join(homedir(), '.agents', 'skills')
/** ly 配置根目录（~/.ly） */
export const LY_DIR = join(homedir(), '.ly')
/** ly 配置文件（~/.ly/config.toml） */
export const CONFIG_FILE = join(LY_DIR, 'config.toml')
/** 共享角色词目录（~/.ly/prompts） */
export const PROMPTS_DIR = join(LY_DIR, 'prompts')
export const ISSUES_URL = 'https://github.com/FE-runner/ly-workflow-codex/issues'
