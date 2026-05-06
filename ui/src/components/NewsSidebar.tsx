import { useWorkspace } from '../tabs/store'
import { getFocusedTab } from '../tabs/types'

/**
 * News sidebar — phase-2 placeholder. Single "All News" item that opens
 * the existing NewsPage. Phase 3+ adds source list, category filters,
 * and saved articles, each opening filtered news tabs.
 */
export function NewsSidebar() {
  const focusedKind = useWorkspace((state) => getFocusedTab(state)?.spec.kind ?? null)
  const openOrFocus = useWorkspace((state) => state.openOrFocus)

  const active = focusedKind === 'news'
  return (
    <div className="py-0.5">
      <button
        type="button"
        onClick={() => openOrFocus({ kind: 'news', params: {} })}
        className={`w-full text-left flex items-center gap-1 px-3 py-1 text-[13px] transition-colors ${
          active
            ? 'bg-bg-tertiary text-text'
            : 'text-text-muted hover:text-text hover:bg-bg-tertiary/50'
        }`}
      >
        All News
      </button>
    </div>
  )
}
