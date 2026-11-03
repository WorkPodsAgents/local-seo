import { createContext, useContext } from 'react'

/** The settings cards a header chip or a blocked paid action can send the user to. */
export type SettingsSection = 'vault' | 'keys' | 'spend' | 'agent'

export const OpenSettings = createContext<(section: SettingsSection) => void>(() => undefined)

export function useOpenSettings() {
  return useContext(OpenSettings)
}

export const sectionId = (section: SettingsSection) => `settings-${section}`
