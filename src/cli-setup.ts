import type { CAC } from 'cac'
import type { OpenspecCommandOptions } from './commands/openspec'
import type { CliOptions } from './types'
import type { HostId } from './utils/host-adapters'
import ansis from 'ansis'
import inquirer from 'inquirer'
import { version } from '../package.json'
import { doctor, status } from './commands/doctor'
import { init } from './commands/init'
import { showMainMenu } from './commands/menu'
import { runOpenspecCommand } from './commands/openspec'
import { describeUninstallTargets, printUninstallResult, resolveUninstallHosts, runUninstall } from './commands/uninstall'
import { i18n, initI18n } from './i18n'
import { readLyConfig } from './utils/config'
import { parseHostList } from './utils/host-selection'
import { BIN_NAME, PACKAGE_NAME } from './utils/package-meta'
import { checkExternalDeps } from './utils/preflight'

function customizeHelp(sections: any[]): any[] {
  sections.unshift({
    title: '',
    body: ansis.cyan.bold(`${i18n.t('cli:help.banner')} v${version}`),
  })

  sections.push({
    title: ansis.yellow(i18n.t('cli:help.commands')),
    body: [
      `  ${ansis.cyan(BIN_NAME)}              ${i18n.t('cli:help.commandDescriptions.showMenu')}`,
      `  ${ansis.cyan(`${BIN_NAME} init`)} | ${ansis.cyan('i')}     ${i18n.t('cli:help.commandDescriptions.initConfig')}`,
      `  ${ansis.cyan(`${BIN_NAME} doctor`)}       Check installation health`,
      `  ${ansis.cyan(`${BIN_NAME} status`)}       Show installation overview`,
      `  ${ansis.cyan(`${BIN_NAME} openspec inspect`)}  Inspect OpenSpec dependency state`,
      `  ${ansis.cyan(`${BIN_NAME} openspec ensure`)}   Ensure OpenSpec CLI/skills/root`,
      `  ${ansis.cyan(`${BIN_NAME} uninstall`)}    Uninstall ${PACKAGE_NAME} (per host)`,
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
      `  ${ansis.green('--host')} <hosts>            ${i18n.t('cli:help.hostOption')}`,
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

/** 解析 --host；非法取值打印错误并设置退出码，返回 null */
function parseHostsOrExit(value: string | undefined): HostId[] | undefined | null {
  try {
    return parseHostList(value)
  }
  catch (error) {
    console.error(ansis.red(error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
    return null
  }
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
    .option('--init-openspec', i18n.t('cli:help.optionDescriptions.initOpenspec'))
    .option('--host <hosts>', i18n.t('cli:help.hostOption'))
    .action(async (options: CliOptions) => {
      if (options.lang) {
        await initI18n(options.lang)
      }
      await checkExternalDeps({ skipPrompt: options.skipPrompt, initOpenspec: options.initOpenspec })
      await init(options)
    })

  // OpenSpec dependency inspection / repair (按宿主)
  cli
    .command('openspec <action>', 'Inspect or ensure OpenSpec dependencies')
    .option('--json', 'Output JSON')
    .option('--yes, -y', 'Skip confirmation')
    .option('--host <hosts>', i18n.t('cli:help.hostOption'))
    .action(async (action: string, options: OpenspecCommandOptions) => {
      await runOpenspecCommand(action, options)
    })

  // Doctor: environment health check（按宿主分组）
  cli
    .command('doctor', 'Check ly-workflow-codex installation health')
    .option('--host <hosts>', i18n.t('cli:help.hostOption'))
    .action(async (options: { host?: string }) => {
      const hosts = parseHostsOrExit(options.host)
      if (hosts !== null)
        await doctor({ hosts })
    })

  // Status: show current installation overview（按宿主分组）
  cli
    .command('status', 'Show ly-workflow-codex installation status')
    .option('--host <hosts>', i18n.t('cli:help.hostOption'))
    .action(async (options: { host?: string }) => {
      const hosts = parseHostsOrExit(options.host)
      if (hosts !== null)
        await status({ hosts })
    })

  // Uninstall ly-workflow-codex（按宿主；OpenSpec 自有产物与共用 ~/.ly/worktrees/ 不动）
  cli
    .command('uninstall', 'Uninstall ly-workflow-codex (per host; --host to limit, default = all installed hosts)')
    .option('--yes, -y', 'Skip confirmation')
    .option('--host <hosts>', i18n.t('cli:help.hostOption'))
    .action(async (options: { yes?: boolean, host?: string }) => {
      const explicit = parseHostsOrExit(options.host)
      if (explicit === null)
        return
      const hosts = await resolveUninstallHosts(explicit)
      if (!options.yes) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `确定要卸载 ${PACKAGE_NAME} 吗？将移除：\n${describeUninstallTargets(hosts).map(l => `    ${l}`).join('\n')}\n  （OpenSpec 自有产物与共用的 ~/.ly/worktrees/ 不会被删除）`,
          default: false,
        }])
        if (!confirm) {
          console.log(ansis.gray('卸载已取消'))
          return
        }
      }
      const result = await runUninstall(hosts)
      if (result.success)
        console.log(ansis.green(`✓ ${PACKAGE_NAME} uninstalled (${hosts.join(', ')})`))
      else
        console.error(ansis.red('✗ Uninstall failed'))
      printUninstallResult(result)
      if (!result.success)
        process.exitCode = 1
    })

  cli.help(sections => customizeHelp(sections))
  cli.version(version)
}
