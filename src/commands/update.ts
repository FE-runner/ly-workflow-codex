import type { HostId } from '../utils/host-adapters'
import { exec } from 'node:child_process'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import ansis from 'ansis'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { basename, join } from 'pathe'
import { i18n } from '../i18n'
import { listInstalledHosts, readLyConfig } from '../utils/config'
import { listPrefixedDirs } from '../utils/fs-helpers'
import { FALLBACK_HOSTS, getAdapter } from '../utils/host-adapters'
import { resolveTargetHosts } from '../utils/host-selection'
import { getCoreCommandIds, installWorkflows } from '../utils/installer'
import { PACKAGE_NAME } from '../utils/package-meta'
import { checkForUpdates, compareVersions } from '../utils/version'

const execAsync = promisify(exec)

/**
 * 非交互重装命令串：`init --force --skip-prompt` 覆盖重装。
 * 未指定宿主时由 init 按已安装宿主集合重装；指定时透传 `--host` 只重装这些宿主。
 */
export function buildInitArgs(hosts?: HostId[]): string {
  const base = 'init --force --skip-prompt'
  return hosts && hosts.length > 0 ? `${base} --host ${hosts.join(',')}` : base
}

export type HostRefreshAction = 'refresh' | 'rerender' | 'skip'

/**
 * 单宿主的更新动作：
 * - 该宿主记录的版本落后于当前包版本 → refresh（整体重装该宿主产物）
 * - 版本一致但已安装的定义与当前配置有偏差 → rerender（按当前配置重新渲染，不必联网）
 * - 版本一致且无偏差 → skip
 */
export function planHostRefresh(input: { currentVersion: string, localVersion: string, drift: string[] }): HostRefreshAction {
  if (compareVersions(input.currentVersion, input.localVersion) > 0)
    return 'refresh'
  if (input.drift.length > 0)
    return 'rerender'
  return 'skip'
}

interface HostUpdatePlan {
  host: HostId
  localVersion: string
  drift: string[]
  action: HostRefreshAction
}

async function buildHostPlans(hosts: HostId[], currentVersion: string): Promise<HostUpdatePlan[]> {
  const plans: HostUpdatePlan[] = []
  for (const host of hosts) {
    const adapter = getAdapter(host)
    const config = await readLyConfig(host)
    const localVersion = config?.general?.version || '0.0.0'
    const drift = adapter.definitionDrift
      ? await adapter.definitionDrift({ paths: adapter.defaultPaths(), config: config?.host })
      : []
    plans.push({ host, localVersion, drift, action: planHostRefresh({ currentVersion, localVersion, drift }) })
  }
  return plans
}

/** 版本一致但定义有偏差：按当前配置本地重渲染该宿主产物（含子代理定义），不下载新包 */
async function rerenderHosts(plans: HostUpdatePlan[]): Promise<void> {
  for (const plan of plans) {
    const config = await readLyConfig(plan.host)
    const spinner = ora(i18n.t('update:rerendering', { host: plan.host, list: plan.drift.join(', ') })).start()
    const result = await installWorkflows(getCoreCommandIds(), '', true, {
      hosts: [plan.host],
      hostConfig: { [plan.host]: config?.host ?? {} },
    })
    if (result.success)
      spinner.succeed(i18n.t('update:rerenderDone', { host: plan.host }))
    else
      spinner.fail(`${i18n.t('update:installFailed')}: ${result.errors.join('; ')}`)
  }
}

/**
 * Main update command - checks for updates and installs if available
 */
