import type { ChildProcess } from 'node:child_process'
import type { HostAdapterContext } from '../utils/host-adapters'
import type { EvalFixture, EvalSkill, SideEffectCheck, SkillEvalCase } from './cases'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'
import fs from 'fs-extra'
import { basename, dirname, join, resolve } from 'pathe'
import { codexAdapter } from '../hosts/codex/adapter'
import {
  isPathInside,
  listMissingSkillReferences,
  PACKAGE_ROOT,
  parseSkillReferences,
  replaceHomePathsInTemplate,
} from '../utils/installer-template'
import { EVAL_SKILLS, getSkillEvalCase } from './cases'

export type EvalVersion = 'baseline' | 'current'
export type EvalVersionSelection = EvalVersion | 'both'
export type EvalStatus = 'passed' | 'failed' | 'not-executed'

export interface CliOptions {
  caseIds: EvalSkill[]
  version: EvalVersionSelection
  baselineRef: string
  outputDir?: string
  keepTemp: boolean
  setupOnly: boolean
  help: boolean
}

export interface CodexEventSummary {
  validEvents: number
  invalidLines: number
  threadStarted: number
  turnStarted: number
  turnCompleted: number
  turnFailed: number
  agentMessages: string[]
}

export interface CodexProcessResult {
  exitCode: number | null
  timedOut: boolean
  spawnError?: string
  stdout: string
  stderr: string
  finalText: string
  durationMs: number
}

export interface ClassificationInput {
  processResult: CodexProcessResult
  events: CodexEventSummary
  passPatterns: RegExp[]
  forbiddenPatterns: RegExp[]
  sideEffects?: SideEffectCheck
}

export interface Classification {
  status: EvalStatus
  reason: string
  matchedPass: number
  matchedForbidden: string[]
}

export interface EvalUnitResult {
  case: EvalSkill
  version: EvalVersion
  status: EvalStatus
  reason: string
  exitCode: number | null
  timedOut: boolean
  durationMs: number
  threadStarted: number
  turnCompleted: number
  matchedPass: number
  passPatternCount: number
  matchedForbidden: string[]
  sideEffects?: SideEffectCheck
  finalExcerpt: string
  transcriptPath?: string
}

export interface EvalSuiteResult {
  runAt: string
  baselineRef: string
  resultsDir: string
  summaryPath: string
  results: EvalUnitResult[]
  temporaryRoot?: string
}

export interface CleanupPlan {
  temporaryRoot: string
  baselineWorktree?: string
  removeTemporaryRoot: boolean
  removeBaselineWorktree: boolean
}

interface RunUnitOptions {
  evalCase: SkillEvalCase
  version: EvalVersion
  sourceRoot: string
  temporaryRoot: string
  codexHome: string
  timeoutMs: number
  setupOnly: boolean
}

const DEFAULT_BASELINE_REF = 'dce2466'
const DEFAULT_TIMEOUT_MS = 600_000
const ROOT = PACKAGE_ROOT

export function getHelpText(): string {
  return [
    'Usage: pnpm eval:skills -- [options]',
    '',
    'Options:',
    '  --case <propose|apply|review-plan|review-code>  只运行指定 case，可重复或逗号分隔',
    `  --version <baseline|current|both>              默认 both`,
    `  --baseline-ref <git-ref>                       默认 ${DEFAULT_BASELINE_REF}`,
    '  --output <dir>                                 结果目录；缺省写到临时目录',
    '  --keep-temp                                    保留 fixture、transcript 与临时 HOME',
    '  --setup-only                                   只构建 fixture/skill，不调用模型',
    '  --help                                         显示帮助',
  ].join('\n')
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]
  if (!value || value.startsWith('--'))
    throw new Error(`${flag} 缺少参数值`)
  return value
}

function parseCase(value: string): EvalSkill[] {
  const ids = value.split(',').map(item => item.trim()).filter(Boolean)
  const invalid = ids.filter(item => !EVAL_SKILLS.includes(item as EvalSkill))
  if (invalid.length > 0)
    throw new Error(`未知 case: ${invalid.join(', ')}；可选值: ${EVAL_SKILLS.join(', ')}`)
  return ids as EvalSkill[]
}

