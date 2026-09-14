import { exec } from 'node:child_process'
import { homedir } from 'node:os'
import { promisify } from 'node:util'
import ansis from 'ansis'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import { basename, join } from 'pathe'
import { i18n } from '../i18n'
import { readLyConfig } from '../utils/config'
import { CODE_PROMPTS_DIR, PACKAGE_NAME } from '../utils/package-meta'
import { checkForUpdates, compareVersions } from '../utils/version'

const execAsync = promisify(exec)

/**
 * 非交互重装命令串：codex 单宿主，无需透传 --hosts，
 * 直接 `init --force --skip-prompt` 覆盖重装 codex 侧产物。
 */
export function buildInitArgs(): string {
  return 'init --force --skip-prompt'
}

/**
 * Main update command - checks for updates and installs if available
 */
export async function update(): Promise<void> {
  console.log()
  console.log(ansis.cyan.bold(`🔄 ${i18n.t('update:checking')}`))
  console.log()

  const spinner = ora(i18n.t('update:checkingLatest')).start()

  try {
    const { hasUpdate, currentVersion, latestVersion } = await checkForUpdates()

    // Check if local workflow version differs from running version
    const config = await readLyConfig()
    const localVersion = config?.general?.version || '0.0.0'
    const needsWorkflowUpdate = compareVersions(currentVersion, localVersion) > 0

    spinner.stop()

    if (!latestVersion) {
      console.log(ansis.red(`❌ ${i18n.t('update:cannotConnect')}`))
      return
    }

    console.log(`${i18n.t('update:currentVersion')}: ${ansis.yellow(`v${currentVersion}`)}`)
    console.log(`${i18n.t('update:latestVersion')}: ${ansis.green(`v${latestVersion}`)}`)
    if (localVersion !== '0.0.0') {
      console.log(`${i18n.t('update:localWorkflow')}: ${ansis.gray(`v${localVersion}`)}`)
    }
    console.log()

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
    await performUpdate(fromVersion, latestVersion || currentVersion, hasUpdate)
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
async function performUpdate(fromVersion: string, toVersion: string, isNewVersion: boolean): Promise<void> {
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
  // Old approach deleted everything BEFORE installing, so if install failed
  // the user was left with nothing. New approach backs up first, installs new,
  // verifies, then cleans up backups. On failure, restores from backup.

  const BACKUP_SUFFIX = '.ly-update-bak'

  // codex 单宿主：只备份 ~/.codex/prompts/ly-*.md 命令文件
  // （共享角色词 ~/.ly/prompts/ 与配置 ~/.ly/config.toml 由 init --force 重装/保留，
  //   用户自己的 ~/.codex/prompts 下非 ly- 文件一律不动）
  const codexPromptsDir = CODE_PROMPTS_DIR
  const backupDir = join(codexPromptsDir + BACKUP_SUFFIX)

  // Step 3: Back up existing ly-*.md files
  spinner = ora(i18n.t('update:removingOld')).start()

  const backedUp: string[] = []
  try {
    if (await fs.pathExists(codexPromptsDir)) {
      // Clean up leftover backups from previous failed update
      if (await fs.pathExists(backupDir)) {
        await fs.remove(backupDir)
      }
      await fs.ensureDir(backupDir)
      const files = await fs.readdir(codexPromptsDir)
      for (const f of files) {
        if (!f.startsWith('ly-') || !f.endsWith('.md'))
          continue
        await fs.move(join(codexPromptsDir, f), join(backupDir, f))
        backedUp.push(join(codexPromptsDir, f))
      }
    }
    spinner.succeed(i18n.t('update:oldRemoved'))
  }
  catch (error) {
    // Backup failed — restore what we moved and abort
    spinner.warn(`Backup failed: ${error}`)
    for (const file of backedUp) {
      const backupPath = join(backupDir, basename(file))
      try {
        if (await fs.pathExists(backupPath)) {
          await fs.move(backupPath, file)
        }
      }
      catch { /* best-effort restore */ }
    }
    console.log(ansis.yellow('  旧版本文件已保留 / Old files preserved'))
    return
  }

  // Step 4: Install new workflows using the latest version via npx
  spinner = ora(i18n.t('update:installingNew')).start()

  let installSuccess = false
  try {
    await execAsync(`npx --yes ${PACKAGE_NAME}@latest ${buildInitArgs()}`, {
      timeout: 300000, // 5min — install from npm registry may be slow (especially in China)
      env: {
        ...process.env,
        LY_UPDATE_MODE: 'true',
      },
    })

    // Step 5: Verify new installation actually produced files
    const hasInstalled = await fs.pathExists(codexPromptsDir)
      && (await fs.readdir(codexPromptsDir)).some(f => f.startsWith('ly-') && f.endsWith('.md'))

    if (hasInstalled) {
      installSuccess = true
      spinner.succeed(i18n.t('update:installDone'))

      // Read updated config to display installed commands
      const config = await readLyConfig()
      if (config?.workflows?.installed) {
        console.log()
        console.log(ansis.cyan(i18n.t('update:installed', { count: config.workflows.installed.length })))
        for (const cmd of config.workflows.installed) {
          console.log(`  ${ansis.gray('•')} /ly:${cmd}`)
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
    try {
      await fs.remove(backupDir)
    }
    catch { /* non-critical: stale backup files */ }

    // Legacy artifact cleanup (codex-side residue from previous installs) — 非阻断
    try {
      const { cleanupLegacyArtifacts, reportCleanupResult } = await import('../utils/legacy-cleanup')
      reportCleanupResult(await cleanupLegacyArtifacts())
    }
    catch { /* non-blocking */ }
  }
  else {
    // Failure: restore from backups so user still has a working installation
    console.log()
    console.log(ansis.yellow.bold('  ⚠ 正在恢复旧版本文件 / Restoring old version files...'))
    let restored = 0
    for (const file of backedUp) {
      const backupPath = join(backupDir, basename(file))
      try {
        // Remove any partial install artifacts
        if (await fs.pathExists(file)) {
          await fs.remove(file)
        }
        if (await fs.pathExists(backupPath)) {
          await fs.move(backupPath, file)
          restored++
        }
      }
      catch (restoreErr) {
        console.log(ansis.red(`  Failed to restore ${file}: ${restoreErr}`))
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
