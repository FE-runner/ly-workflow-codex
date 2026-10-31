import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const EVALS_DIR = join(ROOT, 'evals', 'skills')
const SKILLS = ['propose', 'apply', 'review-plan', 'review-code'] as const
const REQUIRED_SECTIONS = [
  '## Preconditions',
  '## User Prompt',
  '## Required Evidence',
  '## Forbidden Actions',
  '## Pass Criteria',
  '## Evidence Record',
] as const

describe('skill behavior eval assets', () => {
  it('ships the eval guide and index', () => {
    expect(readFileSync(join(ROOT, 'docs', 'skill-behavior-evals.md'), 'utf-8')).toContain('基线')
    expect(readFileSync(join(EVALS_DIR, 'README.md'), 'utf-8')).toContain('review-code.md')
  })

  it.each(SKILLS)('%s has a complete pressure scenario', (skill) => {
    const content = readFileSync(join(EVALS_DIR, `${skill}.md`), 'utf-8')
    for (const section of REQUIRED_SECTIONS)
      expect(content, `${skill} missing ${section}`).toContain(section)
    expect(content).toContain('Baseline:')
    expect(content).toContain('Modified:')
  })
})
