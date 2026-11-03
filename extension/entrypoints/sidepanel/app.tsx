import { DEFAULT_AUDIT_PARTS, type AuditPart } from '@local-seo/core/bridge'
import type { LocalGroup } from '@local-seo/core/registry'
import { isMissing } from '@local-seo/core/business'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { BusinessView } from '../../src/shared/local'
import { AnswersCard } from '../../src/ui/answers/answers-screen'
import { BusinessScreen } from '../../src/ui/business/business-screen'
import { call } from '../../src/ui/client'
import { Empty } from '../../src/ui/components/notice'
import { Tabs } from '../../src/ui/components/tabs'
import { DevCapture } from '../../src/ui/dev-capture'
import { Header } from '../../src/ui/header'
import { LanguageNotice, useMapsLanguage } from '../../src/ui/language-notice'
import { OpenSettings, sectionId, type SettingsSection } from '../../src/ui/open-settings'
import { GeoGridCard } from '../../src/ui/rankings/geo-grid'
import { TeleportCard } from '../../src/ui/rankings/teleport'
import { ReviewsScreen } from '../../src/ui/reviews/reviews-screen'
import { ScanScreen } from '../../src/ui/scan/scan-screen'
import { ScoreStrip } from '../../src/ui/score-strip'
import { searchPageQuery } from '../../src/ui/search-notice'
import { Settings } from '../../src/ui/screens/settings'
import screens from '../../src/ui/screens/screens.module.css'
import { StatusProvider } from '../../src/ui/status-context'
import { TabAccess } from '../../src/ui/tab-access'
import { useActiveTab, useTabAccess } from '../../src/ui/use-active-url'
import { useTask } from '../../src/ui/use-task'
import { WebsiteScreen } from '../../src/ui/website/website-screen'
import styles from './app.module.css'

type TabId = 'business' | 'scan' | 'rankings' | 'reviews' | 'website' | 'answers' | 'settings'

/** From the one profile to the market around it. Settings opens from the header. */
const TABS: readonly { readonly id: Exclude<TabId, 'settings'>; readonly label: string }[] = [
  { id: 'business', label: 'This business' },
  { id: 'scan', label: 'Local scan' },
  { id: 'rankings', label: 'Rankings' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'website', label: 'Website' },
  { id: 'answers', label: 'AI answers' },
]

/** The panel audits every part it can; the website needs a site grant, asked on that tab. */
const PANEL_PARTS: AuditPart[] = [...DEFAULT_AUDIT_PARTS, 'competitors']

export function App() {
  return (
    <StatusProvider>
      <Panel />
    </StatusProvider>
  )
}