export async function update(options: { hosts?: HostId[] } = {}): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold(`🔄 ${i18n.t('update:checking')}`))
  console.log()

  const spinner = ora(i18n.t('update:checkingLatest')).start()

  try {
    const { hasUpdate, currentVersion, latestVersion } = await checkForUpdates()

    // 只处理已安装（或显式指定）的宿主；按宿主分别判断版本落后与定义偏差
    const hosts = await resolveTargetHosts(options.hosts)
    const plans = await buildHostPlans(hosts, currentVersion)
    const refreshHosts = plans.filter(p => p.action === 'refresh').map(p => p.host)
    const localVersion = plans.length > 0
      ? plans.map(p => p.localVersion).sort(compareVersions)[0]
      : '0.0.0'
    const needsWorkflowUpdate = plans.length === 0 || refreshHosts.length > 0

    spinner.stop()

    if (!latestVersion) {
      console.log(ansis.red(`❌ ${i18n.t('update:cannotConnect')}`))
      return
    }

    console.log(`${i18n.t('update:currentVersion')}: ${ansis.yellow(`v${currentVersion}`)}`)
    console.log(`${i18n.t('update:latestVersion')}: ${ansis.green(`v${latestVersion}`)}`)
    for (const plan of plans) {
      console.log(`${i18n.t('update:localWorkflow')} [${plan.host}]: ${ansis.gray(`v${plan.localVersion}`)}${plan.drift.length > 0 ? ansis.yellow(` (${i18n.t('update:driftDetected', { list: plan.drift.join(', ') })})`) : ''}`)
    }
    console.log()

    // 版本一致、无新包，但有定义偏差：只本地重渲染偏差宿主
    const rerenderPlans = plans.filter(p => p.action === 'rerender')
    if (!hasUpdate && !needsWorkflowUpdate && rerenderPlans.length > 0) {
      await rerenderHosts(rerenderPlans)
      return
    }

    // Determine effective update status
    const effectiveNeedsUpdate = hasUpdate || needsWorkflowUpdate
    let defaultConfirm = effectiveNeedsUpdate

    let message: string
    if (hasUpdate) {
      message = i18n.t('update:newVersionFound', { latest: latestVersion, current: currentVersion })
      defaultConfirm = true
    }
    else if (needsWorkflowUpdate) {
      message = i18n.t('update:localOutdated', { local: localVersion, current: currentVersion })
      defaultConfirm = true
    }
    else {
      message = i18n.t('update:alreadyLatest', { current: currentVersion })
      defaultConfirm = false
    }

    const { confirmUpdate } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirmUpdate',
      message,
      default: defaultConfirm,
    }])

    if (!confirmUpdate) {
      console.log(ansis.gray(i18n.t('update:cancelled')))
      return
    }

    // Pass localVersion as fromVersion for accurate display
    const fromVersion = needsWorkflowUpdate ? localVersion : currentVersion
    // 有新包时重装全部目标宿主；仅本地版本落后时只重装落后的宿主（未指定宿主且无已安装宿主时交给 init 决定）
    const installHosts = hasUpdate ? hosts : refreshHosts
    await performUpdate(fromVersion, latestVersion || currentVersion, hasUpdate, installHosts)
    // 同时存在的"版本一致但有偏差"宿主：新包重装已覆盖全部宿主；否则单独本地重渲染
    if (!hasUpdate && rerenderPlans.length > 0)
      await rerenderHosts(rerenderPlans)
  }
  catch (error) {
    spinner.stop()
    console.log(ansis.red(`❌ ${i18n.t('update:error', { error: String(error) })}`))
  }
}

/**
 * Check if ly-workflow-codex is installed globally via npm
 */
async function checkIfGlobalInstall(): Promise<boolean> {
  try {
    const { stdout } = await execAsync(`npm list -g ${PACKAGE_NAME} --depth=0`, { timeout: 5000 })
    return stdout.includes(`${PACKAGE_NAME}@`)
  }
  catch {
    return false
  }
}

/**
 * Perform the actual update process
 */
