import { NextRequest, NextResponse } from "next/server";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { velocityLimiter } from "./lib/ratelimit";
import { ddb } from "./lib/db";

const HEADLESS_UA_PATTERN = /HeadlessChrome|Puppeteer|Playwright|Selenium|PhantomJS/i;
const TRUST_FLOOR = 51; // a single strong signal (headless UA, -50) lands at exactly 50 — must reject at 50, so floor sits at 51

// Mirrors recordStats() in lib/purchase.ts — same non-blocking, try/catch-wrapped
// pattern. Observability must never affect correctness: a Stats write failure
// here must never turn a block into a 500 or otherwise change the response.
async function recordBlockedStats(dropId: string | undefined, flags: string[]): Promise<void> {
    if (!dropId) return; // can't attribute the block to a drop — skip silently
    try {
        await ddb.send(new UpdateCommand({
            TableName: "Stats",
            Key: { dropId },
            UpdateExpression: "ADD blockedCount :one, totalAttempts :one",
            ExpressionAttributeValues: { ":one": 1 },
        }));
    } catch (err) {
        console.error("recordBlockedStats failed:", err);
    }
}

export async function proxy(request: NextRequest) {
    const requestId = request.headers.get("x-request-id") || crypto.randomUUID();
    const ua = request.headers.get("user-agent") || "";
    const acceptLanguage = request.headers.get("accept-language");

    let score = 100;
    const flags: string[] = [];

    if (!ua) {
        score -= 30;
        flags.push("missing_ua");
    } else if (HEADLESS_UA_PATTERN.test(ua)) {
        score -= 50;
        flags.push("headless_ua");
    }

    if (!acceptLanguage) {
        score -= 10;
        flags.push("missing_accept_language");
    }

    const identifier = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (process.env.DISABLE_VELOCITY_LIMIT !== "true") {
        try {
            const { success } = await velocityLimiter.limit(identifier);
            if (!success) {
                score -= 50;
                flags.push("velocity_exceeded");
            }
        } catch (err) {
            console.error("Velocity check failed:", err);
            flags.push("velocity_check_error");
        }
    }

    score = Math.max(0, score);

    if (score < TRUST_FLOOR) {
        // Peek at the body via clone() so we never consume the original stream —
        // we return our own response here so the route handler never runs anyway,
        // but clone() keeps this safe if that ever changes.
        let dropId: string | undefined;
        try {
            const body = await request.clone().json();
            dropId = body?.dropId;
        } catch {
            // not JSON or empty body — dropId stays undefined, recordBlockedStats no-ops
        }

        await recordBlockedStats(dropId, flags);

        return NextResponse.json(
            { status: "blocked", reason: "trust_score_below_floor", flags, score },
            { status: 403 }
        );
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-request-id", requestId);
    requestHeaders.set("x-trust-score", String(score));

    return NextResponse.next({
        request: { headers: requestHeaders },
    });
}

export const config = {
    matcher: "/api/purchase",
};