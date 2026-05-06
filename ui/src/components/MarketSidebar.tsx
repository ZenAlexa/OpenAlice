import { useEffect, useState } from 'react'
import { marketApi, type SearchResult, type AssetClass } from '../api/market'
import { useWorkspace } from '../tabs/store'
import { useWatchlist } from '../tabs/watchlist-store'
import { getFocusedTab, type ViewSpec } from '../tabs/types'

const ASSET_CLASS_COLORS: Record<AssetClass, string> = {
  equity: 'bg-accent/15 text-accent',
  crypto: 'bg-amber-500/15 text-amber-400',
  currency: 'bg-emerald-500/15 text-emerald-400',
  commodity: 'bg-purple-500/15 text-purple-400',
}

function resultSymbol(r: SearchResult): string {
  return r.symbol ?? r.id ?? ''
}

function resultKey(r: SearchResult): string {
  return `${r.assetClass}:${r.symbol ?? r.id ?? Math.random()}`
}

/**
 * Market sidebar — search + browse + watchlist. Modelled after VS Code's
 * Extension Marketplace: the sidebar IS the search panel, results land
 * inline, clicking opens a market-detail tab in the editor area. Pinning
 * an asset (via the ⭐ button on the detail page) adds it to the
 * watchlist below.
 *
 * Search results are debounced 300ms (mirrors SearchBox).
 */
export function MarketSidebar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  const watchlist = useWatchlist((s) => s.entries)
  const removeFromWatchlist = useWatchlist((s) => s.remove)
  const openOrFocus = useWorkspace((s) => s.openOrFocus)

  const focusedSpec = useWorkspace((state) => getFocusedTab(state)?.spec)
  const isFocused = (kind: ViewSpec['kind']) => focusedSpec?.kind === kind
  const isFocusedDetail = (assetClass: AssetClass, symbol: string) =>
    focusedSpec?.kind === 'market-detail' &&
    focusedSpec.params.assetClass === assetClass &&
    focusedSpec.params.symbol === symbol

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await marketApi.search(q, 20)
        setResults(res.results)
      } catch (err) {
        console.error('search failed', err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  const handleSelectResult = (r: SearchResult) => {
    const sym = resultSymbol(r)
    if (!sym) return
    openOrFocus({ kind: 'market-detail', params: { assetClass: r.assetClass, symbol: sym } })
  }

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      {/* Search box */}
      <div className="px-3 pt-2 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search assets…"
          className="w-full px-2.5 py-1.5 bg-bg text-text border border-border rounded-md text-[13px] outline-none focus:border-accent"
        />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Browse */}
        <SidebarSectionHeader>Browse</SidebarSectionHeader>
        <button
          type="button"
          onClick={() => openOrFocus({ kind: 'market-list', params: {} })}
          className={`w-full text-left flex items-center gap-1 px-3 py-1 text-[13px] transition-colors ${
            isFocused('market-list')
              ? 'bg-bg-tertiary text-text'
              : 'text-text-muted hover:text-text hover:bg-bg-tertiary/50'
          }`}
        >
          Browse Markets
        </button>

        {/* Search results — only when query is non-empty */}
        {query.trim() && (
          <>
            <SidebarSectionHeader>
              Search Results{loading ? ' (searching…)' : results.length ? ` (${results.length})` : ''}
            </SidebarSectionHeader>
            {!loading && results.length === 0 && (
              <p className="px-3 py-1 text-[12px] text-text-muted/60">No matches</p>
            )}
            {results.map((r) => {
              const sym = resultSymbol(r)
              return (
                <button
                  key={resultKey(r)}
                  type="button"
                  onClick={() => handleSelectResult(r)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-1 text-[13px] transition-colors ${
                    isFocusedDetail(r.assetClass, sym)
                      ? 'bg-bg-tertiary text-text'
                      : 'text-text-muted hover:text-text hover:bg-bg-tertiary/50'
                  }`}
                >
                  <span className="font-mono font-semibold text-text truncate">{sym}</span>
                  {r.name && <span className="text-text-muted truncate flex-1">{r.name}</span>}
                  <span className={`shrink-0 text-[9px] uppercase tracking-wide px-1 rounded ${ASSET_CLASS_COLORS[r.assetClass]}`}>
                    {r.assetClass}
                  </span>
                </button>
              )
            })}
          </>
        )}

        {/* Watchlist */}
        <SidebarSectionHeader>Watchlist{watchlist.length ? ` (${watchlist.length})` : ''}</SidebarSectionHeader>
        {watchlist.length === 0 ? (
          <p className="px-3 py-1 text-[12px] text-text-muted/60">
            Pin assets here from a detail page.
          </p>
        ) : (
          watchlist.map((entry) => {
            const active = isFocusedDetail(entry.assetClass, entry.symbol)
            return (
              <div
                key={`${entry.assetClass}:${entry.symbol}`}
                onClick={() =>
                  openOrFocus({
                    kind: 'market-detail',
                    params: { assetClass: entry.assetClass, symbol: entry.symbol },
                  })
                }
                className={`group flex items-center gap-2 px-3 py-1 text-[13px] cursor-pointer transition-colors ${
                  active
                    ? 'bg-bg-tertiary text-text'
                    : 'text-text-muted hover:text-text hover:bg-bg-tertiary/50'
                }`}
              >
                <span className="font-mono font-semibold text-text truncate flex-1">{entry.symbol}</span>
                <span className={`shrink-0 text-[9px] uppercase tracking-wide px-1 rounded ${ASSET_CLASS_COLORS[entry.assetClass]}`}>
                  {entry.assetClass}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFromWatchlist(entry.assetClass, entry.symbol)
                  }}
                  className="w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-text-muted/60 hover:text-text hover:bg-bg-tertiary"
                  aria-label={`Remove ${entry.symbol}`}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function SidebarSectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-3 mt-3 mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted/60 select-none">
      {children}
    </h3>
  )
}
