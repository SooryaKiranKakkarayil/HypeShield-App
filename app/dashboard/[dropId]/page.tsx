"use client"

import { use, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  Ban,
  Bot,
  CheckCircle2,
  Copy,
  GaugeCircle,
  HelpCircle,
  PackageX,
  ShieldOff,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react"
import type { DropStats } from "@/lib/hypeshield-types"
import { StatCard } from "@/components/hypeshield/stat-card"
import { DepletionMeter } from "@/components/hypeshield/depletion-meter"
import { launchAttackAction } from "./actions"

const POLL_INTERVAL_MS = 1500

type SimulateAttackResult = {
  dropId: string
  scenario?: "mixed" | "legit_shared_ip"
  totalRequests: number
  humanCount: number
  obviousBotCount: number
  stealthBotCount: number
  sharedIpHumanCount?: number
  elapsedMs: number
  tally: Record<string, number>
  byType: Record<string, Record<string, number>>
}

function countBlocked(tally: Record<string, number>) {
  return Object.entries(tally).reduce(
    (sum, [outcome, count]) => (outcome.startsWith("blocked") ? sum + count : sum),
    0
  )
}

export default function DashboardPage({ params }: { params: Promise<{ dropId: string }> }) {
  const { dropId } = use(params)

  const [stats, setStats] = useState<DropStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [isAttacking, setIsAttacking] = useState(false)
  const [attackResult, setAttackResult] = useState<SimulateAttackResult | null>(null)
  const [attackError, setAttackError] = useState<string | null>(null)

  const [isLegitRunning, setIsLegitRunning] = useState(false)
  const [legitResult, setLegitResult] = useState<SimulateAttackResult | null>(null)
  const [legitError, setLegitError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`/api/stats/${dropId}`, {
        signal: controller.signal,
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`)
      }
      const data = (await res.json()) as DropStats
      setStats(data)
      setError(null)
      setIsLive(true)
      setLastUpdated(new Date())
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setError(err instanceof Error ? err.message : "Failed to load stats")
      setIsLive(false)
    }
  }, [dropId])

  const launchAttack = useCallback(async () => {
    setIsAttacking(true)
    setAttackError(null)
    try {
      const data = (await launchAttackAction(dropId, { totalRequests: 150, botRatio: 0.5 })) as SimulateAttackResult
      setAttackResult(data)
      fetchStats()
    } catch (err) {
      setAttackError(err instanceof Error ? err.message : "Attack failed")
    } finally {
      setIsAttacking(false)
    }
  }, [dropId, fetchStats])

  const launchLegitBuyers = useCallback(async () => {
    setIsLegitRunning(true)
    setLegitError(null)
    try {
      const data = (await launchAttackAction(dropId, {
        totalRequests: 6,
        scenario: "legit_shared_ip",
      })) as SimulateAttackResult
      setLegitResult(data)
      fetchStats()
    } catch (err) {
      setLegitError(err instanceof Error ? err.message : "Simulation failed")
    } finally {
      setIsLegitRunning(false)
    }
  }, [dropId, fetchStats])

  useEffect(() => {
    fetchStats()
    const id = setInterval(fetchStats, POLL_INTERVAL_MS)
    return () => {
      clearInterval(id)
      abortRef.current?.abort()
    }
  }, [fetchStats])

  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <Header dropId={dropId} isLive={isLive} hasError={!!error} lastUpdated={lastUpdated} />

        <AttackPanel
          botnet={{ isAttacking, result: attackResult, error: attackError, onLaunch: launchAttack }}
          legit={{ isAttacking: isLegitRunning, result: legitResult, error: legitError, onLaunch: launchLegitBuyers }}
        />

        {error && !stats ? (
          <ErrorState message={error} onRetry={fetchStats} />
        ) : !stats ? (
          <LoadingState />
        ) : (
          <Dashboard stats={stats} staleError={error} />
        )}
      </main>
    </div>
  )
}

function Header({
  dropId,
  isLive,
  hasError,
  lastUpdated,
}: {
  dropId: string
  isLive: boolean
  hasError: boolean
  lastUpdated: Date | null
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-5 text-amber-400" aria-hidden="true" />
          <h1 className="text-lg font-semibold tracking-tight">HypeShield</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Drop <span className="font-mono text-foreground">{dropId}</span> · live inventory mission control
        </p>
      </div>
      <LiveIndicator isLive={isLive} hasError={hasError} lastUpdated={lastUpdated} />
    </header>
  )
}

function LiveIndicator({
  isLive,
  hasError,
  lastUpdated,
}: {
  isLive: boolean
  hasError: boolean
  lastUpdated: Date | null
}) {
  const state = hasError ? "error" : isLive ? "live" : "connecting"
  const config = {
    live: { label: "LIVE", dot: "bg-emerald-400", ring: "ring-emerald-500/30", text: "text-emerald-300" },
    connecting: { label: "CONNECTING", dot: "bg-amber-400", ring: "ring-amber-500/30", text: "text-amber-300" },
    error: { label: "RECONNECTING", dot: "bg-red-400", ring: "ring-red-500/30", text: "text-red-300" },
  }[state]

  return (
    <div
      className={`inline-flex items-center gap-2 self-start rounded-full bg-card px-3 py-1.5 ring-1 ring-inset ${config.ring}`}
    >
      <span className="relative flex size-2.5">
        {state === "live" && (
          <span className={`absolute inline-flex size-full animate-ping rounded-full ${config.dot} opacity-75`} />
        )}
        <span className={`relative inline-flex size-2.5 rounded-full ${config.dot}`} />
      </span>
      <span className={`text-xs font-semibold tracking-wider ${config.text}`}>{config.label}</span>
      {lastUpdated ? (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      ) : null}
    </div>
  )
}

function AttackPanel({
  botnet,
  legit,
}: {
  botnet: {
    isAttacking: boolean
    result: SimulateAttackResult | null
    error: string | null
    onLaunch: () => void
  }
  legit: {
    isAttacking: boolean
    result: SimulateAttackResult | null
    error: string | null
    onLaunch: () => void
  }
}) {
  const anyRunning = botnet.isAttacking || legit.isAttacking

  return (
    <section className="grid gap-4 sm:grid-cols-2">
      <ScenarioCard
        icon={Bot}
        iconClassName="text-red-400"
        label="Scalper Botnet Simulation"
        buttonLabel="Launch Scalper Botnet"
        buttonClassName="bg-red-500/90"
        loadingLabel="Launching attack…"
        idleDescription="Fires a mixed wave of real, obvious-bot, and stealth-bot traffic at this drop's purchase endpoint."
        isRunning={botnet.isAttacking}
        disabled={anyRunning}
        result={botnet.result}
        error={botnet.error}
        onLaunch={botnet.onLaunch}
        renderResult={(result) => {
          const blocked = countBlocked(result.tally)
          const pct = result.totalRequests ? Math.round((blocked / result.totalRequests) * 100) : 0
          return (
            <p className="text-sm text-muted-foreground">
              {result.totalRequests} requests ({result.humanCount} human ·{" "}
              {result.obviousBotCount} obvious bot · {result.stealthBotCount} stealth bot) ·{" "}
              <span className="font-medium text-emerald-300">
                {blocked} blocked ({pct}%)
              </span>{" "}
              in {result.elapsedMs}ms.
            </p>
          )
        }}
      />

      <ScenarioCard
        icon={Users}
        iconClassName="text-teal-400"
        label="Legit Shared-IP Buyers"
        buttonLabel="Simulate Shared-IP Buyers"
        buttonClassName="bg-teal-500/90"
        loadingLabel="Sending buyers…"
        idleDescription="Fires real-browser, human-paced traffic from a small shared-IP pool — the same NAT/office-wifi pattern your velocity check has to tell apart from a botnet."
        isRunning={legit.isAttacking}
        disabled={anyRunning}
        result={legit.result}
        error={legit.error}
        onLaunch={legit.onLaunch}
        renderResult={(result) => {
          const blocked = countBlocked(result.tally)
          const through = result.totalRequests - blocked
          const clean = blocked === 0
          return (
            <p className="text-sm text-muted-foreground">
              <span className={clean ? "font-medium text-emerald-300" : "font-medium text-amber-300"}>
                {through} of {result.totalRequests} got through · {blocked} blocked
              </span>{" "}
              in {result.elapsedMs}ms — all real-browser headers sharing one IP pool.
            </p>
          )
        }}
      />
    </section>
  )
}

function ScenarioCard({
  icon: Icon,
  iconClassName,
  label,
  buttonLabel,
  buttonClassName,
  loadingLabel,
  idleDescription,
  isRunning,
  disabled,
  result,
  error,
  onLaunch,
  renderResult,
}: {
  icon: typeof Bot
  iconClassName: string
  label: string
  buttonLabel: string
  buttonClassName: string
  loadingLabel: string
  idleDescription: string
  isRunning: boolean
  disabled: boolean
  result: SimulateAttackResult | null
  error: string | null
  onLaunch: () => void
  renderResult: (result: SimulateAttackResult) => ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-inset ring-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`size-5 ${iconClassName}`} aria-hidden="true" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <button
          onClick={onLaunch}
          disabled={disabled}
          className={`rounded-lg ${buttonClassName} px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isRunning ? loadingLabel : buttonLabel}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : result ? (
        renderResult(result)
      ) : (
        <p className="text-sm text-muted-foreground">{idleDescription}</p>
      )}
    </div>
  )
}

