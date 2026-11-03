// The bridge's twelve tools as `tool:<name>` router handlers. Only the bridge link calls them: it
// calls the router directly, with no sender, so a page or content script can never run one.
import type { ToolName } from '@local-seo/core/bridge'
import type { LocalTools } from '../services/tools'
import { registerHandler } from './router'

/** Only the bridge link calls tools, and it calls the router directly with no sender. */
export function registerTools(tools: LocalTools, onCall: (name: ToolName) => void): void {
  for (const name of Object.keys(tools) as ToolName[]) {
    registerHandler(`tool:${name}`, (args, sender) => {
      if (sender !== null) throw new Error(`tool:${name} is only open to the agent bridge`)
      if (typeof args !== 'object' || args === null) throw new Error(`${name} needs its arguments`)
      onCall(name)
      // The bridge validated the arguments against the same ToolArgs schema before sending them.
      return (tools[name] as (args: unknown) => Promise<unknown>)(args)
    })
  }
}
