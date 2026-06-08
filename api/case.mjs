// Content cross-reference for karensafo.com /tools.
// Given a citation and the proposition you are relying on it for, this fetches
// the judgment and returns: (a) what the case is about, in the court's own
// opening words, and (b) the actual paragraphs that discuss your proposition,
// with their paragraph numbers, so you can confirm the case supports your point.
// It surfaces the evidence; it does not assert the conclusion. The barrister
// reads the passage and decides. That is deliberate: a tool built to defend
// against fabricated law must not itself assert law it could get wrong.

const DIVISION_PATH = {
  civ: "civ", crim: "crim", fam: "fam", ch: "ch", qb: "qb", kb: "kb",
  pat: "pat", admin: "admin", comm: "comm", tcc: "tcc", admlty: "admlty",
  iac: "iac", aac: "aac", lc: "lc", scco: "scco", ipec: "ipec",
};
const DIVISIONED = new Set(["ewhc", "ewca", "ukut", "ukftt"]);
const UK_NEUTRAL = /\[(\d{4})\]\s+(UKSC|UKPC|UKHL|EWCA|EWHC|EWFC|EWCOP|UKUT|UKFTT)\s+(?:(Civ|Crim|Fam|Ch|QB|KB|Pat|Admin|Comm|TCC|Admlty|IAC|AAC|LC|SCCO|IPEC)\s+)?(\d+)(?:\s*\(([A-Za-z]+)\))?/i;
const US_REPORTERS =
  "U\\.\\s?S\\.|S\\.\\s?Ct\\.|L\\.\\s?Ed\\.(?:\\s?2d)?|F\\.(?:\\s?(?:2d|3d|4th))?|F\\.\\s?Supp\\.(?:\\s?(?:2d|3d))?|Cal\\.(?:\\s?(?:2d|3d|4th|App\\.|Rptr\\.))?|N\\.\\s?[EWY]\\.(?:\\s?2d|\\s?3d)?|A\\.(?:\\s?(?:2d|3d))?|P\\.(?:\\s?(?:2d|3d))?|So\\.(?:\\s?(?:2d|3d))?";
const US_CITATION = new RegExp(`\\b(\\d{1,4})\\s+(${US_REPORTERS})\\s+(\\d{1,5})\\b`, "i");

const STOPWORDS = new Set([
  "the", "and", "that", "this", "with", "from", "for", "was", "were", "are", "has",
  "have", "had", "not", "but", "which", "their", "there", "where", "when", "what",
  "case", "court", "would", "could", "should", "shall", "must", "may", "any", "all",
  "such", "than", "then", "into", "upon", "under", "over", "they", "them", "his",
  "her", "its", "who", "whom", "whose", "been", "being", "also", "only", "more",
  "most", "some", "will", "can", "did", "does", "law", "para", "paragraph",
]);

function tokenize(proposition) {
  return [
    ...new Set(
      (proposition.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || []).filter(
        (w) => w.length >= 4 && !STOPWORDS.has(w)
      )
    ),
  ];
}

