import { beforeAll, describe, expect, it } from 'vitest'
import { initI18n } from '../../i18n'
import { buildMainMenuChoices } from '../menu'

beforeAll(async () => {
  await initI18n('zh-CN')
})

/** 提取 choices 里的 value（跳过 Separator） */
function values(choices: any[]): string[] {
  return choices.filter(c => !('type' in c && c.type === 'separator') && c.value !== undefined).map(c => c.value)
}

/** 提取分组标签（Separator 文本，inquirer v12 存于 .separator） */
function groupLabels(choices: any[]): string[] {
  return choices
    .filter(c => 'type' in c && c.type === 'separator' && typeof c.separator === 'string')
    .map(c => c.separator as string)
}

describe('main menu structure (codex 单宿主)', () => {
  it('keeps the codex single-host entries (1/2/3/H/-/Q)', () => {
    const keys = values(buildMainMenuChoices(true))
    expect(keys).toContain('1') // init
    expect(keys).toContain('2') // update
    expect(keys).toContain('3') // configReviewModel
    expect(keys).toContain('H')
    expect(keys).toContain('-')
    expect(keys).toContain('Q')
  })

  it('removes claude-host entries (4/D/T/C/X)', () => {
    const keys = values(buildMainMenuChoices(true))
    expect(keys).not.toContain('4')
    expect(keys).not.toContain('D')
    expect(keys).not.toContain('T')
    expect(keys).not.toContain('C')
    expect(keys).not.toContain('X')
  })

  it('organizes entries under 工作流 and 帮助与卸载 groups', () => {
    const groups = groupLabels(buildMainMenuChoices(true)).map(g => g.replace(/─/g, '').trim())
    expect(groups.filter(g => g.includes('工作流')).length).toBe(1)
    expect(groups.filter(g => g.includes('帮助与卸载')).length).toBe(1)
    // 原"其他工具 / Claude Code"组已移除
    expect(groups.some(g => g.includes('其他工具'))).toBe(false)
    expect(groups.includes('Claude Code')).toBe(false)
  })

  it('orders workflow entries 1→2→3 inside the workflow group', () => {
    const choices = buildMainMenuChoices(true)
    const idx = (v: string) => choices.findIndex((c: any) => c.value === v)
    const workflowGroupIdx = choices.findIndex((c: any) => c.type === 'separator' && String(c.separator).includes('工作流'))
    const helpGroupIdx = choices.findIndex((c: any) => c.type === 'separator' && String(c.separator).includes('帮助与卸载'))
    expect(idx('1')).toBeGreaterThan(workflowGroupIdx)
    expect(idx('2')).toBeGreaterThan(idx('1'))
    expect(idx('3')).toBeGreaterThan(idx('2'))
    expect(idx('3')).toBeLessThan(helpGroupIdx)
    expect(idx('H')).toBeGreaterThan(helpGroupIdx)
    expect(idx('-')).toBeGreaterThan(idx('H'))
    expect(idx('Q')).toBeGreaterThan(idx('-'))
  })

  it('renders English group labels for en locale', () => {
    const groups = groupLabels(buildMainMenuChoices(false)).map(g => g.replace(/─/g, '').trim())
    expect(groups.some(g => g.includes('Workflow'))).toBe(true)
    expect(groups.some(g => g.includes('Help & Uninstall'))).toBe(true)
  })
})
