// Huis-app bankbrug: Cloudflare Worker voor Enable Banking (PSD2, alleen lezen).
// Geheimen (Variables and Secrets in Cloudflare): EB_APP_ID, EB_KEY, HUIS_TOKEN
// Optioneel: APP_URL (adres van je Huis-app, bijv. https://naam.github.io/Huis/)

const EB = "https://api.enablebanking.com";
const BANKS = { abn: "ABN AMRO", ing: "ING" };

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const enc = (s) => b64u(new TextEncoder().encode(s));
const b64 = (s) => { const u = new TextEncoder().encode(s); let t = ""; u.forEach((c) => (t += String.fromCharCode(c))); return btoa(t); };

let keyPromise;
function signingKey(env) {
  if (!keyPromise) {
    const body = String(env.EB_KEY || "")
      .replace(/-----[^-]+-----/g, "")
      .replace(/\\n/g, "")
      .replace(/\s+/g, "");
    let raw;
    try { raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0)); } catch (e) { throw new Error("EB_KEY is geen geldige PEM-sleutel"); }
    keyPromise = crypto.subtle
      .importKey("pkcs8", raw, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"])
      .catch(() => { keyPromise = null; throw new Error("EB_KEY moet een PKCS8-sleutel zijn (begint met BEGIN PRIVATE KEY)"); });
  }
  return keyPromise;
}

async function makeJwt(env) {
  const iat = Math.floor(Date.now() / 1000);
  const head = enc(JSON.stringify({ typ: "JWT", alg: "RS256", kid: env.EB_APP_ID }));
  const pay = enc(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 }));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", await signingKey(env), new TextEncoder().encode(head + "." + pay));
  return head + "." + pay + "." + b64u(sig);
}

async function eb(env, path, method = "GET", body) {
  const r = await fetch(EB + path, {
    method,
    headers: { Authorization: "Bearer " + (await makeJwt(env)), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
  if (!r.ok) { const e = new Error((data && (data.message || data.error)) || "Enable Banking fout " + r.status); e.status = r.status; e.data = data; throw e; }
  return data;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", ...CORS } });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const page = (title, inner) => new Response(
  `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:16px system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#222}textarea{width:100%;height:110px;font-size:12px}button,a.b{display:inline-block;background:#2f6f5e;color:#fff;border:0;border-radius:10px;padding:12px 16px;font:inherit;text-decoration:none;margin:6px 6px 0 0}</style></head><body>${inner}</body></html>`,
  { headers: { "Content-Type": "text/html; charset=utf-8" } }
);

async function callback(url, env) {
  const err = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  if (err || !code) return page("Koppelen mislukt", `<h2>Koppelen mislukt</h2><p>${esc(url.searchParams.get("error_description") || err || "Geen code ontvangen van de bank.")}</p><p>Ga terug naar de app en probeer opnieuw.</p>`);
  try {
    const s = await eb(env, "/sessions", "POST", { code });
    const acc = (s.accounts || []).map((a) => ({
      uid: a.uid,
      iban: (a.account_id && a.account_id.iban) || a.iban || "",
      name: a.name || a.details || "",
    }));
    const payload = b64(JSON.stringify({ st: url.searchParams.get("state") || "", acc, until: (s.access && s.access.valid_until) || "", sid: s.session_id || "" }));
    const link = env.APP_URL ? env.APP_URL.replace(/#.*$/, "") + "#bank=" + encodeURIComponent(payload) : "";
    return page("Gekoppeld", `<h2>Gekoppeld ✓</h2><p>${acc.length} rekening(en) gekoppeld.</p>
${link ? `<a class="b" href="${esc(link)}">Open Huis-app</a>` : ""}
<p style="margin-top:20px">Gebruik je de Huis-app op Android? Kopieer dan deze bankcode en plak hem in de app bij Budget → Bankkoppeling.</p>
<textarea id="c" readonly>${esc(payload)}</textarea><br><button onclick="c.select();navigator.clipboard&&navigator.clipboard.writeText(c.value)">Kopieer bankcode</button>`);
  } catch (e) {
    return page("Koppelen mislukt", `<h2>Koppelen mislukt</h2><p>${esc(e.message)}</p>`);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname === "/callback") return await callback(url, env);

      if (request.headers.get("Authorization") !== "Bearer " + env.HUIS_TOKEN || !env.HUIS_TOKEN)
        return json({ error: "Niet toegestaan (controleer het wachtwoord)" }, 401);

      if (url.pathname === "/health") {
        const a = await eb(env, "/application");
        return json({ ok: true, app: a.name || a.app_id || "ok" });
      }

      if (url.pathname === "/banks") {
        const a = await eb(env, "/aspsps?country=NL");
        return json({ banks: (a.aspsps || []).map((b) => b.name) });
      }

      if (url.pathname === "/auth" && request.method === "POST") {
        const { bank, scope } = await request.json();
        const name = BANKS[bank];
        if (!name) return json({ error: "Onbekende bank" }, 400);
        const rand = crypto.randomUUID().slice(0, 8);
        const valid = new Date(Date.now() + 90 * 86400000).toISOString();
        const r = await eb(env, "/auth", "POST", {
          access: { valid_until: valid },
          aspsp: { name, country: "NL" },
          state: `${bank}~${scope || "joint"}~${rand}`,
          redirect_url: url.origin + "/callback",
          psu_type: "personal",
        });
        return json({ url: r.url });
      }

      if (url.pathname === "/transactions") {
        const account = url.searchParams.get("account");
        const from = url.searchParams.get("from");
        if (!account) return json({ error: "account ontbreekt" }, 400);
        const out = [];
        let ck = null;
        for (let i = 0; i < 20; i++) {
          const q = new URLSearchParams();
          if (from) q.set("date_from", from);
          if (ck) q.set("continuation_key", ck);
          const r = await eb(env, `/accounts/${encodeURIComponent(account)}/transactions?${q}`);
          for (const t of r.transactions || []) {
            if (t.credit_debit_indicator !== "DBIT") continue;
            if (t.status && t.status !== "BOOK") continue;
            const amt = parseFloat(t.transaction_amount && t.transaction_amount.amount);
            const date = t.booking_date || t.transaction_date || t.value_date;
            if (!amt || !date) continue;
            const rem = (t.remittance_information || []).join(" ").replace(/\s+/g, " ").trim();
            const who = (t.creditor && t.creditor.name) || "";
            out.push({ date, amount: Math.abs(amt), text: (who || rem || "Bankafschrijving").slice(0, 48), desc: rem, id: t.entry_reference || "" });
          }
          ck = r.continuation_key;
          if (!ck) break;
        }
        return json({ transactions: out });
      }

      return json({ error: "Niet gevonden" }, 404);
    } catch (e) {
      return json({ error: e.message || String(e), detail: e.data || null }, e.status && e.status >= 400 && e.status < 600 ? e.status : 500);
    }
  },
};
