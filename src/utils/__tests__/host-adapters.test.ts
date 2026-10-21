import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import fs from 'fs-extra'
import { afterAll, describe, expect, it } from 'vitest'
import { renderCodexTemplate } from '../../hosts/codex/adapter'
import { renderHostCommand } from '../../test-utils/render'
import { ADAPTERS, getAdapter, listRegisteredHosts } from '../host-adapters'
import { getAllCommandIds, getWorkflowById, installWorkflows, uninstallWorkflows } from '../installer'

/** 在指定目录初始化一个最小 git 仓库（uninstall worktree 存活检测测试用） */
function initMainRepo(dir: string): void {
  fs.ensureDirSync(dir)
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: dir })
  fs.writeFileSync(join(dir, 'README.md'), '# main\n')
  execFileSync('git', ['add', '-A'], { cwd: dir })
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir })
}

/** 从主仓库切出一个真实 git worktree 到指定路径（父目录自动创建） */
function addWorktree(mainRepo: string, worktreePath: string, branch: string): void {
  fs.ensureDirSync(join(worktreePath, '..'))
  execFileSync('git', ['-C', mainRepo, 'worktree', 'add', '-q', '-b', branch, worktreePath])
}

function findPackageRoot(): string {
  let dir = import.meta.dirname
  for (let i = 0; i < 10; i++) {
    try {
      readFileSync(join(dir, 'package.json'))
      return dir
    }
    catch {
      dir = join(dir, '..')
    }
  }
  throw new Error('Could not find package root')
}

const PACKAGE_ROOT = findPackageRoot()
const SKILLS_TEMPLATES_DIR = join(PACKAGE_ROOT, 'templates', 'skills')

