/* Publiczna konfiguracja frontendu. Klucz API jest przechowywany wyłącznie w Cloudflare Worker. */
window.APP_CONFIG = {
  API_BASE: "https://ekstraklasa-api.mateuszgornicki3.workers.dev",
  LEAGUE_NAME: "Ekstraklasa",
  REFRESH_MINUTES: 5,
  MAX_MATCH_STATS_PER_REFRESH: 10
};
