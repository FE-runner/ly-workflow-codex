import type { OpenspecEnsureResult, OpenspecInspection } from '../utils/preflight'
import ansis from 'ansis'
import { parseHostList } from '../utils/host-selection'
import { confirmOpenspecCliInstall, ensureOpenspec, inspectOpenspec, printOpenspecInspection } from '../utils/preflight'

export interface OpenspecCommandOptions {
  json?: boolean
  yes?: boolean
  /** 宿主集合（逗号分隔）：限定检查与修复范围；缺省 = 已安装宿主（无则只读检查全部已注册宿主） */
  host?: string
}

/**
 * `lycx openspec <inspect|ensure>`：以宿主集合为扫描与修复依据。
 * - inspect：只读，按宿主分别判定 skills
 * - ensure：显式 --host 视为已确认宿主，允许为其执行项目级修复；未指定时只修复已安装宿主，
 *   全新环境（无任何宿主配置文件）只做只读诊断
 * 返回结果便于测试；未知子命令 / 非法宿主设置 process.exitCode = 1。
 */
export async function runOpenspecCommand(
  action: string,
  options: OpenspecCommandOptions = {},
): Promise<OpenspecInspection | OpenspecEnsureResult | undefined> {
  let hosts
  try {
    hosts = parseHostList(options.host)
  }
  catch (error) {
    console.error(ansis.red(error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
    return undefined
  }

  if (action === 'inspect') {
    const result = await inspectOpenspec({ hosts })
    if (options.json)
      console.log(JSON.stringify(result, null, 2))
    else
      printOpenspecInspection(result)
    return result
  }

  if (action === 'ensure') {
    const result = await ensureOpenspec({
      hosts,
      allowWrite: hosts && hosts.length > 0 ? true : undefined,
      yes: options.yes,
      confirmInstall: () => confirmOpenspecCliInstall(),
    })
    if (options.json)
      console.log(JSON.stringify(result, null, 2))
    else
      printOpenspecInspection(result.inspection)
    return result
  }

  console.error(ansis.red(`未知 openspec 子命令: ${action}`))
  process.exitCode = 1
  return undefined
}
