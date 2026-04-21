import { useEffect, useState } from 'react'
import { marketApi, type KeyMetrics, type FinancialRatios } from '../../api/market'
import { Card } from './Card'
import { fmtNumber, fmtPercent, fmtMoneyShort } from './format'

interface Props {
  symbol: string
}

type Loaded = { metrics: KeyMetrics | null; ratios: FinancialRatios | null }

export function KeyMetricsPanel({ symbol }: Props) {
  const [data, setData] = useState<Loaded | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([marketApi.equity.metrics(symbol), marketApi.equity.ratios(symbol)])
      .then(([m, r]) => {
        if (cancelled) return
        const err = m.error ?? r.error
        if (err) setError(err)
        setData({ metrics: m.results?.[0] ?? null, ratios: r.results?.[0] ?? null })
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbol])

  const m = data?.metrics ?? {}
  const r = data?.ratios ?? {}
  const both = { ...r, ...m } as Record<string, unknown>

  // Small curated list — the raw schemas carry 100+ fields that swamp a user.
  const rows: Array<[string, string]> = [
    ['P/E',          fmtNumber(both.pe_ratio ?? both.priceToEarningsRatioTTM)],
    ['PEG',          fmtNumber(both.priceEarningsToGrowthRatioTTM)],
    ['P/S',          fmtNumber(both.priceToSalesRatioTTM)],
    ['P/B',          fmtNumber(both.priceToBookRatioTTM)],
    ['EV/EBITDA',    fmtNumber(both.ev_to_ebitda ?? both.enterpriseValueMultipleTTM)],
    ['Div Yield',    fmtPercent(both.dividend_yield ?? both.dividendYieldTTM)],
    ['ROE',          fmtPercent(both.returnOnEquityTTM ?? both.roe)],
    ['ROA',          fmtPercent(both.returnOnAssetsTTM ?? both.roa)],
    ['Gross Margin', fmtPercent(both.grossProfitMarginTTM)],
    ['Net Margin',   fmtPercent(both.netProfitMarginTTM ?? both.bottomLineProfitMarginTTM)],
    ['Debt/Equity',  fmtNumber(both.debt_to_equity ?? both.debtToEquityRatioTTM)],
    ['Current Ratio',fmtNumber(both.current_ratio ?? both.currentRatioTTM)],
    ['Market Cap',   fmtMoneyShort(both.marketCap ?? both.market_cap)],
    ['Enterprise V', fmtMoneyShort(both.enterprise_value ?? both.enterpriseValueTTM)],
  ]

  return (
    <Card title="Key Metrics">
      {loading && <div className="text-[12px] text-text-muted">Loading…</div>}
      {error && !loading && <div className="text-[12px] text-red-400">{error}</div>}
      {!loading && !error && data && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between border-b border-border/30 py-1 last:border-b-0">
              <dt className="text-text-muted/70">{k}</dt>
              <dd className="font-mono text-text tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  )
}
