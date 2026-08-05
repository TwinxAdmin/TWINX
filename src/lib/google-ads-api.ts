// Google Ads REST API (v16) natív integráció — OAuth token-kezelés + kampány-építés.
// SZERVEROLDALI. Env: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_OAUTH_CLIENT_ID,
// GOOGLE_ADS_OAUTH_CLIENT_SECRET, opcionálisan GOOGLE_ADS_LOGIN_CUSTOMER_ID (MCC).

const GADS = "https://googleads.googleapis.com/v16";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GADS_SCOPE = "https://www.googleapis.com/auth/adwords";

export function gadsEnv() {
  return {
    devToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    clientId: process.env.GOOGLE_ADS_OAUTH_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_ADS_OAUTH_CLIENT_SECRET || "",
    loginCustomerId: (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || "").replace(/\D/g, ""),
  };
}

export function oauthConfigured(): boolean {
  const e = gadsEnv();
  return Boolean(e.clientId && e.clientSecret && e.devToken);
}

/** Az OAuth beleegyező URL a fiók összekötéséhez. */
export function buildAuthUrl(redirectUri: string, state: string): string {
  const e = gadsEnv();
  const p = new URLSearchParams({
    client_id: e.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GADS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

/** Auth code -> tokenek (refresh_token-t is kér). */
export async function exchangeCode(code: string, redirectUri: string) {
  const e = gadsEnv();
  const body = new URLSearchParams({
    code,
    client_id: e.clientId,
    client_secret: e.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`OAuth token-csere hiba (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as { access_token: string; refresh_token?: string };
}

/** Refresh token -> friss access token. */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const e = gadsEnv();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: e.clientId,
    client_secret: e.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`OAuth frissítés hiba (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const d = (await res.json()) as { access_token: string };
  return d.access_token;
}

function headers(accessToken: string): Record<string, string> {
  const e = gadsEnv();
  const h: Record<string, string> = {
    "developer-token": e.devToken,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  if (e.loginCustomerId) h["login-customer-id"] = e.loginCustomerId;
  return h;
}

/** Elérhető ügyfél-fiókok (a customer_id automatikus kitöltéséhez). */
export async function listAccessibleCustomers(accessToken: string): Promise<string[]> {
  const res = await fetch(`${GADS}/customers:listAccessibleCustomers`, { headers: headers(accessToken) });
  if (!res.ok) throw new Error(`listAccessibleCustomers hiba (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const d = (await res.json()) as { resourceNames?: string[] };
  return (d.resourceNames ?? []).map((r) => r.replace("customers/", ""));
}

async function mutate(customerId: string, service: string, operations: unknown[], accessToken: string, label: string) {
  const cid = String(customerId).replace(/\D/g, "");
  const res = await fetch(`${GADS}/customers/${cid}/${service}:mutate`, {
    method: "POST",
    headers: headers(accessToken),
    body: JSON.stringify({ operations }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`[GOOGLE] „${label}" hiba (${res.status}): ${txt.slice(0, 500)}`);
  }
  return (await res.json()) as { results: Array<{ resourceName: string }> };
}

/** A célzott lokáció feloldása geoTargetConstant resourceName-re (best-effort). */
async function geoResourceName(locationName: string, accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(`${GADS}/geoTargetConstants:suggest`, {
      method: "POST",
      headers: headers(accessToken),
      body: JSON.stringify({ locale: "hu", countryCode: "HU", locationNames: { names: [locationName] } }),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { geoTargetConstantSuggestions?: Array<{ geoTargetConstant?: { resourceName?: string } }> };
    return d.geoTargetConstantSuggestions?.[0]?.geoTargetConstant?.resourceName ?? null;
  } catch {
    return null;
  }
}

// ---- CSV -> struktúra ----
export type ParsedGoogleAds = {
  campaignName: string;
  adGroupName: string;
  finalUrl: string;
  headlines: string[];
  descriptions: string[];
  keywords: Array<{ text: string; matchType: "PHRASE" | "EXACT" | "BROAD" }>;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ";" && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** A modul által adott pontosvesszős CSV visszaparse-olása kampány-struktúrává. */
export function parseGoogleAdsCsv(csv: string): ParsedGoogleAds | null {
  const lines = String(csv ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => header.indexOf(name.toLowerCase());
  const iCampaign = col("campaign");
  const iAdGroup = col("ad group");
  const iKeyword = col("keyword");
  const iCrit = col("criterion type");
  const iH1 = col("headline 1"), iH2 = col("headline 2"), iH3 = col("headline 3");
  const iD1 = col("description 1"), iD2 = col("description 2");
  const iUrl = col("final url");
  if (iKeyword < 0 || iH1 < 0 || iUrl < 0) return null;

  const rows = lines.slice(1).map(splitCsvLine).filter((r) => r.length >= header.length - 1);
  if (!rows.length) return null;

  const first = rows[0];
  const mt = (v: string): "PHRASE" | "EXACT" | "BROAD" => {
    const s = (v || "").toUpperCase();
    return s.includes("EXACT") ? "EXACT" : s.includes("BROAD") ? "BROAD" : "PHRASE";
  };
  const headlines = [first[iH1], first[iH2], first[iH3]].map((s) => (s || "").slice(0, 30)).filter(Boolean);
  const descriptions = [first[iD1], first[iD2]].map((s) => (s || "").slice(0, 90)).filter(Boolean);
  const keywords = rows
    .map((r) => ({ text: (r[iKeyword] || "").replace(/^"|"$/g, "").trim(), matchType: mt(r[iCrit]) }))
    .filter((k) => k.text);

  return {
    campaignName: (iCampaign >= 0 ? first[iCampaign] : "") || "Konkrét Ingatlanok",
    adGroupName: (iAdGroup >= 0 ? first[iAdGroup] : "") || "Ad Group",
    finalUrl: first[iUrl] || "",
    headlines,
    descriptions,
    keywords,
  };
}

function gDate(d: string | Date): string {
  const dt = d instanceof Date ? d : new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

// ---- Kampány felépítése (Search, PAUSED) ----
export type CreateInput = {
  customerId: string;
  accessToken: string;
  parsed: ParsedGoogleAds;
  dailyBudgetHuf: number;
  endDate: string; // YYYY-MM-DD
  locationName?: string;
};

export async function createSearchCampaign(input: CreateInput) {
  const { customerId, accessToken, parsed } = input;
  const out: Record<string, string | number | undefined> = {};

  // 1) Költségkeret
  const budget = await mutate(customerId, "campaignBudgets", [{
    create: {
      name: `${parsed.campaignName} – budget ${Date.now()}`,
      amountMicros: Math.round(Number(input.dailyBudgetHuf) * 1_000_000),
      deliveryMethod: "STANDARD",
      explicitlyShared: false,
    },
  }], accessToken, "Költségkeret");
  const budgetRN = budget.results[0].resourceName;
  out.budget = budgetRN;

  // 2) Kampány (SEARCH, PAUSED, endDate)
  const campaign = await mutate(customerId, "campaigns", [{
    create: {
      name: `${parsed.campaignName} – ${Date.now()}`,
      status: "PAUSED",
      advertisingChannelType: "SEARCH",
      campaignBudget: budgetRN,
      networkSettings: {
        targetGoogleSearch: true, targetSearchNetwork: true,
        targetContentNetwork: false, targetPartnerSearchNetwork: false,
      },
      manualCpc: {},
      startDate: gDate(new Date()),
      endDate: gDate(input.endDate),
    },
  }], accessToken, "Kampány");
  const campaignRN = campaign.results[0].resourceName;
  out.campaign = campaignRN;

  // 3) Geo célzás (best-effort, kampány-szinten)
  if (input.locationName) {
    const geoRN = await geoResourceName(input.locationName, accessToken);
    if (geoRN) {
      try {
        await mutate(customerId, "campaignCriteria", [{
          create: { campaign: campaignRN, location: { geoTargetConstant: geoRN } },
        }], accessToken, "Geo célzás");
        out.geo = geoRN;
      } catch { /* a geo hiánya ne buktassa az egészet */ }
    }
  }

  // 4) Hirdetéscsoport
  const adGroup = await mutate(customerId, "adGroups", [{
    create: { name: parsed.adGroupName, campaign: campaignRN, status: "PAUSED", type: "SEARCH_STANDARD", cpcBidMicros: 50_000_000 },
  }], accessToken, "Hirdetéscsoport");
  const adGroupRN = adGroup.results[0].resourceName;
  out.adGroup = adGroupRN;

  // 5) Kulcsszavak
  if (parsed.keywords.length) {
    const ops = parsed.keywords.map((k) => ({
      create: { adGroup: adGroupRN, status: "ENABLED", keyword: { text: k.text, matchType: k.matchType } },
    }));
    const kw = await mutate(customerId, "adGroupCriteria", ops, accessToken, "Kulcsszavak");
    out.keywords = kw.results.length;
  }

  // 6) RSA (min. 3 címsor + 2 leírás — a CSV ennyit ad)
  const headlines = parsed.headlines.length >= 3 ? parsed.headlines : [...parsed.headlines, "Nézze meg most", "Kérjen időpontot", "Ingatlan eladó"].slice(0, 3);
  const descriptions = parsed.descriptions.length >= 2 ? parsed.descriptions : [...parsed.descriptions, "Kattintson a részletekért és vegye fel velünk a kapcsolatot még ma!"].slice(0, 2);
  const ad = await mutate(customerId, "adGroupAds", [{
    create: {
      adGroup: adGroupRN,
      status: "PAUSED",
      ad: {
        finalUrls: [parsed.finalUrl],
        responsiveSearchAd: {
          headlines: headlines.map((text) => ({ text: text.slice(0, 30) })),
          descriptions: descriptions.map((text) => ({ text: text.slice(0, 90) })),
        },
      },
    },
  }], accessToken, "RSA hirdetés");
  out.ad = ad.results[0].resourceName;

  return out;
}