function Panel() {
  const tab = useActiveTab()
  const tabAccess = useTabAccess()
  const mapsLanguage = useMapsLanguage(tab)
  const url = tab?.url ?? null
  const host = url === null || !/^https?:/.test(url) ? null : siteLabel(url)
  const onMapsPlace = url !== null && /^https:\/\/www\.google\.[a-z.]+\/maps\/place\//.test(url)
  const searchPage = searchPageQuery(url)
  const [screen, setScreen] = useState<TabId>(initialTab)
  const [section, setSection] = useState<SettingsSection | null>(null)
  const [group, setGroup] = useState<LocalGroup | null>(null)
  const audit = useTask<BusinessView>()
  useEffect(() => {
    void call('business:last', {}).then((last) => {
      if (last !== null) audit.setTask({ kind: 'done', value: last })
    })
  }, [audit.setTask])
  const openSettings = useCallback((next: SettingsSection) => {
    setScreen('settings')
    setSection(next)
  }, [])
  // Scrolls once the settings screen is shown; the section resets so the same chip works twice.
  useEffect(() => {
    if (screen !== 'settings' || section === null) return
    document.getElementById(sectionId(section))?.scrollIntoView({ block: 'start' })
    setSection(null)
  }, [screen, section])
  const runAudit = (keyword: string | null) =>
    void audit.run(() => call('business:audit', { tab, ref: null, include: PANEL_PARTS, keyword }))
  const view = audit.value
  const showGroup = (next: LocalGroup) => {
    setScreen('business')
    setGroup((current) => (current === next ? null : next))
  }
  // Every screen stays mounted, so switching tabs keeps what the user typed and found.
  const panel = (id: TabId, children: ReactNode) => (
    <section
      key={id}
      id={`panel-${id}`}
      role={id === 'settings' ? 'region' : 'tabpanel'}
      aria-labelledby={id === 'settings' ? undefined : `tab-${id}`}
      aria-label={id === 'settings' ? 'Settings' : undefined}
      hidden={screen !== id}
      className={styles.screen}
    >
      {children}
    </section>
  )
  const needsBusiness = (children: (view: BusinessView) => ReactNode) =>
    view === null ? (
      <Empty title="Audit a business first">
        Open a business in Google Maps and audit it on the This business tab. This tab then works on
        that business.
      </Empty>
    ) : (
      children(view)
    )
  return (
    <OpenSettings value={openSettings}>
      <div className={styles.panel}>
        <Header host={host} settingsOpen={screen === 'settings'} />
        <ScoreStrip
          findings={view?.findings ?? null}
          selected={screen === 'business' ? group : null}
          onSelect={showGroup}
        />
        <Tabs tabs={TABS} selected={screen} onSelect={setScreen} label="Local SEO sections" />
        <main className={styles.body}>
          {tabAccess.granted === false && url === null ? (
            <TabAccess onAllow={tabAccess.allow} />
          ) : null}
          {tab === null ? null : <LanguageNotice tab={tab} language={mapsLanguage} />}
          {import.meta.env.MODE === 'development' ? <DevCapture /> : null}
          {panel(
            'business',
            <BusinessScreen
              onMapsPlace={onMapsPlace}
              searchPage={searchPage}
              audit={audit.task}
              group={group}
              onGroup={setGroup}
              onAudit={runAudit}
            />,
          )}
          {panel(
            'scan',
            <ScanScreen tab={tab} searchPage={searchPage} ownName={view?.business.name ?? null} />,
          )}
          {panel(
            'rankings',
            needsBusiness((current) => (
              <div className={screens.stack} key={current.business.readAt}>
                <TeleportCard business={current.business} defaultQuery={queryOf(current)} />
                <GeoGridCard business={current.business} defaultQuery={queryOf(current)} />
              </div>
            )),
          )}
          {panel(
            'reviews',
            needsBusiness((current) => (
              <ReviewsScreen key={current.business.readAt} view={current} />
            )),
          )}
          {panel(
            'website',
            needsBusiness((current) => (
              <WebsiteScreen key={current.business.readAt} view={current} />
            )),
          )}
          {panel(
            'answers',
            needsBusiness((current) => (
              <AnswersCard
                key={current.business.readAt}
                businessName={current.business.name}
                defaultQuery={queryOf(current).toLowerCase()}
                defaultCity={cityOf(current)}
                defaultCompetitors={(current.competitors ?? [])
                  .filter((row) => !row.sponsored && row.name !== current.business.name)
                  .slice(0, 3)
                  .map((row) => row.name)}
              />
            )),
          )}
          {panel('settings', <Settings />)}
        </main>
      </div>
    </OpenSettings>
  )
}

/** The search a business wants to win: the audit's keyword, else its primary category. */
function queryOf(view: BusinessView): string {
  if (view.keyword !== null) return view.keyword
  const primary = view.business.categories.primary
  return isMissing(primary) ? '' : primary
}

/** "Austin, TX" from the address line, the town a local buyer names. */
function cityOf(view: BusinessView): string {
  const address = view.business.address
  if (isMissing(address)) return ''
  if (address.city !== null) return address.city
  const parts = address.formatted.split(',').map((part) => part.trim())
  return parts.length >= 3 ? `${parts.at(-2)}, ${(parts.at(-1) ?? '').split(' ')[0]}` : ''
}

/** "Google Maps" on Maps, "Google Search" on a results page, else the site's host. */
function siteLabel(url: string): string {
  const { host, pathname } = new URL(url)
  if (/^www\.google\./.test(host)) {
    if (pathname.startsWith('/maps')) return 'Google Maps'
    if (pathname.startsWith('/search')) return 'Google Search'
  }
  return host
}

/** `#rankings` opens that tab, so a link or a test can land on any screen. */
function initialTab(): TabId {
  const hash = location.hash.slice(1)
  if (hash === 'settings') return 'settings'
  return TABS.find((entry) => entry.id === hash)?.id ?? 'business'
}
