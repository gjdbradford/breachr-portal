# Navigation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the floating `UserAvatarMenu` overlay with a proper fixed top header, add a collapsible sidebar with icon-rail mode, and build a global context-aware help/AI panel.

**Architecture:** A new `TopHeader` component (fixed, 64px) owns the BREACHR logo, help toggle, and avatar. `DashboardNav` gains collapse state persisted to `localStorage`, toggling a `body.sidebar-collapsed` class that CSS uses to animate `portal-main`'s `margin-left`. A `HelpPanelContext` lets any page register page-specific content (title, guides, chat context) that the global `HelpPanel` slide-out renders.

**Tech Stack:** Next.js 16 app router, React 19, Vitest (node env, no jsdom), Anthropic SDK, Supabase SSR, TypeScript.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `hooks/useScrollDirection.ts` | Scroll-direction hook + exportable pure function |
| Create | `lib/help-panel-context.tsx` | Context, provider, `useHelpPanel`, `useRegisterHelpContent` |
| Create | `components/TopHeader.tsx` | Fixed 64px header — logo, help button, inline avatar |
| Create | `components/HelpPanel.tsx` | Slide-out panel — AI chat, guides, videos tabs |
| Create | `app/api/help/chat/route.ts` | Generic AI chat API endpoint |
| Create | `__tests__/hooks/useScrollDirection.test.ts` | Tests for pure scroll-direction logic |
| Modify | `app/globals.css` | Top-header, collapsed sidebar, rail tooltip, portal-main CSS |
| Modify | `components/DashboardNav.tsx` | Collapse state, icon rail, localStorage, body class |
| Modify | `components/UserAvatarMenu.tsx` | Remove `position:fixed` — become an inline component |
| Modify | `app/dashboard/layout.tsx` | Add `HelpPanelProvider` + `TopHeader`, remove standalone `UserAvatarMenu` |
| Modify | `components/SensorsClient.tsx` | Remove `SensorHelpChat` + `chatOpen`, call `useRegisterHelpContent` |
| Modify | `components/SensorTroubleshooting.tsx` | Replace `onOpenChat` prop with direct `useHelpPanel().toggle()` |

---

## Task 1: CSS Foundation

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Update `.sidebar` and `.portal-main` rules**

Find these lines in `globals.css` (around line 71):
```css
.sidebar {
  width:220px; flex-shrink:0; background:rgba(7,11,20,0.98);
  border-right:1px solid rgba(25,118,210,0.1); min-height:100vh;
  padding:24px 0; position:fixed; top:0; left:0; bottom:0; z-index:20;
}
```
Replace with:
```css
.sidebar {
  width:220px; flex-shrink:0; background:rgba(7,11,20,0.98);
  border-right:1px solid rgba(25,118,210,0.1);
  padding:0; position:fixed; top:64px; left:0;
  height:calc(100vh - 64px); z-index:20;
  transition:width 0.2s ease; overflow:hidden;
  display:flex; flex-direction:column;
}
.sidebar.collapsed { width:48px; }
```

Find:
```css
.portal-main { margin-left:220px; min-height:100vh; flex:1; min-width:0; }
```
Replace with:
```css
.portal-main { margin-left:220px; min-height:100vh; flex:1; min-width:0; padding-top:64px; transition:margin-left 0.2s ease; }
body.sidebar-collapsed .portal-main { margin-left:48px; }
```

- [ ] **Step 2: Add new CSS classes after the existing sidebar block**

