// Numista catalog lookup — corrects facts (issuer, year, composition) and finds the catalog entry.
// Testable in a browser: /.netlify/functions/price-coin?name=Bar-Kochba&country=Israel&year=1961
exports.handler = async (event) => {
  try {
    const p = event.httpMethod === "POST"
      ? JSON.parse(event.body || "{}")
      : (event.queryStringParameters || {});
    const { name = "", country = "", year = "", denomination = "" } = p;

    const key = process.env.NUMISTA_API_KEY;
    if (!key) return json(500, { error: "NUMISTA_API_KEY not set in Netlify" });

    const base = "https://api.numista.com/v3";
    const headers = { "Numista-API-Key": key, "Accept": "application/json" };

    // medals/tokens live under "exonumia"; notes under "banknote"; else "coin"
    const blob = (name + " " + denomination).toLowerCase();
    const category = /medal|token|exonumia/.test(blob) ? "exonumia"
                   : /note|banknote|bill/.test(blob) ? "banknote"
                   : "coin";

    const q = [name, country].filter(Boolean).join(" ").slice(0, 120);
    const searchURL = `${base}/types?lang=en&count=8&category=${category}&q=${encodeURIComponent(q)}`;
    const sres = await fetch(searchURL, { headers });
    const stext = await sres.text();
    if (!sres.ok) return json(sres.status, { error: "Numista search failed", status: sres.status, detail: stext.slice(0, 300) });

    let sdata = {};
    try { sdata = JSON.parse(stext); } catch (_) {}
    const types = sdata.types || [];
    if (!types.length) return json(200, { found: false, category, query: q });

    // prefer a type whose year range contains the coin's year
    let best = types[0];
    const y = parseInt(String(year).replace(/[^0-9]/g, "").slice(0, 4));
    if (y) {
      const hit = types.find(t => (t.min_year == null || y >= t.min_year) && (t.max_year == null || y <= t.max_year));
      if (hit) best = hit;
    }

    // pull full details for the best match
    let detail = {};
    try {
      const dres = await fetch(`${base}/types/${best.id}?lang=en`, { headers });
      if (dres.ok) detail = await dres.json();
    } catch (_) {}

    const composition = detail.composition ? (detail.composition.text || detail.composition.name || "") : "";

    return json(200, {
      found: true,
      source: "numista",
      n_number: best.id,
      title: best.title || detail.title || "",
      issuer: (best.issuer && best.issuer.name) || (detail.issuer && detail.issuer.name) || "",
      min_year: best.min_year ?? detail.min_year ?? null,
      max_year: best.max_year ?? detail.max_year ?? null,
      composition,
      url: `https://en.numista.com/catalogue/pieces${best.id}.html`,
      candidates: types.slice(0, 5).map(t => ({
        id: t.id, title: t.title,
        issuer: t.issuer && t.issuer.name,
        min_year: t.min_year, max_year: t.max_year
      }))
    });
  } catch (err) {
    return json(500, { error: String(err) });
  }
};

function json(status, obj) {
  return { statusCode: status, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) };
}
