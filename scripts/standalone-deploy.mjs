// Deploys an already-built dist/ to a standalone Cloudflare Worker guarded by Cloudflare Access.
// Not used by the Sites deployment. See docs/STANDALONE_DEPLOYMENT.md.
//   node scripts/standalone-deploy.mjs [--dry-run]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const settingsPath = path.join(root, ".standalone.json");
const builtConfigPath = path.join(root, "dist/server/wrangler.json");
const outputPath = path.join(root, "dist/server/wrangler.standalone.json");
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");

function fail(message) {
  console.error("standalone-deploy: " + message);
  process.exit(1);
}

if (!existsSync(settingsPath)) fail("missing .standalone.json (copy .standalone.example.json and fill it in).");
if (!existsSync(builtConfigPath)) fail("missing dist/server/wrangler.json; run npm run build first.");

const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
const required = ["workerName", "d1DatabaseName", "d1DatabaseId", "r2BucketName", "accessTeamDomain", "accessAud"];
for (const key of required) {
  if (typeof settings[key] !== "string" || !settings[key].trim()) fail(`.standalone.json is missing "${key}".`);
}
if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(settings.accessTeamDomain)) fail("accessTeamDomain must look like <team>.cloudflareaccess.com.");
if (!dryRun && !/^[0-9a-f-]{36}$/.test(settings.d1DatabaseId)) fail("d1DatabaseId must be the UUID printed by wrangler d1 create.");

const config = JSON.parse(readFileSync(builtConfigPath, "utf8"));
Object.assign(config, {
  name: settings.workerName,
  topLevelName: settings.workerName,
  workers_dev: true,
  // Preview URLs are a second public hostname; keep only the Access-protected workers.dev route.
  preview_urls: false,
  d1_databases: [{
    binding: "DB",
    database_name: settings.d1DatabaseName,
    database_id: settings.d1DatabaseId,
    migrations_dir: path.join(root, "drizzle"),
  }],
  r2_buckets: [{ binding: "BUCKET", bucket_name: settings.r2BucketName }],
  vars: {
    ...config.vars,
    AUTH_PROVIDER: "cloudflare-access",
    ACCESS_TEAM_DOMAIN: settings.accessTeamDomain,
    ACCESS_AUD: settings.accessAud,
    // Fixed cost guards (app/api/_lib/r2-budget.ts), well inside the R2 free tier:
    // 5 GB of the 10 GB-month, 50k of 1M Class A, 500k of 10M Class B per month.
    R2_MAX_BYTES: "5000000000",
    R2_MAX_WRITES_PER_MONTH: "50000",
    R2_MAX_READS_PER_MONTH: "500000",
  },
});
writeFileSync(outputPath, JSON.stringify(config, null, 2));

function run(args) {
  console.log("> wrangler " + args.join(" "));
  const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (dryRun) {
  run(["deploy", "--config", outputPath, "--dry-run"]);
} else {
  run(["d1", "migrations", "apply", settings.d1DatabaseName, "--remote", "--config", outputPath]);
  run(["deploy", "--config", outputPath]);
}
