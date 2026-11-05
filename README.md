# Ekstraklasa Insight

Statyczna strona analityczna PKO BP Ekstraklasy (HTML, CSS, Vanilla JavaScript) oraz Cloudflare Worker jako bezpieczny proxy API.

## Źródła danych
- **SportAPI.ai** pozostaje głównym źródłem tabeli, terminarza, wyników i statystyk drużyn. Wymagany sekret Cloudflare: `SPORTAPI_KEY`.
- **Zawód Typer** jest przygotowany jako osobne źródło statystyk sędziowskich. Worker odczytuje zapisany snapshot przez `GET /api/referees`; zadanie Cron pobiera dane co 6 godzin.
- SoccersAPI zostało usunięte z kodu i konfiguracji.

## Konfiguracja Cloudflare
1. Wgraj `worker.js` do Workera `ekstraklasa-api`.
2. Zachowaj sekret `SPORTAPI_KEY` w środowisku Production.
3. Utwórz KV namespace, np. `EKSTRA_REFEREES`, i dodaj binding o nazwie `REFEREE_KV`.
4. Dodaj zmienną środowiskową `ZAWOD_TYPER_LEAGUE_ID` z potwierdzonym identyfikatorem ligi Ekstraklasy. Nie wpisuj `140` z przykładowego podglądu — tamte dane zawierały hiszpańskich arbitrów.
5. W ustawieniach Worker → Triggers → Cron Triggers dodaj `0 */6 * * *` (UTC).
6. Zaktualizuj pliki frontendu w repozytorium GitHub Pages.

## Ważne przed uruchomieniem importu
`NP_ajax.php` jest wewnętrznym, nieudokumentowanym endpointem używanym przez stronę Zawód Typer. Kod integracji jest przygotowany, ale automatyczne wykorzystanie tego endpointu w zewnętrznym projekcie należy uruchomić dopiero po potwierdzeniu warunków/licencji przez właściciela serwisu oraz ustaleniu prawidłowego `league_id` dla Ekstraklasy. Do tego czasu nie ustawiaj Cron Triggera ani identyfikatora ligi. Nie obchodzimy zabezpieczeń, logowania ani limitów serwisu.

## Zachowanie danych
Cron zapisuje nowy snapshot dopiero po otrzymaniu poprawnej, niepustej tablicy rekordów. Przy błędzie poprzedni snapshot w KV pozostaje bez zmian. Frontend nie odpytuje Zawód Typer bezpośrednio.

## Publikacja
Frontend jest statyczny i nie wymaga Node.js ani procesu build. Worker wymaga `SPORTAPI_KEY`, bindingu KV `REFEREE_KV` oraz — po uzyskaniu zgody i weryfikacji — `ZAWOD_TYPER_LEAGUE_ID` i harmonogramu Cron.
