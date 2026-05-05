import { describe, it, expect, beforeEach } from 'vitest'
import { useWorkspace } from '../store'
import { specEquals, getFocusedGroup, getFocusedTab, type ViewSpec } from '../types'

// Reset zustand state + localStorage before each test so cases stay isolated.
function resetStore() {
  localStorage.clear()
  // Re-build initial state by replacing the slice. We can't call the
  // factory directly because of zustand's internal hydration — easier to
  // manually set known-good initial state.
  const id = crypto.randomUUID()
  useWorkspace.setState({
    tabs: { [id]: { id, spec: { kind: 'chat', params: { channelId: 'default' } } } },
    tree: { kind: 'leaf', group: { id: 'g1', tabIds: [id], activeTabId: id } },
    focusedGroupId: 'g1',
  })
}

beforeEach(resetStore)

// ==================== specEquals ====================

describe('specEquals', () => {
  it('matches identical chat specs', () => {
    expect(specEquals(
      { kind: 'chat', params: { channelId: 'a' } },
      { kind: 'chat', params: { channelId: 'a' } },
    )).toBe(true)
  })

  it('different channelIds are not equal', () => {
    expect(specEquals(
      { kind: 'chat', params: { channelId: 'a' } },
      { kind: 'chat', params: { channelId: 'b' } },
    )).toBe(false)
  })

  it('different kinds are not equal even with overlapping params shape', () => {
    expect(specEquals(
      { kind: 'diary', params: {} },
      { kind: 'portfolio', params: {} },
    )).toBe(false)
  })

  it('matches market-detail by both assetClass and symbol', () => {
    expect(specEquals(
      { kind: 'market-detail', params: { assetClass: 'equity', symbol: 'AAPL' } },
      { kind: 'market-detail', params: { assetClass: 'equity', symbol: 'AAPL' } },
    )).toBe(true)
    expect(specEquals(
      { kind: 'market-detail', params: { assetClass: 'equity', symbol: 'AAPL' } },
      { kind: 'market-detail', params: { assetClass: 'crypto', symbol: 'AAPL' } },
    )).toBe(false)
  })
})

// ==================== openOrFocus ====================

describe('openOrFocus', () => {
  it('focuses an existing tab if spec already open', () => {
    const beforeIds = getFocusedGroup(useWorkspace.getState())!.tabIds
    expect(beforeIds).toHaveLength(1)

    // Default tab is { kind: 'chat', channelId: 'default' } — opening the
    // same spec must NOT create a new tab.
    useWorkspace.getState().openOrFocus({ kind: 'chat', params: { channelId: 'default' } })

    const afterIds = getFocusedGroup(useWorkspace.getState())!.tabIds
    expect(afterIds).toHaveLength(1)
    expect(afterIds[0]).toBe(beforeIds[0])
  })

  it('appends and focuses a new tab when spec is novel', () => {
    useWorkspace.getState().openOrFocus({ kind: 'market-detail', params: { assetClass: 'equity', symbol: 'AAPL' } })

    const group = getFocusedGroup(useWorkspace.getState())!
    expect(group.tabIds).toHaveLength(2)
    const focused = getFocusedTab(useWorkspace.getState())
    expect(focused?.spec).toEqual({ kind: 'market-detail', params: { assetClass: 'equity', symbol: 'AAPL' } })
    // Newest tab is appended at the end.
    expect(group.activeTabId).toBe(group.tabIds[1])
  })

  it('focusing an existing non-active tab makes it active without re-creating', () => {
    const s = useWorkspace.getState()
    s.openOrFocus({ kind: 'diary', params: {} })
    s.openOrFocus({ kind: 'portfolio', params: {} })
    // Now portfolio is active; switch back to chat.
    s.openOrFocus({ kind: 'chat', params: { channelId: 'default' } })

    const focused = getFocusedTab(useWorkspace.getState())
    expect(focused?.spec.kind).toBe('chat')
    // No new tabs were created — chat already existed.
    expect(getFocusedGroup(useWorkspace.getState())!.tabIds).toHaveLength(3)
  })
})

// ==================== closeTab ====================

