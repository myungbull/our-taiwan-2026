// Imports an externally edited image (e.g. a Higgsfield result) into the standalone
// deployment's private photo diary, applying the same limits as POST /api/photos.
// Not used by Sites. Requires .standalone.json, a built dist/server/wrangler.standalone.json
// (npm run standalone:deploy creates it) and wrangler auth (login or CLOUDFLARE_API_TOKEN).
//   node scripts/import-edited-photo.mjs --file result.png --date 2026-11-18 \
//     --uploader-id <Access user id> --uploader-label "여행자 A" [--place ..] [--caption ..]
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
const configPath = path.join(root, "dist/server/wrangler.standalone.json");
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
  },
});
if (!args.file || !existsSync(args.file)) fail("--file must point to an image.");
if (!/^2026-11-(1[89]|2[0-2])$/.test(args.date ?? "")) fail("--date must be a trip date 2026-11-18..22.");
if (!/^[A-Za-z0-9-]{8,64}$/.test(args["uploader-id"] ?? "")) fail("--uploader-id must be the member's Access user id.");
if (!["여행자 A", "여행자 B"].includes(args["uploader-label"] ?? "")) fail('--uploader-label must be "여행자 A" or "여행자 B".');
if (!existsSync(configPath)) fail("missing dist/server/wrangler.standalone.json; run npm run standalone:deploy first.");
const settings = JSON.parse(readFileSync(path.join(root, ".standalone.json"), "utf8"));

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
const period = new Date().toISOString().slice(0, 7);
const reserved = query(`INSERT INTO usage_counters (period, kind, count) VALUES (${sql(period)}, 'r2-write', 1) ON CONFLICT(period, kind) DO UPDATE SET count = count + 1 WHERE count < ${R2_MAX_WRITES_PER_MONTH} RETURNING count`);
if (!reserved.length) fail("monthly free upload cap reached.");

const id = randomUUID();
const objectKey = `private-trip/${id}.jpg`;
const temp = mkdtempSync(path.join(tmpdir(), "our-taiwan-import-"));
try {
  const local = path.join(temp, "photo.jpg");
  writeFileSync(local, jpeg);
  wranglerRun(["r2", "object", "put", `${settings.r2BucketName}/${objectKey}`, "--file", local, "--content-type", "image/jpeg", "--cache-control", "private, no-store, max-age=0", "--remote"]);
  try {
    query(`INSERT INTO photos (id,trip_date,place,caption,uploader_id,uploader_label,uploaded_at,object_key,content_type,byte_size) VALUES (${[
      id, args.date, args.place.trim().slice(0, 120), args.caption.trim().slice(0, 240), args["uploader-id"], args["uploader-label"],
      new Date().toISOString(), objectKey, "image/jpeg",
    ].map(sql).join(",")},${jpeg.length})`);
  } catch (error) {
    wranglerRun(["r2", "object", "delete", `${settings.r2BucketName}/${objectKey}`, "--remote"]);
    throw error;
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
console.log(JSON.stringify({ id, date: args.date, bytes: jpeg.length }));
