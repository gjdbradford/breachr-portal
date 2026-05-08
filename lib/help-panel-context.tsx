'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

export type HelpPanelConfig = {
  title: string
  defaultTab: 'chat' | 'guides' | 'videos'
  chatContextKey?: 'sensors' | 'generic'
  guides?: { title: string; description: string; href?: string }[]
  videos?: { title: string; thumbnailUrl?: string; href: string }[]
}

type HelpPanelContextValue = {
  isOpen: boolean
  toggle: () => void
  close: () => void
  config: HelpPanelConfig | null
  registerContent: (config: HelpPanelConfig) => void
}

const HelpPanelContext = createContext<HelpPanelContextValue | null>(null)

export function HelpPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [config, setConfig] = useState<HelpPanelConfig | null>(null)

  const toggle = useCallback(() => setIsOpen(o => !o), [])
  const close = useCallback(() => setIsOpen(false), [])
  const registerContent = useCallback((cfg: HelpPanelConfig) => {
    setConfig(cfg)
  }, [])

  return (
    <HelpPanelContext.Provider value={{ isOpen, toggle, close, config, registerContent }}>
      {children}
    </HelpPanelContext.Provider>
  )
}

export function useHelpPanel() {
  const ctx = useContext(HelpPanelContext)
  if (!ctx) throw new Error('useHelpPanel must be used within HelpPanelProvider')
  return ctx
}

export function useRegisterHelpContent(config: HelpPanelConfig) {
  const { registerContent, close } = useHelpPanel()
  useEffect(() => {
    registerContent(config)
    return () => { close() }
  // config is intentionally excluded — it's static per page mount and passed inline (new reference each render)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerContent, close])
}
