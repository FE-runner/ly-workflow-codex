import type { HostAdapterConfig, HostId } from '../utils/host-adapters'
import { readFileSync } from 'node:fs'
import { join } from 'pathe'
import { getAdapter } from '../utils/host-adapters'
import { PACKAGE_ROOT } from '../utils/installer-template'

/** 测试辅助：按指定宿主渲染一个共享命令模板（与安装期同一条渲染链，不含 ~/ 展开） */
export function renderHostCommand(host: HostId, command: string, config: HostAdapterConfig = {}): string {
  const templateDir = join(PACKAGE_ROOT, 'templates')
  const content = readFileSync(join(templateDir, 'skills', `${command}.md`), 'utf-8')
  const adapter = getAdapter(host)
  return adapter.renderTemplate(content, {
    installDir: '',
    force: true,
    templateDir,
    paths: adapter.defaultPaths(),
    config,
    result: { success: true, installedCommands: [], installedPrompts: [], errors: [], configPath: '' },
  }, command)
}
