import type { CAC } from 'cac'
import type { CliOptions } from './types'
import { homedir } from 'node:os'
import ansis from 'ansis'
import inquirer from 'inquirer'
import { join } from 'pathe'
import { version } from '../package.json'
import { doctor, status } from './commands/doctor'
import { init } from './commands/init'
import { showMainMenu } from './commands/menu'
import { i18n, initI18n } from './i18n'
import { readLyConfig } from './utils/config'
import { uninstallWorkflows } from './utils/installer'
import { BIN_NAME, PACKAGE_NAME } from './utils/package-meta'
import { checkExternalDeps } from './utils/preflight'

function customizeHelp(sections: any[]): any[] {
  sections.unshift({
    title: '',
    body: ansis.cyan.bold(`ly-workflow-codex — Codex 单 Agent 工作流 + OpenSpec 双审查关卡 v${version}`),
  })

  sections.push({
    title: ansis.yellow(i18n.t('cli:help.commands')),
    body: [
      `  ${ansis.cyan(BIN_NAME)}              ${i18n.t('cli:help.commandDescriptions.showMenu')}`,
      `  ${ansis.cyan(`${BIN_NAME} init`)} | ${ansis.cyan('i')}     ${i18n.t('cli:help.commandDescriptions.initConfig')}`,
      `  ${ansis.cyan(`${BIN_NAME} doctor`)}       Check installation health`,
      `  ${ansis.cyan(`${BIN_NAME} status`)}       Show installation overview`,
      `  ${ansis.cyan(`${BIN_NAME} uninstall`)}    Uninstall ${PACKAGE_NAME} (non-interactive)`,
      '',
      ansis.gray(`  ${i18n.t('cli:help.shortcuts')}`),
      `  ${ansis.cyan(`${BIN_NAME} i`)}            ${i18n.t('cli:help.shortcutDescriptions.quickInit')}`,
    ].join('\n'),
  })

  sections.push({
    title: ansis.yellow(i18n.t('cli:help.options')),
    body: [
      `  ${ansis.green('--lang, -l')} <lang>         ${i18n.t('cli:help.optionDescriptions.displayLanguage')} (zh-CN, en)`,
      `  ${ansis.green('--force, -f')}               ${i18n.t('cli:help.optionDescriptions.forceOverwrite')}`,
      `  ${ansis.green('--help, -h')}                ${i18n.t('cli:help.optionDescriptions.displayHelp')}`,
      `  ${ansis.green('--version, -v')}             ${i18n.t('cli:help.optionDescriptions.displayVersion')}`,
      `  ${ansis.green('--yes, -y')}                 ${i18n.t('cli:help.optionDescriptions.skipConfirmation')}`,
      '',
      ansis.gray(`  ${i18n.t('cli:help.nonInteractiveMode')}`),
      `  ${ansis.green('--skip-prompt, -s')}         ${i18n.t('cli:help.optionDescriptions.skipAllPrompts')}`,
      `  ${ansis.green('--workflows, -w')} <list>    ${i18n.t('cli:help.optionDescriptions.workflows')}`,
      `  ${ansis.green('--install-dir, -d')} <path>  ${i18n.t('cli:help.optionDescriptions.installDir')}`,
    ].join('\n'),
  })

  sections.push({
    title: ansis.yellow(i18n.t('cli:help.examples')),
    body: [
      ansis.gray(`  # ${i18n.t('cli:help.exampleDescriptions.showInteractiveMenu')}`),
      `  ${ansis.cyan(`npx ${PACKAGE_NAME}`)}`,
      '',
      ansis.gray(`  # ${i18n.t('cli:help.exampleDescriptions.runFullInitialization')}`),
      `  ${ansis.cyan(`npx ${PACKAGE_NAME} init`)}`,
      `  ${ansis.cyan(`npx ${PACKAGE_NAME} i`)}`,
      '',
      ansis.gray(`  # ${i18n.t('cli:help.exampleDescriptions.customModels')}`),
      `  ${ansis.cyan(`npx ${PACKAGE_NAME} init -s`)}`,
      '',
    ].join('\n'),
  })

  return sections
}

