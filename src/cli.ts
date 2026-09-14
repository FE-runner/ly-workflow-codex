#!/usr/bin/env node
import cac from 'cac'
import { setupCommands } from './cli-setup'
import { BIN_NAME } from './utils/package-meta'

async function main(): Promise<void> {
  const cli = cac(BIN_NAME)
  await setupCommands(cli)
  cli.parse()
}

main().catch(console.error)
