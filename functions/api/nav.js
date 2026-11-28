/**
 * Read-only AMFI NAV search proxy.
 * GET /api/nav?q=<scheme-name-or-scheme-code>
 * Supports AMFI's legacy 6-column and current 8-column NAVAll.txt rows.
 * No customer data, secrets, or outbound writes are involved.
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseNavDate(value) {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value || "");
  if (!match) return null;
  const months = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" };
  const month = months[match[2].toLowerCase()];
  return month ? match[3] + "-" + month + "-" + match[1].padStart(2, "0") : null;
}

export async function onRequest({ request }) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().replace(/\s+/g, " ");
  if (query.length < 3) return json({ error: "Enter at least 3 characters to search." }, 400);
  if (query.length > 100) return json({ error: "Search is too long." }, 400);

  let upstream;
  try {
    upstream = await fetch("https://portal.amfiindia.com/spages/NAVAll.txt", {
      headers: { "Accept": "text/plain", "User-Agent": "Corbitrage-NAV-Explorer/1.0" },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
  } catch {
    return json({ error: "AMFI NAV data is temporarily unavailable. Please try again later." }, 502);
  }
  if (!upstream.ok) return json({ error: "AMFI NAV data is temporarily unavailable. Please try again later." }, 502);

  const raw = await upstream.text();
  if (raw.length > 8_000_000) return json({ error: "The AMFI data response was unexpectedly large." }, 502);
  const needle = query.toLocaleLowerCase("en-IN");
  const matches = [];
  let newestDate = null;

  for (const line of raw.split(/\r?\n/)) {
    const fields = line.trim().split(";");
    if (!/^\d{4,7}$/.test(fields[0] || "")) continue;
    let code, name, plan, option, nav, date;
    if (fields.length >= 8) {
      [code, , , name, plan, option, nav, date] = fields;
    } else if (fields.length >= 6) {
      [code, , , name, nav, date] = fields;
      plan = "";
      option = "";
    } else continue;

    if (!name || !date || !nav || !Number.isFinite(Number(nav)) || Number(nav) <= 0) continue;
    const normalizedDate = parseNavDate(date.trim());
    if (!normalizedDate) continue;
    if (!name.toLocaleLowerCase("en-IN").includes(needle) && code !== query) continue;
    if (!newestDate || normalizedDate > newestDate) newestDate = normalizedDate;
    matches.push({
      schemeCode: code,
      schemeName: name.trim(),
      plan: (plan || "").trim(),
      option: (option || "").trim(),
      nav: Number(nav).toFixed(4),
      navDate: normalizedDate,
      source: "AMFI",
    });
    if (matches.length >= 25) break;
  }

  return json({
    source: "Association of Mutual Funds in India (AMFI)",
    sourceUrl: "https://www.amfiindia.com/net-asset-value/nav-download",
    fetchedAt: new Date().toISOString(),
    results: matches,
    count: matches.length,
    message: matches.length ? undefined : "No matching schemes found. Try a shorter scheme name or scheme code.",
  });
}
