# Zrzut Strony (Chrome Extension)

Wtyczka do Chrome robiąca zrzuty ekranu stron www — działa jak **GoFullPage**:
- **Cała strona** — przewija stronę i skleja kolejne kadry w jeden długi obraz PNG.
- **Zaznacz fragment** — przeciągnięciem myszy wybierasz dokładny obszar strony do zrzutu.
- **Widoczny obszar** — szybki zrzut tego, co aktualnie widać w oknie przeglądarki.

Po wykonaniu zrzutu otwiera się nowa karta z podglądem, przyciskiem **Pobierz PNG** oraz **Kopiuj do schowka**.

## Instalacja (tryb dewelopera / rozszerzenie rozpakowane)

1. Otwórz w Chrome: `chrome://extensions`
2. Włącz przełącznik **Tryb dewelopera** (prawy górny róg).
3. Kliknij **Wczytaj rozpakowane** (Load unpacked).
4. Wskaż folder `chrome-screenshot-extension`.
5. Ikonka wtyczki pojawi się na pasku narzędzi — przypnij ją dla wygody.

## Użycie

- Kliknij ikonę wtyczki i wybierz jedną z trzech opcji.
- Skróty klawiszowe: `Ctrl+Shift+S` (zaznacz fragment), `Ctrl+Shift+F` (cała strona) — można je zmienić w `chrome://extensions/shortcuts`.
- Podczas zaznaczania fragmentu: przeciągnij myszą, aby narysować obszar; `Esc` anuluje.
- Podczas zrzutu całej strony widoczny jest pasek postępu; elementy `position: fixed`/`sticky` (np. sticky nagłówki) są tymczasowo ukrywane, żeby nie powielały się w sklejonym obrazie.

## Struktura projektu

```
chrome-screenshot-extension/
├── manifest.json      # Manifest V3
├── background.js      # Service worker: przechwytywanie karty, komunikacja, zapis wyniku
├── content.js          # Wstrzykiwany do strony: zaznaczanie obszaru + przewijanie/sklejanie
├── content.css          # Style nakładki zaznaczania i paska postępu
├── popup.html/js/css    # Interfejs klikany z paska narzędzi
├── result.html/js       # Karta wyniku: podgląd, pobieranie PNG, kopiowanie do schowka
└── icons/                # Ikony 16/32/48/128 px
```

## Ograniczenia

- Nie działa na wewnętrznych stronach przeglądarki (`chrome://…`) ani w Chrome Web Store — to ograniczenie API Chrome, nie wtyczki.
- Zrzut całej strony zakłada przewijanie pionowe (bez sklejania w poziomie), tak jak większość narzędzi tego typu.
