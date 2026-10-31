import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { skillEvalCases } from '../../evals/cases'
import {
  buildCleanupPlan,
  buildFixtureHomeConfig,
  classifyEvalOutcome,
  installEvalSkillBundle,
  parseCliOptions,
  parseCodexEvents,
  sanitizeEvalText,
  versionsFor,
} from '../../evals/run-skill-evals'

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
    const guide = readFileSync(join(ROOT, 'docs', 'skill-behavior-evals.md'), 'utf-8')
    expect(guide).toContain('基线')
    expect(guide).toContain('pnpm eval:skills')
    expect(guide).toContain('not-executed')
    expect(readFileSync(join(EVALS_DIR, 'README.md'), 'utf-8')).toContain('review-code.md')
  })

  it.each(SKILLS)('%s has a complete pressure scenario', (skill) => {
    const content = readFileSync(join(EVALS_DIR, `${skill}.md`), 'utf-8')
    for (const section of REQUIRED_SECTIONS)
      expect(content, `${skill} missing ${section}`).toContain(section)
    expect(content).toContain('Baseline:')
    expect(content).toContain('Modified:')
  })

  it('defines all executable cases with prompts, patterns and fixture checks', () => {
    expect(skillEvalCases.map(item => item.id)).toEqual([...SKILLS])
    for (const item of skillEvalCases) {
      expect(item.prompt.trim()).not.toBe('')
      expect(item.passPatterns.length).toBeGreaterThan(0)
      expect(item.passPatterns.every(pattern => pattern instanceof RegExp)).toBe(true)
      expect(item.forbiddenPatterns.every(pattern => pattern instanceof RegExp)).toBe(true)
      expect(item.notApplicableReason).toBeNull()
      expect(typeof item.setup).toBe('function')
      expect(typeof item.verifySideEffects).toBe('function')
    }
  })

  it('documents the non-interactive propose and fixed round-two review-code boundaries', () => {
    const propose = skillEvalCases.find(item => item.id === 'propose')!
    const reviewCode = skillEvalCases.find(item => item.id === 'review-code')!
    expect(propose.prompt).toContain('session-recovery')
    expect(propose.passPatterns.map(pattern => pattern.source)).toEqual(expect.arrayContaining(['隔离']))
    expect(reviewCode.prompt).toContain('review-round-2.md')
    expect(reviewCode.hostConfig?.reviewExecutor).toBe('subagent')
    expect(reviewCode.passPatterns.map(pattern => pattern.source)).toEqual(expect.arrayContaining(['驳回硬线']))
  })

  it('does not read or copy auth.json in the runner', () => {
    const runner = readFileSync(join(ROOT, 'src', 'evals', 'run-skill-evals.ts'), 'utf8')
    expect(runner).not.toMatch(/(?:readFile|writeFile|copy)[^\n]*auth\.json/i)
  })
})

describe('skill eval runner arguments and outcomes', () => {
  it('parses case, version, output, baseline and setup flags', () => {
    const options = parseCliOptions([
      '--',
      '--case',
      'propose,review-code',
      '--case=apply',
      '--version=current',
      '--baseline-ref',
      'dce2466',
      '--output',
      '/tmp/evals',
      '--keep-temp',
      '--setup-only',
    ])
    expect(options.caseIds).toEqual(['propose', 'review-code', 'apply'])
    expect(options.version).toBe('current')
    expect(options.baselineRef).toBe('dce2466')
    expect(options.outputDir).toBe('/tmp/evals')
    expect(options.keepTemp).toBe(true)
    expect(options.setupOnly).toBe(true)
  })

  it('defaults to every case and both versions', () => {
    const options = parseCliOptions([])
    expect(options.caseIds).toEqual([...SKILLS])
    expect(options.version).toBe('both')
    expect(versionsFor(options.version)).toEqual(['baseline', 'current'])
  })

  it('rejects unknown cases and versions', () => {
    expect(() => parseCliOptions(['--case', 'unknown'])).toThrow('未知 case')
    expect(() => parseCliOptions(['--version', 'latest'])).toThrow('--version')
  })

  it('parses JSONL evidence and distinguishes environment from behavior failure', () => {
    const stdout = [
      JSON.stringify({ type: 'thread.started', thread_id: 't1' }),
      JSON.stringify({ type: 'turn.started' }),
      JSON.stringify({ type: 'item.completed', item: { type: 'agent_message', text: 'done' } }),
      JSON.stringify({ type: 'turn.completed' }),
      'not-json stderr-like line',
    ].join('\n')
    const events = parseCodexEvents(stdout)
    expect(events).toMatchObject({ validEvents: 4, invalidLines: 0, threadStarted: 1, turnStarted: 1, turnCompleted: 1 })
    expect(events.agentMessages).toEqual(['done'])

    const baseProcess = {
      exitCode: 0,
      timedOut: false,
      stdout,
      stderr: '',
      finalText: 'done 隔离 自动',
      durationMs: 10,
    }
    expect(classifyEvalOutcome({
      processResult: baseProcess,
      events,
      passPatterns: [/done/, /隔离/],
      forbiddenPatterns: [/失败/],
      sideEffects: { passed: true, evidence: 'ok' },
    }).status).toBe('passed')
    expect(classifyEvalOutcome({
      processResult: { ...baseProcess, timedOut: true },
      events,
      passPatterns: [/done/],
      forbiddenPatterns: [],
    }).status).toBe('not-executed')
    expect(classifyEvalOutcome({
      processResult: { ...baseProcess, finalText: '' },
      events,
      passPatterns: [/done/],
      forbiddenPatterns: [],
    }).status).toBe('not-executed')
    expect(classifyEvalOutcome({
      processResult: baseProcess,
      events,
      passPatterns: [/done/],
      forbiddenPatterns: [/done/],
    }).status).toBe('failed')
    expect(classifyEvalOutcome({
      processResult: baseProcess,
      events,
      passPatterns: [/done/],
      forbiddenPatterns: [],
      sideEffects: { passed: false, evidence: 'source changed' },
    }).status).toBe('failed')
  })

  it('sanitizes fixture paths and common token forms', () => {
    const text = 'home=/tmp/eval-home token=Bearer abc.def.ghi key=sk-12345678'
    expect(sanitizeEvalText(text, ['/tmp/eval-home'])).toBe('home=<fixture-path> token=Bearer <redacted> key=<redacted-key>')
  })
})

