import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { attemptPurchase } from "../../../lib/purchase";

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const { dropId } = body;

    if (!dropId) {
        return NextResponse.json({ error: "dropId is required" }, { status: 400 });
    }

    const requestId = request.headers.get("x-request-id") || randomUUID();

    try {
        const result = await attemptPurchase(dropId, requestId);

        if (result.success) {
            return NextResponse.json({ status: "success", requestId }, { status: 200 });
        }

        const statusMap: Record<string, number> = {
            sold_out: 409,
            duplicate: 200,
            conflict_exhausted: 503,
            throttled: 503,
            unknown_cancel: 500,
        };

        return NextResponse.json(
            { status: result.reason, requestId },
            { status: statusMap[result.reason] || 500 }
        );
    } catch (err) {
        console.error("Unexpected purchase error:", err);
        return NextResponse.json({ status: "error", requestId }, { status: 500 });
    }
}