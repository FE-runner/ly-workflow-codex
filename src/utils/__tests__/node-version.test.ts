import { describe, expect, it } from 'vitest'
import { engines } from '../../../package.json'
import { isNodeVersionSupported } from '../node-version'
import { MIN_NODE_VERSION } from '../package-meta'

describe('openspec Node.js requirement', () => {
  it('keeps package engines aligned with the OpenSpec npm floor', () => {
    expect(engines.node).toBe(`>=${MIN_NODE_VERSION}`)
  })

  it('supports Node.js 22.12.0 and newer', () => {
    expect(isNodeVersionSupported('22.11.0')).toBe(false)
    expect(isNodeVersionSupported('22.12.0')).toBe(true)
    expect(isNodeVersionSupported('23.0.0')).toBe(true)
  })
})
