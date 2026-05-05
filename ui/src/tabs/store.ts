import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type WorkspaceState,
  type Tab,
  type ViewSpec,
  type TabGroup,
  specEquals,
  getFocusedGroup,
} from './types'

/**
 * Zustand store backing the workspace. Phase 1 contract:
 *
 * - Single tab group (tree is always { kind: 'leaf', group }).
 * - openOrFocus(spec): if a tab with this spec exists in the focused group,
 *   focus it. Otherwise append a new tab and focus it.
 * - closeTab(id): drop the tab. If it was focused, focus the right neighbour
 *   (or left, if it was the rightmost). If the group becomes empty, open a
 *   default chat tab — there is no empty-state UI in phase 1.
 * - focusTab(id): just set the focused tab. No-op if id isn't in the group.
 *
 * Persistence uses zustand's `persist` middleware against localStorage with
 * key `openalice.workspace.v1`. On schema changes (phase 3+) bump the key
 * — there is no migrate function: version mismatch falls back to initial
 * state, which is the loud-fail behaviour we want over silent migration.
 */

interface WorkspaceActions {
  openOrFocus: (spec: ViewSpec) => void
  closeTab: (id: string) => void
  focusTab: (id: string) => void
  /**
   * Close every tab whose spec matches the predicate. Used e.g. when a
   * channel is deleted — we close any chat tab pointing at that channel.
   */
  closeMatching: (predicate: (spec: ViewSpec) => boolean) => void
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions

const DEFAULT_GROUP_ID = 'g1'

function newId(): string {
  // crypto.randomUUID is available in all browsers we target (and in jsdom 22+).
  return crypto.randomUUID()
}

function defaultChatSpec(): ViewSpec {
  return { kind: 'chat', params: { channelId: 'default' } }
}

function buildInitialState(): WorkspaceState {
  const tab: Tab = { id: newId(), spec: defaultChatSpec() }
  const group: TabGroup = {
    id: DEFAULT_GROUP_ID,
    tabIds: [tab.id],
    activeTabId: tab.id,
  }
  return {
    tabs: { [tab.id]: tab },
    tree: { kind: 'leaf', group },
    focusedGroupId: DEFAULT_GROUP_ID,
  }
}

/** Phase 1 only — assumes leaf tree. Returns a new state with the focused group replaced. */
function withFocusedGroup(
  state: WorkspaceState,
  fn: (group: TabGroup) => TabGroup,
): WorkspaceState {
  const group = getFocusedGroup(state)
  if (!group) return state
  const next = fn(group)
  if (next === group) return state
  return { ...state, tree: { kind: 'leaf', group: next } }
}

export const useWorkspace = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      ...buildInitialState(),

      openOrFocus(spec) {
        set((state) => {
          const group = getFocusedGroup(state)
          if (!group) return state

          // Match existing tab by spec equality
          const existingId = group.tabIds.find((id) => {
            const tab = state.tabs[id]
            return tab != null && specEquals(tab.spec, spec)
          })
          if (existingId) {
            if (group.activeTabId === existingId) return state
            return withFocusedGroup(state, (g) => ({ ...g, activeTabId: existingId }))
          }

          // Append new tab + focus
          const tab: Tab = { id: newId(), spec }
          return {
            ...state,
            tabs: { ...state.tabs, [tab.id]: tab },
            tree: {
              kind: 'leaf',
              group: { ...group, tabIds: [...group.tabIds, tab.id], activeTabId: tab.id },
            },
          }
        })
      },

      closeTab(id) {
        set((state) => {
          const group = getFocusedGroup(state)
          if (!group) return state
          const idx = group.tabIds.indexOf(id)
          if (idx < 0) return state

          const tabIds = group.tabIds.filter((x) => x !== id)
          const tabs = { ...state.tabs }
          delete tabs[id]

          // Focus a neighbour if the closed tab was active.
          let activeTabId = group.activeTabId
          if (activeTabId === id) {
            // Prefer right neighbour (same index, since we filtered out the closed one),
            // fall back to left.
            activeTabId = tabIds[idx] ?? tabIds[idx - 1] ?? null
          }

          // Empty group → open default chat. No empty-state UI in phase 1.
          if (tabIds.length === 0) {
            const fallback: Tab = { id: newId(), spec: defaultChatSpec() }
            tabs[fallback.id] = fallback
            tabIds.push(fallback.id)
            activeTabId = fallback.id
          }

          return {
            ...state,
            tabs,
            tree: { kind: 'leaf', group: { ...group, tabIds, activeTabId } },
          }
        })
      },

      focusTab(id) {
        set((state) => {
          const group = getFocusedGroup(state)
          if (!group) return state
          if (!group.tabIds.includes(id)) return state
          if (group.activeTabId === id) return state
          return withFocusedGroup(state, (g) => ({ ...g, activeTabId: id }))
        })
      },

      closeMatching(predicate) {
        // Use the existing closeTab so behaviour stays consistent (last-tab fallback,
        // neighbour focus). Snapshot ids first — closeTab mutates the array we'd be
        // iterating.
        const state = get()
        const group = getFocusedGroup(state)
        if (!group) return
        const toClose = group.tabIds
          .map((id) => state.tabs[id])
          .filter((t): t is Tab => t != null && predicate(t.spec))
          .map((t) => t.id)
        for (const id of toClose) {
          get().closeTab(id)
        }
      },
    }),
    {
      name: 'openalice.workspace.v1',
      version: 1,
      // Persist only the data shape — actions are recreated by the store factory.
      partialize: (state) => ({
        tabs: state.tabs,
        tree: state.tree,
        focusedGroupId: state.focusedGroupId,
      }),
    },
  ),
)
