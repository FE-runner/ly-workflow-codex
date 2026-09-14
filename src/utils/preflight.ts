import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import ansis from 'ansis'
import inquirer from 'inquirer'
import { join } from 'pathe'
import { i18n } from '../i18n'
import { AGENTS_SKILLS_DIR } from './package-meta'

/**
 * External dependency preflight checks.
 *
 * OpenSpec lifecycle commands (@lyx-init /@lyx-explore /@lyx-propose /@lyx-review-plan
 * /@lyx-archive) depend on the global `openspec` CLI and the openspec skills
 * (`openspec-*` SKILL.md) it installs into `~/.agents/skills/` or the project
 * `.agents/skills/` during `openspec init`. Detection runs at installer entry points
 * (default / init / menu) so missing-dependency failures surface early
 * instead of at first command invocation.
 *
 * codex 单宿主：技能存在性判定检测用户级 ~/.agents/skills/ 与项目 .agents/skills/
 * 下的 openspec-* skill（openspec-explore/propose/apply-change/archive-change
 * 任一存在 SKILL.md 即可）。
 */

export interface OpenspecCliStatus {
  installed: boolean
  version?: string
}

/** Commands that directly require the openspec CLI / openspec skills. */
const DEPENDENT_COMMANDS = ['@lyx-init', '@lyx-explore', '@lyx-propose', '@lyx-review-plan', '@lyx-archive']

const INSTALL_CMD = ['npm', 'install', '-g', '@fission-ai/openspec@latest']

/** Windows needs shell:true to resolve npm-generated .cmd shims. */
const SHELL_OPT = process.platform === 'win32' ? { shell: true } : {}

/** openspec-* skill 目录名（任一存在 SKILL.md 即视为 codex 侧技能齐备） */
const OPENSPEC_SKILL_NAMES = [
  'openspec-explore',
  'openspec-propose',
  'openspec-apply-change',
  'openspec-archive-change',
]

/** codex skills 安装目录 — defaults to ~/.agents/skills. */
export function getCodexSkillsDir(): string {
  return AGENTS_SKILLS_DIR
}

/**
 * Detect whether openspec skills exist (user-level ~/.agents/skills or the
 * current project's .agents/skills), i.e. openspec init has been run.
 */
export function detectOpenspecSkills(): boolean {
  const roots = [
    AGENTS_SKILLS_DIR,
    join(process.cwd(), '.agents', 'skills'),
  ]
  return OPENSPEC_SKILL_NAMES.some(name =>
    roots.some(root => existsSync(join(root, name, 'SKILL.md'))),
  )
}

/** Detect the global openspec CLI via `openspec --version`. */
export function detectOpenspecCli(): Promise<OpenspecCliStatus> {
  return new Promise((resolve) => {
    execFile('openspec', ['--version'], { timeout: 5000, ...SHELL_OPT }, (err, stdout) => {
      if (err) {
        // Installed but unhealthy (e.g. hung execution) — do not trigger a reinstall.
        if (('killed' in err && err.killed) || (err as NodeJS.ErrnoException).code === 'ETIMEDOUT') {
          resolve({ installed: true, version: 'unknown' })
          return
        }
        resolve({ installed: false })
        return
      }
      resolve({ installed: true, version: stdout.toString().trim() || 'unknown' })
    })
  })
}

function printUnavailable(): void {
  console.log(ansis.yellow(`  ${i18n.t('common:preflight.unavailableList', { list: DEPENDENT_COMMANDS.join(' ') })}`))
  console.log(ansis.gray(`  ${i18n.t('common:preflight.unaffectedNote')}`))
}

async function runNpmInstall(): Promise<boolean> {
  return new Promise((resolve) => {
    const [cmd, ...args] = INSTALL_CMD
    const child = spawn(cmd, args, { stdio: 'inherit', ...SHELL_OPT })
    child.on('error', () => resolve(false))
    child.on('close', code => resolve(code === 0))
  })
}

function isNonInteractive(skipPrompt?: boolean): boolean {
  return Boolean(skipPrompt || process.env.CI || !process.stdin.isTTY || !process.stdout.isTTY)
}

/**
 * Orchestrated preflight entry for installer flows (default action / init / menu).
 * Never throws — installer main flow must proceed regardless of check outcomes.
 */
export async function checkExternalDeps(options?: { skipPrompt?: boolean }): Promise<void> {
  try {
    const cli = await detectOpenspecCli()

    if (cli.installed) {
      if (!detectOpenspecSkills()) {
        console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.skillsMissingCodex')}`))
      }
      return
    }

    console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.cliMissing')}`))

    if (isNonInteractive(options?.skipPrompt)) {
      printUnavailable()
      return
    }

    const { confirmed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmed',
      message: i18n.t('common:preflight.installAsk'),
      default: true,
    }])

    if (!confirmed) {
      printUnavailable()
      return
    }

    const ok = await runNpmInstall()
    if (!ok) {
      console.error(ansis.red(`✗ ${i18n.t('common:preflight.installFailed')}`))
      printUnavailable()
      return
    }

    // Re-check skills after install: a stale opsx dir may already exist
    // (openspec CLI was previously installed then removed).
    // Re-check the CLI too: npm install may succeed while the global bin
    // prefix is not on the current PATH (nvm/brew prefix mismatches).
    const recheck = await detectOpenspecCli()
    if (!recheck.installed) {
      console.log(ansis.yellow(`⚠ ${i18n.t('common:preflight.installNotInPath')}`))
      return
    }
    if (detectOpenspecSkills()) {
      console.log(ansis.green(`✓ ${i18n.t('common:preflight.installSuccessWithSkills')}`))
    }
    else {
      console.log(ansis.green(`✓ ${i18n.t('common:preflight.installSuccessNeedInit')}`))
    }
  }
  catch {
    // Never break the installer flow because of preflight failures.
  }
}
