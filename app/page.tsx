import Link from "next/link"
import { Space_Grotesk } from "next/font/google"
import { ShieldAlert, Zap, Fingerprint, Users, ArrowRight } from "lucide-react"
import { LiveTicker } from "@/components/hypeshield/live-ticker"

const display = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"] })

const DASHBOARD_HREF = "/dashboard/test-drop-1" // change if your seeded slug differs

export default function Home() {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-10 sm:px-6 sm:py-16">
        {/* Hero */}
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1.5 ring-1 ring-inset ring-white/10">
              <ShieldAlert className="size-4 text-amber-400" aria-hidden="true" />
              <span className="text-xs font-medium tracking-wide text-muted-foreground">
                H0 Hackathon · Flash-Sale Defense
              </span>
            </div>

            <h1
              className={`${display.className} text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl`}
            >
              Bots check out in
              <span className="text-red-400"> milliseconds.</span>
              <br />
              Real buyers don&apos;t.
            </h1>

            <p className="max-w-md text-base leading-7 text-muted-foreground">
              HypeShield scores every purchase attempt in real time — request velocity, browser
              headers, identifier pressure — and blocks scalper bots before they touch your
              inventory, without throttling shoppers on shared office or campus IPs.
            </p>

            <div>
              <Link
                href={DASHBOARD_HREF}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500/90 px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Open live dashboard
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <LiveTicker />
        </section>

        {/* How it decides */}
        <section className="flex flex-col gap-6 border-t border-white/10 pt-10">
          <h2 className="text-sm font-medium text-muted-foreground">How a request gets judged</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            <MethodRow
              icon={Zap}
              iconClassName="text-amber-400"
              title="Velocity"
              description="Five requests per second per identifier. Past that, the window closes."
            />
            <MethodRow
              icon={Fingerprint}
              iconClassName="text-red-400"
              title="Headers"
              description="Headless browsers and missing accept-language get flagged before they reach inventory."
            />
            <MethodRow
              icon={Users}
              iconClassName="text-teal-400"
              title="Identifier pressure"
              description="A shared IP isn't penalized on its own — only when it's paired with bot-speed timing."
            />
          </div>
        </section>

        <footer className="border-t border-white/10 pt-6 text-xs text-muted-foreground">
          Built for H0: Hack the Zero Stack with Vercel v0 and AWS Databases.
        </footer>
      </main>
    </div>
  )
}

function MethodRow({
  icon: Icon,
  iconClassName,
  title,
  description,
}: {
  icon: typeof Zap
  iconClassName: string
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-5 ring-1 ring-inset ring-white/10">
      <Icon className={`size-5 ${iconClassName}`} aria-hidden="true" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  )
}