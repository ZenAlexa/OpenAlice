import { useWorkspace } from '../tabs/store'
import { getFocusedTab } from '../tabs/types'

/**
 * Portfolio sidebar — phase-2 placeholder. Single "Overview" item that
 * opens the existing PortfolioPage as a tab. Phase 3+ adds an account
 * list, equity-curve / P&L view selectors, and per-account tabs.
 */
export function PortfolioSidebar() {
  const focusedKind = useWorkspace((state) => getFocusedTab(state)?.spec.kind ?? null)
  const openOrFocus = useWorkspace((state) => state.openOrFocus)

  const active = focusedKind === 'portfolio'
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => openOrFocus({ kind: 'portfolio', params: {} })}
        className={`w-full text-left flex items-center gap-1 px-3 py-1 text-[13px] transition-colors ${
          active
            ? 'bg-bg-tertiary text-text'
            : 'text-text-muted hover:text-text hover:bg-bg-tertiary/50'
        }`}
      >
        Overview
      </button>
    </div>
  )
}
