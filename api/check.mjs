// Authority verification for karensafo.com /tools.
// Self-contained (no imports) so it deploys on this static site with no build
// step. Confirms a cited case EXISTS and that its name matches its citation,
// against free official sources. It does NOT assert that a case is still good
// law: there is no free reliable noted-up service, and a false green light
// there would be the one way the tool could mislead.

const DIVISION_PATH = {
  civ: "civ", crim: "crim", fam: "fam", ch: "ch", qb: "qb", kb: "kb",
  pat: "pat", admin: "admin", comm: "comm", tcc: "tcc", admlty: "admlty",
  iac: "iac", aac: "aac", lc: "lc", scco: "scco", ipec: "ipec",
};
const DIVISIONED = new Set(["ewhc", "ewca", "ukut", "ukftt"]);

const UK_NEUTRAL = /\[(\d{4})\]\s+(UKSC|UKPC|UKHL|EWCA|EWHC|EWFC|EWCOP|UKUT|UKFTT)\s+(?:(Civ|Crim|Fam|Ch|QB|KB|Pat|Admin|Comm|TCC|Admlty|IAC|AAC|LC|SCCO|IPEC)\s+)?(\d+)(?:\s*\(([A-Za-z]+)\))?/gi;
const NAME_BEFORE = /([A-Z][A-Za-z'’.&()\- ]+?\s+v\.?\s+[A-Z][A-Za-z'’.&()\- ]+?)\s*\[/g;

function buildFindCaseLawUrl(year, court, divRaw, number) {
  const c = court.toLowerCase();
  const base = "https://caselaw.nationalarchives.gov.uk";
  if (!DIVISIONED.has(c)) return `${base}/${c}/${year}/${number}`;
  const div = divRaw ? DIVISION_PATH[divRaw.toLowerCase()] : null;
  if (!div) return null;
  return `${base}/${c}/${div}/${year}/${number}`;
}

// Pull the opening numbered paragraphs of a Find Case Law judgment to say, in
// the court's own words, what the case is about. Grounded, not generated.
function extractAbout(html) {
  const m = html.match(/<article[\s\S]*?<\/article>/i);
  const a = m ? m[0] : html;
  const strip = (s) =>
    s.replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();
  const txts = [...a.matchAll(/class="[^"]*judgment-body__text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => strip(x[1]));
  const meaningful = txts.filter((t) => t.length > 25);
  if (meaningful.length === 0) return null;
  let about = "";
  for (const t of meaningful) {
    about += (about ? " " : "") + t;
    if (about.length > 320) break;
  }
  if (about.length > 360) about = about.slice(0, 357).replace(/\s+\S*$/, "") + "...";
  return about || null;
}

async function fetchTitle(url) {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return { ok: false, status: res.status };
    const html = await res.text();
    const m = html.match(/<title>([^<]*)<\/title>/i);
    let title = m ? m[1] : null;
    if (title) {
      title = title
        .replace(/\s+/g, " ")
        .replace(/\s*[-|]\s*Find Case Law.*$/i, "")
        .replace(/\s*[-|]\s*The National Archives.*$/i, "")
        .trim();
    }
    return { ok: true, status: res.status, title, about: extractAbout(html) };
  } catch (e) {
    return { ok: false, status: 0, error: String(e) };
  }
}

function nameForCitation(text, citationIndex) {
  let best = null;
  NAME_BEFORE.lastIndex = 0;
  let m;
  while ((m = NAME_BEFORE.exec(text)) !== null) {
    const end = m.index + m[0].length;
    if (end <= citationIndex + 1 && end >= citationIndex - 1) best = m[1].trim();
  }
  return best;
}

function nameMatches(cited, official) {
  if (!cited || !official) return null;
  const tokens = cited
    .toLowerCase()
    .split(/\s+v\.?\s+/)[0]
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !["regina", "rex", "queen", "king"].includes(t));
  if (tokens.length === 0) return null;
  const off = official.toLowerCase();
  return tokens.some((t) => off.includes(t));
}

