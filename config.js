// ============================================================
//  config.js — Verbindungsdaten zur Datenhaltung (Supabase)
//  Wird vor app.js geladen und stellt window.WHI_CONFIG bereit.
//  Der anon-Key ist bewusst öffentlich: Zugriff ist durch die
//  Row-Level-Security-Policy "public read access" (nur SELECT)
//  abgesichert. Niemals den service_role-Key hier eintragen.
// ============================================================
window.WHI_CONFIG = {
  SUPABASE_URL: "https://zdrksbchsjcbfzomessv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkcmtzYmNoc2pjYmZ6b21lc3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDY2NjIsImV4cCI6MjA5NTg4MjY2Mn0.y0eBDnvkoJUz4KElxW6_nggDPerKJsCgUE5NWSPNiAE",
  TABLE: "happiness",
  PAGE_SIZE: 1000   // PostgREST-Standardobergrenze pro Anfrage
};
