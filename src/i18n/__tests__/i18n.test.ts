import { describe, expect, it } from 'vitest'
import { changeLanguage, i18n, initI18n } from '../index'

const HOST_KEYS = [
  'cli:help.banner',
  'cli:help.hostOption',
  'init:tagline',
  'init:hostSelect.prompt',
  'init:hostSelect.required',
  'init:hostSelect.desc.codex',
  'init:hostSelect.desc.claude',
  'init:claude.executorHint',
  'init:claude.modelInherit',
  'init:claude.noProviderNote',
  'common:preflight.repairHint',
]

describe('host-related copy exists in both languages (5.4)', () => {
  it.each(['zh-CN', 'en'] as const)('%s', async (lang) => {
    await initI18n(lang)
    await changeLanguage(lang)
    for (const key of HOST_KEYS) {
      const text = i18n.t(key, { host: 'claude', cmd: 'x' })
      expect(text, `${lang} ${key}`).not.toBe(key.split(':')[1])
      expect(text, `${lang} ${key}`).not.toBe(key)
    }
    expect(i18n.t('cli:help.banner')).toMatch(/Claude Code/)
    expect(i18n.t('init:claude.executorHint')).toMatch(/inherit/)
  })
})
