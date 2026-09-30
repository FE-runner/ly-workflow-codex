import type { HostId } from '../utils/host-adapters'
import type { UninstallResult } from '../utils/installer'
import ansis from 'ansis'
import { listInstalledHosts } from '../utils/config'
import { FALLBACK_HOSTS, getAdapter } from '../utils/host-adapters'
import { uninstallWorkflows } from '../utils/installer'

/**
 * 卸载的宿主集合：显式指定 → 只卸载这些宿主；否则全部已安装宿主；
 * 一个都没安装时回退兜底集合（仍清理旧版本残留，保持改造前行为）。
 */
export async function resolveUninstallHosts(explicit?: HostId[]): Promise<HostId[]> {
  if (explicit && explicit.length > 0)
    return explicit
  const installed = await listInstalledHosts()
  return installed.length > 0 ? installed : [...FALLBACK_HOSTS]
}

/**
 * 卸载确认提示中列出的范围（按宿主，逐项与实际删除 / 修改动作对应，由适配器提供）；
 * OpenSpec 自有产物与共用 ~/.ly/worktrees/ 不在范围内。
 */
export function describeUninstallTargets(hosts: HostId[]): string[] {
  return hosts.flatMap((host) => {
    const adapter = getAdapter(host)
    const paths = adapter.defaultPaths()
    const items = adapter.describeUninstall
      ? adapter.describeUninstall(paths)
      : [`${paths.skillsDir}/lyx-*/`, ...(paths.agentsDir ? [`${paths.agentsDir}/lyx-*.md`] : []), `${paths.lyDir}/`]
    return [`[${host}]`, ...items.map(item => `  - ${item}`)]
  })
}

/** 按宿主输出卸载结果 */
export function printUninstallResult(result: UninstallResult): void {
  for (const [host, report] of Object.entries(result.hosts ?? {})) {
    if (!report)
      continue
    console.log(ansis.cyan(`  [${host}] ${report.success ? '✓' : '✗'}`))
    if (report.removedSkills.length > 0)
      console.log(ansis.gray(`    removed: ${report.removedSkills.join(', ')}`))
    if (report.removedLegacyPrompts.length > 0)
      console.log(ansis.gray(`    legacy residue: ${report.removedLegacyPrompts.join(', ')}`))
    if (report.removedPrompts)
      console.log(ansis.gray('    role prompts: removed'))
    for (const err of report.errors)
      console.log(ansis.red(`    ${err}`))
  }
}

export async function runUninstall(hosts: HostId[]): Promise<UninstallResult> {
  return uninstallWorkflows('', { hosts })
}
