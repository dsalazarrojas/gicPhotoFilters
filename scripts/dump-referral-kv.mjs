import { execFileSync } from "node:child_process";

const namespaceId = "69d43c998f9440ed9c73648d9591beee";
const prefix = "usage:v1:referral:";
const wrangler = process.env.WRANGLER_BIN || "npx";
const wranglerArgs = ["wrangler@latest"];

function run(args) {
  return execFileSync(wrangler, [...wranglerArgs, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim();
}

const listed = run(["kv", "key", "list", `--namespace-id=${namespaceId}`, "--remote", `--prefix=${prefix}`]);
let keys = [];
try { keys = JSON.parse(listed); } catch (error) {
  console.error(JSON.stringify({ error: "kv_key_list_not_json", raw: listed, cause: String(error) }));
  process.exit(1);
}

for (const entry of keys) {
  const key = typeof entry === "string" ? entry : entry.name;
  if (!key) continue;
  const value = run(["kv", "key", "get", key, `--namespace-id=${namespaceId}`, "--remote"]);
  console.log(JSON.stringify({ key, value }));
}
