"use client"

import { useEffect, useRef, useState } from "react"
import { ShieldOff, CheckCircle2 } from "lucide-react"

type Entry = {
  id: number
  type: "allowed" | "blocked"
  label: string
}

const POOL: Array<Omit<Entry, "id">> = [
  { type: "allowed", label: "checkout · normal velocity" },
  { type: "blocked", label: "flag: headless_ua" },
  { type: "allowed", label: "checkout · shared IP, human pace" },
  { type: "blocked", label: "flag: velocity_exceeded" },
  { type: "allowed", label: "checkout · mobile, normal velocity" },
  { type: "blocked", label: "flag: missing_accept_language" },
  { type: "allowed", label: "checkout · normal velocity" },
  { type: "blocked", label: "flag: velocity_exceeded ×6/1s" },
]

export function LiveTicker() {
  const [entries, setEntries] = useState<Entry[]>([])
  const counterRef = useRef(0)

  useEffect(() => {
    function pushEntry() {
      const next = POOL[Math.floor(Math.random() * POOL.length)]
      counterRef.current += 1
      setEntries((prev) => [...prev, { ...next, id: counterRef.current }].slice(-6))
    }
    pushEntry()
    const id = setInterval(pushEntry, 1100)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-5 ring-1 ring-inset ring-white/10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Defense feed
        </span>
        <div className="inline-flex items-center gap-2 rounded-full bg-background px-2.5 py-1 ring-1 ring-inset ring-teal-500/30">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-teal-400" />
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-teal-300">
            SIMULATED PREVIEW
          </span>
        </div>
      </div>

      <div className="flex min-h-[15.5rem] flex-col-reverse gap-2">
        {entries
          .slice()
          .reverse()
          .map((entry) => (
            <TickerRow key={entry.id} entry={entry} />
          ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Run a real attack on the dashboard to see this engine score actual requests.
      </p>
    </div>
  )
}

function TickerRow({ entry }: { entry: Entry }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const isBlocked = entry.type === "blocked"

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-xs transition-all duration-300 motion-reduce:transition-none ${
        isBlocked ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"
      } ${visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
    >
      {isBlocked ? (
        <ShieldOff className="size-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{entry.label}</span>
    </div>
  )
}