# Navigation Overhaul — Design Spec
**Date:** 2026-05-08  
**Status:** Approved

---

## Problem

The current `UserAvatarMenu` is rendered as a sibling outside the layout structure at `position: fixed; top: 14; right: 20; z-index: 100`. This causes it to float over page content — overlapping action buttons (`+ Launch Scan`, `+ Generate Report`), risk score badges, and other top-right UI elements across multiple pages.

Additionally, there is no persistent top header, the left sidebar has no collapse mechanism, and the right-side AI assistant panel (`SensorHelpChat`) is only accessible from the Sensors page.

---

## Goals

1. Fix the avatar overlay conflict by embedding it in a proper top header
2. Add a fixed top header with auto-hide-on-scroll behaviour
3. Make the left sidebar collapsible (expanded ↔ icon rail), with state persisted in `localStorage`
4. Add a global context-aware help/AI panel accessible from every page via the top header

---

## Architecture

### New Components

#### `TopHeader` (`components/TopHeader.tsx`) — Client Component

Fixed 64px bar at the top of every dashboard page.

- `position: fixed; top: 0; left: 0; right: 0; z-index: 50`
- **Left:** BREACHR shield logo + wordmark — clicking navigates to `/dashboard`
- **Right:** `?` help button (opens/closes HelpPanel) + `UserAvatarMenu` (inline, not separate)
- **Auto-hide behaviour:** Uses a `useScrollDirection` hook — translates `-64px` on scroll down via CSS transition (`transform: translateY(-64px)`), slides back to `0` when scrolling up or when scroll position is at/near top (< 10px). Uses `requestAnimationFrame` throttling to keep it smooth.
- Receives `email`, `firstName`, `lastName`, `role` props (same as current `UserAvatarMenu`)

#### `useScrollDirection` (`hooks/useScrollDirection.ts`) — Hook

Tracks scroll direction and returns `'up' | 'down'`. Throttled with `requestAnimationFrame`. Only fires direction change after 5px threshold to avoid jitter on micro-scrolls. Resets to `'up'` (header visible) on Next.js route changes via `usePathname()` — prevents header getting stuck hidden after navigation.

#### `DashboardNav` — Modified (`components/DashboardNav.tsx`)

- Add `collapsed` state, initialised from `localStorage.getItem('sidebar-collapsed') === 'true'`
- Toggle button (chevron `‹` / `›`) on the right edge of the sidebar, vertically centred near the top
- **Expanded (220px):** current behaviour — full labels, badges, plan usage widget
- **Collapsed (48px):** icon rail only, plan usage widget hidden (`display: none`)
- **Hover on collapsed icon:** absolute-positioned tooltip floats to the right of the icon showing the nav label (and badge count if applicable). Pure CSS `:hover` + `position: absolute` — no JS needed. Tooltip has a small left-pointing caret.
- On toggle: update `localStorage`, animate width via CSS `transition: width 0.2s ease`
- Top starts at `64px` (`top: 64px; height: calc(100vh - 64px)`) to sit below `TopHeader`
- On collapse/expand, toggles a `sidebar-collapsed` class on `document.body`. CSS then applies `margin-left: 48px` vs `margin-left: 220px` on `.portal-main`, also animated with `transition: margin-left 0.2s ease`

#### `HelpPanel` (`components/HelpPanel.tsx`) — Client Component

Right slide-out panel, page-specific content via React context.

- `position: fixed; right: 0; top: 64px; height: calc(100vh - 64px); width: 380px; z-index: 40`
- Slides in/out with `transform: translateX(100%)` ↔ `translateX(0)`, `transition: transform 0.25s ease`
- **Header:** Panel title (page-provided), × close button
- **Tabs:** AI Chat | Guides | Videos (default tab is page-configured)
- **Body:** scrollable, content provided by the registered page
- When closed: `pointer-events: none`, hidden off-screen (no DOM removal — avoids chat state loss)

