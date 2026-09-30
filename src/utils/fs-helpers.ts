import fs from 'fs-extra'
import { join } from 'pathe'

/**
 * 目录可读性探测：目录不存在（ENOENT）返回 false，其余错误（EACCES 等）向上抛出。
 *
 * 不能用 `fs.pathExists` 代替——它在任何错误上都返回 false，会把权限错误当成"目录不存在"。
 */
async function isReadableDir(dir: string): Promise<boolean> {
  try {
    return (await fs.stat(dir)).isDirectory()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return false
    throw error
  }
}

/** 条目是否为目录：ENOENT（断链等）按"不是目录"跳过，其余错误向上抛出 */
async function isDirEntry(full: string): Promise<boolean> {
  try {
    return (await fs.stat(full)).isDirectory()
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return false
    throw error
  }
}

/**
 * 列出目录下以 prefix 开头的子目录（绝对路径）。
 *
 * 目录不存在返回 []；读取失败（权限、IO 错误）向上抛出——调用方据此判定备份/删除失败，
 * SHALL NOT 把"读不到"静默当成"没有内容"（那会让 update 跳过备份后覆盖、或让卸载漏删却报成功）。
 */
export async function listPrefixedDirs(dir: string, prefix: string): Promise<string[]> {
  if (!(await isReadableDir(dir)))
    return []
  const dirs: string[] = []
  for (const entry of await fs.readdir(dir)) {
    if (!entry.startsWith(prefix))
      continue
    const full = join(dir, entry)
    if (await isDirEntry(full))
      dirs.push(full)
  }
  return dirs
}

/** 列出目录下以 prefix 开头、以 suffix 结尾的文件（绝对路径）；错误口径同 listPrefixedDirs */
export async function listPrefixedFiles(dir: string, prefix: string, suffix: string): Promise<string[]> {
  if (!(await isReadableDir(dir)))
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