async function verifyUk(text) {
  const results = [];
  const seen = new Set();
  let m;
  UK_NEUTRAL.lastIndex = 0;
  while ((m = UK_NEUTRAL.exec(text)) !== null) {
    const raw = m[0].trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    const [, year, court, divPre, number, divPost] = m;
    const div = divPre || divPost || null;
    const url = buildFindCaseLawUrl(year, court, div, number);
    const citedName = nameForCitation(text, m.index);
    const entry = { raw, jurisdiction: "UK", type: "neutral citation", citedName: citedName || null, source: "Find Case Law (National Archives)" };

    if (!url) {
      entry.status = "check_manually";
      entry.note = "Divisioned court without a recognised division; verify by hand.";
      results.push(entry);
      continue;
    }
    const r = await fetchTitle(url);
    if (r.ok) {
      entry.status = "verified";
      entry.url = url;
      entry.officialName = r.title || null;
      if (r.about) entry.about = r.about;
      if (nameMatches(citedName, r.title) === false) {
        entry.nameUnconfirmed = true;
        entry.note = "Citation is genuine. The case name you used could not be matched to the official title, which is sometimes an abbreviated form. Compare the two names and confirm you have the right case.";
      }
    } else if (r.status === 404) {
      const bailii = `https://www.bailii.org/cgi-bin/lucy_search_1.cgi?query=${encodeURIComponent(raw)}`;
      const c = court.toUpperCase();
      const mainstream = ["UKSC", "UKPC", "EWCA", "EWHC", "EWFC", "EWCOP"].includes(c);
      entry.url = bailii;
      if (mainstream && Number(year) >= 2003) {
        entry.status = "not_found";
        entry.note = "A judgment of this court from 2003 onward would normally appear on Find Case Law, and this one does not. Treat as likely fabricated and confirm on BAILII (link) before relying on it.";
      } else {
        entry.status = "check_manually";
        entry.note = "Not on Find Case Law, whose coverage of pre-2003 cases and some tribunals is incomplete. This is not proof of fabrication. Confirm on BAILII (link) by hand.";
      }
    } else {
      entry.status = "unverified";
      entry.note = `Could not reach the official record (HTTP ${r.status}). Try again or check by hand.`;
      entry.url = url;
    }
    results.push(entry);
  }
  return results;
}

const US_REPORTERS =
  "U\\.\\s?S\\.|S\\.\\s?Ct\\.|L\\.\\s?Ed\\.(?:\\s?2d)?|F\\.(?:\\s?(?:2d|3d|4th))?|F\\.\\s?Supp\\.(?:\\s?(?:2d|3d))?|F\\.\\s?App'?x\\.?|Cal\\.(?:\\s?(?:2d|3d|4th|App\\.|Rptr\\.))?|N\\.\\s?[EWY]\\.(?:\\s?2d|\\s?3d)?|A\\.(?:\\s?(?:2d|3d))?|P\\.(?:\\s?(?:2d|3d))?|So\\.(?:\\s?(?:2d|3d))?|N\\.\\s?J\\.|Ill\\.(?:\\s?(?:2d|App\\.))?";
const US_CITATION = new RegExp(`\\b(\\d{1,4})\\s+(${US_REPORTERS})\\s+(\\d{1,5})\\b`, "g");
const normCite = (s) => s.replace(/\s+/g, " ").replace(/\s/g, "").toLowerCase();

async function lookupCourtListenerByToken(text, token) {
  const res = await fetch("https://www.courtlistener.com/api/rest/v3/citation-lookup/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Token ${token}` },
    body: new URLSearchParams({ text }).toString(),
  });
  if (!res.ok) throw new Error(`citation-lookup HTTP ${res.status}`);
  return res.json();
}

async function searchCourtListener(citation) {
  const url = `https://www.courtlistener.com/api/rest/v4/search/?type=o&q=${encodeURIComponent(`"${citation}"`)}`;
  const res = await fetch(url);
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  const results = (data.results || []).slice(0, 5);
  const target = normCite(citation);
  const exact = results.find((r) => (r.citation || []).some((c) => normCite(c) === target));
  return { ok: true, count: data.count, results, exact: exact || null };
}