export function parseCliOptions(argv: string[]): CliOptions {
  const args = argv[0] === '--' ? argv.slice(1) : argv
  const options: CliOptions = {
    caseIds: [],
    version: 'both',
    baselineRef: DEFAULT_BASELINE_REF,
    keepTemp: false,
    setupOnly: false,
    help: false,
  }

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    const [flag, inlineValue] = arg.includes('=') ? arg.split(/=(.*)/s, 2) : [arg, undefined]
    switch (flag) {
      case '--case':
        options.caseIds.push(...parseCase(inlineValue ?? requireValue(args, index, flag)))
        if (inlineValue === undefined)
          index++
        break
      case '--version': {
        const value = inlineValue ?? requireValue(args, index, flag)
        if (!['baseline', 'current', 'both'].includes(value))
          throw new Error(`--version 只接受 baseline/current/both，收到: ${value}`)
        options.version = value as EvalVersionSelection
        if (inlineValue === undefined)
          index++
        break
      }
      case '--baseline-ref':
        options.baselineRef = inlineValue ?? requireValue(args, index, flag)
        if (inlineValue === undefined)
          index++
        break
      case '--output':
        options.outputDir = inlineValue ?? requireValue(args, index, flag)
        if (inlineValue === undefined)
          index++
        break
      case '--keep-temp':
        options.keepTemp = true
        break
      case '--setup-only':
        options.setupOnly = true
        break
      case '--help':
        options.help = true
        break
      default:
        throw new Error(`未知参数: ${arg}`)
    }
  }

  options.caseIds = [...new Set(options.caseIds)]
  if (options.caseIds.length === 0)
    options.caseIds = [...EVAL_SKILLS]
  return options
}

export function versionsFor(selection: EvalVersionSelection): EvalVersion[] {
  return selection === 'both' ? ['baseline', 'current'] : [selection]
}

export function buildCleanupPlan(
  temporaryRoot: string,
  baselineWorktree: string | undefined,
  keepTemp: boolean,
): CleanupPlan {
  return {
    temporaryRoot,
    baselineWorktree,
    removeTemporaryRoot: !keepTemp,
    removeBaselineWorktree: !keepTemp && Boolean(baselineWorktree),
  }
}

export function parseCodexEvents(stdout: string): CodexEventSummary {
  const summary: CodexEventSummary = {
    validEvents: 0,
    invalidLines: 0,
    threadStarted: 0,
    turnStarted: 0,
    turnCompleted: 0,
    turnFailed: 0,
    agentMessages: [],
  }

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{'))
      continue
    try {
      const event = JSON.parse(trimmed) as {
        type?: string
        item?: { type?: string, text?: string }
      }
      summary.validEvents++
      if (event.type === 'thread.started')
        summary.threadStarted++
      else if (event.type === 'turn.started')
        summary.turnStarted++
      else if (event.type === 'turn.completed')
        summary.turnCompleted++
      else if (event.type === 'turn.failed')
        summary.turnFailed++
      else if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text)
        summary.agentMessages.push(event.item.text)
    }
    catch {
      summary.invalidLines++
    }
  }

  return summary
}

