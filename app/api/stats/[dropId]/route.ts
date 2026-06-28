import { NextRequest, NextResponse } from "next/server";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../../../../lib/db";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ dropId: string }> }
) {
    const { dropId } = await params;

    const [dropsResult, statsResult] = await Promise.all([
        ddb.send(new GetCommand({ TableName: "Drops", Key: { dropId }, ConsistentRead: true })),
        ddb.send(new GetCommand({ TableName: "Stats", Key: { dropId } })),
    ]);

    if (!dropsResult.Item) {
        return NextResponse.json({ error: "drop not found" }, { status: 404 });
    }

    const stats = statsResult.Item ?? {};

    return NextResponse.json({
        dropId,
        remainingStock: dropsResult.Item.remainingStock,
        successCount: stats.successCount ?? 0,
        duplicateCount: stats.duplicateCount ?? 0,
        soldOutCount: stats.sold_outCount ?? 0,
        throttledCount: stats.throttledCount ?? 0,
        conflictCount: stats.conflictCount ?? 0,
        conflictExhaustedCount: stats.conflictExhaustedCount ?? 0,
        unknownCancelCount: stats.unknownCancelCount ?? 0,
        totalAttempts: stats.totalAttempts ?? 0,
        blockedCount: stats.blockedCount ?? 0,
    });
}