import { defineConfig } from 'wxt'

// The public half of the signing key. It fixes the extension id (bljbmngieccnjdnlahdhgklcagfcphak)
// for unpacked team builds and the store listing alike, so the bridge's origin check and saved
// results survive every update. The private key never enters this repo.
const KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlYVDQGBI0cCagfXE+FkMSsY1cWhYjEHGqfowSjk863S6EiErRjur+Z2XTvNYVURwlzsf9mFqleVTVGEzP5Bh19ds8IGqVEjGI0H+OYUn5c7+K3BuiVCZNzO97TXXhY8bBfqguMMKEAHJuzE32Kgev8cAQjvWJUoyM4IEfCOMklEOAyjm55XY/IUosKS5XpCKr6AN9ATsrjyuHGgnywBV6z7719yeamlN3M25PlVj2sHPjKVPtlAg04ykGrdst50azB3ED2ht57RXmhqboI7hKTpeuD4JEuJZUn+P1YElX4t6FwS1lzgoQVIuLKoz0U3P/ki5jjvtjfl6gN8sLDizkwIDAQAB'

// Maps is all a release reads. Development builds also hold Search, for the fixture capture
// (src/ui/dev-capture.tsx) to save Search pages for the local pack readers still to be written.
const DEV_HOSTS = ['https://www.google.com/search*']

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  zip: { artifactTemplate: 'local-seo-{{version}}-{{browser}}.zip' },
  manifest: ({ mode, browser }) => ({
    name: 'Local SEO by WorkPods',
    short_name: 'Local SEO',
    description:
      'Audit Google Business Profiles and see where local businesses rank in Google Maps.',
    ...(browser === 'firefox' || process.env.LOCAL_SEO_STORE_UPLOAD === '1' ? {} : { key: KEY }),
    permissions: [
      ...(browser === 'firefox' ? [] : ['sidePanel' as const]),
      'activeTab',
      'storage',
      'scripting',
      ...(browser === 'firefox' ? [] : ['offscreen' as const]),
      'alarms',
      ...(mode === 'e2e' ? (['webRequest', 'tabs'] as const) : []),
    ],
    // webRequest is asked with each website a check reads: it observes the redirect hops of the
    // extension's own requests, which a manual-redirect fetch hides. tabs is asked once from the
    // panel, because Chrome hides the address of the page in front of the user without it.
    optional_permissions: ['webRequest', 'tabs'],
    // Other Google country domains, the AI assistants and the business's own website are asked
    // for per site.
    optional_host_permissions: ['<all_urls>'],
    // The core features read Maps places, Maps results and reviews on these pages.
    host_permissions: [
      'https://www.google.com/maps/*',
      ...(mode === 'e2e' ? ['http://127.0.0.1/*'] : []),
      ...(mode === 'development' ? DEV_HOSTS : []),
    ],
    ...(browser === 'firefox'
      ? {
          // Keep packaged scripts only, but allow the authenticated localhost WebSocket bridge.
          content_security_policy: {
            extension_pages:
              "script-src 'self'; object-src 'none'; connect-src https: http: ws://127.0.0.1:47822",
          },
          browser_specific_settings: {
            gecko: {
              id: 'local-seo@workpods.ai',
              strict_min_version: '140.0',
              data_collection_permissions: {
                required: ['authenticationInfo', 'websiteContent', 'searchTerms'],
              },
            },
          },
        }
      : {}),
    action: { default_title: 'Local SEO', default_icon: { 16: 'icon-16.png', 32: 'icon-32.png' } },
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
      512: 'icon-512.png',
    },
  }),
})
