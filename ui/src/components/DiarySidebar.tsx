import { useWorkspace } from '../tabs/store'
import { getFocusedTab } from '../tabs/types'

/**
 * Diary sidebar — phase-2 placeholder. Single "All Entries" item that
 * opens the existing DiaryPage as a tab. Phase 3+ replaces this with a
 * date-organised navigator that opens per-day tabs.
 */
export function DiarySidebar() {
  const focusedKind = useWorkspace((state) => getFocusedTab(state)?.spec.kind ?? null)
  const openOrFocus = useWorkspace((state) => state.openOrFocus)

  const active = focusedKind === 'diary'
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => openOrFocus({ kind: 'diary', params: {} })}
        className={`w-full text-left flex items-center gap-1 px-3 py-1 text-[13px] transition-colors ${
          active
            ? 'bg-bg-tertiary text-text'
            : 'text-text-muted hover:text-text hover:bg-bg-tertiary/50'
        }`}
      >
        All Entries
      </button>
    </div>
  )
}
