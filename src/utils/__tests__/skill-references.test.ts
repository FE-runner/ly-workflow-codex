import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { installWorkflows } from '../installer'
import { listMissingSkillReferences, parseSkillReferences } from '../installer-template'

const base = mkdtempSync(join(tmpdir(), 'ly-skill-references-'))

afterAll(async () => {
  await fs.remove(base)
})

describe('skill reference declarations', () => {
  it('parses frontmatter block-list references and rejects traversal paths', async () => {
    const content = [
      '---',
      'name: demo',
      'references:',
      '  - references/a.md',
      '  - "references/nested/b.md"',
      '---',
      '# Demo',
    ].join('\n')
    expect(parseSkillReferences(content)).toEqual(['references/a.md', 'references/nested/b.md'])

    const skillDir = join(base, 'declaration-check')
    await fs.ensureDir(skillDir)
    writeFileSync(join(skillDir, 'SKILL.md'), content.replace('references/a.md', 'references/../secret.md'))
    expect(await listMissingSkillReferences(skillDir)).toContain('references/../secret.md')

    writeFileSync(join(skillDir, 'SKILL.md'), content.replace('references/a.md', 'references/foo\\..\\..\\secret.md'))
    expect(await listMissingSkillReferences(skillDir)).toContain('references/foo\\..\\..\\secret.md')

    await fs.ensureDir(join(skillDir, 'references', 'a.md'))
    writeFileSync(join(skillDir, 'SKILL.md'), content)
    expect(await listMissingSkillReferences(skillDir)).toContain('references/a.md')
  })

  it('installs rendered references for both hosts and removes stale reference files on force update', async () => {
    const paths = {
      codex: {
        skillsDir: join(base, 'codex-skills'),
        promptsDir: join(base, 'codex-prompts'),
        lyDir: join(base, 'codex-lyx'),
      },
      claude: {
        skillsDir: join(base, 'claude-skills'),
        agentsDir: join(base, 'claude-agents'),
        promptsDir: join(base, 'claude-prompts'),
        lyDir: join(base, 'claude-lyx'),
      },
    }
    const result = await installWorkflows(['review-code'], '', true, {
      hosts: ['codex', 'claude'],
      hostPaths: paths,
    })
    expect(result.success, result.errors.join('\n')).toBe(true)

    const codexSkill = join(paths.codex.skillsDir, 'lyx-review-code')
    const claudeSkill = join(paths.claude.skillsDir, 'lyx-review-code')
    expect(await listMissingSkillReferences(codexSkill)).toEqual([])
    expect(await listMissingSkillReferences(claudeSkill)).toEqual([])

    const codexContract = readFileSync(join(codexSkill, 'references', 'review-contract.md'), 'utf-8')
    const claudeContract = readFileSync(join(claudeSkill, 'references', 'review-contract.md'), 'utf-8')
    expect(codexContract).toContain('/.codex/lyx/prompts/codex/reviewer.md')
    expect(claudeContract).not.toContain('prompts/codex')

    const stale = join(codexSkill, 'references', 'stale.md')
    writeFileSync(stale, '# stale\n')
    await installWorkflows(['review-code'], '', true, {
      hosts: ['codex'],
      hostPaths: paths,
    })
    expect(fs.existsSync(stale)).toBe(false)
  })

  it('fails loudly when a declared reference is absent from the package', async () => {
    const fakeRoot = join(base, 'fake-package')
    await fs.copy(join(import.meta.dirname, '..', '..', '..', 'templates'), join(fakeRoot, 'templates'))
    await fs.remove(join(fakeRoot, 'templates', 'skill-references', 'review-code', 'review-contract.md'))

    vi.resetModules()
    vi.doMock('../installer-template', async (importOriginal) => {
      const mod = await importOriginal<typeof import('../installer-template')>()
      return { ...mod, PACKAGE_ROOT: fakeRoot }
    })
    const { installWorkflows: installWithBrokenPackage } = await import('../installer')
    const preservedSkill = join(base, 'broken-skills', 'lyx-review-code')
    await fs.ensureDir(join(preservedSkill, 'references'))
    writeFileSync(join(preservedSkill, 'SKILL.md'), '# preserved\n')
    writeFileSync(join(preservedSkill, 'references', 'old.md'), '# old\n')
    const result = await installWithBrokenPackage(['review-code'], '', true, {
      hosts: ['codex'],
      hostPaths: {
        codex: {
          skillsDir: join(base, 'broken-skills'),
          promptsDir: join(base, 'broken-prompts'),
          lyDir: join(base, 'broken-lyx'),
        },
      },
    })
    vi.doUnmock('../installer-template')
    expect(result.success).toBe(false)
    expect(result.hosts?.codex?.errors.join('\n')).toContain('Skill reference template missing')
    expect(readFileSync(join(preservedSkill, 'SKILL.md'), 'utf-8')).toBe('# preserved\n')
    expect(readFileSync(join(preservedSkill, 'references', 'old.md'), 'utf-8')).toBe('# old\n')
  })
})
