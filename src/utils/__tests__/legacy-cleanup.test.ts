import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanupLegacyArtifacts } from '../legacy-cleanup'

/**
 * legacy-cleanup 支持注入 codexDir——本测试全部在
 * mkdtemp 临时目录构造产物后运行，绝不触碰真实 homedir。
 * 覆盖：AGENTS.md LY 区块剥离、config.toml 旧区块删除、旧 agents 清除、
 * 非 LY 内容保留、幂等、不存在的目标不报错。
 */

function write(path: string, content: string): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, content)
}

function makeFakeCodexHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'ly-cleanup-test-'))
  const codex = join(home, '.codex')

  // 假 ~/.codex/AGENTS.md：含 LY 管理区块（无 ` --` 后缀的起始标记，覆盖 em dash 变体兼容）+ 用户内容
  write(join(codex, 'AGENTS.md'), [
    '# My Codex Config',
    '',
    '<!-- LY:START',
    'ly managed content',
    '-- LY:END -->',
    '',
    'User content stays',
    '',
  ].join('\n'))
  // 假 ~/.codex/config.toml：LY 头部注释 + [features.multi_agent_v2] 表 + 用户配置
  write(join(codex, 'config.toml'), [
    '# ly-workflow managed section',
    '# Installed by: npx ly-workflow init',
    '',
    '[model]',
    'gpt = "5"',
    '',
    '[features.multi_agent_v2]',
    'enabled = true',
    'extra = "value"',
    '',
    '[mcp_servers.user_own]',
    'user-key = "keep-me"',
    '',
  ].join('\n'))
  // 假 ~/.codex/agents：ly- 前缀旧代理 + 用户自己的 agent
  write(join(codex, 'agents/ly-review.toml'), '# Installed by: npx ly-workflow init\n[agent]\nname = "review"\n')
  write(join(codex, 'agents/user-own.toml'), '# user agent')
  // ly- 前缀但无 ly 写入标记 + 非 ly 前缀：都属于用户文件，不得删除
  write(join(codex, 'agents/ly-custom.toml'), '# user custom agent, no ly marker used\n')

  return home
}

describe('cleanupLegacyArtifacts（codex 侧残留清理，注入临时目录）', () => {
  it('剥离 LY 区块与旧产物、保留用户内容、幂等', async () => {
    const home = makeFakeCodexHome()
    try {
      const r = await cleanupLegacyArtifacts({ codexDir: join(home, '.codex') })
      expect(r.failed).toEqual([])

      // AGENTS.md：文件保留（仅剥区块），非 LY 内容保留
      expect(existsSync(join(home, '.codex/AGENTS.md'))).toBe(true)
      const agentsMd = readFileSync(join(home, '.codex/AGENTS.md'), 'utf-8')
      expect(agentsMd).toContain('# My Codex Config')
      expect(agentsMd).toContain('User content stays')
      expect(agentsMd).not.toContain('LY:START')
      expect(agentsMd).not.toContain('ly managed content')

      // config.toml：LY 头部注释 + multi_agent_v2 表移除；用户配置保留
      const configToml = readFileSync(join(home, '.codex/config.toml'), 'utf-8')
      expect(configToml).not.toContain('# ly-workflow')
      expect(configToml).not.toContain('Installed by: npx ly-workflow')
      expect(configToml).not.toContain('features.multi_agent_v2')
      expect(configToml).not.toContain('enabled = true')
      expect(configToml).toContain('[model]')
      expect(configToml).toContain('gpt = "5"')
      expect(configToml).toContain('[mcp_servers.user_own]')
      expect(configToml).toContain('user-key = "keep-me"')

      // 旧 agents：含 ly 标记的 ly-*.toml 移除；无标记的 ly-* / 用户 agent 保留
      expect(existsSync(join(home, '.codex/agents/ly-review.toml'))).toBe(false)
      expect(existsSync(join(home, '.codex/agents/user-own.toml'))).toBe(true)
      expect(existsSync(join(home, '.codex/agents/ly-custom.toml'))).toBe(true)

      // 幂等：第二次运行全 skipped、零 cleaned、零 failed
      const second = await cleanupLegacyArtifacts({ codexDir: join(home, '.codex') })
      expect(second.cleaned).toEqual([])
      expect(second.failed).toEqual([])
      expect(second.skipped.length).toBeGreaterThan(0)
    }
    finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('does not touch config.toml / ly-*.toml without ly write markers (按表名/前缀盲删修复)', async () => {
    const home = mkdtempSync(join(tmpdir(), 'ly-cleanup-nomarker-'))
    const codex = join(home, '.codex')
    // config.toml 含 [features.multi_agent_v2] 表但无任何 ly 写入标记 → 整文件跳过
    write(join(codex, 'config.toml'), [
      '# user config',
      '[model]',
      'gpt = "5"',
      '',
      '[features.multi_agent_v2]',
      'enabled = true',
      '',
    ].join('\n'))
    // ly- 前缀但内容无 ly 标记 → 跳过并报告
    write(join(codex, 'agents/ly-user-custom.toml'), '# user custom agent\n')
    try {
      const r = await cleanupLegacyArtifacts({ codexDir: codex })
      expect(r.cleaned).toEqual([])
      expect(r.skipped).toContain('~/.codex/config.toml (no ly-workflow write markers)')
      expect(r.skipped).toContain('~/.codex/agents/ly-user-custom.toml (no ly-workflow write marker)')
      // 文件原样保留
      expect(readFileSync(join(codex, 'config.toml'), 'utf-8')).toContain('[features.multi_agent_v2]')
      expect(existsSync(join(codex, 'agents/ly-user-custom.toml'))).toBe(true)
    }
    finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('目标全部不存在时不报错（failed 为空、全 skipped）', async () => {
    const home = mkdtempSync(join(tmpdir(), 'ly-cleanup-empty-'))
    try {
      const r = await cleanupLegacyArtifacts({ codexDir: join(home, '.codex') })
      expect(r.failed).toEqual([])
      expect(r.cleaned).toEqual([])
      expect(r.skipped.length).toBeGreaterThan(0)
    }
    finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
