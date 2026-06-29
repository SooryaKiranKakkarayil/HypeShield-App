"use server";

const ADMIN_SECRET = process.env.HYPESHIELD_ADMIN_SECRET!;
const BASE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

export async function launchAttackAction(
    dropId: string,
    params: { totalRequests: number; botRatio?: number; scenario?: "mixed" | "legit_shared_ip" }
) {
    const res = await fetch(`${BASE_URL}/api/simulate-attack`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-hypeshield-secret": ADMIN_SECRET },
        body: JSON.stringify({ dropId, ...params }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Attack request failed with status ${res.status}`);
    }
    return res.json();
}

export async function resetDropAction(dropId: string) {
    const res = await fetch(`${BASE_URL}/api/admin/reset/${dropId}`, {
        method: "POST",
        headers: { "x-hypeshield-secret": ADMIN_SECRET },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Reset request failed with status ${res.status}`);
    }
    return res.json();
}