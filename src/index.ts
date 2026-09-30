export { init } from './commands/init'
export { showMainMenu } from './commands/menu'
export { update } from './commands/update'
export { changeLanguage, i18n, initI18n } from './i18n'
// ly-workflow-codex — 精简工作流：多宿主（codex / claude）共享同一套命令流程 + 独立审查关卡
export * from './types'
export {
  createDefaultConfig,
  /** @deprecated 使用 getHostConfigPath(host) */
  getConfigPath,
  getHostConfigPath,
  getHostLyDir,
  getHostPromptsDir,
  /** @deprecated 使用 getHostLyDir(host) */
  getLyDir,
  /** @deprecated 使用 getHostPromptsDir(host) */
  getLyPromptsDir,
  listInstalledHosts,
  readLyConfig,
  writeLyConfig,
} from './utils/config'
export { ADAPTERS, type HostAdapter, type HostId, listRegisteredHosts } from './utils/host-adapters'
export {
  getWorkflowById,
  getWorkflowConfigs,
  installWorkflows,
  uninstallWorkflows,
} from './utils/installer'
export {
  checkForUpdates,
  compareVersions,
  getCurrentVersion,
  getLatestVersion,
} from './utils/version'
