# Ekstraklasa Insight

Statyczna strona (HTML/CSS/Vanilla JS) publikowana przez GitHub Pages / Cloudflare Pages. Dane meczowe i tabela są pobierane przez Cloudflare Worker z SportAPI.ai. Statystyki sędziów są odczytywane z Cloudflare KV, zasilanego przez ręczny endpoint Worker.

## Publikacja strony

Wgraj zawartość tego folderu do głównego katalogu repozytorium GitHub (zachowując `.github/workflows/deploy.yml`). `index.html`, `app.js`, `style.css` i `config.js` muszą znajdować się obok siebie.

## Cloudflare Worker

Plik `worker.js` jest osobnym kodem do wklejenia w Cloudflare Workers. Po wdrożeniu zachowaj istniejące sekrety `SPORTAPI_KEY`, binding KV `REFEREE_CACHE` (namespace `EKSTRAKLASA_REFEREES`) i dodaj nowy sekret `REFEREE_REFRESH_TOKEN`.

Ręczne odświeżanie:

```powershell
$token = "TU_WSTAW_TOKEN"
Invoke-RestMethod -Uri "https://ekstraklasa-api.mateuszgornicki3.workers.dev/api/referees/refresh" -Method POST -Headers @{ Authorization = "Bearer $token" }
```

Odczyt danych (publiczny): `https://ekstraklasa-api.mateuszgornicki3.workers.dev/api/referees`

Cron nie jest wymagany do testu ręcznego. Po potwierdzeniu poprawnego zapisu do KV można ponownie dodać harmonogram `0 */6 * * *`.

## Bezpieczeństwo

Nie umieszczaj `SPORTAPI_KEY` ani `REFEREE_REFRESH_TOKEN` w plikach strony, GitHub ani publicznym JavaScript. Oba klucze powinny być sekretami w Cloudflare. Token ręcznego odświeżania używaj wyłącznie lokalnie w PowerShell.
