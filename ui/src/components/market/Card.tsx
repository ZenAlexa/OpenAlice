import { type ReactNode } from 'react'

interface Props {
  title: string
  /** Optional data-source hint; renders a tiny `?` next to the title with a
   *  native tooltip — answers "where did this come from" without chrome. */
  source?: string | null
  right?: ReactNode
  className?: string
  contentClassName?: string
  children: ReactNode
}

/**
 * Panel shell used across the Market workbench.
 * Just title + optional source + optional right slot + content. No
 * cross-panel smarts — each panel owns its own fetch and render.
 */
export function Card({ title, source, right, className, contentClassName, children }: Props) {
  return (
    <section className={`flex flex-col border border-border rounded bg-bg-secondary/30 ${className ?? ''}`}>
      <header className="flex items-center justify-between gap-3 px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-[13px] font-medium text-text truncate">{title}</h3>
          {source && (
            <span
              className="text-[10px] text-text-muted/50 cursor-help select-none"
              title={`Data source: ${source}`}
              aria-label={`Data source: ${source}`}
            >
              ⓘ
            </span>
          )}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      <div className={contentClassName ?? 'p-3'}>{children}</div>
    </section>
  )
}