export function classifyEvalOutcome(input: ClassificationInput): Classification {
  const { processResult, events } = input
  if (processResult.spawnError)
    return { status: 'not-executed', reason: `spawn failed: ${processResult.spawnError}`, matchedPass: 0, matchedForbidden: [] }
  if (processResult.timedOut)
    return { status: 'not-executed', reason: 'codex exec timed out', matchedPass: 0, matchedForbidden: [] }
  if (processResult.exitCode !== 0)
    return { status: 'not-executed', reason: `codex exec exited with ${processResult.exitCode}`, matchedPass: 0, matchedForbidden: [] }
  if (!processResult.finalText.trim())
    return { status: 'not-executed', reason: 'final agent message is empty', matchedPass: 0, matchedForbidden: [] }
  if (events.threadStarted === 0 || events.turnCompleted === 0)
    return { status: 'not-executed', reason: 'JSONL missing thread.started or turn.completed', matchedPass: 0, matchedForbidden: [] }
  if (events.turnFailed > 0)
    return { status: 'not-executed', reason: 'JSONL contains turn.failed', matchedPass: 0, matchedForbidden: [] }

  const matchedPass = input.passPatterns.filter(pattern => pattern.test(processResult.finalText)).length
  const matchedForbidden = input.forbiddenPatterns
    .filter(pattern => pattern.test(processResult.finalText))
    .map(pattern => pattern.source)

  if (matchedPass !== input.passPatterns.length)
    return { status: 'failed', reason: `pass patterns matched ${matchedPass}/${input.passPatterns.length}`, matchedPass, matchedForbidden }
  if (matchedForbidden.length > 0)
    return { status: 'failed', reason: `forbidden patterns matched: ${matchedForbidden.join(', ')}`, matchedPass, matchedForbidden }
  if (input.sideEffects && !input.sideEffects.passed)
    return { status: 'failed', reason: `fixture side effect failed: ${input.sideEffects.evidence}`, matchedPass, matchedForbidden }
  return { status: 'passed', reason: 'all behavior patterns and fixture side effects matched', matchedPass, matchedForbidden }
}

export function sanitizeEvalText(text: string, sensitivePaths: string[] = []): string {
  let sanitized = text
  for (const path of sensitivePaths.filter(Boolean)) {
    sanitized = sanitized.split(path).join('<fixture-path>')
    sanitized = sanitized.split(path.replace(/\\/g, '/')).join('<fixture-path>')
  }
  return sanitized
    .replace(/Bearer\s+[\w.~+/=-]+/gi, 'Bearer <redacted>')
    .replace(/\b(sk|ak)-[\w-]{8,}\b/g, '<redacted-key>')
}

export function buildFixtureHomeConfig(overrides: { reviewExecutor?: 'main' | 'subagent' } = {}): string {
  return [
    '[host]',
    `reviewExecutor = "${overrides.reviewExecutor ?? 'main'}"`,
    'codingExecutor = "main"',
    'testMode = "normal"',
    '',
  ].join('\n')
}

export async function createResultsDirectory(outputDir?: string): Promise<string> {
  if (outputDir) {
    const directory = resolve(outputDir)
    await fs.ensureDir(directory)
    return directory
  }
  return fs.mkdtemp(join(tmpdir(), 'lyx-skill-eval-results-'))
}

export async function installEvalSkillBundle(
  sourceRoot: string,
  fixture: EvalFixture,
  command: EvalSkill,
  config: HostAdapterContext['config'] = {},
): Promise<void> {
  const templateDir = join(sourceRoot, 'templates')
  const skillsDir = join(fixture.repoDir, '.agents', 'skills')
  const ctx: HostAdapterContext = {
    installDir: fixture.repoDir,
    force: true,
    templateDir,
    paths: {
      skillsDir,
      lyDir: join(fixture.homeDir, '.codex', 'lyx'),
      promptsDir: join(fixture.homeDir, '.codex', 'lyx', 'prompts'),
    },
    config: {
      reviewExecutor: 'main',
      codingExecutor: 'main',
      testMode: 'normal',
      ...config,
    },
    result: {
      success: true,
      installedCommands: [],
      installedPrompts: [],
      errors: [],
      configPath: '',
    },
  }

  const rawMain = await fs.readFile(join(templateDir, 'skills', `${command}.md`), 'utf8')
  const declaredReferences = parseSkillReferences(rawMain)
  const mainContent = replaceHomePathsInTemplate(
    codexAdapter.renderTemplate(rawMain, ctx, command),
    ctx.installDir,
    fixture.homeDir,
  )
  const destDir = join(skillsDir, `lyx-${command}`)
  await fs.ensureDir(destDir)
  await fs.writeFile(join(destDir, 'SKILL.md'), mainContent, 'utf8')

  if (declaredReferences.length > 0) {
    const referencesRoot = join(templateDir, 'skill-references', command)
    for (const reference of declaredReferences) {
      const relativeReference = reference.slice('references/'.length)
      const sourceFile = resolve(referencesRoot, relativeReference)
      if (!isPathInside(referencesRoot, sourceFile))
        throw new Error(`Skill reference escapes source root: ${command}/${reference}`)
      if (!existsSync(sourceFile))
        throw new Error(`Skill reference template missing: ${sourceFile}`)
      const source = await fs.readFile(sourceFile, 'utf8')
      const rendered = replaceHomePathsInTemplate(
        codexAdapter.renderTemplate(source, ctx, command),
        ctx.installDir,
        fixture.homeDir,
      )
      const destFile = join(destDir, reference)
      await fs.ensureDir(dirname(destFile))
      await fs.writeFile(destFile, rendered, 'utf8')
    }
  }

  const missingReferences = await listMissingSkillReferences(destDir)
  if (missingReferences.length > 0)
    throw new Error(`Installed eval skill references missing: ${command}/${missingReferences.join(', ')}`)
}

