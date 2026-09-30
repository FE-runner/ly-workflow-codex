import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import fs from 'fs-extra'
import { afterAll, describe, expect, it, vi } from 'vitest'

function findPackageRoot(): string {
  let dir = import.meta.dirname
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(join(dir, 'package.json')) && fs.existsSync(join(dir, 'templates')))
      return dir
    dir = join(dir, '..')
  }
  throw new Error('Could not find package root')
}

const ROOT = findPackageRoot()
const files: string[] = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')).files

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

/** 安装期真正读取的模板文件（templates/ 下的文档性文件除外） */
const installSources = walk(join(ROOT, 'templates'))
  .map(f => relative(ROOT, f).replace(/\\/g, '/'))
  .filter(f => f !== 'templates/CLAUDE.md')

describe('package.json files ↔ template source dirs (9.1)', () => {
  const templateEntries = files.filter(f => f.startsWith('templates/'))

  it('every installed template file is covered by a files entry (no omission)', () => {
    const uncovered = installSources.filter(f => !templateEntries.some(e => f.startsWith(e)))
    expect(uncovered).toEqual([])
  })

  it('every templates/ files entry exists on disk and ships something (no stale entry)', () => {
    for (const entry of templateEntries) {
      expect(fs.existsSync(join(ROOT, entry)), `stale files entry: ${entry}`).toBe(true)
      expect(installSources.some(f => f.startsWith(entry)), `empty files entry: ${entry}`).toBe(true)
    }
  })

  it('the covered template dir set equals the source dir set', () => {
    const topLevel = (paths: string[]) => [...new Set(paths.map(p => p.split('/').slice(0, 2).join('/')))].sort()
    expect(topLevel(templateEntries)).toEqual(topLevel(installSources))
  })

  it('host packages ship via dist (src/ is not listed separately)', () => {
    expect(files).toContain('dist')
    expect(files.some(f => f.startsWith('src'))).toBe(false)
  })
})

describe('incomplete package is reported, never a silent success (multi-host-install)', () => {
  const fakeRoot = mkdtempSync(join(tmpdir(), 'ly-incomplete-pkg-'))

  afterAll(async () => {
    await fs.remove(fakeRoot)
  })

  it('missing templates/skills → install fails with an explicit error for every host', async () => {
    await fs.ensureDir(join(fakeRoot, 'templates', 'hosts'))
    vi.resetModules()
    vi.doMock('../installer-template', async (importOriginal) => {
      const mod = await importOriginal<typeof import('../installer-template')>()
      return { ...mod, PACKAGE_ROOT: fakeRoot }
    })
    const { installWorkflows, getAllCommandIds } = await import('../installer')
    const out = join(fakeRoot, 'out')
    const result = await installWorkflows(getAllCommandIds(), '', true, {
      hosts: ['codex', 'claude'],
      hostPaths: {
        codex: { skillsDir: join(out, 'codex-skills'), promptsDir: join(out, 'codex-prompts'), lyDir: join(out, 'codex-lyx') },
        claude: { skillsDir: join(out, 'claude-skills'), agentsDir: join(out, 'claude-agents'), promptsDir: join(out, 'claude-prompts'), lyDir: join(out, 'claude-lyx') },
      },
    })
    vi.doUnmock('../installer-template')
    expect(result.success).toBe(false)
    expect(result.installedCommands).toEqual([])
    expect(result.hosts?.codex?.errors.join('\n')).toContain('Command template directory not found')
    expect(result.hosts?.claude?.errors.join('\n')).toContain('Command template directory not found')
    expect(fs.existsSync(join(out, 'claude-skills', 'lyx-apply'))).toBe(false)
  })
})
