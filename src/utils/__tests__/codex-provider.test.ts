import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { listModelProviders, readCodexCurrentModel, readModelsJson, sanitizeProviderName, upsertModelProvider } from '../codex-provider'

/**
 * codex-provider 单测——全部在 mkdtemp 临时目录运行，不触碰真实 ~/.codex。
 * 覆盖：config.toml 解析/空列表回退、增量写入（追加新块保注释 / 已存在块不重复写 /
 * 写入后 parse 合法 / 顶层 model_provider 原位替换与文件头插入）、Codex 现状读取
 * （顶层 model / models.json 解析）。
 */

function makeTmp(): string {
  return mkdtempSync(join(tmpdir(), 'ly-codex-provider-test-'))
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true })
}

describe('sanitizeProviderName', () => {
  it('keeps [A-Za-z0-9_-] characters', () => {
    expect(sanitizeProviderName('my-provider_1')).toBe('my-provider_1')
    expect(sanitizeProviderName('  deepseek.v3 ')).toBe('deepseekv3')
  })

  it('rejects empty / non-string values', () => {
    expect(sanitizeProviderName('')).toBeUndefined()
    expect(sanitizeProviderName('///')).toBeUndefined()
    expect(sanitizeProviderName(42)).toBeUndefined()
    expect(sanitizeProviderName(undefined)).toBeUndefined()
  })
})

describe('listModelProviders', () => {
  it('parses [model_providers.*] entries with base_url and env_key', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      writeFileSync(file, `
# my codex config
model_provider = "deepseek"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com/v1"
env_key = "DEEPSEEK_API_KEY"

[model_providers.openrouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
`, 'utf-8')

      const providers = await listModelProviders(file)
      expect(providers).toHaveLength(2)
      const deepseek = providers.find(p => p.name === 'deepseek')
      expect(deepseek?.baseUrl).toBe('https://api.deepseek.com/v1')
      expect(deepseek?.envKey).toBe('DEEPSEEK_API_KEY')
    }
    finally {
      cleanup(dir)
    }
  })

  it('returns empty list when file is missing', async () => {
    const dir = makeTmp()
    try {
      expect(await listModelProviders(join(dir, 'config.toml'))).toEqual([])
    }
    finally {
      cleanup(dir)
    }
  })

  it('returns empty list (not throw) when config.toml is invalid', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      writeFileSync(file, 'this is = not valid toml [', 'utf-8')
      expect(await listModelProviders(file)).toEqual([])
    }
    finally {
      cleanup(dir)
    }
  })
})

describe('upsertModelProvider', () => {
  it('creates a new config.toml with top-level model_provider + provider block (parse-valid)', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      const result = await upsertModelProvider({ name: 'my-proxy', baseUrl: 'https://proxy.example.com/v1' }, file)
      expect(result.status).toBe('written')

      const content = readFileSync(file, 'utf-8')
      const parsed = parse(content) as any
      expect(parsed.model_provider).toBe('my-proxy')
      expect(parsed.model_providers['my-proxy'].base_url).toBe('https://proxy.example.com/v1')
      // 顶层键必须位于首个 section 之前
      expect(content.indexOf('model_provider =')).toBeLessThan(content.indexOf('[model_providers.'))
    }
    finally {
      cleanup(dir)
    }
  })

  it('appends a new block to an existing file while preserving comments and other blocks', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      const original = `# user's hand-written header comment
model_provider = "deepseek"

[model_providers.deepseek]
# deepseek comment kept
base_url = "https://api.deepseek.com/v1"
env_key = "DEEPSEEK_API_KEY"
`
      writeFileSync(file, original, 'utf-8')

      const result = await upsertModelProvider({ name: 'my-proxy', baseUrl: 'https://proxy.example.com/v1' }, file)
      expect(result.status).toBe('written')

      const content = readFileSync(file, 'utf-8')
      // 文本增量合并：原有注释与无关行逐行保留（顶层 model_provider 除外——
      // 选自定义 provider 即激活它，该行被原位替换为新名称）
      for (const line of original.split('\n').filter(l => l.trim() !== '' && !/^model_provider\s*=/.test(l)))
        expect(content).toContain(line)

      const parsed = parse(content) as any
      expect(parsed.model_provider).toBe('my-proxy') // 顶层键原位替换为自定义 provider
      expect(parsed.model_providers.deepseek.env_key).toBe('DEEPSEEK_API_KEY')
      expect(parsed.model_providers['my-proxy'].base_url).toBe('https://proxy.example.com/v1')
    }
    finally {
      cleanup(dir)
    }
  })

  it('does not duplicate-write an existing block (status exists, file untouched)', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      const original = `# header
model_provider = "my-proxy"

[model_providers."my-proxy"]
base_url = "https://old.example.com/v1"
`
      writeFileSync(file, original, 'utf-8')

      const before = readFileSync(file, 'utf-8')
      const result = await upsertModelProvider({ name: 'my-proxy', baseUrl: 'https://new.example.com/v1' }, file)
      expect(result.status).toBe('exists')
      expect(readFileSync(file, 'utf-8')).toBe(before)
    }
    finally {
      cleanup(dir)
    }
  })

  it('replaces an existing top-level model_provider value in place', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      writeFileSync(file, `# header
model_provider = "deepseek"

[model_providers.deepseek]
base_url = "https://api.deepseek.com/v1"
`, 'utf-8')

      const result = await upsertModelProvider({ name: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1' }, file)
      expect(result.status).toBe('written')

      const content = readFileSync(file, 'utf-8')
      const parsed = parse(content) as any
      expect(parsed.model_provider).toBe('openrouter')
      // 原位替换：model_provider 行仍在文件头注释之后、首个 section 之前
      expect(content.indexOf('# header')).toBeLessThan(content.indexOf('model_provider ='))
      expect(content.indexOf('model_provider =')).toBeLessThan(content.indexOf('[model_providers.deepseek]'))
      expect(content).toContain('# header') // 注释未丢
    }
    finally {
      cleanup(dir)
    }
  })

  it('inserts model_provider before the first section when no top-level key exists', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      writeFileSync(file, `# header

[features]
multi_agent = true
`, 'utf-8')

      const result = await upsertModelProvider({ name: 'my-proxy', baseUrl: 'https://proxy.example.com/v1' }, file)
      expect(result.status).toBe('written')

      const content = readFileSync(file, 'utf-8')
      const parsed = parse(content) as any
      expect(parsed.model_provider).toBe('my-proxy')
      expect(parsed.features.multi_agent).toBe(true)
      expect(content.indexOf('model_provider =')).toBeLessThan(content.indexOf('[features]'))
    }
    finally {
      cleanup(dir)
    }
  })

  it('rejects provider names that sanitize to empty / empty base_url', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      expect((await upsertModelProvider({ name: '///', baseUrl: 'https://x.com/v1' }, file)).status).toBe('error')
      expect((await upsertModelProvider({ name: 'ok', baseUrl: '  ' }, file)).status).toBe('error')
      expect(existsSync(file)).toBe(false)
    }
    finally {
      cleanup(dir)
    }
  })
})

