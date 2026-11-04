# Ekstraklasa Insight

Statyczna strona analityczna dotycząca PKO BP Ekstraklasy, zbudowana w HTML, CSS i Vanilla JavaScript.

## Pliki
- `index.html` – struktura strony
- `style.css` – wygląd i responsywność
- `app.js` – logika interfejsu i pobieranie danych
- `config.js` – konfiguracja API
- `.github/workflows/deploy.yml` – automatyczne wdrażanie na GitHub Pages
- `.nojekyll` – wyłącza przetwarzanie Jekyll

## Publikacja na GitHub Pages
1. Utwórz nowe repozytorium i ustaw domyślną gałąź `main`.
2. Wgraj całą zawartość tego archiwum, łącznie z folderem `.github` i plikiem `.nojekyll`, do katalogu głównego repozytorium.
3. W repozytorium otwórz **Settings → Pages**.
4. W polu **Build and deployment → Source** wybierz **GitHub Actions**.
5. Workflow uruchomi się automatycznie po wypchnięciu plików na `main`. Wynik sprawdzisz w zakładce **Actions**.

## API
Klucz API wpisuje się w ustawieniach strony. Nie umieszczaj klucza w `config.js`, `app.js` ani w repozytorium publicznym. W tej wersji klucz jest przechowywany w `sessionStorage` przeglądarki.

`config.js` zawiera adres bazowy i limity pobierania. Ścieżki API używane w `app.js` wymagają potwierdzenia z aktualną dokumentacją i dostępem SportAPI.ai. Sama publikacja strony nie potwierdza poprawności ani dostępności tych endpointów. Jeśli dostawca zmienił schemat odpowiedzi, trzeba będzie dostosować mapowanie danych.

## Ważne
- To frontend statyczny; nie wymaga Node.js, npm ani procesu build.
- Analiza dyscyplinarna jest opisową heurystyką na podstawie dostępnej próbki, a nie prognozą prawdopodobieństwa.
- Statystyki sędziów nie są prezentowane jako potwierdzone, jeśli API ich nie udostępnia.


## Połączenie z SportAPI.ai przez Cloudflare Worker
1. Worker `ekstraklasa-api` powinien mieć sekret `SPORTAPI_KEY` w środowisku Production.
2. W Workerze ustaw kod z pliku `worker.js` i wdroż go.
3. `config.js` wskazuje na `https://ekstraklasa-api.mateuszgornicki3.workers.dev`.
4. Wgraj zaktualizowane `index.html`, `app.js` i `config.js` do repozytorium `bad-ekstra` i zatwierdź zmiany.
5. Po wdrożeniu sprawdź `https://ekstraklasa-api.mateuszgornicki3.workers.dev/api/leagues` w przeglądarce. Odpowiedź 401/403 oznacza problem z kluczem/uprawnieniami; odpowiedź JSON z danymi oznacza, że pośrednik odpowiada. Następnie sprawdź stronę.

Uwaga: endpointy i formaty odpowiedzi dostawcy muszą być zgodne z aktualną dokumentacją SportAPI.ai. Jeżeli API zwróci inne pola niż zakłada frontend, konieczne będzie dopasowanie mapowania.
