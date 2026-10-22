import type { LyConfig } from '../../types'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { writeLyConfig } from '../config'
import { readEffectiveProjectTestMode } from '../project-config'

const tempDirs: string[] = []

function makeLocation() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lyx-project-config-test-')))
  const lyDir = join(root, 'host-config')
  tempDirs.push(root)
  return { root, lyDir, projectPath: root }
}

function baseConfig(host: LyConfig['host'], projectMode?: { projectPath: string, testMode: unknown }): LyConfig {
  return {
    general: {
      version: '0.0.0',
      language: 'zh-CN',
      createdAt: new Date(0).toISOString(),
    },
    workflows: { installed: [] },
    paths: { commands: '', prompts: '', backup: '' },
    host,
    ...(projectMode === undefined
      ? {}
      : { projects: { [projectMode.projectPath]: { testMode: projectMode.testMode as never } } }),
  }
}

describe('readEffectiveProjectTestMode', () => {
  beforeEach(() => {
    while (tempDirs.length > 0)
      rmSync(tempDirs.pop()!, { recursive: true, force: true })
  })

  it('uses a valid ask project override', async () => {
    const location = makeLocation()
    await writeLyConfig(
      baseConfig({ testMode: 'normal' }, { projectPath: location.projectPath, testMode: 'ask' }),
      'codex',
      { lyDir: location.lyDir },
    )

    const result = await readEffectiveProjectTestMode('codex', {
      cwd: location.root,
      location: { lyDir: location.lyDir },
    })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.effective.mode).toBe('ask')
      expect(result.effective.source).toBe('project')
      expect(result.effective.warnings).toEqual([])
    }
  })

  it('falls back to host mode when matching project testMode is invalid', async () => {
    const location = makeLocation()
    await writeLyConfig(
      baseConfig({ testMode: 'off' }, { projectPath: location.projectPath, testMode: 'invalid' }),
      'codex',
      { lyDir: location.lyDir },
    )

    const result = await readEffectiveProjectTestMode('codex', {
      cwd: location.root,
      location: { lyDir: location.lyDir },
    })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.effective.mode).toBe('off')
      expect(result.effective.source).toBe('host')
      expect(result.effective.warnings.map(w => w.code)).toContain('project-test-mode-invalid')
    }
  })

  it('treats invalid host testMode as normal', async () => {
    const location = makeLocation()
    await writeLyConfig(baseConfig({ testMode: 'sometimes' as never }), 'codex', { lyDir: location.lyDir })

    const result = await readEffectiveProjectTestMode('codex', {
      cwd: location.root,
      location: { lyDir: location.lyDir },
    })

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.effective.mode).toBe('normal')
      expect(result.effective.hostTestModeInvalid).toBe(true)
    }
  })

  it('returns invalid when the host config is unreadable', async () => {
    const location = makeLocation()
    await writeLyConfig(baseConfig({ testMode: 'normal' }), 'codex', { lyDir: location.lyDir })
    const configPath = join(location.lyDir, 'config.toml')
    writeFileSync(configPath, '[host\ninvalid = true\n')
    expect(readFileSync(configPath, 'utf8')).toContain('[host')

    const result = await readEffectiveProjectTestMode('codex', {
      cwd: location.root,
      location: { lyDir: location.lyDir },
    })

    expect(result.status).toBe('invalid')
  })
})