describe('readCodexCurrentModel (codex-model-config)', () => {
  it('reads the top-level model from config.toml', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      writeFileSync(file, 'model = "DeepSeek-V4-Flash-0731"\nmodel_provider = "blueai"\n', 'utf-8')
      expect(await readCodexCurrentModel(file)).toBe('DeepSeek-V4-Flash-0731')
    }
    finally {
      cleanup(dir)
    }
  })

  it('returns undefined when the top-level model is absent', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'config.toml')
      writeFileSync(file, '[model_providers.x]\nname = "x"\n', 'utf-8')
      expect(await readCodexCurrentModel(file)).toBeUndefined()
    }
    finally {
      cleanup(dir)
    }
  })

  it('returns undefined for missing file / parse failure', async () => {
    const dir = makeTmp()
    try {
      expect(await readCodexCurrentModel(join(dir, 'nope.toml'))).toBeUndefined()
      const bad = join(dir, 'bad.toml')
      writeFileSync(bad, 'model = "unterminated\n[', 'utf-8')
      expect(await readCodexCurrentModel(bad)).toBeUndefined()
    }
    finally {
      cleanup(dir)
    }
  })
})

describe('readModelsJson (codex-model-config)', () => {
  it('extracts model slugs from the codex cache shape models[].slug', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'models.json')
      writeFileSync(file, JSON.stringify({ models: [{ slug: 'deepseek-v4-flash' }, { slug: 'gpt-5.6-luna' }, { slug: '  ' }] }), 'utf-8')
      expect(await readModelsJson(file)).toEqual(['deepseek-v4-flash', 'gpt-5.6-luna'])
    }
    finally {
      cleanup(dir)
    }
  })

  it('tolerates a bare string array and {models: [string]}', async () => {
    const dir = makeTmp()
    try {
      const bare = join(dir, 'bare.json')
      writeFileSync(bare, '["a", { "slug": "b" }]', 'utf-8')
      expect(await readModelsJson(bare)).toEqual(['a', 'b'])

      const nested = join(dir, 'nested.json')
      writeFileSync(nested, '{"models": ["x", "y"]}', 'utf-8')
      expect(await readModelsJson(nested)).toEqual(['x', 'y'])
    }
    finally {
      cleanup(dir)
    }
  })

  it('returns undefined for missing file / broken JSON (distinct from 0 models)', async () => {
    const dir = makeTmp()
    try {
      expect(await readModelsJson(join(dir, 'nope.json'))).toBeUndefined()
      const bad = join(dir, 'bad.json')
      writeFileSync(bad, '{not json', 'utf-8')
      expect(await readModelsJson(bad)).toBeUndefined()
      // 空注册集合 → 空数组（与"未检测到"区分）
      const empty = join(dir, 'empty.json')
      writeFileSync(empty, '{"models": []}', 'utf-8')
      expect(await readModelsJson(empty)).toEqual([])
      // 合法 JSON 但无 models 键（{}）→ 未检测到（undefined，与空注册集合区分）
      const noKey = join(dir, 'nokey.json')
      writeFileSync(noKey, '{}', 'utf-8')
      expect(await readModelsJson(noKey)).toBeUndefined()
    }
    finally {
      cleanup(dir)
    }
  })

  it('never returns provider secrets (envKey / apiKey 不进入返回值)', async () => {
    const dir = makeTmp()
    try {
      const file = join(dir, 'models.json')
      writeFileSync(file, JSON.stringify({ models: [{ slug: 'gpt-5.5', env_key: 'SECRET', api_key: 'SK' }] }), 'utf-8')
      const result = await readModelsJson(file)
      const serialized = JSON.stringify(result)
      expect(serialized).not.toContain('env_key')
      expect(serialized).not.toContain('api_key')
      expect(serialized).not.toContain('SECRET')
    }
    finally {
      cleanup(dir)
    }
  })
})