function Dashboard({ stats, staleError }: { stats: DropStats; staleError: string | null }) {
  const sold = stats.successCount
  const isSoldOut = stats.remainingStock <= 0

  return (
    <div className="flex flex-col gap-6">
      {staleError ? (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-inset ring-red-500/20">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>Connection unstable — showing last known values. Retrying…</span>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-card p-6 ring-1 ring-inset ring-white/10 lg:col-span-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Remaining Stock
            </span>
            <GaugeCircle className="size-5 text-amber-400" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <span
              className={`font-mono text-6xl font-bold tabular-nums sm:text-7xl ${
                isSoldOut ? "text-red-400" : "text-foreground"
              }`}
            >
              {stats.remainingStock.toLocaleString()}
            </span>
            <span className={`text-sm font-medium ${isSoldOut ? "text-red-300" : "text-emerald-300"}`}>
              {isSoldOut ? "SOLD OUT" : "units available"}
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-center gap-5 rounded-2xl bg-card p-6 ring-1 ring-inset ring-white/10 lg:col-span-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Depletion</span>
          <DepletionMeter remaining={stats.remainingStock} sold={sold} />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Attempt Outcomes</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Success" value={stats.successCount} icon={CheckCircle2} accent="success" />
          <StatCard label="Blocked" value={stats.blockedCount} icon={ShieldOff} accent="success" hint="bots stopped" />
          <StatCard label="Duplicate" value={stats.duplicateCount} icon={Copy} accent="info" />
          <StatCard label="Sold Out" value={stats.soldOutCount} icon={PackageX} accent="danger" />
          <StatCard label="Throttled" value={stats.throttledCount} icon={Zap} accent="warning" />
          <StatCard label="Conflict" value={stats.conflictCount} icon={ShieldAlert} accent="warning" />
          <StatCard
            label="Conflict Exhausted"
            value={stats.conflictExhaustedCount}
            icon={Ban}
            accent="danger"
          />
          <StatCard label="Unknown Cancel" value={stats.unknownCancelCount} icon={HelpCircle} accent="neutral" />
          <StatCard
            label="Total Attempts"
            value={stats.totalAttempts}
            icon={Activity}
            accent="info"
            hint="all inbound requests"
          />
        </div>
      </section>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading drop statistics</span>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="h-44 animate-pulse rounded-2xl bg-card ring-1 ring-inset ring-white/10 lg:col-span-2" />
        <div className="h-44 animate-pulse rounded-2xl bg-card ring-1 ring-inset ring-white/10 lg:col-span-3" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-card ring-1 ring-inset ring-white/10" />
        ))}
      </div>
    </div>
  )
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl bg-card px-6 py-16 text-center ring-1 ring-inset ring-red-500/20"
      role="alert"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="size-6 text-red-400" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Unable to load drop stats</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        Retry now
      </button>
    </div>
  )
}