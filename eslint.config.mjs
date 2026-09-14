import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    // vitest vi.hoisted 模式需要同步 require，测试文件豁免
    files: ['**/__tests__/**'],
    rules: {
      'ts/no-require-imports': 'off',
    },
  },
  {
    // CLI 工具天然依赖 console 输出与全局 process,不予 lint 阻塞
    rules: {
      'no-console': 'off',
      'node/prefer-global/process': 'off',
    },
  },
)
