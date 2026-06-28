import { ddb } from "@/lib/db";
import { DeleteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { checkAdminSecret } from "@/lib/admin-auth";


export async function POST(
    req: Request,
    { params }: { params: Promise<{ dropId: string }> }
) {
    const authError = checkAdminSecret(req);
    if (authError) return authError;

    const { dropId } = await params;

    let capacity = 100;
    try {
        const body = await req.json();
        if (typeof body?.capacity === "number") capacity = body.capacity;
    } catch {
        // no body provided — fall back to default capacity
    }

    try {
        await ddb.send(new DeleteCommand({
            TableName: "Stats",
            Key: { dropId },
        }));

        await ddb.send(new UpdateCommand({
            TableName: "Drops",
            Key: { dropId },
            UpdateExpression: "SET remainingStock = :cap",
            ExpressionAttributeValues: { ":cap": capacity },
        }));

        return Response.json({ success: true, dropId, remainingStock: capacity });
    } catch (err) {
        console.error("reset failed:", err);
        return Response.json({ success: false, error: String(err) }, { status: 500 });
    }
}