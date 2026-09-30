import fs from 'fs-extra'
import { join } from 'pathe'

/** 列出目录下以 prefix 开头的子目录（绝对路径）；目录不存在或读取失败返回 [] */
export async function listPrefixedDirs(dir: string, prefix: string): Promise<string[]> {
  try {
    if (!(await fs.pathExists(dir)))
      return []
    const dirs: string[] = []
    for (const entry of await fs.readdir(dir)) {
      if (!entry.startsWith(prefix))
        continue
      const full = join(dir, entry)
      if ((await fs.stat(full)).isDirectory())
        dirs.push(full)
    }
    return dirs
  }
  catch {
    return []
  }
}

/** 列出目录下以 prefix 开头、以 suffix 结尾的文件（绝对路径）；目录不存在或读取失败返回 [] */
export async function listPrefixedFiles(dir: string, prefix: string, suffix: string): Promise<string[]> {
  try {
    if (!(await fs.pathExists(dir)))
      return []
    const files: string[] = []
    for (const entry of await fs.readdir(dir)) {
      if (!entry.startsWith(prefix) || !entry.endsWith(suffix))
        continue
      const full = join(dir, entry)
      if ((await fs.stat(full)).isFile())
        files.push(full)
    }
    return files
  }
  catch {
    return []
  }
}