async function installEvalRolePrompts(sourceRoot: string, fixture: EvalFixture): Promise<void> {
  const sourceDir = join(sourceRoot, 'templates', 'hosts', 'codex', 'prompts')
  const targetDir = join(fixture.homeDir, '.codex', 'lyx', 'prompts', 'codex')
  if (!(await fs.pathExists(sourceDir)))
    throw new Error(`Codex role prompts missing: ${sourceDir}`)
  await fs.ensureDir(targetDir)
  for (const file of await fs.readdir(sourceDir)) {
    if (!file.endsWith('.md'))
      continue
    const content = await fs.readFile(join(sourceDir, file), 'utf8')
    await fs.writeFile(
      join(targetDir, file),
      replaceHomePathsInTemplate(content, fixture.repoDir, fixture.homeDir),
      'utf8',
    )
  }
}

async function prepareFixtureForUnit(evalCase: SkillEvalCase, temporaryRoot: string, version: EvalVersion): Promise<EvalFixture> {
  const unitRoot = join(temporaryRoot, 'runs', `${evalCase.id}-${version}`)
  const fixture: EvalFixture = {
    repoDir: join(unitRoot, 'fixture'),
    homeDir: join(unitRoot, 'home'),
  }
  await fs.ensureDir(fixture.repoDir)
  await fs.ensureDir(fixture.homeDir)
  await evalCase.setup(fixture)
  await fs.ensureDir(join(fixture.homeDir, '.codex', 'lyx'))
  await fs.writeFile(
    join(fixture.homeDir, '.codex', 'lyx', 'config.toml'),
    buildFixtureHomeConfig(evalCase.hostConfig),
    'utf8',
  )
  return fixture
}

function runChild(command: string, args: string[], options: { cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number }): Promise<CodexProcessResult> {
  return new Promise((resolvePromise) => {
    const startedAt = Date.now()
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let spawnError: string | undefined
    let child: ChildProcess

    try {
      child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: process.platform !== 'win32',
      })
    }
    catch (error) {
      resolvePromise({
        exitCode: null,
        timedOut: false,
        spawnError: String(error),
        stdout,
        stderr,
        finalText: '',
        durationMs: Date.now() - startedAt,
      })
      return
    }

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.once('error', (error) => {
      spawnError = String(error)
    })

    const timer = setTimeout(() => {
      timedOut = true
      killPromise = killProcessTree(child)
    }, options.timeoutMs)

    child.once('close', (exitCode) => {
      clearTimeout(timer)
      closeInfo = { exitCode }
      void finish()
    })

    let closeInfo: { exitCode: number | null } | undefined
    let killPromise = Promise.resolve()
    let settled = false

    async function finish(): Promise<void> {
      if (settled || !closeInfo)
        return
      settled = true
      await killPromise.catch(() => {})
      resolvePromise({
        exitCode: closeInfo.exitCode,
        timedOut,
        spawnError,
        stdout,
        stderr,
        finalText: '',
        durationMs: Date.now() - startedAt,
      })
    }
  })
}