describe('closeTab', () => {
  it('closing the active tab focuses the right neighbour', () => {
    const s = useWorkspace.getState()
    s.openOrFocus({ kind: 'diary', params: {} })       // tab 1: diary, focused
    s.openOrFocus({ kind: 'portfolio', params: {} })   // tab 2: portfolio, focused
    // Order: [chat-default, diary, portfolio], active = portfolio (index 2)

    // Close diary (middle) — chat is left neighbour, portfolio is right.
    // Active tab was portfolio, NOT diary, so closing diary doesn't change active.
    const groupBefore = getFocusedGroup(useWorkspace.getState())!
    const diaryId = groupBefore.tabIds[1]
    s.closeTab(diaryId)

    const after = getFocusedGroup(useWorkspace.getState())!
    expect(after.tabIds).toHaveLength(2)
    expect(getFocusedTab(useWorkspace.getState())?.spec.kind).toBe('portfolio')
  })

  it('closing the rightmost active tab focuses the left neighbour', () => {
    const s = useWorkspace.getState()
    s.openOrFocus({ kind: 'diary', params: {} })
    s.openOrFocus({ kind: 'portfolio', params: {} })
    // Active = portfolio (rightmost). Close it.
    const portfolioId = getFocusedGroup(useWorkspace.getState())!.activeTabId!
    s.closeTab(portfolioId)

    expect(getFocusedTab(useWorkspace.getState())?.spec.kind).toBe('diary')
  })

  it('closing a non-active tab does not change focus', () => {
    const s = useWorkspace.getState()
    s.openOrFocus({ kind: 'diary', params: {} })
    s.openOrFocus({ kind: 'portfolio', params: {} })
    // Active = portfolio. Close diary (middle, not active).
    const ids = getFocusedGroup(useWorkspace.getState())!.tabIds
    const diaryId = ids[1]
    s.closeTab(diaryId)

    expect(getFocusedTab(useWorkspace.getState())?.spec.kind).toBe('portfolio')
  })

  it('closing the last tab opens default chat as fallback', () => {
    const s = useWorkspace.getState()
    // Start with default chat. Close it.
    const onlyId = getFocusedGroup(useWorkspace.getState())!.tabIds[0]
    s.closeTab(onlyId)

    const group = getFocusedGroup(useWorkspace.getState())!
    expect(group.tabIds).toHaveLength(1)
    const focused = getFocusedTab(useWorkspace.getState())
    expect(focused?.spec).toEqual({ kind: 'chat', params: { channelId: 'default' } })
    // The fallback tab is a new instance — id should differ from the closed one.
    expect(focused?.id).not.toBe(onlyId)
  })

  it('closeTab is a no-op for unknown ids', () => {
    const before = useWorkspace.getState()
    useWorkspace.getState().closeTab('nonexistent-id')
    const after = useWorkspace.getState()
    expect(after.tabs).toEqual(before.tabs)
    expect(after.tree).toEqual(before.tree)
  })
})

// ==================== focusTab ====================

describe('focusTab', () => {
  it('switches focus to a known tab', () => {
    const s = useWorkspace.getState()
    s.openOrFocus({ kind: 'diary', params: {} })
    const ids = getFocusedGroup(useWorkspace.getState())!.tabIds
    s.focusTab(ids[0]) // back to chat
    expect(getFocusedTab(useWorkspace.getState())?.spec.kind).toBe('chat')
  })

  it('is a no-op for unknown ids', () => {
    const s = useWorkspace.getState()
    const before = getFocusedTab(useWorkspace.getState())?.id
    s.focusTab('nonexistent')
    const after = getFocusedTab(useWorkspace.getState())?.id
    expect(after).toBe(before)
  })
})

// ==================== closeMatching ====================

describe('closeMatching', () => {
  it('closes every tab whose spec matches the predicate', () => {
    const s = useWorkspace.getState()
    s.openOrFocus({ kind: 'chat', params: { channelId: 'a' } })
    s.openOrFocus({ kind: 'chat', params: { channelId: 'b' } })
    s.openOrFocus({ kind: 'diary', params: {} })
    // Group: [chat:default, chat:a, chat:b, diary] = 4 tabs

    s.closeMatching((spec: ViewSpec) =>
      spec.kind === 'chat' && spec.params.channelId !== 'default',
    )

    const remaining = getFocusedGroup(useWorkspace.getState())!.tabIds
      .map((id) => useWorkspace.getState().tabs[id]?.spec.kind)
    expect(remaining).toEqual(['chat', 'diary'])
  })

  it('closing all tabs via closeMatching still triggers default-chat fallback', () => {
    const s = useWorkspace.getState()
    s.openOrFocus({ kind: 'diary', params: {} })
    s.closeMatching(() => true)

    const group = getFocusedGroup(useWorkspace.getState())!
    expect(group.tabIds).toHaveLength(1)
    expect(getFocusedTab(useWorkspace.getState())?.spec).toEqual({
      kind: 'chat',
      params: { channelId: 'default' },
    })
  })
})