#### `HelpPanelContext` (`lib/help-panel-context.tsx`) — Context + Provider

Pages register their help content by calling `useRegisterHelpContent(config)` in a `useEffect`. Config shape:

```ts
type HelpPanelConfig = {
  title: string               // e.g. "Sensor Assistant"
  defaultTab: 'chat' | 'guides' | 'videos'
  chatContext?: string        // system prompt / context hint for AI
  guides?: { title: string; description: string; href?: string }[]
  videos?: { title: string; thumbnailUrl?: string; href: string }[]
}
```

`HelpPanelProvider` wraps the dashboard layout and exposes:
- `registerContent(config)` — called by pages on mount
- `isOpen` / `toggle()` — controls panel visibility, read by `TopHeader` (? button) and `HelpPanel`

The existing `SensorHelpChat` component becomes the `chatContext` + `guides` registration for the Sensors page. Its standalone chat UI is replaced by the `HelpPanel` AI Chat tab.

`SensorsClient.tsx` currently renders `<SensorHelpChat>` at two call sites (lines 62 and 138) and manages `chatOpen` state. This is replaced by a `useRegisterHelpContent()` call. The `SensorHelpChat` component is retired; its AI call logic is extracted into the `HelpPanel` AI Chat tab. The chat-open trigger buttons on the Sensors page are removed (the `?` button in `TopHeader` takes over).

### Modified: `DashboardLayout` (`app/dashboard/layout.tsx`)

- Remove standalone `<UserAvatarMenu />` from the layout render
- Add `<HelpPanelProvider>` wrapping the layout
- Add `<TopHeader email=... firstName=... lastName=... role=... />` 
- `<DashboardNav>` and `<main>` stay; `<SurveyBanner />` stays

### CSS Changes (`app/globals.css`)

```css
/* Header */
.top-header {
  position: fixed; top: 0; left: 0; right: 0; height: 64px; z-index: 50;
  background: rgba(10,14,26,0.98); border-bottom: 1px solid rgba(25,118,210,0.12);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 20px; backdrop-filter: blur(12px);
  transition: transform 0.3s ease;
}
.top-header.hidden { transform: translateY(-64px); }

/* Sidebar adjustments */
.sidebar { top: 64px; height: calc(100vh - 64px); /* was top:0, min-height:100vh */ }
.sidebar.collapsed { width: 48px; }
.sidebar-collapse-btn { /* toggle button styles */ }
.rail-tooltip { /* hover tooltip styles */ }

/* Main content */
.portal-main { padding-top: 64px; margin-left: 220px; transition: margin-left 0.2s ease; }
body.sidebar-collapsed .portal-main { margin-left: 48px; }
```

---

## Data Flow

```
DashboardLayout (server)
  └─ HelpPanelProvider (client, wraps everything)
       ├─ TopHeader (client) — reads isOpen/toggle from context, renders avatar inline
       ├─ DashboardNav (client) — collapse state in localStorage
       ├─ <main> → page content
       │    └─ page calls useRegisterHelpContent() on mount
       └─ HelpPanel (client) — reads registered config from context
```

---

## Error Handling

- `localStorage` access is wrapped in try/catch (SSR safety + private browsing)
- `useScrollDirection` checks `typeof window !== 'undefined'` before attaching listeners
- `HelpPanel` renders with `visibility: hidden` until `TopHeader` mounts, to avoid flash

---

## What Does NOT Change

- Page-level action buttons (`+ Launch Scan`, `+ Generate Report`) remain in page content area
- `SurveyBanner` remains in its current position
- The `portal-header` CSS class (used by page-level sticky sub-headers) is unchanged
- Admin portal is unaffected
- All existing `DashboardNav` props and realtime subscription logic are preserved

---

## Out of Scope

- Mobile / responsive breakpoints (the portal is desktop-only)
- Keyboard shortcuts for panel toggle
- Notifications / alerts in the top header (future work)
- Video content for help panel (structure is built, content is a future task)
