import { describe, expect, it } from 'vitest'
import { buildInitArgs } from '../update'

// codex 单宿主：非交互重装无需透传 --hosts，直接覆盖重装 codex 侧产物
describe('buildInitArgs (codex 单宿主)', () => {
  it('returns init --force --skip-prompt', () => {
    expect(buildInitArgs()).toBe('init --force --skip-prompt')
  })
})
