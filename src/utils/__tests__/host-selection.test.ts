import { describe, expect, it } from 'vitest'
import { defaultInteractiveHosts, parseHostList, resolveNonInteractiveHosts, resolveTargetHosts } from '../host-selection'

describe('resolveNonInteractiveHosts (init --skip-prompt / update)', () => {
  it('reinstalls exactly the installed set and never adds codex when only claude is installed', () => {
    expect(resolveNonInteractiveHosts({ installed: ['claude'], detected: ['codex', 'claude'] })).toEqual(['claude'])
  })

  it('falls back to detected hosts on a fresh environment', () => {
    expect(resolveNonInteractiveHosts({ installed: [], detected: ['claude'] })).toEqual(['claude'])
  })

  it('installs codex on a fresh environment with nothing detected (pre-change behavior)', () => {
    expect(resolveNonInteractiveHosts({ installed: [], detected: [] })).toEqual(['codex'])
  })
})

describe('defaultInteractiveHosts', () => {
  it('checks installed ∪ detected in registry order', () => {
    expect(defaultInteractiveHosts({ installed: ['claude'], detected: ['codex'] })).toEqual(['codex', 'claude'])
  })

  it('checks codex when nothing is installed or detected', () => {
    expect(defaultInteractiveHosts({ installed: [], detected: [] })).toEqual(['codex'])
  })
})

describe('parseHostList / resolveTargetHosts', () => {
  it('parses comma lists and dedupes', () => {
    expect(parseHostList('claude, codex,claude')).toEqual(['claude', 'codex'])
    expect(parseHostList(undefined)).toBeUndefined()
  })

  it('rejects unknown hosts with the available list', () => {
    expect(() => parseHostList('gemini')).toThrow(/available: codex, claude/)
  })

  it('uses the explicit host when given, otherwise all installed hosts', async () => {
    expect(await resolveTargetHosts(['claude'])).toEqual(['claude'])
  })
})
