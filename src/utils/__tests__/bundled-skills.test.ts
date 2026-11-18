import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import { afterAll, describe, expect, it } from 'vitest'
import { BUNDLED_SKILLS, installBundledSkills, isBundledSkillDirName, listMissingBundledSkills } from '../bundled-skills'
import { PACKAGE_ROOT } from '../installer-template'

describe('lyx bundled skills', () => {
  const base = mkdtempSync(join(tmpdir(), 'lyx-bundled-skills-'))
  const templateDir = join(PACKAGE_ROOT, 'templates')

  afterAll(async () => {
    await fs.remove(base)
  })

  it('installs both lyx wrapper skills when missing', async () => {
    const result = await installBundledSkills({ templateDir, skillsDir: base, force: false })

    expect(result.errors).toEqual([])
    expect(result.installed).toEqual([...BUNDLED_SKILLS])
    for (const name of BUNDLED_SKILLS) {
      const content = readFileSync(join(base, name, 'SKILL.md'), 'utf8')
      expect(content).toContain(`name: ${name}`)
    }
    expect(await listMissingBundledSkills(base)).toEqual([])
    await fs.remove(join(base, 'lyx-code-simplification'))
    expect(await listMissingBundledSkills(base)).toEqual(['lyx-code-simplification'])
  })

  it('does not overwrite an existing wrapper without force', async () => {
    const preserveDir = join(base, 'preserve')
    const custom = join(preserveDir, 'lyx-ponytail', 'SKILL.md')
    await fs.ensureDir(join(custom, '..'))
    await fs.writeFile(custom, '# user-managed wrapper\n')

    const result = await installBundledSkills({ templateDir, skillsDir: preserveDir, force: false })

    expect(result.installed).toEqual(['lyx-code-simplification'])
    expect(await fs.readFile(custom, 'utf8')).toBe('# user-managed wrapper\n')
  })

  it('refreshes both wrappers with force', async () => {
    const result = await installBundledSkills({ templateDir, skillsDir: base, force: true })

    expect(result.errors).toEqual([])
    expect(result.installed).toEqual([...BUNDLED_SKILLS])
    expect(await fs.readFile(join(base, 'lyx-ponytail', 'SKILL.md'), 'utf8')).toContain('# Lyx Ponytail')
  })

  it('separates wrapper skill directories from workflow command directories', () => {
    expect(isBundledSkillDirName('lyx-ponytail')).toBe(true)
    expect(isBundledSkillDirName('lyx-code-simplification')).toBe(true)
    expect(isBundledSkillDirName('lyx-apply')).toBe(false)
  })
})
