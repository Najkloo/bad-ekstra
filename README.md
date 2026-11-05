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
Klucz API jest przechowywany jako sekret `SPORTAPI_KEY` w Cloudflare Worker. Nie umieszczaj go w repozytorium ani w plikach frontendowych.

`config.js` zawiera adres bazowy i limity pobierania. Ścieżki API używane w `app.js` wymagają potwierdzenia z aktualną dokumentacją i dostępem SportAPI.ai. Sama publikacja strony nie potwierdza poprawności ani dostępności tych endpointów. Jeśli dostawca zmienił schemat odpowiedzi, trzeba będzie dostosować mapowanie danych.

## Ważne
- To frontend statyczny; nie wymaga Node.js, npm ani procesu build.
- Analiza dyscyplinarna jest opisową heurystyką na podstawie dostępnej próbki, a nie prognozą prawdopodobieństwa.
- Statystyki sędziów nie są prezentowane jako potwierdzone, jeśli API ich nie udostępnia.


## Połączenie z SportAPI.ai przez Cloudflare Worker
1. Worker `ekstraklasa-api` powinien mieć sekret `SPORTAPI_KEY` w środowisku Production.
2. W Workerze ustaw kod z pliku `worker.js` i wdroż go.
3. `config.js` wskazuje na `https://ekstraklasa-api.mateuszgornicki3.workers.dev/api`.
4. Wgraj zaktualizowane `index.html`, `app.js` i `config.js` do repozytorium `bad-ekstra` i zatwierdź zmiany.
5. Po wdrożeniu sprawdź `https://ekstraklasa-api.mateuszgornicki3.workers.dev/api/leagues` w przeglądarce. Odpowiedź 401/403 oznacza problem z kluczem/uprawnieniami; odpowiedź JSON z danymi oznacza, że pośrednik odpowiada. Następnie sprawdź stronę.

Uwaga: endpointy i formaty odpowiedzi dostawcy muszą być zgodne z aktualną dokumentacją SportAPI.ai. Jeżeli API zwróci inne pola niż zakłada frontend, konieczne będzie dopasowanie mapowania.


## Statystyki sezonowe
- Ranking kartek i fauli pobiera zakończone mecze od 1 lipca bieżącego sezonu do dnia uruchomienia.
- Dla każdego zakończonego spotkania pobierane są statystyki meczu; liczby w tabeli są sumami sezonowymi, a wykresy pokazują TOP 10 drużyn.
- To oznacza większą liczbę zapytań do API podczas pierwszego ładowania. Przy obecnym limicie 2 000 zapytań dziennie pobranie sezonu powinno mieścić się w limicie, ale zależy od liczby rozegranych spotkań i limitów dostawcy.
- W terminarzu statystyki kartek i fauli są dociągane dla zakończonych lub trwających spotkań, jeśli dostawca je udostępnia.
- Herby są wyświetlane, gdy API zwraca adres logo drużyny; w przeciwnym razie widoczny jest skrót nazwy.


## Statystyki sędziów – Zawód Typer

SportAPI.ai pozostaje głównym źródłem tabeli, terminarza, wyników i statystyk drużyn. Statystyki sędziów są obsługiwane oddzielnie przez Cloudflare Worker.

### Cloudflare bindings i sekrety

W środowisku Production Workera `ekstraklasa-api` skonfiguruj:

- KV Namespace binding: `REFEREE_CACHE` → `EKSTRAKLASA_REFEREES`
- Secret: `SPORTAPI_KEY` (istniejący sekret pozostaje bez zmian)

Nie dodawaj kluczy API ani ciasteczek sesyjnych Zawód Typer do repozytorium, plików frontendowych ani kodu Workera.

### Harmonogram

W Cloudflare → Workers & Pages → `ekstraklasa-api` → Settings → Triggers → Cron Triggers dodaj:

- Cron expression: `0 */6 * * *`
- Oznacza to uruchomienie o minutach 0 co 6 godzin (UTC).

### Endpoint

- `GET /api/referees` – odczytuje ostatni poprawnie zapisany snapshot z KV.
- Harmonogram pobiera dane ligi `106` z endpointu JSON Zawód Typer i zapisuje je w KV.
- Worker nie odtwarza ciasteczek ani prywatnej sesji przeglądarki.
- Niepoprawna odpowiedź lub błąd pobierania nie nadpisuje ostatniego poprawnego snapshotu.

Automatyczne pobieranie należy włączyć wyłącznie wtedy, gdy warunki serwisu lub uzyskana zgoda pozwalają na takie wykorzystanie danych. Pierwsze uruchomienie Cron można zweryfikować w Cloudflare → Observability → Logs. Frontend nie został jeszcze przełączony na prezentowanie profili sędziów; endpoint jest przygotowany jako osobny etap integracji.
