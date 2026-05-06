import { useWorkspace } from '../tabs/store'
import { getFocusedTab } from '../tabs/types'

/**
 * Automation sidebar — phase-2 placeholder. Single "Overview" item that
 * opens the existing AutomationPage. Phase 3+ splits into heartbeats /
 * crons / webhooks / listeners lists, each opening per-rule detail tabs.
 */
export function AutomationSidebar() {
  const focusedKind = useWorkspace((state) => getFocusedTab(state)?.spec.kind ?? null)
  const openOrFocus = useWorkspace((state) => state.openOrFocus)

  const active = focusedKind === 'automation'
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => openOrFocus({ kind: 'automation', params: {} })}
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