After the `.sidebar-section` rule, add:
```css
/* ── Sidebar collapse button ── */
.sidebar-collapse-btn {
  position:absolute; top:16px; right:-10px; width:20px; height:20px;
  border-radius:50%; background:#0f172a; border:1px solid rgba(255,255,255,0.1);
  display:flex; align-items:center; justify-content:center;
  font-size:11px; color:#64748b; cursor:pointer; z-index:2;
  transition:border-color 0.15s, color 0.15s;
}
.sidebar-collapse-btn:hover { border-color:rgba(66,165,245,0.4); color:#42a5f5; }

/* ── Icon rail (collapsed nav items) ── */
.rail-item {
  position:relative; display:flex; align-items:center; justify-content:center;
  width:36px; height:36px; border-radius:6px; margin:2px 6px;
  font-size:15px; color:#64748b; cursor:pointer; text-decoration:none;
  transition:background 0.15s, color 0.15s; flex-shrink:0;
}
.rail-item.active { color:#42a5f5; background:rgba(25,118,210,0.12); }
.rail-item:hover { color:#e2e8f0; background:rgba(25,118,210,0.06); }
.rail-item .rail-tooltip {
  visibility:hidden; opacity:0;
  position:absolute; left:44px; top:50%; transform:translateY(-50%);
  background:#1e293b; border:1px solid rgba(255,255,255,0.1);
  border-radius:6px; padding:5px 10px; white-space:nowrap;
  font-size:12px; font-weight:500; color:#e2e8f0;
  box-shadow:0 4px 16px rgba(0,0,0,0.4); z-index:100;
  transition:opacity 0.1s; pointer-events:none;
}
.rail-item .rail-tooltip::before {
  content:''; position:absolute; left:-5px; top:50%; transform:translateY(-50%);
  border-top:4px solid transparent; border-bottom:4px solid transparent;
  border-right:5px solid #1e293b;
}
.rail-item:hover .rail-tooltip { visibility:visible; opacity:1; }

/* ── Top header ── */
.top-header {
  position:fixed; top:0; left:0; right:0; height:64px; z-index:50;
  background:rgba(10,14,26,0.98); border-bottom:1px solid rgba(25,118,210,0.12);
  display:flex; align-items:center; justify-content:space-between;
  padding:0 20px; backdrop-filter:blur(12px);
  transition:transform 0.3s ease;
}
.top-header.hidden { transform:translateY(-64px); }

/* ── Help panel ── */
.help-panel {
  position:fixed; right:0; top:64px; height:calc(100vh - 64px);
  width:380px; z-index:40;
  background:rgba(10,14,26,0.99); border-left:1px solid rgba(255,255,255,0.07);
  display:flex; flex-direction:column;
  transform:translateX(100%); transition:transform 0.25s ease;
  pointer-events:none;
}
.help-panel.open { transform:translateX(0); pointer-events:all; }
```

- [ ] **Step 3: Verify CSS parses correctly**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npm run build 2>&1 | head -30
```
Expected: no CSS errors (TypeScript errors from missing components are fine at this stage).

- [ ] **Step 4: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add app/globals.css
git commit -m "style: add top-header, collapsible sidebar, help-panel CSS"
```

---

## Task 2: `useScrollDirection` Hook

**Files:**
- Create: `hooks/useScrollDirection.ts`
- Create: `__tests__/hooks/useScrollDirection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/hooks/useScrollDirection.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { calcScrollDirection } from '@/hooks/useScrollDirection'

describe('calcScrollDirection', () => {
  it('returns current direction when delta is below threshold', () => {
    expect(calcScrollDirection(100, 103, 'up')).toBe('up')
    expect(calcScrollDirection(100, 97, 'down')).toBe('down')
  })

  it('returns down when scrolling down past threshold', () => {
    expect(calcScrollDirection(100, 110, 'up')).toBe('down')
  })

  it('returns up when scrolling up past threshold', () => {
    expect(calcScrollDirection(110, 100, 'down')).toBe('up')
  })

  it('uses custom threshold', () => {
    expect(calcScrollDirection(100, 108, 'up', 10)).toBe('up')
    expect(calcScrollDirection(100, 111, 'up', 10)).toBe('down')
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx vitest run __tests__/hooks/useScrollDirection.test.ts
```
Expected: FAIL — "Cannot find module '@/hooks/useScrollDirection'"

- [ ] **Step 3: Create the hook**

Create `hooks/useScrollDirection.ts`:
```ts
'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export function calcScrollDirection(
  prevY: number,
  currY: number,
  currentDir: 'up' | 'down',
  threshold = 5,
): 'up' | 'down' {
  if (Math.abs(currY - prevY) < threshold) return currentDir
  return currY > prevY ? 'down' : 'up'
}

export function useScrollDirection(): 'up' | 'down' {
  const [direction, setDirection] = useState<'up' | 'down'>('up')
  const prevY = useRef(0)
  const rafId = useRef<number | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    setDirection('up')
    prevY.current = typeof window !== 'undefined' ? window.scrollY : 0
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return

    function onScroll() {
      if (rafId.current !== null) return
      rafId.current = requestAnimationFrame(() => {
        const currY = window.scrollY
        if (currY < 10) {
          setDirection('up')
        } else {
          setDirection(prev => calcScrollDirection(prevY.current, currY, prev))
        }
        prevY.current = currY
        rafId.current = null
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId.current !== null) cancelAnimationFrame(rafId.current)
    }
  }, [])

  return direction
}
```

