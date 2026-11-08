// Downloads one photo from the standalone deployment's private photo diary, so a cloud
// session can edit a photo that is already in the app without the user attaching it.
// Uses the same D1/R2 settings and wrangler auth as scripts/import-edited-photo.mjs.
//   node scripts/fetch-trip-photo.mjs --id <photo id> --out source.jpg
//   node scripts/fetch-trip-photo.mjs --source <staged id> --out source.jpg   (photo not in the diary yet)
//   node scripts/fetch-trip-photo.mjs --source <staged id> --cleanup          (delete it after the import)
// Prints the photo's date, place, caption and uploader label as JSON (--id only).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const root = fileURLToPath(new URL("..", import.meta.url));
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");

function fail(message) {
  console.error("fetch-trip-photo: " + message);
  process.exit(1);
}

const { values: args } = parseArgs({ options: { id: { type: "string" }, source: { type: "string" }, out: { type: "string" }, cleanup: { type: "boolean", default: false } } });
const uuid = /^[a-f0-9-]{36}$/i;
if (Boolean(args.id) === Boolean(args.source)) fail("pass exactly one of --id (diary photo) or --source (staged photo).");
if (args.id && !uuid.test(args.id)) fail("--id must be a photo id (UUID).");
if (args.source && !uuid.test(args.source)) fail("--source must be a staged photo id (UUID).");
if (args.cleanup && !args.source) fail("--cleanup only applies to --source.");
if (!args.cleanup && !args.out) fail("--out must name the file to write.");

const settingsPath = path.join(root, ".standalone.json");
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {
  d1DatabaseName: process.env.STANDALONE_D1_DATABASE_NAME,
  d1DatabaseId: process.env.STANDALONE_D1_DATABASE_ID,
  r2BucketName: process.env.STANDALONE_R2_BUCKET,
};
if (!settings.d1DatabaseName || !settings.d1DatabaseId || !settings.r2BucketName) {
  fail("missing D1/R2 settings: add .standalone.json or set STANDALONE_D1_DATABASE_NAME, STANDALONE_D1_DATABASE_ID and STANDALONE_R2_BUCKET.");
}

const temp = mkdtempSync(path.join(tmpdir(), "our-taiwan-fetch-"));
process.on("exit", () => rmSync(temp, { recursive: true, force: true }));
const configPath = path.join(temp, "wrangler.json");
writeFileSync(configPath, JSON.stringify({
  name: "our-taiwan-2026-import",
  compatibility_date: "2026-01-01",
  ...(process.env.CLOUDFLARE_ACCOUNT_ID ? { account_id: process.env.CLOUDFLARE_ACCOUNT_ID } : {}),
  d1_databases: [{ binding: "DB", database_name: settings.d1DatabaseName, database_id: settings.d1DatabaseId }],
}));

function wranglerRun(commandArgs) {
  const result = spawnSync(process.execPath, [wrangler, ...commandArgs, "--config", configPath], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) fail("wrangler " + commandArgs.slice(0, 3).join(" ") + " failed:\n" + (result.stderr || result.stdout));
  return result.stdout;
}

// Staged photos (POST /api/edit-sources) live only in R2, under edit-source/<id>.jpg.
if (args.source) {
  const key = `${settings.r2BucketName}/edit-source/${args.source.toLowerCase()}.jpg`;
  if (args.cleanup) {
    wranglerRun(["r2", "object", "delete", key, "--remote"]);
    console.log(JSON.stringify({ source: args.source, deleted: true }));
  } else {
    wranglerRun(["r2", "object", "get", key, "--file", path.resolve(args.out), "--remote"]);
    console.log(JSON.stringify({ source: args.source, file: args.out }));
  }
  process.exit(0);
}

const rows = JSON.parse(wranglerRun(["d1", "execute", settings.d1DatabaseName, "--remote", "--json", "--command",
  `SELECT trip_date, place, caption, uploader_label, object_key, content_type FROM photos WHERE id = '${args.id.toLowerCase()}'`]))[0].results;
if (!rows.length) fail("no photo with that id.");
const [photo] = rows;
if (!String(photo.content_type).startsWith("image/")) fail("that record is a video, not a photo.");
wranglerRun(["r2", "object", "get", `${settings.r2BucketName}/${photo.object_key}`, "--file", path.resolve(args.out), "--remote"]);
console.log(JSON.stringify({ id: args.id, date: photo.trip_date, place: photo.place, caption: photo.caption, uploader: photo.uploader_label, file: args.out }));
