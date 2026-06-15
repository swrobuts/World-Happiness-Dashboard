// ============================================================
//  data.js — Datenzugriffsschicht
//  Aufgabe: Happiness-Daten paginiert aus Supabase (PostgREST) laden,
//  in die vom Frontend erwartete Struktur transformieren, global
//  bereitstellen und anschließend die Präsentationsschicht (app.js) starten.
//
//  Trennung der Verantwortlichkeiten:
//    config.js  -> Verbindungsdaten
//    data.js    -> Beschaffung + Transformation  (diese Datei)
//    app.js     -> Darstellung + Interaktion
// ============================================================

(async function bootstrap(){
  const cfg = window.WHI_CONFIG;
  const statusEl = document.getElementById("dataStatus");

  function setStatus(msg){ if(statusEl) statusEl.textContent = msg; }

  // ---- Paginiertes Laden über den PostgREST Range-Header ----
  async function loadRows(){
    const PAGE = cfg.PAGE_SIZE;
    let rows = [], from = 0;
    for(;;){
      const url = `${cfg.SUPABASE_URL}/rest/v1/${cfg.TABLE}`
        + `?select=country,code,year,cantril_ladder_score`
        + `&order=country.asc,year.asc`;
      const res = await fetch(url, {
        headers: {
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`,
          Range: `${from}-${from + PAGE - 1}`
        }
      });
      if(!res.ok){
        throw new Error(`Supabase HTTP ${res.status}: ${await res.text()}`);
      }
      const batch = await res.json();
      if(!Array.isArray(batch)){
        throw new Error("Unerwartete Antwort: " + JSON.stringify(batch).slice(0,200));
      }
      rows = rows.concat(batch);
      if(batch.length < PAGE) break;   // letzte (Teil-)Seite erreicht
      from += PAGE;
    }
    return rows;
  }

  // ---- Transformation: flache Zeilen -> { countries:{…}, years:[…] } ----
  function transform(rows){
    const countries = {}, yearSet = new Set();
    for(const r of rows){
      const n = r.country;
      if(!countries[n]) countries[n] = { code: r.code, series: [] };
      countries[n].series.push([r.year, r.cantril_ladder_score]);
      yearSet.add(r.year);
    }
    // Sicherstellen, dass jede Zeitreihe chronologisch sortiert ist
    for(const n in countries) countries[n].series.sort((a,b)=>a[0]-b[0]);
    const years = [...yearSet].sort((a,b)=>a-b);
    return { countries, years };
  }

  // ---- app.js erst NACH dem Befüllen der Daten dynamisch laden ----
  function startApp(){
    return new Promise((resolve, reject)=>{
      const s = document.createElement("script");
      s.src = "app.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("app.js konnte nicht geladen werden"));
      document.body.appendChild(s);
    });
  }

  try {
    setStatus("Lade Daten aus der Datenbank …");
    const rows = await loadRows();
    window.__WHI_DATA__ = transform(rows);
    setStatus("");
    await startApp();
  } catch(err){
    console.error(err);
    setStatus("Daten konnten nicht geladen werden: " + err.message);
  }
})();
