import type { HostConfigLocation } from './config'
import type { HostId } from './host-adapters'
import fs from 'fs-extra'
import { listInstalledHosts } from './config'
import { FALLBACK_HOSTS, getAdapter, isRegisteredHost, listRegisteredHosts } from './host-adapters'

// ═══════════════════════════════════════════════════════
// 宿主集合解析（共享层：只经注册表与适配器取值，不认识任何具体宿主）
// ═══════════════════════════════════════════════════════

/** 探测到的宿主：适配器声明的探测目录存在即视为用户在用该宿主 */
export async function detectHosts(): Promise<HostId[]> {
  const detected: HostId[] = []
  for (const host of listRegisteredHosts()) {
    if (await fs.pathExists(getAdapter(host).detectDir()))
      detected.push(host)
  }
  return detected
}

/**
 * 非交互安装（`init --skip-prompt` / `update`）的宿主集合：
 * 1. 已安装宿主（配置文件存在）非空 → 原样重装该集合，不擅自新增宿主；
 * 2. 否则（全新环境 / CI）→ 取探测到的宿主；
 * 3. 仍为空 → 兜底集合（保持改造前全新环境下只装 codex 的行为），SHALL NOT 以空集合结束。
 */
export function resolveNonInteractiveHosts(input: { installed: HostId[], detected: HostId[] }): HostId[] {
  if (input.installed.length > 0)
    return input.installed
  if (input.detected.length > 0)
    return input.detected
  return [...FALLBACK_HOSTS]
}

/** 交互安装的默认勾选：已安装 ∪ 探测到（按注册顺序）；两者皆空时取兜底集合 */
export function defaultInteractiveHosts(input: { installed: HostId[], detected: HostId[] }): HostId[] {
  const picked = listRegisteredHosts().filter(h => input.installed.includes(h) || input.detected.includes(h))
  return picked.length > 0 ? picked : [...FALLBACK_HOSTS]
}

/** 解析用户显式指定的宿主（逗号分隔或数组）；存在未注册宿主时抛错并列出合法取值 */
export function parseHostList(value: string | string[] | undefined): HostId[] | undefined {
  if (value === undefined)
    return undefined
  const items = (Array.isArray(value) ? value : value.split(','))
    .map(v => v.trim())
    .filter(Boolean)
  const invalid = items.filter(v => !isRegisteredHost(v))
  if (invalid.length > 0)
    throw new Error(`Unknown host: ${invalid.join(', ')} (available: ${listRegisteredHosts().join(', ')})`)
  return [...new Set(items)] as HostId[]
}

/**
 * 运维命令（uninstall / doctor / status / update）的作用宿主：
 * 显式指定 → 只作用于指定宿主；未指定 → 全部已安装宿主。
 */
export async function resolveTargetHosts(
  explicit: HostId[] | undefined,
  locations: Partial<Record<HostId, HostConfigLocation>> = {},
): Promise<HostId[]> {
  if (explicit && explicit.length > 0)
    return explicit
  return listInstalledHosts(locations)
}
