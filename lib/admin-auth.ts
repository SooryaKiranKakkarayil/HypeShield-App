import { NextResponse } from "next/server";

export function checkAdminSecret(request: Request): NextResponse | null {
    const expected = process.env.HYPESHIELD_ADMIN_SECRET;
    const provided = request.headers.get("x-hypeshield-secret");

    if (!expected || provided !== expected) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return null;
}