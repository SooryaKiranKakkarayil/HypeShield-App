import { cn } from "@/lib/utils"

export function DepletionMeter({
  remaining,
  sold,
}: {
  remaining: number
  sold: number
}) {
  const total = Math.max(remaining + sold, 1)
  const soldPct = Math.min(100, Math.max(0, (sold / total) * 100))
  const remainingPct = 100 - soldPct

  const isCritical = remainingPct <= 10
  const isLow = remainingPct <= 30

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-emerald-300">{remaining.toLocaleString()} remaining</span>
        <span className="font-medium text-muted-foreground">{sold.toLocaleString()} sold</span>
      </div>

      <div
        className="relative h-4 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={Math.round(soldPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Stock depletion"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            isCritical ? "bg-red-500" : isLow ? "bg-amber-500" : "bg-emerald-500",
          )}
          style={{ width: `${remainingPct}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{remainingPct.toFixed(1)}% of inventory left</span>
        <span>{total.toLocaleString()} total units</span>
      </div>
    </div>
  )
}