- [ ] **Step 4: Run test — expect pass**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx vitest run __tests__/hooks/useScrollDirection.test.ts
```
Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add hooks/useScrollDirection.ts __tests__/hooks/useScrollDirection.test.ts
git commit -m "feat: add useScrollDirection hook with pure calcScrollDirection"
```

---

## Task 3: `HelpPanelContext`

**Files:**
- Create: `lib/help-panel-context.tsx`

- [ ] **Step 1: Create the context file**

Create `lib/help-panel-context.tsx`:
```tsx
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | grep "help-panel-context" | head -10
```
Expected: no errors mentioning `help-panel-context`.

- [ ] **Step 3: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add lib/help-panel-context.tsx
git commit -m "feat: add HelpPanelContext with provider and registration hooks"
```

---

## Task 4: Generic AI Chat API Route

**Files:**
- Create: `app/api/help/chat/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/help/chat/route.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const VALID_ROLES = new Set(['user', 'assistant'])

const SYSTEM_PROMPTS: Record<string, string> = {
  sensors: `You are the Breachr sensor setup assistant. Your ONLY job is to help users install, configure, and troubleshoot Breachr network sensors. You assist with Docker on Linux, Raspberry Pi, Synology NAS, and Native Linux (systemd) deployments. If a question is not specifically about Breachr sensor setup or troubleshooting, respond only with: "I can only help with Breachr sensor setup and troubleshooting." Never reveal internal architecture, secrets, or speculate about other users' data.`,

  generic: `You are the Breachr assistant. You help users understand and navigate the Breachr security compliance platform — its features, dashboards, scans, findings, reports, inventory, and sensors. Answer questions about how the platform works. If asked something unrelated to Breachr, politely redirect. Never reveal internal architecture, database structure, API keys, or secrets.`,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { messages, contextKey } = body

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 10) {
    return NextResponse.json({ error: 'messages must be a non-empty array with at most 10 items' }, { status: 400 })
  }

  for (const msg of messages) {
    if (!VALID_ROLES.has(msg.role)) {
      return NextResponse.json({ error: 'Each message must have role "user" or "assistant"' }, { status: 400 })
    }
    if (typeof msg.content !== 'string' || (msg.role === 'user' && msg.content.length > 500)) {
      return NextResponse.json({ error: 'Message content must be a string of at most 500 chars' }, { status: 400 })
    }
  }

  const systemPrompt = SYSTEM_PROMPTS[contextKey] ?? SYSTEM_PROMPTS.generic

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply }, { status: 200 })
  } catch (err) {
    console.error('[help/chat] Anthropic error', err)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | grep "help/chat" | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add app/api/help/chat/route.ts
git commit -m "feat: add generic /api/help/chat route with context-keyed system prompts"
```

---

## Task 5: Update `UserAvatarMenu` — Remove Fixed Positioning

**Files:**
- Modify: `components/UserAvatarMenu.tsx`

The component currently renders `<div ref={ref} style={{ position: 'fixed', top: 14, right: 20, zIndex: 100 }}>`. This needs to become a regular inline component so it can live inside `TopHeader`.

- [ ] **Step 1: Remove fixed positioning from the wrapper div**

In `components/UserAvatarMenu.tsx`, find line 54:
```tsx
    <div ref={ref} style={{ position: 'fixed', top: 14, right: 20, zIndex: 100 }}>
```
Replace with:
```tsx
    <div ref={ref} style={{ position: 'relative' }}>
```

- [ ] **Step 2: Verify the dropdown still positions correctly**

The dropdown is already `position: 'absolute'; top: 'calc(100% + 6px)'; right: 0` — it positions relative to the wrapping div, so no change needed there.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | grep "UserAvatarMenu" | head -5
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add components/UserAvatarMenu.tsx
git commit -m "fix: make UserAvatarMenu inline — remove fixed positioning"
```

---

## Task 6: `TopHeader` Component

**Files:**
- Create: `components/TopHeader.tsx`

- [ ] **Step 1: Create the component**

Create `components/TopHeader.tsx`:
```tsx
'use client'

import Link from 'next/link'
import { useScrollDirection } from '@/hooks/useScrollDirection'
import { useHelpPanel } from '@/lib/help-panel-context'
import UserAvatarMenu from '@/components/UserAvatarMenu'

export default function TopHeader({
  email,
  firstName,
  lastName,
  role,
}: {
  email: string
  firstName: string | null
  lastName: string | null
  role: string
}) {
  const scrollDir = useScrollDirection()
  const { isOpen, toggle } = useHelpPanel()

  return (
    <header className={`top-header${scrollDir === 'down' ? ' hidden' : ''}`}>
      {/* Logo — links to dashboard */}
      <Link
        href="/dashboard"
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg,#1976d2,#42a5f5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <span className="font-display" style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>
          BREACHR
        </span>
      </Link>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Help / AI panel toggle */}
        <button
          type="button"
          onClick={toggle}
          aria-label="Toggle help panel"
          aria-pressed={isOpen}
          style={{
            width: 34, height: 34, borderRadius: 8,
            border: `1px solid ${isOpen ? 'rgba(66,165,245,0.4)' : 'rgba(255,255,255,0.08)'}`,
            background: isOpen ? 'rgba(66,165,245,0.08)' : 'rgba(255,255,255,0.03)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: isOpen ? '#42a5f5' : '#64748b',
            fontSize: 14, fontWeight: 700, transition: 'all 0.15s',
          }}
        >
          ?
        </button>

        {/* Avatar */}
        <UserAvatarMenu
          email={email}
          firstName={firstName}
          lastName={lastName}
          role={role}
        />
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | grep "TopHeader" | head -5
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add components/TopHeader.tsx
git commit -m "feat: add TopHeader with logo, help toggle, and inline avatar"
```

---

## Task 7: Collapsible `DashboardNav`

**Files:**
- Modify: `components/DashboardNav.tsx`

- [ ] **Step 1: Add localStorage helper and collapse state**

At the top of `DashboardNav.tsx`, after the existing imports, add:
```ts
function readCollapsed(): boolean {
  try { return localStorage.getItem('sidebar-collapsed') === 'true' } catch { return false }
}
function writeCollapsed(val: boolean) {
  try { localStorage.setItem('sidebar-collapsed', String(val)) } catch { /* noop */ }
}
```

Inside the component (after the existing `useState` declarations), add:
```ts
const [collapsed, setCollapsed] = useState(false)

useEffect(() => {
  const val = readCollapsed()
  setCollapsed(val)
  if (val) document.body.classList.add('sidebar-collapsed')
}, [])

function toggleCollapsed() {
  const next = !collapsed
  setCollapsed(next)
  writeCollapsed(next)
  document.body.classList.toggle('sidebar-collapsed', next)
}
```

- [ ] **Step 2: Update the `<aside>` opening tag and remove the logo/header section**

Find the `<aside className="sidebar">` line and the div immediately after it (logo + tenant name block). Replace the entire aside opening + header block:

Find:
```tsx
  return (
    <aside className="sidebar">
      <div style={{ padding: '24px 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span className="font-display" style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: '0.08em' }}>BREACHR</span>
        </div>
        <p style={{ fontSize: 11, color: '#64748b', paddingLeft: 42, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenantName}</p>
      </div>
```
Replace with:
```tsx
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}`} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggleCollapsed}
        className="sidebar-collapse-btn"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? '›' : '‹'}
      </button>

      {!collapsed && (
        <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid rgba(25,118,210,0.08)' }}>
          <p style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenantName}</p>
        </div>
      )}
