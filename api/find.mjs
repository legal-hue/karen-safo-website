// "Find a case" for karensafo.com /authority-checker.
// Runs the user's scenario as a real search against the official databases and
// returns genuine results only. It NEVER generates case names from a model:
// inventing authorities is the very harm this whole tool exists to prevent.
// Results are ranked by the source's own relevance and are a starting point,
// not a guarantee that a case is on point or remains good law. The user reads it.

const COURT_NAMES = {
  uksc: "Supreme Court",
  ukpc: "Privy Council",
  ukhl: "House of Lords",
  eat: "Employment Appeal Tribunal",
  "ewca/civ": "Court of Appeal (Civil Division)",
  "ewca/crim": "Court of Appeal (Criminal Division)",
  "ewhc/admin": "High Court (Administrative Court)",
  "ewhc/ch": "High Court (Chancery Division)",
  "ewhc/qb": "High Court (King's/Queen's Bench)",
  "ewhc/kb": "High Court (King's Bench Division)",
  "ewhc/fam": "High Court (Family Division)",
  "ewhc/comm": "High Court (Commercial Court)",
  "ewhc/tcc": "High Court (Technology and Construction)",
  "ewhc/ipec": "Intellectual Property Enterprise Court",
  "ewhc/pat": "High Court (Patents Court)",
  ewfc: "Family Court",
  ewcop: "Court of Protection",
  "ukut/iac": "Upper Tribunal (Immigration and Asylum)",
  "ukut/aac": "Upper Tribunal (Administrative Appeals)",
  "ukut/lc": "Upper Tribunal (Lands Chamber)",
  "ukut/tcc": "Upper Tribunal (Tax and Chancery)",
};

function courtFromUrl(url) {
  const m = url.match(/nationalarchives\.gov\.uk\/([a-z]+(?:\/[a-z]+)?)\//i);
  if (!m) return "";
  const key = m[1].toLowerCase();
  return COURT_NAMES[key] || key.toUpperCase().replace("/", " ");
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#?\w+;/g, " ");
}

async function findUk(scenario) {
  const url = `https://caselaw.nationalarchives.gov.uk/atom.xml?query=${encodeURIComponent(scenario)}`;
  const res = await fetch(url);
  if (!res.ok) return { jurisdiction: "UK", results: [], note: `Could not reach Find Case Law (HTTP ${res.status}).` };
  const xml = await res.text();
  const entries = xml.split(/<entry[\s>]/).slice(1);
  const results = entries.slice(0, 10).map((e) => {
    const title = decodeEntities(((e.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim());
    const link = ((e.match(/<link[^>]*href="([^"]+)"/i) || [])[1] || "").trim();
    const date = ((e.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || e.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) || [])[1] || "").trim().slice(0, 10);
    return { name: title, url: link, court: courtFromUrl(link), date };
  }).filter((r) => r.name && r.url);
  return {
    jurisdiction: "UK",
    source: "Find Case Law (The National Archives)",
    results,
    searchUrl: `https://caselaw.nationalarchives.gov.uk/judgments/search?query=${encodeURIComponent(scenario)}`,
  };
}

async function findUs(scenario, token) {
  const headers = token ? { Authorization: `Token ${token}` } : {};
  const url = `https://www.courtlistener.com/api/rest/v4/search/?type=o&order_by=score%20desc&q=${encodeURIComponent(scenario)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) return { jurisdiction: "US", results: [], note: `Could not reach CourtListener (HTTP ${res.status}).` };
  const data = await res.json();
  const results = (data.results || []).slice(0, 10).map((r) => ({
    name: r.caseName || "(unnamed)",
    url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : null,
    court: r.court || r.court_citation_string || "",
    date: (r.dateFiled || "").slice(0, 10),
    citation: (r.citation || [])[0] || "",
  })).filter((r) => r.url);
  return {
    jurisdiction: "US",
    source: "CourtListener / Free Law Project",
    results,
    searchUrl: `https://www.courtlistener.com/?q=${encodeURIComponent(scenario)}&type=o`,
  };
}

function findDe(scenario) {
  return {
    jurisdiction: "DE",
    source: "openJur",
    results: [],
    note: "There is no free comprehensive German case-law API, so search results cannot be listed here. Open the search links to look by hand.",
    searchUrl: `https://openjur.de/suche.html?q=${encodeURIComponent(scenario)}`,
    altSearchUrl: `https://www.rechtsprechung-im-internet.de/jportal/portal/page/bsjrsprod.psml?cmsuri=%2Fjuris%2Fde%2Frechtsprechung%2Findex.jsp`,
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
    const jurisdiction = ((body && body.jurisdiction) || "").toUpperCase();
    const scenario = ((body && body.scenario) || "").trim();
    if (!scenario) {
      res.status(400).json({ error: "Describe the scenario you are looking for." });
      return;
    }
    if (scenario.length > 500) {
      res.status(400).json({ error: "Please keep the description short." });
      return;
    }
    const token = process.env.COURTLISTENER_TOKEN || null;
    let out;
    if (jurisdiction === "UK") out = await findUk(scenario);
    else if (jurisdiction === "US") out = await findUs(scenario, token);
    else if (jurisdiction === "DE") out = findDe(scenario);
    else {
      res.status(400).json({ error: "Choose a jurisdiction: UK, US or Germany." });
      return;
    }
    out.scenario = scenario;
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: "Search failed.", detail: String(e) });
  }
}