// ─────────────────────────────────────────────────────────────
// A. 跨宿主不变量：同一组断言对注册表中的每个宿主执行一遍（8.1）
//    新增宿主自动纳入覆盖；任一宿主缺失不变量即失败
// ─────────────────────────────────────────────────────────────
describe.each(listRegisteredHosts())('%s host template invariants', (host) => {
  /** 按该宿主渲染后的命令产物（与安装期同一渲染链） */
  const read = (file: string) => renderHostCommand(host, file.replace('.md', ''))
  /** 断言文本中的命令标识按宿主前缀改写（@lyx-<cmd> 是命令标识，见 multi-host-install） */
  const t = (text: string) => text.replace(/@lyx-/g, `${getAdapter(host).commandPrefix}lyx-`)

  it('has exactly the 15 core commands as shared templates', () => {
    const files = readdirSync(SKILLS_TEMPLATES_DIR).filter(f => f.endsWith('.md'))
    const codexCommands = getAllCommandIds()
      .flatMap(id => getWorkflowById(id)!.commands)
    expect(files.sort()).toEqual(codexCommands.map(c => `${c}.md`).sort())
    expect(files.length).toBe(15)
  })

  it('every template has argument-hint frontmatter', () => {
    for (const file of readdirSync(SKILLS_TEMPLATES_DIR).filter(f => f.endsWith('.md'))) {
      const content = read(file)
      expect(content.startsWith('---\n'), file).toBe(true)
      expect(content, file).toMatch(/^argument-hint: '/m)
      expect(content, file).toMatch(/^description: '/m)
    }
  })

  it('review templates render single-reviewer non-fork subagent orchestration (no exec residue)', () => {
    for (const name of ['review-plan.md', 'review-code.md']) {
      const content = read(name)
      // 单审查 subagent（非 fork）编排指示
      expect(content).toMatch(/1 个审查 subagent|单审查 subagent/)
      expect(content).toContain('非 fork')
      expect(content).toContain('SHALL NOT spawn 第二个审查 agent')
      expect(content).toContain('context.md')
      expect(content).toContain('可核验依据')
      expect(content).toContain('驳回硬线')
      // 弃用字段已随 switchable-executor-flow 移除：模板不应再提及
      expect(content).not.toContain('reviewModelB')
      expect(content).not.toContain('reviewReasoningEffortB')
      expect(content).not.toContain('codingModel') // review 模板不引用实施模型
      // 不再走 codex exec 独立子会话
      expect(content).not.toContain('codex exec')
      expect(content).not.toContain('CODEAGENT_EOF')
      expect(content).not.toContain('codex exec resume')
      expect(content).not.toContain('session_id')
      expect(content).not.toContain('{{REVIEW_MODEL}}')
      expect(content).not.toContain('ly-wrapper')
      expect(content).not.toContain('{{LITE_MODE_FLAG}}')
      expect(content).not.toContain('{{REVIEWER_MODEL}}')
      expect(content).not.toContain('OVERALL')
      expect(content).not.toContain('LY:IF')
      expect(content).not.toContain('routing.implementer')
    }
  })

  it('review templates write unresolved-Warning snapshot and exclude it from review scope', () => {
    const sections: Record<string, string> = {
      'review-plan.md': '## 方案审查',
      'review-code.md': '## 代码审查',
    }
    const anchors: Record<string, string> = {
      'review-plan.md': '#方案审查#',
      'review-code.md': '#代码审查#',
    }
    for (const [name, section] of Object.entries(sections)) {
      const content = read(name)
      // 写入 change 目录下的审查未修项快照，并按本命令负责的节写入
      expect(content, name).toContain('review-findings.md')
      expect(content, name).toContain(section)
      // 只收 Warning；不收 Info、不收 Critical
      expect(content, name).toContain('SHALL NOT 收录 Info')
      // 节级 upsert：重跑后该类零 Warning 时移除旧节，不保留过期内容
      expect(content, name).toContain('SHALL NOT 保留过期节内容')
      // 快照只收「未被自动修复的 Warning」，三类情形并列写明
      expect(content, name).toContain('只收未被自动修复的 Warning')
      expect(content, name).toContain('已在本 change 内修复并进入统一 commit 的 SHALL NOT 收录')
      // 写入失败不改变审查结论
      expect(content, name).toContain('写入失败容错')
      // 排除规则：不被当审查对象、不进统一 commit，且两条执行者路径一致
      expect(content, name).toContain('未跟踪清单排除')
      expect(content, name).toContain('统一 commit 纳入')
      expect(content, name).toContain('两条执行者路径')
      // 该轮发现原文按执行者取值（main 路径无 subagent 也要记录）
      expect(content, name).toContain('该轮发现原文')
      // 条目连续编号，支撑 #<节名>#<序号> 解决说明锚点
      expect(content, name).toContain('连续编号')
      expect(content, name).toContain(anchors[name])
    }
  })

  it('review templates declare the auto-fixable warning axis with first-round-only bounds', () => {
    for (const name of ['review-plan.md', 'review-code.md']) {
      const content = read(name)
      // 标注字段与判据落在共享模板（main 路径不读角色词也拿得到）
      expect(content, name).toContain('可自动修复：是 / 否')
      expect(content, name).toContain('目标唯一')
      expect(content, name).toContain('不新造决策')
      expect(content, name).toContain('改法机械')
      expect(content, name).toContain('SHALL NOT 半修')
      // 正常清零定义扩展
      expect(content, name).toContain('所有 `影响落地=是` 的 Warning 都已自动修复')
      // 只消费首轮 + 未修好即降级
      expect(content, name).toContain('消费判据（四象限）')
      expect(content, name).toContain('立即停止循环转人工')
      // 影响落地轴与四条刹车
      expect(content, name).toContain('影响落地：是 / 否')
      expect(content, name).toContain('必须判「是」')
      expect(content, name).toContain('必须判「否」')
      expect(content, name).toContain('第 3 轮起新增影响项')
      expect(content, name).not.toContain('只消费首轮')
      // 判同键必须显式指向终止条件 2，而不是悬空的"上一条 Critical"
      expect(content, name).toContain('判同键见终止条件 2')
      expect(content, name).not.toContain('上一条 Critical')
      // 覆盖标注须留痕
      expect(content, name).toContain('SHALL 可覆盖审查者的标注')
      // TASK 层同样要求标注，避免判据在 TASK 层落空
      expect(content, name).toContain('每条 Warning 还须同时附')
      // 报告分级结构未被破坏：既有 Warning 小节标题保留
      expect(content, name).toContain('## Warning（建议修复，最后一轮结果）')
    }
  })

  it('archive and explore keep their unresolved-warning calibers unchanged', () => {
    // 归档前核对按「没有任何解决子项」计数
    expect(read('archive.md')).toContain('没有任何解决子项')
    // explore 按「存在至少一条 - 解决：子项」判定已解决
    expect(read('explore.md')).toContain('存在至少一条 `- 解决：` 子项')
  })

  it('only the propose template gates review gates by reviewMode (review/apply/archive stay config-independent)', () => {
    const propose = read('propose.md')
    expect(propose).toContain('reviewMode')
    expect(propose).toContain('[跳过] review-plan')
    expect(propose).toContain('[跳过] review-code')
    expect(propose).toContain('plan-only')
    expect(propose).toContain('code-only')
    for (const name of ['review-plan.md', 'review-code.md', 'apply.md', 'archive.md'])
      expect(read(name), name).not.toMatch(/reviewMode(?![a-zA-Z])/)
  })

  it('templates declare and write back review-findings resolution notes', () => {
    const propose = read('propose.md')
    expect(propose).toContain('## 解决的审查未修项')
    expect(propose).toContain('#方案审查#')
    expect(propose).toContain('#代码审查#')
    expect(propose).toContain('已归档快照')
    expect(propose).toContain('SHALL NOT 直接改写历史快照')

    const archive = read('archive.md')
    expect(archive).toContain('回写审查未修项解决说明')
    expect(archive).toContain('- 解决：')
    expect(archive).toContain('（归档于')
    expect(archive).toContain('已归档快照')
    expect(archive).toContain('幂等')
    expect(archive).toContain('SHALL NOT 阻断归档')
    expect(archive).toContain('SHALL NOT 引入 open/closed 状态字段')
  })

  it('archive template defaults the delta-spec sync decision without asking', () => {
    const archive = read('archive.md')
    expect(archive).toContain('Sync now (recommended)')
    expect(archive).toContain('Archive now')
    expect(archive).toContain('SHALL NOT 就该同步决策向用户提问')
  })

  it('templates pin snapshot minimal structure and write-back lifecycle', () => {
    const archive = read('archive.md')
    // 冻结口径：只冻结原 Warning 原文与编号，后续仍允许追加解决说明
    expect(archive).toContain('归档 commit 后**原 Warning 原文与编号冻结**')
    // 明确从归档后目录读取 proposal.md，而非已不存在的 active 路径
    expect(archive).toContain('openspec/changes/archive/<日期>-<change-name>/proposal.md')
    // 旧快照无编号时按顶层条目出现顺序定位
    expect(archive).toContain('顶层 Warning 条目的出现顺序')
    // 追加位置不要求原条目已有显式编号
    expect(archive).toContain('序号仅用于引用与计数，不要求原条目已有显式编号')
    // active 引用与追加写入失败统一归入逐条跳过、不阻断归档
    expect(archive).toContain('引用 active（未归档）快照、锚点无法解析')
    expect(archive).toContain('追加写入失败（磁盘错误、权限错误、文件被占用等）')
    expect(archive).toContain('SHALL NOT 阻断归档')
    expect(archive).toContain('SHALL NOT 改写 active 快照')

    for (const name of ['review-plan.md', 'review-code.md']) {
      const content = read(name)
      expect(content, name).toContain('条目最小结构')
      expect(content, name).toContain('1. [<位置>] — <问题>')
      expect(content, name).toContain('3 空格缩进')
      expect(content, name).toContain('不计入 Warning 计数')
      expect(content, name).toContain('不触发编号重排')
    }

    const explore = read('explore.md')
    expect(explore).toContain(t('@lyx-explore` 对快照只读展示'))
    expect(explore).toContain(t('解决说明由 `@lyx-archive` 在归档时追加'))
    expect(explore).not.toContain('它是只读留痕')
  })

  it('templates support in-change resolution notes on the active snapshot', () => {
    const note = '- 解决：本 change 内修复（commit <短 hash>）'
    for (const name of ['review-plan.md', 'review-code.md']) {
      const content = read(name)
      expect(content, name).toContain('审查后同会话修复的就地标注')
      expect(content, name).toContain(note)
      expect(content, name).toContain('先提交后标注')
      expect(content, name).toContain('修复提交排除快照')
      expect(content, name).toContain(t('SHALL NOT 委托 `@lyx-commit --all`'))
      expect(content, name).toContain('标注前确认')
      // 重跑审查整节替换时，就地标注不被合并保留
      expect(content, name).toContain('SHALL NOT 为保留就地标注而合并新旧节')
    }

    const archive = read('archive.md')
    expect(archive).toContain('归档前核对本 change 未标注 Warning')
    expect(archive).toContain('先确定目标 change')
    expect(archive).toContain(note)
    expect(archive).toContain('(y/N)')
    expect(archive).toContain('由用户直接提供修复 commit hash')
    // 口径收窄：不改写 active 快照只约束跨 change 回写
    expect(archive).toContain('只约束跨 change 回写')
    expect(archive).toContain('不属于对当前 change 快照的重新生成或重建')
    // 核对阶段确定的 change 名传给后续归档委托
    expect(archive).toContain('作为参数传入，SHALL NOT 让其再次推断或询问目标 change')
  })

  it('full-tree staging excludes in-progress review-findings snapshots', () => {
    const pathspec = "':(top,exclude,glob)openspec/changes/*/review-findings.md'"
    for (const name of ['commit.md', 'propose.md']) {
      const content = read(name)
      expect(content, name).toContain("git add -A -- ':/' " + pathspec)
      // 以仓库顶层为锚点：不得退化为以当前目录为锚点的写法
      expect(content, name).not.toContain('git add -A -- .')
      expect(content, name).not.toContain('git add -A &&')
    }
    // 仅有进行中快照改动时：propose 视为干净并跳过空 WIP，commit --all 不硬失败
    const propose = read('propose.md')
    expect(propose).toContain('?? openspec/changes/<change-name>/review-findings.md')
    expect(propose).toContain('已跳过 WIP 提交')
    expect(read('commit.md')).toContain('没有可提交的改动（进行中快照已按规则排除）')
  })

  it('explore lists only unresolved warnings and re-review mechanism is removed', () => {
    const explore = read('explore.md')
    expect(explore).toContain('只展示未解决条目')
    expect(explore).toContain('所有可读快照都没有未解决条目')
    expect(explore).toContain('SHALL NOT 提供展开已隐藏条目的入口')
    expect(explore).not.toContain('已标注解决')
    expect(explore).not.toContain('复审')

    for (const name of ['archive.md', 'propose.md', 'review-plan.md', 'review-code.md']) {
      expect(read(name), name).not.toContain('复审')
    }
  })

  it('explore template asks before listing review-findings snapshots', () => {
    const content = read('explore.md')
    expect(content).toContain('review-findings.md')
    expect(content).toContain('先询问')
    expect(content).toContain('SHALL NOT 直接列出')
    expect(content).toContain('openspec/changes/archive/')
    // 询问/列出不改变参数原样转发
    expect(content).toContain('原样转发')
    // 读取失败容错
    expect(content).toContain('跳过该条并如实注明')
  })

  it('fix template is a lightweight single-commit flow with spec triage and self-review', () => {
    const fix = read('fix.md')
    // A/B/C 分流（含无 spec 基线与用户坚持）
    for (const marker of ['A（代码对齐 spec）', 'B（小幅行为变化）', 'C（超出轻流程）', '无 spec 基线', '用户坚持轻流程'])
      expect(fix, marker).toContain(marker)
    expect(fix).toContain(t('@lyx-propose'))
    // 先红后绿回归测试
    expect(fix).toContain('确认其失败')
    // 五项自审 + 对称清单
    for (const item of ['① 修对了吗', '② spec 一致吗', '③ 漏改了吗', '④ 改多了吗', '⑤ 有回归测试吗'])
      expect(fix, item).toContain(item)
    expect(fix).toContain('改动对称清单')
    // 验证门禁与 B 类确认
    expect(fix).toContain('连续失败 2 次')
    expect(fix).toContain('展示主 spec 的改动')
    // 单 commit：正文附加三条，无 Change trailer，按路径暂存
    for (const bullet of ['- spec：', '- 自审：', '- 验证：'])
      expect(fix, bullet).toContain(bullet)
    expect(fix).toContain('git rev-parse --git-path COMMIT_EDITMSG')
    expect(fix).not.toContain('Change-Stage:')
    expect(fix).not.toContain('Change-Name: <change-name>')
    expect(fix).not.toMatch(/git add -A(?!`)/)
    // 不读取宿主配置、不 spawn
    expect(fix).not.toMatch(/reviewExecutor|codingExecutor|reviewMode|config\.toml/)
    expect(fix).not.toContain('{{')
  })

  it('explore convergence hint routes small changes to fix and others to propose', () => {
    const explore = read('explore.md')
    expect(explore).toContain(t('建议用 @lyx-fix 落地'))
    expect(explore).toContain(t('建议用 @lyx-propose 落地方案'))
    expect(explore).toContain('不自动切换')
  })

  it('archive template notes review-findings snapshot rides along with openspec add', () => {
    const content = read('archive.md')
    expect(content).toContain('review-findings.md')
    expect(content).toContain('git add -- openspec/')
  })

  it('apply template is coding-subagent implementation (main session commits)', () => {
    const content = read('apply.md')
    expect(content).toContain('coding subagent')
    expect(content).toContain('codingModel')
    expect(content).toContain('非 fork')
    expect(content).toContain('context.md')
    expect(content).toContain('只实施 change 范围')
    expect(content).toContain('回传主会话，不自行 commit')
    // 环境级不可用回退 vs 业务失败转人工
    expect(content).toContain('环境级不可用')
    expect(content).toContain('转人工')
    // 实施产物由主会话统一提交（CC 前缀 + Change-Stage trailer）；无 exec 残留
    expect(content).toContain('Change-Stage: apply')
    expect(content).not.toContain('codex exec')
    expect(content).not.toContain('CODEAGENT_EOF')
    expect(content).not.toContain('codex exec resume')
    expect(content).not.toContain('session_id')
    expect(content).not.toContain('ly-wrapper')
    expect(content).not.toMatch(/OVERALL:\s*(PASS|FAIL)/)
    expect(content).not.toContain('LY:IF')
    expect(content).not.toContain('routing.implementer')
    expect(content).toContain('Change-Name: <change-name>')
  })

  it('commit-generating templates reuse the standardized message body rules', () => {
    const bodyTemplates = [
      'commit.md',
      'propose.md',
      'apply.md',
      'archive.md',
      'review-plan.md',
      'review-code.md',
      'init.md',
      'release.md',
      'changelog.md',
      'publish.md',
      'worktree.md',
    ]
    for (const file of bodyTemplates) {
      const content = read(file)
      expect(content, file).toMatch(/(动机[\s\S]*改动[\s\S]*影响|Motivation[\s\S]*Change[\s\S]*Impact)/)
    }

    const commit = read('commit.md')
    expect(commit).toContain('- 动机：')
    expect(commit).toContain('- Motivation:')

    for (const file of ['propose.md', 'apply.md']) {
      const content = read(file)
      expect(content, file).toContain('git commit --only -F "$MSG_FILE"')
    }

    for (const file of ['propose.md', 'apply.md', 'archive.md', 'review-plan.md', 'review-code.md']) {
      const content = read(file)
      expect(content, file).toContain('Change-Stage')
      expect(content, file).toContain('Change-Name: <change-name>')
      expect(content, file).toContain('git rev-parse --git-path COMMIT_EDITMSG')
      expect(content, file).toContain('git commit -F "$MSG_FILE"')
    }

    const publish = read('publish.md')
    expect(publish).toContain('npm version <patch|minor|major> --no-git-tag-version')
    expect(publish).toContain('git tag -a "v<新版本号>" -m "v<新版本号>"')

    const worktree = read('worktree.md')
    expect(worktree).toContain('chore(worktree): 忽略 .worktrees 目录')

    for (const file of ['init.md', 'release.md', 'changelog.md', 'publish.md', 'worktree.md']) {
      const content = read(file)
      expect(content, file).not.toContain('Change-Stage:')
      expect(content, file).not.toContain('Change-Name: <change-name>')
    }
  })

  it('propose and archive templates include isolation cleanup metadata flow', () => {
    const propose = read('propose.md')
    expect(propose).toContain('ISOLATION_SOURCE_BRANCH')
    expect(propose).toContain('DEVELOPMENT_BRANCH')
    expect(propose).toContain('WORKTREE_PATH')
    expect(propose).toContain('lyx:')
    expect(propose).toContain('sourceBranch')
    expect(propose).toContain('developmentBranch')
    expect(propose).toContain('worktreePath')
    expect(propose).toContain('detached HEAD')
    expect(propose).toContain('已保留、未清理')

    const archive = read('archive.md')
    expect(archive).toContain('归档后分支收尾')
    expect(archive).toContain('sourceBranch')
    expect(archive).toContain('developmentBranch')
    expect(archive).toContain('worktreePath')
    expect(archive).toContain('git -C "<targetWorktree>" merge --no-ff "<developmentBranch>"')
    expect(archive).toContain('git -C "<targetWorktree>" worktree remove "<worktreePath>"')
    expect(archive).toContain('git -C "<targetWorktree>" branch -d "<developmentBranch>"')
    expect(archive).toContain('git -C "<targetWorktree>" worktree remove "<worktreePath>"')
    expect(archive).toContain('SHALL NOT 自动 `git push`')
    expect(archive).toContain('sourceBranch` 为 `null`')
    expect(archive).toContain('完全缺少 isolation metadata')
    expect(archive).toContain('checkout / 切回 `targetBranch` 失败')
    expect(archive).toContain('`targetBranch` SHALL NOT 等于 `developmentBranch`')
    expect(archive.indexOf('展示确认前完成一致性校验')).toBeLessThan(archive.indexOf('### 3. 展示收尾提示'))

    const worktree = read('worktree.md')
    expect(worktree).toContain(t('手动 `@lyx-worktree add` 不强制记录该 metadata'))
  })

  it('no template contains wrapper/lite/routing residue', () => {
    for (const file of readdirSync(SKILLS_TEMPLATES_DIR).filter(f => f.endsWith('.md'))) {
      const content = read(file)
      expect(content, file).not.toContain('ly-wrapper')
      expect(content, file).not.toContain('{{LITE_MODE_FLAG}}')
      expect(content, file).not.toContain('<!-- LY:IF')
    }
  })
})

// ─────────────────────────────────────────────────────────────
// A2. 宿主专属：角色词来源（codex = ROLE_FILE 绝对路径；claude = 子代理定义，不引用 codex 角色词）
// ─────────────────────────────────────────────────────────────
describe('host-specific role prompt source', () => {
  it('codex review templates point at the ROLE_FILE absolute paths', () => {
    for (const name of ['review-plan', 'review-code'])
      expect(renderHostCommand('codex', name)).toMatch(/~\/\.codex\/lyx\/prompts\/codex\/(plan-reviewer|reviewer)\.md/)
  })

  it('claude review templates never reference codex role prompt paths', () => {
    for (const name of ['review-plan', 'review-code'])
      expect(renderHostCommand('claude', name)).not.toContain('prompts/codex')
  })

  // 每项为「标签, codex 角色词, claude 角色词, 共享模板」——同一份判级标准必须三处逐字一致
  const RUBRIC_SOURCES: Array<[string, string, string, string]> = [
    ['代码审查', 'templates/hosts/codex/prompts/reviewer.md', 'templates/hosts/claude/agents/lyx-reviewer.md', 'templates/skills/review-code.md'],
    ['方案审查', 'templates/hosts/codex/prompts/plan-reviewer.md', 'templates/hosts/claude/agents/lyx-plan-reviewer.md', 'templates/skills/review-plan.md'],
  ]

  /** 抽取 `## 判级标准` 小节正文（到下一个 `## ` 标题为止），用于跨宿主一致性比对 */
  function rubricSection(markdown: string): string {
    const start = markdown.indexOf('## 判级标准')
    expect(start, '缺少 `## 判级标准` 小节').toBeGreaterThanOrEqual(0)
    const rest = markdown.slice(start)
    const end = rest.indexOf('\n## ', 1)
    return (end === -1 ? rest : rest.slice(0, end)).trim()
  }

  it.each(RUBRIC_SOURCES)('%s 判级标准在两宿主角色词与共享模板间逐字一致', (_label, codexPath, claudePath, sharedPath) => {
    const codexRubric = rubricSection(readFileSync(join(PACKAGE_ROOT, codexPath), 'utf-8'))
    const claudeRubric = rubricSection(readFileSync(join(PACKAGE_ROOT, claudePath), 'utf-8'))
    const sharedRubric = rubricSection(readFileSync(join(PACKAGE_ROOT, sharedPath), 'utf-8'))
    expect(claudeRubric).toBe(codexRubric)
    // main 路径不读角色词，判级标准必须同样出现在共享模板里
    expect(sharedRubric).toBe(codexRubric)
    // rubric 必须真的定义三级与防漂移约束，而不是空壳标题
    for (const heading of ['**Critical', '**Warning', '**Info']) expect(codexRubric, heading).toContain(heading)
    expect(codexRubric).toContain('SHALL NOT 判 Critical')
  })
})

// ─────────────────────────────────────────────────────────────
// B. codex adapter 渲染（REVIEW_MODEL 注入）
// ─────────────────────────────────────────────────────────────
describe('renderCodexTemplate', () => {
  it('injects REVIEW_MODEL when configured', () => {
    const result = renderCodexTemplate(
      'codex exec -m {{REVIEW_MODEL}} -',
      { reviewModel: 'gpt-5.1-codex' },
    )
    expect(result).toBe('codex exec -m gpt-5.1-codex -')
  })

  it('strips the -m flag when reviewModel is unset (fall back to session model)', () => {
    const result = renderCodexTemplate(
      'codex exec -C "$WORKDIR" --json -m {{REVIEW_MODEL}} -',
      {},
    )
    expect(result).toBe('codex exec -C "$WORKDIR" --json -')
  })

  it('strips the -m flag when reviewModel is blank', () => {
    const result = renderCodexTemplate('codex exec -m {{REVIEW_MODEL}} -', { reviewModel: '  ' })
    expect(result).toBe('codex exec -')
  })

  it('renders legacy reviewer/implementer placeholders to codex (single-host semantics)', () => {
    const result = renderCodexTemplate('{{REVIEWER_MODEL}}/{{IMPLEMENTER_MODEL}}', {})
    expect(result).toBe('codex/codex')
  })
})

// ─────────────────────────────────────────────────────────────
// C. adapter 目标与注册表
// ─────────────────────────────────────────────────────────────
function makeCtx(overrides: Record<string, unknown> = {}): any {
  return {
    installDir: '/tmp/codex',
    force: true,
    templateDir: '/pkg/templates',
    paths: { promptsDir: '/tmp/ly-prompts', skillsDir: '/tmp/codex-skills', lyDir: '/tmp/lyx' },
    config: {},
    result: { success: true, installedCommands: [], installedPrompts: [], errors: [], configPath: '' },
    ...overrides,
  }
}

describe('adapters', () => {
  const baseCtx = makeCtx

  it('registry lists codex and claude adapters', () => {
    expect(Object.keys(ADAPTERS).sort()).toEqual(['claude', 'codex'])
  })

  it('codex adapter targets codexSkillsDir with ly- prefix', () => {
    const target = ADAPTERS.codex!.promptsTarget(baseCtx())
    expect(target.sourceDir).toBe('/pkg/templates/skills')
    expect(target.targetDir).toBe('/tmp/codex-skills')
    expect(target.filePrefix).toBe('lyx-')
  })

  it('codex adapter verify checks ROLE_FILE targets exist', async () => {
    const ctx = baseCtx()
    ctx.paths.promptsDir = '/tmp/ly-prompts-missing'
    await ADAPTERS.codex!.verify?.(ctx)
    expect(ctx.result.success).toBe(false)
    expect(ctx.result.errors.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────
// D. installWorkflows — codex 单宿主（产物路径 + ROLE_FILE 校验）
// ─────────────────────────────────────────────────────────────
describe('installWorkflows — codex host', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-test-codex-'))
  const codexSkillsDir = join(base, 'codex-skills')
  const lyPromptsDir = join(base, 'ly-prompts')
  const codexDir = join(base, 'codex')

  afterAll(async () => {
    await fs.remove(base)
  })

  it('installs ly-* skill dirs (SKILL.md) into codexSkillsDir and shared prompts into lyPromptsDir', async () => {
    const result = await installWorkflows(
      getAllCommandIds(),
      codexDir,
      true,
      { hostPaths: { codex: { promptsDir: lyPromptsDir, skillsDir: codexSkillsDir } } },
    )
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])

    const installed = readdirSync(codexSkillsDir)
    expect(installed.length).toBe(15)
    expect(installed).toContain('lyx-apply')
    expect(installed).toContain('lyx-review-plan')
    expect(fs.existsSync(join(codexSkillsDir, 'lyx-apply', 'SKILL.md'))).toBe(true)

    // 渲染产物：单审查 subagent（非 fork）编排指示；REVIEW_MODEL 未配置也无 -m/exec 残留；无 wrapper 残留
    const reviewPlan = readFileSync(join(codexSkillsDir, 'lyx-review-plan', 'SKILL.md'), 'utf-8')
    expect(reviewPlan).toContain('单审查 subagent')
    expect(reviewPlan).not.toContain('reviewModelB')
    expect(reviewPlan).toContain('/.codex/lyx/prompts/codex/plan-reviewer.md')
    expect(reviewPlan).not.toContain('codex exec')
    expect(reviewPlan).not.toContain('CODEAGENT_EOF')
    expect(reviewPlan).not.toContain('codex exec resume')
    expect(reviewPlan).not.toContain('session_id')
    expect(reviewPlan).not.toContain('ly-wrapper')
    expect(reviewPlan).not.toContain('{{REVIEW_MODEL}}')

    // 共享角色词安装到 lyPromptsDir/codex/
    expect(fs.existsSync(join(lyPromptsDir, 'codex', 'reviewer.md'))).toBe(true)
    expect(fs.existsSync(join(lyPromptsDir, 'codex', 'plan-reviewer.md'))).toBe(true)
  })

  it('rendered review templates keep subagent orchestration when reviewModel configured', async () => {
    const result = await installWorkflows(
      getAllCommandIds(),
      codexDir,
      true,
      { hostPaths: { codex: { promptsDir: lyPromptsDir, skillsDir: codexSkillsDir } }, hostConfig: { codex: { reviewModel: 'gpt-5.1-codex' } } },
    )
    expect(result.success).toBe(true)
    const reviewPlan = readFileSync(join(codexSkillsDir, 'lyx-review-plan', 'SKILL.md'), 'utf-8')
    // 模型经模板指示 + 宿主 spawn 能力落实：配置的 reviewModel 值以指示文字形式存在于模板，
    // 不出现 codex exec -m 调用形态
    expect(reviewPlan).toContain('reviewModel')
    expect(reviewPlan).toContain('单审查 subagent')
    expect(reviewPlan).not.toContain('codex exec')
    expect(reviewPlan).not.toContain('-m {{REVIEW_MODEL}}')
    expect(reviewPlan).not.toContain('gpt-5.1-codex')
  })

  it('does not create claude-side artifacts', async () => {
    expect(fs.existsSync(join(codexDir, 'commands', 'ly'))).toBe(false)
    expect(fs.existsSync(join(lyPromptsDir, 'claude'))).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────
// E. 卸载（codex 单宿主：删 ly-*.md + ~/.codex/lyx/ 私有目录；
//     config.toml 与 prompts/ 无条件删除；共享的 ~/.ly/worktrees/ 不碰）
// ─────────────────────────────────────────────────────────────
describe('uninstallWorkflows — codex single host', () => {
  const base = mkdtempSync(join(tmpdir(), 'ly-test-uninstall-'))
  const codexSkillsDir = join(base, 'codex-skills')
  const lyPromptsDir = join(base, 'ly-prompts')
  const codexDir = join(base, 'codex')
  const cleanupDirs = { codexDir: join(base, '.codex'), homeDir: base }
  const lyDir = join(base, 'lyx') // 模拟 ~/.codex/lyx

  async function seed(): Promise<void> {
    await fs.ensureDir(join(codexSkillsDir, 'lyx-commit'))
    await fs.writeFile(join(codexSkillsDir, 'lyx-commit', 'SKILL.md'), '# codex commit\n')
    await fs.writeFile(join(codexSkillsDir, 'user-prompt.md'), '# user own prompt\n')
    await fs.ensureDir(join(lyPromptsDir, 'codex'))
    await fs.writeFile(join(lyPromptsDir, 'codex', 'reviewer.md'), '# reviewer\n')
    await fs.ensureDir(lyDir)
    await fs.writeFile(join(lyDir, 'config.toml'), 'general = { version = "1.0.0" }\n')
  }

  afterAll(async () => {
    await fs.remove(base)
  })

  it('removes package-owned artifacts + private config dir, does not touch user prompts', async () => {
    await seed()
    const result = await uninstallWorkflows(codexDir, {
      hostPaths: { codex: { promptsDir: lyPromptsDir, skillsDir: codexSkillsDir, lyDir } },
      legacyCleanupDirs: cleanupDirs,
    })
    expect(result.success).toBe(true)
    expect(result.removedSkills).toContain('lyx-commit')
    expect(fs.existsSync(join(codexSkillsDir, 'lyx-commit'))).toBe(false)
    // 用户自己的 prompt 不误删
    expect(fs.existsSync(join(codexSkillsDir, 'user-prompt.md'))).toBe(true)
    // 角色词：仅删 codex 子目录，父目录与其余内容保留
    expect(result.removedPrompts).toBe(true)
    expect(fs.existsSync(join(lyPromptsDir, 'codex'))).toBe(false)
    expect(fs.existsSync(lyPromptsDir)).toBe(true)
    // 私有目录（config.toml）无条件删除
    expect(fs.existsSync(lyDir)).toBe(false)
  })

  it('succeeds on empty dirs', async () => {
    const result = await uninstallWorkflows(join(base, 'empty'), {
      hostPaths: { codex: { promptsDir: join(base, 'no-prompts'), skillsDir: join(base, 'no-codex'), lyDir: join(base, 'no-lyx') } },
      legacyCleanupDirs: cleanupDirs,
    })
    expect(result.success).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('does not touch the shared ~/.ly/worktrees/ directory', async () => {
    // 共享 worktree 目录在 lyDir 之外（模拟老包与本包共用的 ~/.ly/worktrees/）
    const sharedWorktreesDir = join(base, 'shared-ly', 'worktrees')
    const mainRepo = join(base, 'shared-main-repo')
    initMainRepo(mainRepo)
    addWorktree(mainRepo, join(sharedWorktreesDir, 'proj-shared'), 'wt-shared')
    await seed()
    const result = await uninstallWorkflows(codexDir, {
      hostPaths: { codex: { promptsDir: lyPromptsDir, skillsDir: codexSkillsDir, lyDir } },
      legacyCleanupDirs: cleanupDirs,
    })
    expect(result.success).toBe(true)
    // 私有目录删了
    expect(fs.existsSync(lyDir)).toBe(false)
    // 共享 worktree 目录原样保留（不删除、不移动、不改动）
    expect(fs.existsSync(join(sharedWorktreesDir, 'proj-shared'))).toBe(true)
    execFileSync('git', ['-C', join(sharedWorktreesDir, 'proj-shared'), 'rev-parse', '--git-dir'])
  })
})
