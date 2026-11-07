# Ekstraklasa Insight — wersja analityczna

Statyczna strona HTML/CSS/JavaScript dla GitHub Pages / Cloudflare Pages.

## Pliki
- `index.html` — widok strony i sekcje analityczne
- `style.css` — układ dwukolumnowy, tabele, terminarz i wersja mobilna
- `app.js` — pobieranie danych, analiza sezonu, prognozy i statystyki sędziów
- `config.js` — publiczny adres API Workera (bez kluczy)
- `worker.js` — aktualny Worker z ręcznym odświeżaniem i zapisem danych sędziów w KV
- `.github/workflows/deploy.yml` — wdrożenie GitHub Pages

## Wdrożenie
Zastąp pliki w repozytorium `Najkloo/bad-ekstra` zawartością tej paczki, zachowując strukturę `.github/workflows/`, a następnie wykonaj commit.

Nie zmieniaj `SPORTAPI_KEY`, `REFEREE_CACHE` ani `REFEREE_REFRESH_TOKEN` w Cloudflare. Sekrety pozostają wyłącznie w Workerze.

## Ważne informacje o sędziach
- Statystyki sezonowe sędziów są pobierane z `GET /api/referees`.
- Tabela sędziów ma wyszukiwarkę i sortowanie.
- Informacja o sędzim przypisanym do konkretnego spotkania jest wyświetlana wyłącznie, jeśli dostawca terminarza zwróci nazwisko arbitra w danych meczu.
- Jeśli obsada nie jest dostępna w SportAPI, strona uczciwie pokazuje brak potwierdzonej informacji — nie przypisuje arbitra na podstawie domysłów.
- W ręcznym analizatorze można wybrać sędziego z listy. Jego średnia liczba żółtych kartek koryguje prognozę z wagą 25% względem średniej sędziowskiej ligi. Jest to eksperymentalna korekta opisowa, nie model wytrenowany na danych mecz-po-meczu.
- Prognoza terminarza nadal bazuje na statystykach drużyn. Dane sędziego są prezentowane osobno, gdy brak potwierdzonej obsady.

## Aktualizacja danych
Automatyczne odświeżanie sędziów jest obsługiwane przez Cron Trigger w Cloudflare. Harmonogram co 6 godzin: `0 */6 * * *`.