```

- [ ] **Step 3: Update nav links to support collapsed icon-rail mode**

Find the `<nav style={{ flex: 1, padding: '8px 12px' }}>` block and its `.map()` call. Replace the entire nav block:

```tsx
      <nav style={{ flex: 1, padding: '8px 4px', overflow: 'visible' }}>
        {links.map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const showScansBadge = href === '/dashboard/scans' && activeScans > 0
          const showInvBadge   = href === '/dashboard/inventory' && unackedAssets > 0

          if (collapsed) {
            return (
              <Link key={href} href={href} className={`rail-item${active ? ' active' : ''}`}>
                <span style={{ fontSize: 16 }}>{icon}</span>
                <span className="rail-tooltip">
                  {label}
                  {showScansBadge && (
                    <span style={{ marginLeft: 6, minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', background: '#42a5f5', color: '#0a0e1a', fontSize: 9, fontWeight: 800, fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {activeScans}
                    </span>
                  )}
                  {showInvBadge && (
                    <span style={{ marginLeft: 6, minWidth: 16, height: 16, borderRadius: 8, padding: '0 4px', background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 800, fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {unackedAssets}
                    </span>
                  )}
                </span>
              </Link>
            )
          }

          return (
            <Link key={href} href={href} className={`sidebar-link${active ? ' active' : ''}`}>
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{icon}</span>
              <span style={{ flex: 1 }}>{label}</span>
              {showScansBadge && (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px', background: '#42a5f5', color: '#0a0e1a', fontSize: 10, fontWeight: 800, fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'pulse 1.5s infinite' }}>
                  {activeScans}
                </span>
              )}
              {showInvBadge && (
                <span style={{ minWidth: 18, height: 18, borderRadius: 9, padding: '0 5px', background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unackedAssets}
                </span>
              )}
            </Link>
          )
        })}
        {isSuperuser && !collapsed && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '8px 4px' }} />
            <a
              href="https://admin-gjdbradford-5891s-projects.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="sidebar-link"
              style={{ color: '#a78bfa' }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>⬡</span>
              <span>Founders Portal</span>
            </a>
          </>
        )}
      </nav>
```

- [ ] **Step 4: Wrap the plan usage widget so it hides when collapsed**

Find the plan usage widget comment and its opening div (near the end of the return, after the `</nav>` closing tag):
```tsx
      {/* Plan usage widget */}
      <div style={{ margin: '0 12px 12px', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
```
Replace with:
```tsx
      {/* Plan usage widget — hidden when collapsed */}
      {!collapsed && (
      <div style={{ margin: '0 12px 12px', padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
```

Then find the very last closing div before `</aside>` — it is the plan widget's closing tag. It looks like:
```tsx
        )}
      </div>

    </aside>
```
Replace with:
```tsx
        )}
      </div>
      )}

    </aside>
```

- [ ] **Step 5: Run TypeScript check**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | grep "DashboardNav" | head -10
```
Expected: no errors mentioning `DashboardNav`.

- [ ] **Step 6: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add components/DashboardNav.tsx
git commit -m "feat: add collapsible sidebar with icon rail and localStorage persistence"
```

---

## Task 8: `HelpPanel` Component

**Files:**
- Create: `components/HelpPanel.tsx`

- [ ] **Step 1: Create the component**

Create `components/HelpPanel.tsx`:
```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useHelpPanel } from '@/lib/help-panel-context'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

