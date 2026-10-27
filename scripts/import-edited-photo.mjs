// Imports an externally edited image (e.g. a Higgsfield result) into the standalone
// deployment's private photo diary, applying the same limits as POST /api/photos.
// Not used by Sites. Reads D1/R2 names from .standalone.json, or from STANDALONE_D1_DATABASE_NAME,
// STANDALONE_D1_DATABASE_ID and STANDALONE_R2_BUCKET (cloud sessions). Needs wrangler auth
// (login, or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID). No build is required.
//   node scripts/import-edited-photo.mjs --file result.png --date 2026-11-18 \
//     --uploader-label "여행자 A" [--uploader-id <Access user id>] [--place ..] [--caption ..] [--dry-run]
// Without --uploader-id the id is taken from that member's earlier uploads.
// --dry-run converts the image and checks D1 access and the storage cap without writing anything.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
// Mirrors app/api/photos/route.ts and the fixed limits in scripts/standalone-deploy.mjs.
const MAX_IMAGE_BYTES = 5_000_000;
const R2_MAX_BYTES = 5_000_000_000;
const R2_MAX_WRITES_PER_MONTH = 50_000;

function fail(message) {
  console.error("import-edited-photo: " + message);
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    file: { type: "string" }, date: { type: "string" }, place: { type: "string", default: "" },
    caption: { type: "string", default: "" }, "uploader-id": { type: "string" }, "uploader-label": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
if (!args.file || !existsSync(args.file)) fail("--file must point to an image.");
if (!/^2026-11-(1[89]|2[0-2])$/.test(args.date ?? "")) fail("--date must be a trip date 2026-11-18..22.");
if (args["uploader-id"] !== undefined && !/^[A-Za-z0-9-]{8,64}$/.test(args["uploader-id"])) fail("--uploader-id must be the member's Access user id.");
if (!["여행자 A", "여행자 B"].includes(args["uploader-label"] ?? "")) fail('--uploader-label must be "여행자 A" or "여행자 B".');

const settingsPath = path.join(root, ".standalone.json");
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {
  d1DatabaseName: process.env.STANDALONE_D1_DATABASE_NAME,
  d1DatabaseId: process.env.STANDALONE_D1_DATABASE_ID,
  r2BucketName: process.env.STANDALONE_R2_BUCKET,
};
if (!settings.d1DatabaseName || !settings.d1DatabaseId || !settings.r2BucketName) {
  fail("missing D1/R2 settings: add .standalone.json or set STANDALONE_D1_DATABASE_NAME, STANDALONE_D1_DATABASE_ID and STANDALONE_R2_BUCKET.");
}

// A minimal wrangler config with only the D1 binding, so the import works without a build.
const temp = mkdtempSync(path.join(tmpdir(), "our-taiwan-import-"));
process.on("exit", () => rmSync(temp, { recursive: true, force: true }));
const configPath = path.join(temp, "wrangler.json");
writeFileSync(configPath, JSON.stringify({
  name: "our-taiwan-2026-import",
  compatibility_date: "2026-01-01",
  ...(process.env.CLOUDFLARE_ACCOUNT_ID ? { account_id: process.env.CLOUDFLARE_ACCOUNT_ID } : {}),
  d1_databases: [{ binding: "DB", database_name: settings.d1DatabaseName, database_id: settings.d1DatabaseId }],
}));

function wranglerRun(commandArgs, { json = false } = {}) {
  const result = spawnSync(process.execPath, [wrangler, ...commandArgs, "--config", configPath], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) fail("wrangler " + commandArgs.slice(0, 3).join(" ") + " failed:\n" + (result.stderr || result.stdout));
  return json ? JSON.parse(result.stdout) : result.stdout;
}
const sql = value => "'" + String(value).replace(/'/g, "''") + "'";
const query = statement => wranglerRun(["d1", "execute", settings.d1DatabaseName, "--remote", "--json", "--command", statement], { json: true })[0].results;

// Same shape the app uploads: JPEG, longest side 1800px, under 5 MB.
let quality = 86, jpeg;
do {
  jpeg = await sharp(args.file).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
  quality -= 8;
} while (jpeg.length > MAX_IMAGE_BYTES && quality > 40);
if (jpeg.length > MAX_IMAGE_BYTES) fail("image is still over 5 MB after compression.");

const [usage] = query("SELECT COALESCE(SUM(byte_size),0) AS used FROM photos");
if (Number(usage.used) + jpeg.length > R2_MAX_BYTES) fail("free storage cap reached; delete photos first.");
let uploaderId = args["uploader-id"];
if (!uploaderId) {
  const known = query(`SELECT DISTINCT uploader_id FROM photos WHERE uploader_label = ${sql(args["uploader-label"])}`);
  if (known.length !== 1) fail(`found ${known.length} uploader ids for ${args["uploader-label"]}; pass --uploader-id.`);
  uploaderId = known[0].uploader_id;
}
if (args["dry-run"]) {
  console.log(JSON.stringify({ dryRun: true, date: args.date, bytes: jpeg.length, storedBytes: Number(usage.used), uploaderId }));
  process.exit(0);
}
const period = new Date().toISOString().slice(0, 7);
const reserved = query(`INSERT INTO usage_counters (period, kind, count) VALUES (${sql(period)}, 'r2-write', 1) ON CONFLICT(period, kind) DO UPDATE SET count = count + 1 WHERE count < ${R2_MAX_WRITES_PER_MONTH} RETURNING count`);
if (!reserved.length) fail("monthly free upload cap reached.");

const id = randomUUID();
const objectKey = `private-trip/${id}.jpg`;
const local = path.join(temp, "photo.jpg");
writeFileSync(local, jpeg);
wranglerRun(["r2", "object", "put", `${settings.r2BucketName}/${objectKey}`, "--file", local, "--content-type", "image/jpeg", "--cache-control", "private, no-store, max-age=0", "--remote"]);
try {
  query(`INSERT INTO photos (id,trip_date,place,caption,uploader_id,uploader_label,uploaded_at,object_key,content_type,byte_size) VALUES (${[
    id, args.date, args.place.trim().slice(0, 120), args.caption.trim().slice(0, 240), uploaderId, args["uploader-label"],
    new Date().toISOString(), objectKey, "image/jpeg",
  ].map(sql).join(",")},${jpeg.length})`);
} catch (error) {
  wranglerRun(["r2", "object", "delete", `${settings.r2BucketName}/${objectKey}`, "--remote"]);
  throw error;
}
console.log(JSON.stringify({ id, date: args.date, bytes: jpeg.length }));
