import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SPAWNABLE_MODELS_DEFAULT } from '../config'
import { injectConfigVariables } from '../installer'

// Helper: find package root (mirrors the logic in installer.ts)
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
// codex 单宿主：实际命令模板源为 templates/skills-codex/
const TEMPLATES_DIR = join(PACKAGE_ROOT, 'templates', 'skills-codex')

// ─────────────────────────────────────────────────────────────
// Integration test with real templates
// ─────────────────────────────────────────────────────────────
describe('integration: real templates have no MCP placeholders', () => {
  // Collect all .md files under templates/skills-codex/
  function collectTemplateFiles(dir: string): string[] {
    const files: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...collectTemplateFiles(fullPath))
      }
      else if (entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }
    return files
  }

  const templateFiles = collectTemplateFiles(TEMPLATES_DIR)

  it('no command template references {{MCP_SEARCH_TOOL}} / {{MCP_SEARCH_PARAM}}', () => {
    const filesWithMcpRef = templateFiles.filter((f) => {
      const content = readFileSync(f, 'utf-8')
      return content.includes('{{MCP_SEARCH_TOOL}}') || content.includes('{{MCP_SEARCH_PARAM}}')
    })
    expect(filesWithMcpRef).toEqual([])
  })

  it('no command template references removed wrapper/lite placeholders', () => {
    const filesWithResidue = templateFiles.filter((f) => {
      const content = readFileSync(f, 'utf-8')
      return content.includes('{{LITE_MODE_FLAG}}') || content.includes('<!-- LY:IF')
    })
    expect(filesWithResidue).toEqual([])
  })

  it('injectConfigVariables renders reviewer/implementer placeholders to codex', () => {
    expect(injectConfigVariables('{{REVIEWER_MODEL}}', {})).toBe('codex')
    expect(injectConfigVariables('{{IMPLEMENTER_MODEL}}', {})).toBe('codex')
  })

  it('renders {{SPAWNABLE_MODELS_DEFAULT}} with the built-in default list text', () => {
    const rendered = injectConfigVariables('fallback: {{SPAWNABLE_MODELS_DEFAULT}}', {})
    expect(rendered).toBe(`fallback: ${SPAWNABLE_MODELS_DEFAULT.join(' / ')}`)
    expect(rendered).not.toContain('{{SPAWNABLE_MODELS_DEFAULT}}')
    expect(rendered).toContain('gpt-6-astra')
  })

  it('review-plan / review-code / apply templates carry the model availability validation rule and no unrendered placeholder', () => {
    for (const file of ['review-plan.md', 'review-code.md', 'apply.md']) {
      const rendered = injectConfigVariables(readFileSync(join(TEMPLATES_DIR, file), 'utf-8'), {})
      expect(rendered, file).toContain('模型可用性校验')
      expect(rendered, file).toContain('子代理模型配置无效')
      expect(rendered, file).toContain('Available models')
      expect(rendered, file).toContain('无法读取配置，请运行 `lycx doctor` 检查')
      expect(rendered, file).not.toContain('{{SPAWNABLE_MODELS_DEFAULT}}')
    }
  })
})
