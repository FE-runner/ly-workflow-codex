import { homedir } from 'node:os'
import fs from 'fs-extra'
import { join } from 'pathe'
import { parse } from 'smol-toml'

// ═══════════════════════════════════════════════════════
// codex provider 管理（multi-host-single-agent-mode 追加细化）
//
// init 向导 codex 分支的三级采集数据源（未来 menu 复用）：
// 1. 读取 ~/.codex/config.toml 现有 [model_providers.*] 条目
// 2. 自定义 provider 增量写入 config.toml（文本级合并，保注释）
// 3. GET {base_url}/models 拉取模型列表（OpenAI 兼容）
// ═══════════════════════════════════════════════════════

/** config.toml 中一条 [model_providers.*] 条目的投影 */
export interface CodexModelProvider {
  name: string
  baseUrl?: string
  /** provider 声明的 env_key——API key 存放在该名称的环境变量里 */
  envKey?: string
}

export function codexConfigPath(): string {
  return join(homedir(), '.codex', 'config.toml')
}

/**
 * provider 名称清洗：该值既进 TOML section 头（[model_providers.<name>]，bare key
 * 仅允许 [A-Za-z0-9_-]），又作为 model_provider 顶层值——白名单剔除其余字符；
 * 剔除后为空 → undefined。
 */
export function sanitizeProviderName(value: unknown): string | undefined {
  if (typeof value !== 'string')
    return undefined
  const cleaned = value.trim().replace(/[^\w-]/g, '')
  return cleaned === '' ? undefined : cleaned
}

/**
 * 读取并解析 ~/.codex/config.toml。
 * 文件缺失或解析失败 → null（调用方按"无已有 provider"处理，不报错）。
 */
export async function readCodexConfigToml(filePath: string = codexConfigPath()): Promise<Record<string, any> | null> {
  try {
    if (!(await fs.pathExists(filePath)))
      return null
    const content = await fs.readFile(filePath, 'utf-8')
    return parse(content) as Record<string, any>
  }
  catch {
    return null
  }
}

/**
 * 解析 config.toml 的 [model_providers.*] 条目列表。
 * 文件缺失 / 解析失败 → 空列表（不报错，由调用方决定是否提示）。
 */
export async function listModelProviders(filePath: string = codexConfigPath()): Promise<CodexModelProvider[]> {
  const parsed = await readCodexConfigToml(filePath)
  const table = parsed?.model_providers
  if (!table || typeof table !== 'object')
    return []

  const providers: CodexModelProvider[] = []
  for (const [name, entry] of Object.entries(table as Record<string, any>)) {
    if (!entry || typeof entry !== 'object')
      continue
    providers.push({
      name,
      baseUrl: typeof entry.base_url === 'string' ? entry.base_url : undefined,
      envKey: typeof entry.env_key === 'string' ? entry.env_key : undefined,
    })
  }
  return providers
}

export type UpsertProviderResult
  = | { status: 'exists', name: string }
    | { status: 'written', path: string }
    | { status: 'error', error: string }

/**
 * 增量写入自定义 provider 到 config.toml：
 *
 * 必须保文本增量合并（读原文 → 行级追加/替换 → 写回），SHALL NOT
 * parse + stringify 整文件重写（会丢注释与格式）：
 * - `[model_providers.<name>]` 块已存在 → 不重复写，返回 'exists'（调用方提示"直接选用"）
 * - 块不存在 → 以文本块形式追加到文件尾
 * - 顶层 `model_provider` 键：TOML 规定顶层键必须位于首个 section 之前——
 *   已有该行（在首个 section 前）则原位替换其值；否则插入文件最顶部。
 * 写回后用 smol-toml parse 校验合法性，不合法返回 'error'。
 */
