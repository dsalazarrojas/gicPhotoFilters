const baseUrl = (process.env.PHOTO_FILTERS_BASE_URL || "").replace(/\/$/, "");
if (!baseUrl) {
  console.error("Set PHOTO_FILTERS_BASE_URL to the deployed Pages URL.");
  process.exit(2);
}

const referral = process.env.PHOTO_FILTERS_REFERRAL || `shr205-${Date.now()}`;
const ips = (process.env.PHOTO_FILTERS_IPS || "198.51.100.21,198.51.100.22,198.51.100.23").split(",");

async function request(path, ip) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: ip ? { "x-forwarded-for": ip } : {},
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  console.log(JSON.stringify({ path, ip: ip || null, status: response.status, body: json || text }));
  return { response, json };
}

console.log(`# production base: ${baseUrl}`);
await request("/api/health", "");
for (const ip of ips) await request(`/api/usage?ref=${encodeURIComponent(referral)}&src=phase2-production`, ip.trim());
await request("/api/usage?view=counters", "");
console.log("PRODUCTION CHECK COMPLETE — inspect the raw JSON above; no result is inferred.");
