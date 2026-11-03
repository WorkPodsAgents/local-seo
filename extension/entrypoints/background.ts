import { listenForRetries, syncBridgeLink, watchLinkState } from '../src/background/bridge-link'
import { watchRedirects } from '../src/background/fetcher'
import { listenForRequests } from '../src/background/messages'
import { registerLocalHandlers } from '../src/background/local'
import { watchScratchTab } from '../src/maps/scratch-tab'
import { registerNetHandlers } from '../src/background/net'
import { registerPaidHandlers } from '../src/background/paid'
import { readSettings } from '../src/background/settings'
import {
  broadcastStatus,
  registerStatusHandlers,
  reportFailure,
  unlockOnDevice,
} from '../src/background/status'
import { closeStorageToPages } from '../src/background/vault'

export default defineBackground(() => {
  // The toolbar button opens the side panel, which is the whole interface.
  if (import.meta.env.FIREFOX) {
    browser.action.onClicked.addListener(() => {
      void (browser as unknown as { sidebarAction: { open(): Promise<void> } }).sidebarAction.open()
    })
  } else {
    void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  }
  void closeStorageToPages()
  watchRedirects()
  listenForRequests()

  registerNetHandlers()
  registerPaidHandlers()
  registerStatusHandlers()
  registerLocalHandlers()
  watchScratchTab(reportFailure('Closing the Maps reading tab'))

  watchLinkState(() => void broadcastStatus().catch(reportFailure('Showing the agent link')))
  listenForRetries(
    async () => (await readSettings()).agentLink,
    reportFailure('Connecting to the agent bridge'),
  )
  void unlockOnDevice().then(broadcastStatus).catch(reportFailure('Unlocking the vault'))
  void readSettings()
    .then((settings) => syncBridgeLink(settings.agentLink))
    .catch(reportFailure('Connecting to the agent bridge'))
})