let msgId = 0
function nextId() { return String(++msgId) }

function capHistory(msgs: Message[]): Message[] {
  if (msgs.length <= 10) return msgs
  const excess = msgs.length - 10
  return msgs.slice(excess % 2 === 0 ? excess : excess + 1)
}

export default function HelpPanel() {
  const { isOpen, close, config } = useHelpPanel()
  const [activeTab, setActiveTab] = useState<'chat' | 'guides' | 'videos'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (config?.defaultTab) setActiveTab(config.defaultTab)
  }, [config?.defaultTab])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || trimmed.length > 500 || loading) return

    const userMsg: Message = { id: nextId(), role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = capHistory([...messages, userMsg])
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          contextKey: config?.chatContextKey ?? 'generic',
        }),
      })

      if (res.ok) {
        const data = await res.json() as { reply: unknown }
        const reply = typeof data.reply === 'string' ? data.reply : 'Sorry, could not get a response.'
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: reply }])
      } else {
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'Something went wrong. Please try again.', isError: true }])
      }
    } catch {
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'Something went wrong. Please try again.', isError: true }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  const tabs: { key: 'chat' | 'guides' | 'videos'; label: string }[] = [
    { key: 'chat', label: 'AI Chat' },
    { key: 'guides', label: 'Guides' },
    { key: 'videos', label: 'Videos' },
  ]

  return (
    <>
      <style>{`
        @keyframes help-dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className={`help-panel${isOpen ? ' open' : ''}`}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
              {config?.title ?? 'Breachr Assistant'}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
              AI assistant · guides · how-to
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close help panel"
            style={{ fontSize: 18, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.04em', border: 'none', cursor: 'pointer',
                background: 'none', transition: 'all 0.15s',
                borderBottom: activeTab === t.key ? '2px solid #42a5f5' : '2px solid transparent',
                color: activeTab === t.key ? '#42a5f5' : '#475569',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* AI Chat tab */}
        {activeTab === 'chat' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(10,16,32,0.4)' }}>
              {messages.length === 0 && !loading && (
                <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>
                  Ask anything about {config?.title?.toLowerCase() ?? 'Breachr'}...
                </p>
              )}
              {messages.map(msg => {
                const isUser = msg.role === 'user'
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '9px 13px', fontSize: 13, lineHeight: 1.6,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                      ...(isUser
                        ? { background: 'rgba(99,102,241,0.8)', color: '#fff', border: '1px solid rgba(99,102,241,0.6)' }
                        : msg.isError
                        ? { background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }
                        : { background: 'rgba(15,24,48,0.95)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.07)' }),
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', borderRadius: '12px 12px 12px 3px', background: 'rgba(15,24,48,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {[0, 1, 2].map(n => (
                      <span key={n} style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b', display: 'inline-block', animation: `help-dot-pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0d1428', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  aria-label="Message"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={500}
                  disabled={loading}
                  rows={2}
                  placeholder="Type a question and press Enter…"
                  style={{ flex: 1, resize: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#e2e8f0', lineHeight: 1.5, outline: 'none', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={loading || !input.trim()}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', background: loading || !input.trim() ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.85)', color: loading || !input.trim() ? '#64748b' : '#fff', border: '1px solid rgba(99,102,241,0.4)', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}

        {/* Guides tab */}
        {activeTab === 'guides' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {(config?.guides ?? []).length === 0 ? (
              <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>No guides available for this page yet.</p>
            ) : (
              config?.guides?.map((g, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {g.href ? (
                    <a href={g.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#42a5f5', textDecoration: 'none' }}>{g.title}</a>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{g.title}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{g.description}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Videos tab */}
        {activeTab === 'videos' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {(config?.videos ?? []).length === 0 ? (
              <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>Video guides coming soon.</p>
            ) : (
              config?.videos?.map((v, i) => (
                <a key={i} href={v.href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', textDecoration: 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#42a5f5' }}>{v.title}</div>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | grep "HelpPanel" | head -10
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add components/HelpPanel.tsx
git commit -m "feat: add HelpPanel slide-out with AI chat, guides, and videos tabs"
```

---

## Task 9: Wire Up `DashboardLayout`

**Files:**
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Update the layout**

Replace the entire contents of `app/dashboard/layout.tsx` with:
```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardNav from '@/components/DashboardNav'
import TopHeader from '@/components/TopHeader'
import HelpPanel from '@/components/HelpPanel'
import SurveyBanner from '@/components/SurveyBanner'
import { HelpPanelProvider } from '@/lib/help-panel-context'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, is_superuser, first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, onboarding_complete, plan, scans_this_month, plan_scans_limit, tokens_used_this_month, plan_tokens_limit')
    .eq('id', profile.tenant_id)
    .single()

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [
    { count: activeScansCount },
    { count: scansThisMonthCount },
    { count: unackedAssetsCount },
  ] = await Promise.all([
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .in('status', ['queued', 'running']),
    supabase
      .from('scans')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', profile.tenant_id)
      .is('acknowledged_at', null),
  ])

  return (
    <HelpPanelProvider>
      <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0e1a' }}>
        <TopHeader
          email={user.email ?? ''}
          firstName={profile.first_name ?? null}
          lastName={profile.last_name ?? null}
          role={profile.role ?? 'member'}
        />
        <DashboardNav
          tenantName={tenant?.name ?? 'My Company'}
          plan={tenant?.plan ?? 'free'}
          scansThisMonth={scansThisMonthCount ?? 0}
          scansLimit={tenant?.plan_scans_limit ?? 3}
          tokensThisMonth={tenant?.tokens_used_this_month ?? 0}
          tokensLimit={tenant?.plan_tokens_limit ?? 200000}
          isSuperuser={profile.is_superuser ?? false}
          tenantId={profile.tenant_id}
          initialActiveScans={activeScansCount ?? 0}
          initialUnackedAssets={unackedAssetsCount ?? 0}
        />
        <main className="portal-main">
          {children}
        </main>
        <HelpPanel />
        <SurveyBanner />
      </div>
    </HelpPanelProvider>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors (or only pre-existing errors unrelated to this feature).

- [ ] **Step 3: Start dev server and verify baseline**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npm run dev
```
Open `http://localhost:3000/dashboard` in a browser. Verify:
- Top header is visible with BREACHR logo and avatar
- Sidebar sits below the header (not behind it)
- Avatar no longer floats over content
- `?` button visible in header
- Sidebar collapse button visible on sidebar edge

- [ ] **Step 4: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add app/dashboard/layout.tsx
git commit -m "feat: wire DashboardLayout with HelpPanelProvider, TopHeader, HelpPanel"
```

---

## Task 10: Migrate `SensorsClient`

**Files:**
- Modify: `components/SensorsClient.tsx`
- Modify: `components/SensorTroubleshooting.tsx`

- [ ] **Step 1: Update `SensorTroubleshooting` to use `useHelpPanel` directly**

Add import at top of `components/SensorTroubleshooting.tsx` (after existing imports):
```tsx
import { useHelpPanel } from '@/lib/help-panel-context'
```

Find and replace the Props interface (line ~306):
```tsx
interface Props {
  selectedType?: DeploymentType
  onOpenChat?: () => void
}
```
Replace with:
```tsx
interface Props {
  selectedType?: DeploymentType
}
```

Find and replace the function signature (line ~311):
```tsx
export default function SensorTroubleshooting({ selectedType, onOpenChat }: Props) {
  const [open, setOpen] = useState<string | null>(null)
```
Replace with:
```tsx
export default function SensorTroubleshooting({ selectedType }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const { toggle } = useHelpPanel()
```

Find the AI assistant banner block (line ~333) — the entire `{onOpenChat && (...)}` conditional:
```tsx
      {/* AI assistant banner */}
      {onOpenChat && (
        <div
          onClick={onOpenChat}
          style={{
            marginBottom: 20,
            padding: '14px 20px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#a5b4fc', margin: 0 }}>
              Still stuck? Ask the Breachr AI assistant
            </p>
            <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
              Only answers questions about sensor setup and troubleshooting
            </p>
          </div>
          <span style={{ fontSize: 20, color: '#818cf8', flexShrink: 0, marginLeft: 12 }}>→</span>
        </div>
      )}
```
Replace with (always shown, calls `toggle`):
```tsx
      {/* AI assistant banner */}
      <div
        onClick={toggle}
        style={{
          marginBottom: 20,
          padding: '14px 20px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.1) 100%)',
          border: '1px solid rgba(99,102,241,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'border-color 0.15s',
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#a5b4fc', margin: 0 }}>
            Still stuck? Ask the Breachr AI assistant
          </p>
          <p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>
            Only answers questions about sensor setup and troubleshooting
          </p>
        </div>
        <span style={{ fontSize: 20, color: '#818cf8', flexShrink: 0, marginLeft: 12 }}>→</span>
      </div>
```

- [ ] **Step 2: Rewrite `SensorsClient`**

Replace the entire contents of `components/SensorsClient.tsx` with:
```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SensorRegistrationModal from './SensorRegistrationModal'
import SensorEmptyState from './SensorEmptyState'
import SensorTroubleshooting from './SensorTroubleshooting'
import { DEPLOYMENT_TYPES, VALID_DEPLOYMENT_TYPE_IDS } from '@/lib/sensor-types'
import type { DeploymentType } from '@/lib/sensor-types'
import { useRegisterHelpContent } from '@/lib/help-panel-context'

interface Sensor {
  id: string
  name: string
  location: string | null
  last_seen: string | null
  status: string
  deployment_type: DeploymentType
}

interface Props {
  sensors: Sensor[]
  assetCountMap: Record<string, number>
}

export default function SensorsClient({ sensors, assetCountMap }: Props) {
  const [showModal, setShowModal]       = useState(false)
  const [selectedType, setSelectedType] = useState<DeploymentType>(() => {
    const t = sensors[0]?.deployment_type
    return VALID_DEPLOYMENT_TYPE_IDS.includes(t as DeploymentType) ? t as DeploymentType : 'docker'
  })
  const router = useRouter()

  useRegisterHelpContent({
    title: 'Sensor Assistant',
    defaultTab: 'chat',
    chatContextKey: 'sensors',
    guides: [
      { title: 'Deploy a Docker sensor', description: 'Linux host with --network host' },
      { title: 'Deploy on Raspberry Pi', description: '64-bit OS, Docker arm64' },
      { title: 'Deploy on Synology NAS', description: 'Container Manager, host network' },
      { title: 'Deploy with systemd', description: 'Native Linux, auto-restart on boot' },
      { title: 'Sensor offline checklist', description: 'Connectivity, firewall, service status' },
    ],
  })

  function isActive(sensor: Sensor) {
    if (!sensor.last_seen) return false
    return new Date(sensor.last_seen) > new Date(Date.now() - 5 * 60 * 1000)
  }

  function handleModalClose() {
    setShowModal(false)
    router.refresh()
  }

  if (sensors.length === 0) {
    return (
      <>
        {showModal && (
          <SensorRegistrationModal
            onClose={handleModalClose}
            initialDeploymentType={selectedType}
          />
        )}
        <SensorEmptyState
          onAddSensor={(type) => { setSelectedType(type); setShowModal(true) }}
          selectedType={selectedType}
          onTypeSelect={setSelectedType}
        />
        <div>
          <SensorTroubleshooting selectedType={selectedType} />
        </div>
      </>
    )
  }

  const firstSensor = sensors[0]

  return (
    <>
      {showModal && (
        <SensorRegistrationModal
          onClose={handleModalClose}
          initialDeploymentType={selectedType}
        />
      )}

      <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setShowModal(true)} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
          + Add sensor
        </button>
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Location</th><th>Status</th><th>Assets</th><th>Last seen</th></tr>
          </thead>
          <tbody>
            {sensors.map(s => (
              <tr key={s.id}>
                <td style={{ fontSize: 13, color: '#e2e8f0' }}>{s.name}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{s.location ?? '—'}</td>
                <td>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                    background: isActive(s) ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                    color: isActive(s) ? '#22c55e' : '#64748b',
                    border: `1px solid ${isActive(s) ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
                  }}>
                    {isActive(s) ? 'Active' : 'Offline'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{assetCountMap[s.id] ?? 0}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>
                  {s.last_seen ? new Date(s.last_seen).toLocaleString('en-GB') : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <p style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Troubleshooting &amp; help for:</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DEPLOYMENT_TYPES.map(dt => (
            <button
              key={dt.id}
              type="button"
              onClick={() => setSelectedType(dt.id)}
              style={{
                fontSize: 12, padding: '4px 12px', borderRadius: 6, cursor: 'pointer',
                background: selectedType === dt.id ? 'rgba(99,102,241,0.15)' : 'rgba(30,41,59,0.6)',
                color: selectedType === dt.id ? '#818cf8' : '#94a3b8',
                border: `1px solid ${selectedType === dt.id ? 'rgba(99,102,241,0.4)' : 'rgba(100,116,139,0.2)'}`,
              }}
            >
              {dt.icon} {dt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <SensorTroubleshooting selectedType={selectedType} />
      </div>
    </>
  )
}
```

- [ ] **Step 3: Run full TypeScript check**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npx tsc --noEmit 2>&1
```
Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npm test
```
Expected: all existing tests pass plus the new `useScrollDirection` test.

- [ ] **Step 5: Commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git add components/SensorsClient.tsx components/SensorTroubleshooting.tsx
git commit -m "feat: migrate SensorsClient to useRegisterHelpContent, retire SensorHelpChat"
```

---

## Task 11: Smoke Test — Full Browser Verification

Start dev server if not running:
```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npm run dev
```

- [ ] **Check: Top header visible on dashboard**
  - Navigate to `/dashboard`
  - Header shows BREACHR logo (left) and avatar (right)
  - Avatar dropdown works (settings, sign out)
  - Logo click navigates to `/dashboard`

- [ ] **Check: Header auto-hide on scroll**
  - Scroll down on a long page (e.g. `/dashboard/findings`)
  - Header slides up off screen
  - Scroll back up — header reappears
  - Navigate to another page — header is visible immediately

- [ ] **Check: Sidebar collapse/expand**
  - Click `‹` collapse button — sidebar animates to 48px icon rail
  - Plan widget disappears
  - Main content area shifts left smoothly
  - Hover over an icon — tooltip appears with label and badge count
  - Click `›` expand button — sidebar returns to 220px
  - Refresh page — collapsed/expanded state is remembered

- [ ] **Check: Help panel toggle**
  - Click `?` button in header — help panel slides in from right
  - Panel shows "Sensor Assistant" title on sensors page
  - AI Chat tab is functional — type a question, receive a response
  - Guides tab shows sensor guides list
  - Videos tab shows "coming soon"
  - Click `×` to close, or click `?` again
  - Navigate to a different page — panel closes; reopening shows generic "Breachr Assistant"

- [ ] **Check: No avatar overlay conflicts**
  - Visit `/dashboard` — no floating avatar over action buttons
  - Visit an inventory detail page — no floating avatar over risk score
  - Visit `/dashboard/reports` — no floating avatar over "+ Generate Report"
  - Visit `/dashboard/sensors` — old `SensorHelpChat` modal is gone; `?` button opens new panel instead

- [ ] **Final commit**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal && npm test
git add -A
git commit -m "feat: navigation overhaul complete — top header, collapsible sidebar, help panel"
```