async function verifyUs(text, token) {
  if (token) {
    try {
      const data = await lookupCourtListenerByToken(text, token);
      return (data || []).map((item) => {
        const found = item.status === 200 && item.clusters && item.clusters.length > 0;
        const top = found ? item.clusters[0] : null;
        return {
          raw: item.citation,
          jurisdiction: "US",
          type: "reporter citation",
          source: "CourtListener citation-lookup",
          status: found ? "verified" : "not_found",
          url: top ? `https://www.courtlistener.com${top.absolute_url}` : null,
          officialName: top ? top.case_name : null,
          note: found ? null : "Not recognised by CourtListener's citation database. Treat as fabricated until proven otherwise.",
        };
      });
    } catch (e) {
      // fall through to public search
    }
  }
  const results = [];
  const seen = new Set();
  let m;
  US_CITATION.lastIndex = 0;
  while ((m = US_CITATION.exec(text)) !== null) {
    const raw = m[0].replace(/\s+/g, " ").trim();
    if (seen.has(raw)) continue;
    seen.add(raw);
    const r = await searchCourtListener(raw);
    const entry = { raw, jurisdiction: "US", type: "reporter citation", source: "CourtListener search" };
    if (!r.ok) {
      entry.status = "unverified";
      entry.note = `Could not reach CourtListener (HTTP ${r.status}).`;
    } else if (r.exact) {
      entry.status = "verified";
      entry.url = `https://www.courtlistener.com${r.exact.absolute_url}`;
      entry.officialName = r.exact.caseName;
    } else if (r.count > 0) {
      entry.status = "check_manually";
      entry.url = `https://www.courtlistener.com/?q=${encodeURIComponent(`"${raw}"`)}&type=o`;
      entry.note = "Mentioned in the corpus but not found as any case's own citation. Confirm by hand, or add a free CourtListener token for exact checking.";
    } else {
      entry.status = "not_found";
      entry.note = "No match in CourtListener. Treat as fabricated until proven otherwise (add a free CourtListener token for stronger checking).";
    }
    results.push(entry);
  }
  return results;
}

const DE_AKTENZEICHEN = /\b([IVXL]{1,4}\s+(?:ZR|ZB|StR|AR|BvR|BvL|BvE|C|B|AZR|RAR|BLw)\s+\d+\/\d{2,4})\b/g;
const DE_REPORTER = /\b((?:NJW|NZA|NVwZ|GRUR|BGHZ|BVerfGE|BAGE)\s+\d+,\s*\d+)\b/g;

function verifyDe(text) {
  const results = [];
  const seen = new Set();
  const push = (raw) => {
    const r = raw.replace(/\s+/g, " ").trim();
    if (!r || seen.has(r)) return;
    seen.add(r);
    results.push({
      raw: r, jurisdiction: "DE", type: "german citation", source: "manual",
      status: "check_manually",
      url: `https://openjur.de/suche.html?q=${encodeURIComponent(r)}`,
      note: "No free comprehensive German API. Open the search link and confirm by hand. Also try rechtsprechung-im-internet.de.",
    });
  };
  let m;
  DE_AKTENZEICHEN.lastIndex = 0;
  while ((m = DE_AKTENZEICHEN.exec(text)) !== null) push(m[1]);
  DE_REPORTER.lastIndex = 0;
  while ((m = DE_REPORTER.exec(text)) !== null) push(m[1]);
  return results;
}

async function verifyText(text) {
  const token = process.env.COURTLISTENER_TOKEN || null;
  const [uk, us] = await Promise.all([verifyUk(text), verifyUs(text, token)]);
  const de = verifyDe(text);
  const all = [...uk, ...us, ...de];
  const summary = {
    total: all.length,
    verified: all.filter((r) => r.status === "verified").length,
    not_found: all.filter((r) => r.status === "not_found").length,
    name_to_confirm: all.filter((r) => r.nameUnconfirmed).length,
    check_manually: all.filter((r) => r.status === "check_manually").length,
    unverified: all.filter((r) => r.status === "unverified").length,
    usingCourtListenerToken: Boolean(token),
  };
  return { summary, results: all };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    const text = (body && body.text) || "";
    if (!text.trim()) {
      res.status(400).json({ error: "No text supplied." });
      return;
    }
    if (text.length > 200000) {
      res.status(413).json({ error: "Text too long (200k character limit)." });
      return;
    }
    const out = await verifyText(text);
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: "Verification failed.", detail: String(e) });
  }
}
