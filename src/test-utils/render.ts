import type { HostAdapterConfig, HostId } from '../utils/host-adapters'
import { readFileSync } from 'node:fs'
import { join } from 'pathe'
import { getAdapter } from '../utils/host-adapters'
import { PACKAGE_ROOT, parseSkillReferences } from '../utils/installer-template'

/** 测试辅助：只渲染主 SKILL.md（与安装期同一条渲染链，不含 ~/ 展开）。 */
export function renderHostCommandMain(host: HostId, command: string, config: HostAdapterConfig = {}): string {
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

/** 测试辅助：渲染 skill 声明的单个 sidecar reference。 */
export function renderHostSkillReference(
  host: HostId,
  command: string,
  reference: string,
  config: HostAdapterConfig = {},
): string {
  const templateDir = join(PACKAGE_ROOT, 'templates')
  const content = readFileSync(join(templateDir, 'skill-references', command, reference.replace(/^references\//, '')), 'utf-8')
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

/** 测试辅助：主 SKILL.md + frontmatter 声明的全部 references。 */
export function renderHostSkillBundle(host: HostId, command: string, config: HostAdapterConfig = {}): string {
  const main = renderHostCommandMain(host, command, config)
  const references = parseSkillReferences(main)
  return [
    main,
    ...references.map(reference => renderHostSkillReference(host, command, reference, config)),
  ].join('\n\n')
}

/** 测试辅助：渲染主 SKILL.md 及其声明的 references。 */
export function renderHostCommand(host: HostId, command: string, config: HostAdapterConfig = {}): string {
  return renderHostSkillBundle(host, command, config)
}
