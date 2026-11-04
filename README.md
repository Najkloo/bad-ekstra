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
