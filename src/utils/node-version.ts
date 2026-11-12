import { MIN_NODE_VERSION } from './package-meta'
import { compareVersions } from './version-compare'

/** 当前 Node.js 是否满足 npm 安装 OpenSpec 2.x 的最低版本要求。 */
export function isNodeVersionSupported(version = process.versions.node): boolean {
  return compareVersions(version, MIN_NODE_VERSION) >= 0
}