async function performUpdate(fromVersion: string, toVersion: string, isNewVersion: boolean, hosts: HostId[]): Promise<void> {
  console.log()
  console.log(ansis.yellow.bold(`⚙️  ${i18n.t('update:starting')}`))
  console.log()

  // Check if installed globally via npm
  const isGlobalInstall = await checkIfGlobalInstall()

  // If globally installed and only workflow needs update (package is already latest)
  if (isGlobalInstall && !isNewVersion) {
    console.log(ansis.cyan(`ℹ️  ${i18n.t('update:globalDetected')}`))
    console.log()
    console.log(ansis.green(`✓ ${i18n.t('update:packageLatest')} (v${toVersion})`))
    console.log(ansis.yellow(`⚙️  ${i18n.t('update:workflowOnly')}`))
    console.log()
  }
  else if (isGlobalInstall && isNewVersion) {
    console.log(ansis.yellow(`⚠️  ${i18n.t('update:globalDetected')}`))
    console.log()
    console.log(`${i18n.t('update:recommendNpm')}`)
    console.log()
    console.log(ansis.cyan(`  npm install -g ${PACKAGE_NAME}@latest`))
    console.log()
    console.log(ansis.gray(i18n.t('update:willUpdateBoth')))
    console.log()

    const { useNpmUpdate } = await inquirer.prompt([{
      type: 'confirm',
      name: 'useNpmUpdate',
      message: i18n.t('update:useNpmUpdate'),
      default: true,
    }])

    if (useNpmUpdate) {
      console.log()
      console.log(ansis.cyan(i18n.t('update:runInNewTerminal')))
      console.log()
      console.log(ansis.cyan.bold(`  npm install -g ${PACKAGE_NAME}@latest`))
      console.log()
      console.log(ansis.gray(`(${i18n.t('update:autoUpdateAfter')})`))
      console.log()
      return
    }

    console.log()
    console.log(ansis.yellow(`⚠️  ${i18n.t('update:continueBuiltin')}`))
    console.log(ansis.gray(i18n.t('update:willNotUpdateCli')))
    console.log()
  }

  // Step 1: Download latest package
  let spinner = ora(i18n.t('update:downloading')).start()

  try {
    if (process.platform === 'win32') {
      spinner.text = i18n.t('update:clearingCache')
      try {
        await execAsync('npx clear-npx-cache', { timeout: 10000 })
      }
      catch {
        const npxCachePath = join(homedir(), '.npm', '_npx')
        try {
          await fs.remove(npxCachePath)
        }
        catch {
          // Cache clearing failed, but continue anyway
        }
      }
    }

    spinner.text = i18n.t('update:downloading')
    await execAsync(`npx --yes ${PACKAGE_NAME}@latest --version`, { timeout: 60000 })
    spinner.succeed(i18n.t('update:downloadDone'))
  }
  catch (error) {
    spinner.fail(i18n.t('update:downloadFailed'))
    console.log(ansis.red(`${i18n.t('common:error')}: ${error}`))
    return
  }

  // ── Atomic update: backup → install → verify → cleanup / rollback ──
  // 按宿主备份本包产物（各宿主适配器的 backupList：命令目录、子代理定义、旧安装位残留），
  // 安装失败时原样恢复；用户自己的内容一律不动。
  const BACKUP_SUFFIX = '.ly-update-bak'
  const backupHosts = hosts.length > 0 ? hosts : [...FALLBACK_HOSTS]
  const backedUp: Array<{ original: string, backup: string }> = []
  const backupDirs: string[] = []

  // Step 3: Back up existing artifacts of the target hosts
  spinner = ora(i18n.t('update:removingOld')).start()

  try {
    for (const host of backupHosts) {
      const adapter = getAdapter(host)
      const paths = adapter.defaultPaths()
      const ctx = { installDir: '', force: false, templateDir: '', paths, config: {}, result: { success: true, installedCommands: [], installedPrompts: [], errors: [], configPath: '' } }
      const targets = adapter.backupList ? await adapter.backupList(ctx) : await adapter.uninstallList(ctx)
      if (targets.length === 0)
        continue
      const backupDir = `${paths.skillsDir}${BACKUP_SUFFIX}`
      // Clean up leftover backups from previous failed update
      if (await fs.pathExists(backupDir))
        await fs.remove(backupDir)
      await fs.ensureDir(backupDir)
      backupDirs.push(backupDir)
      for (const original of targets) {
        const backup = join(backupDir, basename(original))
        await fs.move(original, backup)
        backedUp.push({ original, backup })
      }
    }
    spinner.succeed(i18n.t('update:oldRemoved'))
  }
  catch (error) {
    // Backup failed — restore what we moved and abort
    spinner.warn(`Backup failed: ${error}`)
    for (const { original, backup } of backedUp) {
      try {
        if (await fs.pathExists(backup))
          await fs.move(backup, original)
      }
      catch { /* best-effort restore */ }
    }
    console.log(ansis.yellow('  旧版本文件已保留 / Old files preserved'))
    return
  }

  // Step 4: Install new workflows using the latest version via npx
  spinner = ora(i18n.t('update:installingNew')).start()

  let installSuccess = false
  let verifyHosts: HostId[] = hosts
  try {
    await execAsync(`npx --yes ${PACKAGE_NAME}@latest ${buildInitArgs(hosts)}`, {
      timeout: 300000, // 5min — install from npm registry may be slow (especially in China)
      env: {
        ...process.env,
        LY_UPDATE_MODE: 'true',
      },
    })

    // Step 5: Verify new installation actually produced files（每个目标宿主都要有 lyx-* 命令）
    verifyHosts = hosts.length > 0 ? hosts : await listInstalledHosts()
    let hasInstalled = verifyHosts.length > 0
    for (const host of verifyHosts) {
      if ((await listPrefixedDirs(getAdapter(host).defaultPaths().skillsDir, 'lyx-')).length === 0)
        hasInstalled = false
    }

    if (hasInstalled) {
      installSuccess = true
      spinner.succeed(i18n.t('update:installDone'))

      // Read updated config to display installed commands (per host)
      for (const host of verifyHosts) {
        const config = await readLyConfig(host)
        if (config?.workflows?.installed) {
          console.log()
          console.log(ansis.cyan(`[${host}] ${i18n.t('update:installed', { count: config.workflows.installed.length })}`))
          for (const cmd of config.workflows.installed)
            console.log(`  ${ansis.gray('•')} ${getAdapter(host).commandPrefix}lyx-${cmd}`)
        }
      }
    }
    else {
      // Subprocess reported success but no files were created
      spinner.fail(i18n.t('update:installFailed'))
      console.log(ansis.red('  Install subprocess completed but no command files were created'))
    }
  }
  catch (error) {
    spinner.fail(i18n.t('update:installFailed'))
    console.log(ansis.red(`${i18n.t('common:error')}: ${error}`))
  }

  // Step 6: Cleanup or rollback
  if (installSuccess) {
    // Success: remove backups
    for (const backupDir of backupDirs) {
      try {
        await fs.remove(backupDir)
      }
      catch { /* non-critical: stale backup files */ }
    }

    // Legacy artifact cleanup (codex-side residue from previous installs) — 非阻断
    if (verifyHosts.includes('codex')) {
      try {
        const { cleanupLegacyArtifacts, reportCleanupResult } = await import('../hosts/codex/legacy-cleanup')
        reportCleanupResult(await cleanupLegacyArtifacts())
      }
      catch { /* non-blocking */ }
    }
  }
  else {
    // Failure: restore from backups so user still has a working installation
    console.log()
    console.log(ansis.yellow.bold('  ⚠ 正在恢复旧版本文件 / Restoring old version files...'))
    let restored = 0
    for (const { original, backup } of backedUp) {
      try {
        // Remove any partial install artifacts
        if (await fs.pathExists(original)) {
          await fs.remove(original)
        }
        if (await fs.pathExists(backup)) {
          await fs.move(backup, original)
          restored++
        }
      }
      catch (restoreErr) {
        console.log(ansis.red(`  Failed to restore ${original}: ${restoreErr}`))
      }
    }

    if (restored > 0) {
      console.log(ansis.green(`  ✓ 已恢复 ${restored} 个文件 / Restored ${restored} files`))
      console.log(ansis.gray('    旧版命令仍可正常使用 / Old commands still work'))
    }
    console.log()
    console.log(ansis.yellow(i18n.t('update:manualRetry')))
    console.log(ansis.cyan(`  npx ${PACKAGE_NAME}@latest`))
    return
  }

  console.log()
  console.log(ansis.green.bold(`✅ ${i18n.t('update:updateDone')}`))
  console.log()
  if (isNewVersion) {
    console.log(ansis.gray(i18n.t('update:upgradedFromTo', { from: fromVersion, to: toVersion })))
  }
  else {
    console.log(ansis.gray(i18n.t('update:reinstalled', { version: toVersion })))
  }
  console.log()
}
