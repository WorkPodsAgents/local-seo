import { main } from './commands'
import { nodeFetcher, parseHtml } from './node-io'
import { pairingFilePath } from './pairing-file'

const deps = {
  fetcher: nodeFetcher,
  parse: parseHtml,
  now: () => new Date(),
  pairingFile: pairingFilePath(),
}

// `mcp` keeps running on stdio after main returns, so the exit code only sets how it ends.
main(process.argv.slice(2), (text) => process.stdout.write(text), deps).then(
  (code) => {
    process.exitCode = code
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`local-seo: ${message}\n`)
    process.exitCode = 2
  },
)