export async function upsertModelProvider(
  input: { name: string, baseUrl: string },
  filePath: string = codexConfigPath(),
): Promise<UpsertProviderResult> {
  const name = sanitizeProviderName(input.name)
  if (!name)
    return { status: 'error', error: 'invalid provider name' }
  const baseUrl = input.baseUrl.trim()
  if (baseUrl === '')
    return { status: 'error', error: 'base_url is required' }

  let original = ''
  try {
    if (await fs.pathExists(filePath))
      original = await fs.readFile(filePath, 'utf-8')
  }
  catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) }
  }

  // 块存在性检测：bare key 与带引号 key 两种形态都识别（引号内名不含 `"`，因名称已白名单化）
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const blockRe = new RegExp(`^\\s*\\[model_providers\\.(?:${escaped}|"${escaped}")\\]\\s*(#.*)?$`, 'm')
  if (blockRe.test(original))
    return { status: 'exists', name }

  const block = [
    `[model_providers.${name}]`,
    `name = "${name}"`,
    `base_url = "${baseUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
  ]

  let updated: string
  if (original === '') {
    // 全新文件：头部注释 + 顶层键 + provider 块
    updated = `# Added by ly-workflow-codex init\nmodel_provider = "${name}"\n\n${block.join('\n')}\n`
  }
  else {
    const lines = original.split('\n')
    // 顶层键处理：只在首个 section 头之前的区域内查找/插入
    let firstSectionIdx = lines.findIndex(l => /^\s*\[/.test(l))
    if (firstSectionIdx === -1)
      firstSectionIdx = lines.length
    const existingKeyIdx = lines
      .slice(0, firstSectionIdx)
      .findIndex(l => /^\s*model_provider\s*=/.test(l))

    if (existingKeyIdx >= 0) {
      lines[existingKeyIdx] = `model_provider = "${name}"`
    }
    else {
      lines.unshift(`model_provider = "${name}"`)
    }

    // 追加 provider 块到文件尾（保证块前有空行分隔）
    while (lines.length > 0 && lines[lines.length - 1] === '')
      lines.pop()
    updated = `${lines.join('\n')}\n\n${block.join('\n')}\n`
  }

  try {
    await fs.ensureDir(join(filePath, '..'))
    // 写回前自检：增量合并结果必须是合法 TOML
    parse(updated)
    await fs.writeFile(filePath, updated, 'utf-8')
  }
  catch (error) {
    return { status: 'error', error: error instanceof Error ? error.message : String(error) }
  }
  return { status: 'written', path: filePath }
}

export type FetchModelsResult
  = | { ok: true, models: string[] }
    | { ok: false, error: string }

/**
 * 拉取 OpenAI 兼容的模型列表：GET {base_url}/models（Authorization: Bearer <key>，
 * key 可空——部分网关不鉴权），默认 10s 超时。非标响应/网络失败返回 ok:false 与原因，
 * 调用方据此回退 inquirer input 自由输入。
 */
export async function fetchCodexModels(input: {
  baseUrl: string
  apiKey?: string
  timeoutMs?: number
}): Promise<FetchModelsResult> {
  const base = input.baseUrl.trim().replace(/\/+$/, '')
  const url = `${base}/models`
  const headers: Record<string, string> = {}
  if (input.apiKey)
    headers.Authorization = `Bearer ${input.apiKey}`

  let res: Response
  try {
    res = await fetch(url, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(input.timeoutMs ?? 10_000),
    })
  }
  catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }

  if (!res.ok)
    return { ok: false, error: `HTTP ${res.status}` }

  let json: any
  try {
    json = await res.json()
  }
  catch {
    return { ok: false, error: 'response is not valid JSON' }
  }

  // OpenAI 兼容形态：{ data: [{ id }] }；宽容处理裸数组与字符串元素
  const arr = Array.isArray(json)
    ? json
    : Array.isArray(json?.data) ? json.data : null
  if (!arr)
    return { ok: false, error: 'unexpected response shape (missing data[])' }

  const models: string[] = []
  for (const item of arr) {
    const id = typeof item === 'string' ? item : typeof item?.id === 'string' ? item.id : ''
    const trimmed = id.trim()
    if (trimmed !== '' && !models.includes(trimmed))
      models.push(trimmed)
  }
  if (models.length === 0)
    return { ok: false, error: 'empty model list' }

  return { ok: true, models }
}
