import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { checkAdminSecret } from "@/lib/admin-auth";

const MAX_TOTAL_REQUESTS = 5000;

// Real headless-browser UA strings — match middleware's HEADLESS_UA_PATTERN
// (HeadlessChrome|Puppeteer|Playwright|Selenium|PhantomJS), so these trip
// the -50 "headless_ua" flag.
const BOT_USER_AGENTS = [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Selenium",
    "Mozilla/5.0 (X11; Linux x86_64) Puppeteer/21.0.0",
];

// Realistic browser UAs — won't trip the headless pattern, won't be missing
// accept-language either. Pass trust scoring on header signals alone.
const HUMAN_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
];

type ActorType = "human" | "obvious_bot" | "stealth_bot";

interface SimulatedActor {
    type: ActorType;
    requestId: string;
    headers: Record<string, string>;
    delayMs: number;
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randomFakeIp(): string {
    return `${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function buildActor(type: ActorType, botIpPool: string[]): SimulatedActor {
    const requestId = randomUUID();

    if (type === "human") {
        return {
            type,
            requestId,
            headers: {
                "user-agent": pick(HUMAN_USER_AGENTS),
                "accept-language": "en-US,en;q=0.9",
                "x-forwarded-for": randomFakeIp(),
            },
            // humans don't all click at once — spread across a multi-second window
            delayMs: Math.random() * 2000 + 200,
        };
    }

    if (type === "obvious_bot") {
        return {
            type,
            requestId,
            headers: {
                "user-agent": pick(BOT_USER_AGENTS),
                // bots often skip accept-language entirely
                "x-forwarded-for": pick(botIpPool),
            },
            delayMs: Math.random() * 8, // sub-10ms, near-instant
        };
    }

    // stealth_bot: passes every header check a real browser would — only
    // catchable via velocity (shared IP pool + zero delay). Demonstrates the
    // defense isn't solely reliant on UA sniffing.
    return {
        type,
        requestId,
        headers: {
            "user-agent": pick(HUMAN_USER_AGENTS),
            "accept-language": "en-US,en;q=0.9",
            "x-forwarded-for": pick(botIpPool),
        },
        delayMs: 0,
    };
}

interface AttackResult {
    type: ActorType;
    outcome: string;
    httpStatus: number;
}

export async function POST(request: NextRequest) {
    const authError = checkAdminSecret(request);
    if (authError) return authError;

    const body = await request.json().catch(() => ({}));
    const { dropId, totalRequests = 300, botRatio = 0.5 } = body;

    if (!dropId) {
        return NextResponse.json({ error: "dropId is required" }, { status: 400 });
    }
    if (totalRequests > MAX_TOTAL_REQUESTS) {
        return NextResponse.json(
            { error: `totalRequests capped at ${MAX_TOTAL_REQUESTS}` },
            { status: 400 }
        );
    }

    const origin = request.nextUrl.origin;
    const purchaseUrl = `${origin}/api/purchase`;

    // Small reused IP pool for bots — a unique fake IP per bot request would
    // never accumulate enough requests-per-identifier to trip the velocity
    // sliding window. Sharing a pool simulates a real botnet's limited proxy set.
    const BOT_IP_POOL = Array.from({ length: 5 }, randomFakeIp);

    const botCount = Math.round(totalRequests * botRatio);
    const humanCount = totalRequests - botCount;
    const obviousBotCount = Math.round(botCount * 0.6);
    const stealthBotCount = botCount - obviousBotCount;

    const actors: SimulatedActor[] = [
        ...Array.from({ length: humanCount }, () => buildActor("human", BOT_IP_POOL)),
        ...Array.from({ length: obviousBotCount }, () => buildActor("obvious_bot", BOT_IP_POOL)),
        ...Array.from({ length: stealthBotCount }, () => buildActor("stealth_bot", BOT_IP_POOL)),
    ];

    const startedAt = Date.now();

    const firing = actors.map(async (actor): Promise<AttackResult> => {
        if (actor.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, actor.delayMs));
        }

        try {
            const res = await fetch(purchaseUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-request-id": actor.requestId,
                    ...actor.headers,
                },
                body: JSON.stringify({ dropId }),
            });
            const json = await res.json().catch(() => ({}));

            const outcome =
                json.status === "blocked"
                    ? `blocked:${(json.flags ?? []).join("+") || "unknown"}`
                    : json.status ?? "unknown";

            return { type: actor.type, outcome, httpStatus: res.status };
        } catch {
            return { type: actor.type, outcome: "network_error", httpStatus: 0 };
        }
    });

    const results = await Promise.all(firing);
    const elapsedMs = Date.now() - startedAt;

    const tally: Record<string, number> = {};
    const byType: Record<ActorType, Record<string, number>> = {
        human: {},
        obvious_bot: {},
        stealth_bot: {},
    };

    for (const r of results) {
        tally[r.outcome] = (tally[r.outcome] || 0) + 1;
        byType[r.type][r.outcome] = (byType[r.type][r.outcome] || 0) + 1;
    }

    return NextResponse.json({
        dropId,
        totalRequests,
        humanCount,
        obviousBotCount,
        stealthBotCount,
        elapsedMs,
        tally,
        byType,
    });
}