const stripHtml = (s) =>
  s.replace(/<[^>]+>/g, " ").replace(/&#?\w+;/g, " ").replace(/\s+/g, " ").trim();

function buildFindCaseLawUrl(year, court, divRaw, number) {
  const c = court.toLowerCase();
  const base = "https://caselaw.nationalarchives.gov.uk";
  if (!DIVISIONED.has(c)) return `${base}/${c}/${year}/${number}`;
  const div = divRaw ? DIVISION_PATH[divRaw.toLowerCase()] : null;
  if (!div) return null;
  return `${base}/${c}/${div}/${year}/${number}`;
}

function parseJudgment(html) {
  const m = html.match(/<article[\s\S]*?<\/article>/i);
  const a = m ? m[0] : html;
  const nums = [...a.matchAll(/class="[^"]*judgment-body__number[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/gi)].map((x) => stripHtml(x[1]));
  const txts = [...a.matchAll(/class="[^"]*judgment-body__text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => stripHtml(x[1]));
  const paras = [];
  for (let i = 0; i < txts.length; i++) {
    if (txts[i] && txts[i].length > 1) paras.push({ n: nums[i] || String(i + 1), text: txts[i] });
  }
  return paras;
}

function aboutFromParas(paras) {
  let about = "";
  for (const p of paras) {
    if (p.text.length < 25) continue;
    about += (about ? " " : "") + p.text;
    if (about.length > 320) break;
  }
  if (about.length > 360) about = about.slice(0, 357).replace(/\s+\S*$/, "") + "...";
  return about || null;
}

function rankPassages(paras, tokens, limit = 6) {
  if (tokens.length === 0) return [];
  const scored = paras.map((p) => {
    const low = p.text.toLowerCase();
    const matched = tokens.filter((t) => low.includes(t));
    return { ...p, score: matched.length, matched };
  });
  return scored
    .filter((p) => p.score > 0)
    .sort((x, y) => y.score - x.score || Number(x.n.replace(/\D/g, "")) - Number(y.n.replace(/\D/g, "")))
    .slice(0, limit)
    .map((p) => ({
      n: p.n,
      matched: p.matched,
      text: p.text.length > 600 ? p.text.slice(0, 597).replace(/\s+\S*$/, "") + "..." : p.text,
    }));
}

async function crossReferenceUk(citation, tokens) {
  const m = UK_NEUTRAL.exec(citation);
  const [, year, court, divPre, number, divPost] = m;
  const url = buildFindCaseLawUrl(year, court, divPre || divPost || null, number);
  if (!url) return { found: false, jurisdiction: "UK", note: "Could not construct an official URL for that citation." };
  const res = await fetch(url, { redirect: "follow" });
  if (res.status === 404) {
    return {
      found: false,
      jurisdiction: "UK",
      note: "That citation does not resolve on Find Case Law. Verify it exists first on the Verify tab, or check BAILII for older cases.",
      url: `https://www.bailii.org/cgi-bin/lucy_search_1.cgi?query=${encodeURIComponent(citation)}`,
    };
  }
  if (!res.ok) return { found: false, jurisdiction: "UK", note: `Could not reach the official record (HTTP ${res.status}).`, url };
  const html = await res.text();
  const tm = html.match(/<title>([^<]*)<\/title>/i);
  const name = tm ? tm[1].replace(/\s+/g, " ").replace(/\s*[-|]\s*Find Case Law.*$/i, "").replace(/\s*[-|]\s*The National Archives.*$/i, "").trim() : null;
  const paras = parseJudgment(html);
  return {
    found: true,
    jurisdiction: "UK",
    name,
    url,
    source: "Find Case Law (National Archives)",
    about: aboutFromParas(paras),
    totalParas: paras.length,
    passages: rankPassages(paras, tokens),
  };
}

async function crossReferenceUs(citation, tokens, token) {
  const headers = token ? { Authorization: `Token ${token}` } : {};
  const sUrl = `https://www.courtlistener.com/api/rest/v4/search/?type=o&q=${encodeURIComponent(`"${citation}"`)}`;
  const sRes = await fetch(sUrl, { headers });
  if (!sRes.ok) return { found: false, jurisdiction: "US", note: `Could not reach CourtListener (HTTP ${sRes.status}).` };
  const sData = await sRes.json();
  const target = citation.replace(/\s/g, "").toLowerCase();
  const exact = (sData.results || []).find((r) => (r.citation || []).some((c) => c.replace(/\s/g, "").toLowerCase() === target));
  const linkOut = `https://www.courtlistener.com/?q=${encodeURIComponent(`"${citation}"`)}&type=o`;
  if (!exact) {
    return {
      found: false,
      jurisdiction: "US",
      url: linkOut,
      note: token
        ? "No exact match for that citation in CourtListener."
        : "Could not pinpoint that case without a CourtListener token. Open the search link to check by hand, or add a free token for content cross-reference.",
    };
  }
  const name = exact.caseName;
  const url = `https://www.courtlistener.com${exact.absolute_url}`;
  const oRes = await fetch(`https://www.courtlistener.com/api/rest/v4/opinions/?cluster=${exact.cluster_id}`, { headers });
  let paras = [];
  if (oRes.ok) {
    const oData = await oRes.json();
    const o = (oData.results || [])[0] || {};
    const full = stripHtml(o.plain_text || o.html || o.html_with_citations || "");
    if (full) {
      paras = full
        .split(/(?<=\.)\s+(?=[A-Z])/)
        .reduce((acc, sentence) => {
          if (!acc.length || acc[acc.length - 1].text.length > 400) acc.push({ n: String(acc.length + 1), text: sentence });
          else acc[acc.length - 1].text += " " + sentence;
          return acc;
        }, []);
    }
  }
  return {
    found: true,
    jurisdiction: "US",
    name,
    url,
    source: "CourtListener / Free Law Project",
    about: paras.length ? aboutFromParas(paras) : null,
    totalParas: paras.length,
    passages: rankPassages(paras, tokens),
    note: paras.length
      ? "US passages are numbered by position in the opinion, not by the court's own paragraph numbers."
      : "The full opinion text was not available to search. Open the record to read it.",
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    const citation = ((body && body.citation) || "").trim();
    const proposition = ((body && body.proposition) || "").trim();
    if (!citation) {
      res.status(400).json({ error: "Enter a citation." });
      return;
    }
    if (!proposition) {
      res.status(400).json({ error: "Enter the proposition you are relying on the case for." });
      return;
    }
    const tokens = tokenize(proposition);
    const token = process.env.COURTLISTENER_TOKEN || null;
    let out;
    if (UK_NEUTRAL.test(citation)) out = await crossReferenceUk(citation, tokens);
    else if (US_CITATION.test(citation)) out = await crossReferenceUs(citation, tokens, token);
    else {
      res.status(400).json({ error: "Could not recognise a UK neutral citation or US reporter citation. Content cross-reference currently covers those." });
      return;
    }
    out.proposition = proposition;
    out.terms = tokens;
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: "Cross-reference failed.", detail: String(e) });
  }
}
