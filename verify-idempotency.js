/**
 * Empirical check for HypeShield Day 2 item #1:
 * - Same requestId sent twice -> second call must return duplicate (200), not double-decrement.
 * - Run: node verify-idempotency.js
 *
 * Windows-safe: uses file://-based params for aws cli instead of inline JSON,
 * since cmd.exe mangles quoted JSON passed via execSync.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const BASE_URL = "http://localhost:3000";
const ENDPOINT = "/api/purchase"; // <- adjust to your actual route
// Fresh dropId every run -> no stale stock, no leftover Idempotency row from
// a previous run, no cleanup script needed before re-running this file.
const DROP_ID = `test-drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const SEED_STOCK = 5;

const requestId = `replay-test-${Date.now()}`;

function awsGetItem(tableName, keyObj) {
  const tmpFile = path.join(__dirname, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(keyObj));
  try {
    const raw = execSync(`aws dynamodb get-item --table-name ${tableName} --key file://${tmpFile}`, {
      encoding: "utf-8",
    });
    return JSON.parse(raw)?.Item;
  } catch (e) {
    console.error(`getItem(${tableName}) failed:`, e.message.split("\n")[0]);
    return undefined;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function awsPutItem(tableName, itemObj) {
  const tmpFile = path.join(__dirname, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(itemObj));
  try {
    execSync(`aws dynamodb put-item --table-name ${tableName} --item file://${tmpFile}`, { encoding: "utf-8" });
    return true;
  } catch (e) {
    console.error(`putItem(${tableName}) failed:`, e.message.split("\n")[0]);
    return false;
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function getStock() {
  const item = awsGetItem("Drops", { dropId: { S: DROP_ID } });
  const val = item?.remainingStock?.N;
  return val !== undefined ? Number(val) : undefined;
}

function getIdempotencyRecord(reqId) {
  return awsGetItem("Idempotency", { requestId: { S: reqId } });
}

function ensureSeeded() {
  console.log(`seeding fresh drop "${DROP_ID}" with stock=${SEED_STOCK}`);
  const ok = awsPutItem("Drops", {
    dropId: { S: DROP_ID },
    remainingStock: { N: String(SEED_STOCK) },
    ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) }, // auto-expire 1h after seeding — needs TTL enabled on the Drops table, see note below
  });
  if (!ok) throw new Error("Seed failed — check aws cli auth/region before continuing.");
  return SEED_STOCK;
}

async function purchase(label) {
  const res = await fetch(`${BASE_URL}${ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-request-id": requestId },
    body: JSON.stringify({ dropId: DROP_ID }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(`[${label}] status=${res.status} body=${JSON.stringify(body)}`);
  return { status: res.status, body };
}

(async () => {
  const stockBefore = ensureSeeded();
  console.log("stock before:", stockBefore);

  const first = await purchase("call 1 (fresh requestId)");
  const second = await purchase("call 2 (same requestId, replay)");

  const stockAfter = getStock();
  const idempotencyRecord = getIdempotencyRecord(requestId);
  console.log("stock after:", stockAfter);
  console.log("idempotency record:", idempotencyRecord ? "present" : "MISSING");

  console.log("\n--- VERDICT ---");
  console.log(
    first.status === 200 && first.body.status !== "duplicate"
      ? "PASS: first call succeeded as expected"
      : "FAIL: first call should have succeeded cleanly"
  );
  console.log(
    second.status === 200 && second.body.status === "duplicate"
      ? "PASS: replay correctly returned duplicate"
      : `FAIL: replay returned status=${second.status} body.status=${second.body.status} (expected 200 + "duplicate")`
  );
  console.log(
    idempotencyRecord
      ? "PASS: idempotency record written to DynamoDB"
      : "FAIL: no idempotency record found for requestId — Put may not have committed"
  );
  if (stockBefore !== undefined && stockAfter !== undefined) {
    console.log(
      stockBefore - stockAfter === 1
        ? "PASS: stock decremented exactly once across both calls"
        : `FAIL: stock changed by ${stockBefore - stockAfter}, expected exactly 1`
    );
  } else {
    console.log("NOTE: stock read failed — check table name / region / aws cli auth.");
  }
})();