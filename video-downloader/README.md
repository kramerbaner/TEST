# Video Downloader

Desktopowa aplikacja dla macOS do pobierania video z **YouTube**, **Facebooka**, **Twittera/X** (oraz ponad 1000 innych serwisów obsługiwanych przez `yt-dlp`).

## Funkcje

- Pobieranie video w MP4 (do 4K) lub samego audio jako MP3
- Wybór jakości (360p - 4K, "najlepsza dostępna")
- Pasek postępu z prędkością i pozostałym czasem
- Wybór folderu docelowego
- Tryb ciemny, natywny wygląd macOS
- Anulowanie pobierania

## Wymagania

- macOS 10.13+ (Intel lub Apple Silicon)
- [Node.js](https://nodejs.org/) 18+ (tylko do uruchomienia/zbudowania)
- `yt-dlp` i `ffmpeg` (silnik pobierania i konwersji)

Instalacja zależności systemowych przez [Homebrew](https://brew.sh):

```bash
brew install yt-dlp ffmpeg
```

## Uruchomienie z kodu źródłowego

```bash
cd video-downloader
npm install
npm start
```

## Budowanie aplikacji `.app` / `.dmg`

```bash
npm run build:dmg
```

Gotowy plik `.dmg` znajdziesz w katalogu `dist/`. Przeciągnij aplikację do `Applications`.

> Uwaga: niepodpisana aplikacja przy pierwszym uruchomieniu wymaga prawokliku → "Otwórz" (Gatekeeper).

## Użycie

1. Wklej adres URL filmu (YouTube / Facebook / Twitter / itp.)
2. Wybierz format (Video MP4 lub Audio MP3) i jakość
3. Wskaż folder docelowy (domyślnie `~/Downloads`)
4. Kliknij **Pobierz**

## Uwagi prawne

Aplikacja korzysta z `yt-dlp`. Pobieraj wyłącznie treści, do których masz prawo lub które licencja zezwala na pobranie. Respektuj regulaminy serwisów oraz prawo autorskie.

## Architektura

- `main.js` - proces główny Electron, IPC, zarządzanie procesami `yt-dlp`
- `preload.js` - bezpieczny most między rendererem a procesami Node
- `renderer/` - UI (HTML/CSS/JS)
- Backend pobierania: `yt-dlp` + `ffmpeg` (instalowane lokalnie)
