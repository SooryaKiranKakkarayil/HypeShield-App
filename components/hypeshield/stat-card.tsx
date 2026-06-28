import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Accent = "neutral" | "success" | "warning" | "danger" | "info"

const accentStyles: Record<Accent, { ring: string; icon: string; value: string }> = {
  neutral: { ring: "ring-white/10", icon: "text-muted-foreground", value: "text-foreground" },
  success: { ring: "ring-emerald-500/20", icon: "text-emerald-400", value: "text-emerald-300" },
  warning: { ring: "ring-amber-500/20", icon: "text-amber-400", value: "text-amber-300" },
  danger: { ring: "ring-red-500/20", icon: "text-red-400", value: "text-red-300" },
  info: { ring: "ring-sky-500/20", icon: "text-sky-400", value: "text-sky-300" },
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "neutral",
  hint,
}: {
  label: string
  value: number
  icon: LucideIcon
  accent?: Accent
  hint?: string
}) {
  const styles = accentStyles[accent]
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-inset transition-colors",
        styles.ring,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("size-4 shrink-0", styles.icon)} aria-hidden="true" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className={cn("font-mono text-2xl font-semibold tabular-nums", styles.value)}>
          {value.toLocaleString()}
        </span>
      </div>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}