describe('skill eval fixtures and cleanup', () => {
  it('writes [host] config values and parses them back', () => {
    const config = parse(buildFixtureHomeConfig()) as { host: Record<string, string> }
    expect(config.host).toMatchObject({
      reviewExecutor: 'main',
      codingExecutor: 'main',
      testMode: 'normal',
    })
    const subagentConfig = parse(buildFixtureHomeConfig({ reviewExecutor: 'subagent' })) as { host: Record<string, string> }
    expect(subagentConfig.host.reviewExecutor).toBe('subagent')
  })

  it('installs current references with fixture HOME role paths', async () => {
    const base = mkdtempSync(join(tmpdir(), 'lyx-eval-install-'))
    const fixture = { repoDir: join(base, 'repo'), homeDir: join(base, 'home') }
    try {
      await installEvalSkillBundle(ROOT, fixture, 'review-plan')
      const skillPath = join(fixture.repoDir, '.agents', 'skills', 'lyx-review-plan', 'SKILL.md')
      const skillContent = readFileSync(skillPath, 'utf8')
      expect(skillContent).toContain('references/review-contract.md')
      const referencePath = join(fixture.repoDir, '.agents', 'skills', 'lyx-review-plan', 'references', 'review-contract.md')
      expect(existsSync(referencePath)).toBe(true)
      expect(readFileSync(referencePath, 'utf8')).toContain(`${fixture.homeDir}/.codex/lyx/prompts/codex/plan-reviewer.md`)
    }
    finally {
      rmSync(base, { recursive: true, force: true })
    }
  })

  it('allows a reference-less baseline source without skill-references', async () => {
    const base = mkdtempSync(join(tmpdir(), 'lyx-eval-baseline-'))
    const fixture = { repoDir: join(base, 'repo'), homeDir: join(base, 'home') }
    const source = join(base, 'source')
    try {
      mkdirSync(join(source, 'templates', 'skills'), { recursive: true })
      writeFileSync(join(source, 'templates', 'skills', 'propose.md'), [
        '---',
        'name: lyx-propose',
        'description: baseline fixture',
        '---',
        '',
        '# Propose',
        '',
      ].join('\n'))
      await installEvalSkillBundle(source, fixture, 'propose')
      expect(readFileSync(join(fixture.repoDir, '.agents', 'skills', 'lyx-propose', 'SKILL.md'), 'utf8')).toContain('# Propose')
    }
    finally {
      rmSync(base, { recursive: true, force: true })
    }
  })

  it('builds a cleanup plan while preserving requested temporary files', () => {
    expect(buildCleanupPlan('/tmp/eval-root', '/tmp/eval-root/sources/base', false)).toEqual({
      temporaryRoot: '/tmp/eval-root',
      baselineWorktree: '/tmp/eval-root/sources/base',
      removeTemporaryRoot: true,
      removeBaselineWorktree: true,
    })
    expect(buildCleanupPlan('/tmp/eval-root', '/tmp/eval-root/sources/base', true).removeTemporaryRoot).toBe(false)
  })
})