function killProcessTree(child: ChildProcess): Promise<void> {
  const pid = child.pid
  if (!pid)
    return Promise.resolve()
  if (process.platform === 'win32') {
    return new Promise((resolvePromise) => {
      const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.once('error', () => {
        child.kill('SIGKILL')
        resolvePromise()
      })
      killer.once('close', () => resolvePromise())
    })
  }
  try {
    process.kill(-pid, 'SIGKILL')
  }
  catch {
    child.kill('SIGKILL')
  }
  return Promise.resolve()
}

async function executeCodex(
  fixture: EvalFixture,
  prompt: string,
  codexHome: string,
  timeoutMs: number,
  transcriptPath: string,
  finalMessagePath: string,
): Promise<CodexProcessResult> {
  const result = await runChild('codex', [
    'exec',
    '--json',
    '--ephemeral',
    '--skip-git-repo-check',
    '-C',
    fixture.repoDir,
    '-s',
    'workspace-write',
    '-c',
    'approval_policy="never"',
    '--output-last-message',
    finalMessagePath,
    prompt,
  ], {
    cwd: fixture.repoDir,
    env: {
      ...process.env,
      HOME: fixture.homeDir,
      USERPROFILE: fixture.homeDir,
      CODEX_HOME: codexHome,
      NO_COLOR: '1',
    },
    timeoutMs,
  })

  const finalText = await fs.pathExists(finalMessagePath)
    ? await fs.readFile(finalMessagePath, 'utf8')
    : ''
  await fs.writeFile(
    transcriptPath,
    [
      '===== STDOUT =====',
      result.stdout,
      '===== STDERR =====',
      result.stderr,
    ].join('\n'),
    'utf8',
  )
  return { ...result, finalText }
}

function unitOutputPath(outputDir: string, evalCase: SkillEvalCase, version: EvalVersion): string {
  return join(outputDir, `${evalCase.id}-${version}.json`)
}

async function runUnit(options: RunUnitOptions): Promise<EvalUnitResult> {
  const { evalCase, version, sourceRoot, temporaryRoot, codexHome, timeoutMs, setupOnly } = options
  const fixture = await prepareFixtureForUnit(evalCase, temporaryRoot, version)
  await installEvalRolePrompts(sourceRoot, fixture)
  await installEvalSkillBundle(sourceRoot, fixture, evalCase.skillCommand, {
    reviewExecutor: evalCase.hostConfig?.reviewExecutor ?? 'main',
    codingExecutor: 'main',
    testMode: 'normal',
  })

  const unitRoot = join(temporaryRoot, 'runs', `${evalCase.id}-${version}`)
  const transcriptPath = join(unitRoot, 'transcript.log')
  const finalMessagePath = join(unitRoot, 'final-message.txt')
  if (setupOnly) {
    return {
      case: evalCase.id,
      version,
      status: 'not-executed',
      reason: 'setup-only; model call skipped',
      exitCode: null,
      timedOut: false,
      durationMs: 0,
      threadStarted: 0,
      turnCompleted: 0,
      matchedPass: 0,
      passPatternCount: evalCase.passPatterns.length,
      matchedForbidden: [],
      finalExcerpt: '',
      transcriptPath,
    }
  }

  const processResult = await executeCodex(
    fixture,
    evalCase.prompt,
    codexHome,
    timeoutMs,
    transcriptPath,
    finalMessagePath,
  )
  const events = parseCodexEvents(processResult.stdout)
  const sideEffects = await evalCase.verifySideEffects(fixture)
  const classification = classifyEvalOutcome({
    processResult,
    events,
    passPatterns: evalCase.passPatterns,
    forbiddenPatterns: evalCase.forbiddenPatterns,
    sideEffects,
  })

  return {
    case: evalCase.id,
    version,
    status: classification.status,
    reason: classification.reason,
    exitCode: processResult.exitCode,
    timedOut: processResult.timedOut,
    durationMs: processResult.durationMs,
    threadStarted: events.threadStarted,
    turnCompleted: events.turnCompleted,
    matchedPass: classification.matchedPass,
    passPatternCount: evalCase.passPatterns.length,
    matchedForbidden: classification.matchedForbidden,
    sideEffects,
    finalExcerpt: sanitizeEvalText(processResult.finalText.slice(0, 2000), [fixture.homeDir, fixture.repoDir, codexHome]),
    transcriptPath,
  }
}