export async function setupCommands(cli: CAC): Promise<void> {
  try {
    const config = await readLyConfig()
    const defaultLang = config?.general?.language || 'zh-CN'
    await initI18n(defaultLang)
  }
  catch {
    await initI18n('zh-CN')
  }

  // Default command - show menu
  cli
    .command('', i18n.t('cli:help.commandDescriptions.showMenu'))
    .option('--lang, -l <lang>', `${i18n.t('cli:help.optionDescriptions.displayLanguage')} (zh-CN, en)`)
    .action(async (options: CliOptions) => {
      if (options.lang) {
        await initI18n(options.lang)
      }
      await checkExternalDeps()
      await showMainMenu()
    })

  // Init command
  cli
    .command('init', i18n.t('cli:help.commandDescriptions.initConfig'))
    .alias('i')
    .option('--lang, -l <lang>', `${i18n.t('cli:help.optionDescriptions.displayLanguage')} (zh-CN, en)`)
    .option('--force, -f', i18n.t('cli:help.optionDescriptions.forceOverwrite'))
    .option('--skip-prompt, -s', i18n.t('cli:help.optionDescriptions.skipAllPrompts'))
    .option('--workflows, -w <workflows>', i18n.t('cli:help.optionDescriptions.workflows'))
    .option('--install-dir, -d <path>', i18n.t('cli:help.optionDescriptions.installDir'))
    .action(async (options: CliOptions) => {
      if (options.lang) {
        await initI18n(options.lang)
      }
      await checkExternalDeps({ skipPrompt: options.skipPrompt })
      await init(options)
    })

  // Doctor: environment health check
  cli
    .command('doctor', 'Check ly-workflow-codex installation health')
    .action(async () => { await doctor() })

  // Status: show current installation overview
  cli
    .command('status', 'Show ly-workflow-codex installation status')
    .action(async () => { await status() })

  // Uninstall ly-workflow-codex (codex host)
  cli
    .command('uninstall', 'Uninstall ly-workflow-codex workflows (~/.agents/skills/lyx-*, ~/.codex/lyx/)')
    .option('--yes, -y', 'Skip confirmation')
    .action(async (options: { yes?: boolean }) => {
      const installDir = join(homedir(), '.codex')
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `确定要卸载 ${PACKAGE_NAME} 吗？将移除 ~/.agents/skills/lyx-*（含旧 ~/.agents/skills/ly-* 与 ~/.codex/prompts/ly-*.md 残留）与 ~/.codex/lyx/（配置 config.toml、角色词 prompts/、worktrees）；若 ~/.codex/lyx/worktrees/ 下存在未清理的实际 git worktree，该子目录会被保留并提示需先手动清理。`,
          default: false,
        }])
        if (!confirm) {
          console.log(ansis.gray('卸载已取消'))
          return
        }
      }
      const result = await uninstallWorkflows(installDir)
      if (result.success) {
        console.log(ansis.green(`✓ ${PACKAGE_NAME} uninstalled`))
        if (result.removedSkills.length > 0)
          console.log(ansis.gray(`  lyx-* skills: ${result.removedSkills.length} removed`))
        if (result.removedLegacyPrompts.length > 0)
          console.log(ansis.gray(`  Legacy ~/.codex/prompts residue: ${result.removedLegacyPrompts.length} removed`))
        if (result.removedPrompts)
          console.log(ansis.gray('  Prompts (~/.codex/lyx/prompts/codex/): removed'))
        if (result.worktreesKept)
          console.log(ansis.gray('  Worktrees (~/.codex/lyx/worktrees/): kept (live git worktree detected — run `lycx worktree remove` first)'))
      }
      else {
        console.error(ansis.red('✗ Uninstall failed'))
        for (const err of result.errors) console.error(ansis.gray(`  ${err}`))
        process.exitCode = 1
      }
    })

  cli.help(sections => customizeHelp(sections))
  cli.version(version)
}
