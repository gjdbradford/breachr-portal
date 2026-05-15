'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useHelpPanel } from './help-panel-context'

export type GuideStep = {
  id: string
  step_order: number
  title: string
  body: string
  image_url: string | null
  video_url: string | null
  target_selector: string | null
  links: Array<{ label: string; href: string; external: boolean }>
}

export type GuideSet = {
  id: string
  title: string
  description: string
  auto_open: 'always' | 'first_visit' | 'never'
  next_guide_id: string | null
}

export type GuideProgress = {
  current_step: number
  completed_at: string | null
  dismissed_at: string | null
}

type GuideContextValue = {
  activeGuide: GuideSet | null
  steps: GuideStep[]
  progress: GuideProgress | null
  currentStepIndex: number
  loading: boolean
  advanceStep: () => Promise<void>
  goBack: () => void
  dismissGuide: () => Promise<void>
  completeGuide: () => Promise<void>
  rateGuide: (helpful: boolean) => Promise<void>
  nextGuide: GuideSet | null
}

const GuideContext = createContext<GuideContextValue | null>(null)

export function useGuide() {
  const ctx = useContext(GuideContext)
  if (!ctx) throw new Error('useGuide must be used within GuideProvider')
  return ctx
}

/** Returns null when called outside a GuideProvider — safe for optional consumers. */
export function useOptionalGuide(): GuideContextValue | null {
  return useContext(GuideContext)
}

export function GuideProvider({ userId, userRole, children }: {
  userId: string
  userRole: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const { openToTab } = useHelpPanel()

  const [activeGuide, setActiveGuide] = useState<GuideSet | null>(null)
  const [steps, setSteps]             = useState<GuideStep[]>([])
  const [progress, setProgress]       = useState<GuideProgress | null>(null)
  const [nextGuide, setNextGuide]     = useState<GuideSet | null>(null)
  const [loading, setLoading]         = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)

  const autoOpenedRef = useRef<Set<string>>(new Set())

  const fetchGuide = useCallback(async (path: string) => {
    const supabase = createClient()
    setLoading(true)
    try {
      const { data: guides } = await supabase
        .from('guide_sets')
        .select('id, title, description, auto_open, next_guide_id, roles')
        .eq('route', path)
        .eq('is_published', true)
        .contains('roles', [userRole])
        .limit(1)
        .maybeSingle()

      if (!guides) {
        setActiveGuide(null); setSteps([]); setProgress(null); setNextGuide(null)
        return
      }

      const [{ data: stepsData }, { data: progressData }] = await Promise.all([
        supabase.from('guide_steps').select('*').eq('guide_set_id', guides.id).order('step_order', { ascending: true }),
        supabase.from('guide_progress').select('current_step, completed_at, dismissed_at').eq('guide_set_id', guides.id).eq('user_id', userId).maybeSingle(),
      ])

      const prog = progressData as GuideProgress | null
      const guide: GuideSet = {
        id: guides.id,
        title: guides.title,
        description: guides.description,
        auto_open: guides.auto_open,
        next_guide_id: guides.next_guide_id,
      }

      setActiveGuide(guide)
      setSteps((stepsData ?? []) as GuideStep[])
      setProgress(prog)
      setCurrentStepIndex(prog ? Math.max(0, prog.current_step - 1) : 0)

      if (guides.next_guide_id) {
        const { data: next } = await supabase.from('guide_sets').select('id, title, description, auto_open, next_guide_id').eq('id', guides.next_guide_id).single()
        setNextGuide(next as GuideSet | null)
      } else {
        setNextGuide(null)
      }

      if (prog?.completed_at) return

      const key = guides.id
      const shouldOpen =
        guides.auto_open === 'always' ||
        (guides.auto_open === 'first_visit' && !prog && !autoOpenedRef.current.has(key))

      if (shouldOpen) {
        autoOpenedRef.current.add(key)
        openToTab('guides')
      }
    } finally {
      setLoading(false)
    }
  }, [userId, userRole, openToTab])

  useEffect(() => {
    fetchGuide(pathname)
  }, [pathname, fetchGuide])

  async function upsertProgress(patch: Partial<GuideProgress> & { current_step: number }) {
    if (!activeGuide) return
    const supabase = createClient()
    await supabase.from('guide_progress').upsert(
      { user_id: userId, guide_set_id: activeGuide.id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,guide_set_id' }
    )
  }

  async function fireEvent(name: string, payload: Record<string, unknown>) {
    if (!activeGuide) return
    const supabase = createClient()
    await supabase.from('events').insert({
      user_id: userId,
      name,
      properties: { guide_set_id: activeGuide.id, ...payload },
    })
  }

  const advanceStep = useCallback(async () => {
    if (!activeGuide) return
    const nextIdx = currentStepIndex + 1
    setCurrentStepIndex(nextIdx)
    await upsertProgress({ current_step: nextIdx + 1 })
    await fireEvent('guide_step_completed', { step_order: currentStepIndex + 1, method: 'next' })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGuide, currentStepIndex])

  const goBack = useCallback(() => {
    setCurrentStepIndex(i => Math.max(0, i - 1))
  }, [])

  const dismissGuide = useCallback(async () => {
    if (!activeGuide) return
    const now = new Date().toISOString()
    setProgress(p => p ? { ...p, dismissed_at: now } : { current_step: currentStepIndex + 1, completed_at: null, dismissed_at: now })
    await upsertProgress({ current_step: currentStepIndex + 1, dismissed_at: now })
    await fireEvent('guide_dismissed', { step_order: currentStepIndex + 1 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGuide, currentStepIndex])

  const completeGuide = useCallback(async () => {
    if (!activeGuide) return
    const now = new Date().toISOString()
    setProgress(p => p ? { ...p, completed_at: now } : { current_step: steps.length, completed_at: now, dismissed_at: null })
    await upsertProgress({ current_step: steps.length, completed_at: now })
    await fireEvent('guide_completed', { role: userRole })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGuide, steps.length, userRole])

  const rateGuide = useCallback(async (helpful: boolean) => {
    if (!activeGuide) return
    const supabase = createClient()
    await supabase.from('guide_ratings').upsert(
      { user_id: userId, guide_set_id: activeGuide.id, helpful },
      { onConflict: 'user_id,guide_set_id' }
    )
    await fireEvent('guide_rated', { helpful })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGuide, userId])

  return (
    <GuideContext.Provider value={{
      activeGuide, steps, progress, currentStepIndex, loading,
      advanceStep, goBack, dismissGuide, completeGuide, rateGuide, nextGuide,
    }}>
      {children}
    </GuideContext.Provider>
  )
}