async function gitText(args: string[], cwd: string): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0)
        resolvePromise(stdout.trim())
      else
        reject(new Error(`git ${args.join(' ')} failed (${code}): ${stderr.trim()}`))
    })
  })
}

async function prepareSourceRoots(options: CliOptions, temporaryRoot: string): Promise<Map<EvalVersion, string>> {
  const roots = new Map<EvalVersion, string>()
  const versions = versionsFor(options.version)
  if (versions.includes('current'))
    roots.set('current', ROOT)
  if (versions.includes('baseline')) {
    await gitText(['rev-parse', '--verify', `${options.baselineRef}^{commit}`], ROOT)
    const baselineRoot = join(temporaryRoot, 'sources', basename(options.baselineRef))
    await fs.ensureDir(dirname(baselineRoot))
    await gitText(['worktree', 'add', '--detach', baselineRoot, options.baselineRef], ROOT)
    roots.set('baseline', baselineRoot)
  }
  return roots
}

async function removeBaselineWorktrees(roots: Map<EvalVersion, string>): Promise<void> {
  const baselineRoot = roots.get('baseline')
  if (!baselineRoot)
    return
  try {
    await gitText(['worktree', 'remove', '--force', baselineRoot], ROOT)
  }
  catch {
    await gitText(['worktree', 'prune'], ROOT).catch(() => {})
  }
}

export async function runSkillEvalSuite(options: CliOptions): Promise<EvalSuiteResult> {
  const temporaryRoot = await fs.mkdtemp(join(tmpdir(), 'lyx-skill-evals-'))
  const resultsDir = await createResultsDirectory(options.outputDir)
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
  const sourceRoots = new Map<EvalVersion, string>()
  const results: EvalUnitResult[] = []
  try {
    const preparedRoots = await prepareSourceRoots(options, temporaryRoot)
    for (const [version, root] of preparedRoots)
      sourceRoots.set(version, root)

    for (const version of versionsFor(options.version)) {
      const sourceRoot = sourceRoots.get(version)
      if (!sourceRoot)
        throw new Error(`Eval source missing for ${version}`)
      for (const caseId of options.caseIds) {
        const evalCase = getSkillEvalCase(caseId)
        const result = await runUnit({
          evalCase,
          version,
          sourceRoot,
          temporaryRoot,
          codexHome,
          timeoutMs: DEFAULT_TIMEOUT_MS,
          setupOnly: options.setupOnly,
        })
        results.push(result)
        await fs.writeJson(unitOutputPath(resultsDir, evalCase, version), result, { spaces: 2 })
        console.log(`[${result.status}] ${result.case} ${result.version} — ${result.reason}`)
      }
    }

    const summaryPath = join(resultsDir, 'summary.json')
    const suite: EvalSuiteResult = {
      runAt: new Date().toISOString(),
      baselineRef: options.baselineRef,
      resultsDir,
      summaryPath,
      results,
      temporaryRoot: options.keepTemp ? temporaryRoot : undefined,
    }
    await fs.writeJson(summaryPath, suite, { spaces: 2 })
    return suite
  }
  finally {
    const cleanup = buildCleanupPlan(temporaryRoot, sourceRoots.get('baseline'), options.keepTemp)
    if (cleanup.removeTemporaryRoot) {
      if (cleanup.removeBaselineWorktree)
        await removeBaselineWorktrees(sourceRoots)
      await fs.remove(cleanup.temporaryRoot)
    }
    else {
      console.log(`Temporary evaluation files: ${temporaryRoot}`)
    }
  }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const options = parseCliOptions(argv)
  if (options.help) {
    console.log(getHelpText())
    return 0
  }

  const result = await runSkillEvalSuite(options)
  const failed = result.results.filter(item => item.status !== 'passed')
  console.log(`Results: ${result.results.length - failed.length}/${result.results.length} passed`)
  console.log(`Summary: ${result.summaryPath}`)
  if (options.setupOnly)
    return 0
  return failed.length === 0 ? 0 : 1
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === invokedPath) {
  main()
    .then((code) => {
      process.exitCode = code
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
