import { TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "./db";

const MAX_RETRIES = 6;
const BASE_DELAY_MS = 25;

type PurchaseResult =
    | { success: true }
    | { success: false; reason: "duplicate" | "sold_out" | "conflict" | "conflict_exhausted" | "throttled" | "unknown_cancel" };

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Assumes the Stats table's primary key is `dropId`, matching Drops/Idempotency.
// If `aws dynamodb describe-table --table-name Stats` shows a different key name,
// change the Key below to match.
async function recordStats(dropId: string, result: PurchaseResult): Promise<void> {
    const counterAttr = result.success ? "successCount" : `${result.reason}Count`;
    try {
        await ddb.send(new UpdateCommand({
            TableName: "Stats",
            Key: { dropId },
            UpdateExpression: `ADD ${counterAttr} :one, totalAttempts :one`,
            ExpressionAttributeValues: { ":one": 1 },
        }));
    } catch (err) {
        // Stats are observability, not correctness — never let a Stats write
        // failure affect the actual purchase outcome.
        console.error("recordStats failed:", err);
    }
}

async function tryOnce(dropId: string, requestId: string): Promise<PurchaseResult> {
    const now = Math.floor(Date.now() / 1000);

    try {
        await ddb.send(new TransactWriteCommand({
            TransactItems: [
                {
                    Put: {
                        TableName: "Idempotency",
                        Item: { requestId, expiresAt: now + 3600, dropId, createdAt: now },
                        ConditionExpression: "attribute_not_exists(requestId)",
                    },
                },
                {
                    Update: {
                        TableName: "Drops",
                        Key: { dropId },
                        UpdateExpression: "ADD remainingStock :neg1",
                        ConditionExpression: "remainingStock > :zero",
                        ExpressionAttributeValues: { ":neg1": -1, ":zero": 0 },
                    },
                },
            ],
        }));
        return { success: true };
    } catch (err: any) {
        if (err.name === "TransactionCanceledException") {
            const reasons = err.CancellationReasons || [];
            const idempotencyFailed = reasons[0]?.Code === "ConditionalCheckFailed";
            const stockFailed = reasons[1]?.Code === "ConditionalCheckFailed";
            const conflict = reasons.some((r: any) => r.Code === "TransactionConflict");

            if (idempotencyFailed) return { success: false, reason: "duplicate" };
            if (stockFailed) return { success: false, reason: "sold_out" };
            if (conflict) return { success: false, reason: "conflict" };

            console.error("Unrecognized cancellation reasons:", JSON.stringify(reasons));
            return { success: false, reason: "unknown_cancel" };
        }
        if (err.name === "ProvisionedThroughputExceededException" || err.name === "ThrottlingException" || err.name === "TransactionInProgressException") {
            return { success: false, reason: "throttled" };
        }
        throw err;
    }
}

export async function attemptPurchase(dropId: string, requestId: string): Promise<PurchaseResult> {
    let lastResult: PurchaseResult;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        lastResult = await tryOnce(dropId, requestId);

        if (lastResult.success || lastResult.reason !== "conflict") {
            await recordStats(dropId, lastResult);
            return lastResult;
        }

        if (attempt < MAX_RETRIES) {
            const jitter = Math.random() * BASE_DELAY_MS;
            await sleep(BASE_DELAY_MS * (attempt + 1) + jitter);
        }
    }

    const exhausted: PurchaseResult = { success: false, reason: "conflict_exhausted" };
    await recordStats(dropId, exhausted);
    return exhausted;
}