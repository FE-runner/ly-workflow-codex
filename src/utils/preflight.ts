import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import ansis from 'ansis'
import inquirer from 'inquirer'
import { join } from 'pathe'
import { i18n } from '../i18n'
import { CODE_PROMPTS_DIR } from './package-meta'

/**
 * External dependency preflight checks.
 *
 * OpenSpec lifecycle commands (/ly:init /ly:explore /ly:propose /ly:review-plan
 * /ly:archive) depend on the global `openspec` CLI and the opsx skills it
 * installs during `openspec init`. Detection runs at installer entry points
 * (default / init / menu) so missing-dependency failures surface early
 * instead of at first command invocation.
 *
 * codex 单宿主：技能存在性判定只检测 ~/.codex/prompts/ 下的 opsx 自定义
 * prompt（opsx-explore/propose/apply/archive 任一存在即可）。
 */

export interface OpenspecCliStatus {
  installed: boolean
  version?: string
}

/** Commands that directly require the openspec CLI / opsx skills. */
const DEPENDENT_COMMANDS = ['/ly:init', '/ly:explore', '/ly:propose', '/ly:review-plan', '/ly:archive']

const INSTALL_CMD = ['npm', 'install', '-g', '@fission-ai/openspec@latest']

/** Windows needs shell:true to resolve npm-generated .cmd shims. */
const SHELL_OPT = process.platform === 'win32' ? { shell: true } : {}

/** codex 宿主的 opsx 自定义 prompt 文件（任一存在即视为 codex 侧技能齐备） */
const CODEX_OPSX_PROMPT_FILES = [
  'opsx-explore.md',
  'opsx-propose.md',
  'opsx-apply.md',
  'opsx-archive.md',
]

/** codex custom prompts directory — defaults to ~/.codex/prompts. */
export function getCodexPromptsDir(): string {
  return CODE_PROMPTS_DIR
}

/** Detect whether codex-side opsx custom prompts exist (i.e. openspec init was run for codex). */
export function detectCodexOpsxPrompts(): boolean {
  return CODEX_OPSX_PROMPT_FILES.some(f => existsSync(join(getCodexPromptsDir(), f)))
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
      if (!detectCodexOpsxPrompts()) {
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
    if (detectCodexOpsxPrompts()) {
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
