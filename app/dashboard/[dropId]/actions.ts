"use server";

const ADMIN_SECRET = process.env.HYPESHIELD_ADMIN_SECRET!;

const BASE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

console.log("[HypeShield] BASE_URL resolved to:", BASE_URL, {
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
});

async function postAndParse(url: string, headers: Record<string, string>, body?: unknown) {
    console.log("[HypeShield] Attempting POST to:", url);

    const res = await fetch(url, {
        method: "POST",
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();

    if (!res.ok) {
        console.error(`[HypeShield] POST ${url} FAILED with status ${res.status}`, {
            bodySnippet: text.slice(0, 300),
        });
        throw new Error(`Request failed with status ${res.status}`);
    }

    try {
        return JSON.parse(text);
    } catch {
        console.error(`[HypeShield] POST ${url} returned NON-JSON (status ${res.status})`, {
            bodySnippet: text.slice(0, 300),
        });
        throw new Error(`Non-JSON response (status ${res.status})`);
    }
}

export async function launchAttackAction(
    dropId: string,
    params: { totalRequests: number; botRatio?: number; scenario?: "mixed" | "legit_shared_ip" }
) {
    return postAndParse(
        `${BASE_URL}/api/simulate-attack`,
        { "Content-Type": "application/json", "x-hypeshield-secret": ADMIN_SECRET },
        { dropId, ...params }
    );
}

export async function resetDropAction(dropId: string) {
    return postAndParse(`${BASE_URL}/api/admin/reset/${dropId}`, {
        "x-hypeshield-secret": ADMIN_SECRET,
    });
}