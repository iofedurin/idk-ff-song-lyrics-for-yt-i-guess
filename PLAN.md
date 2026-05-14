# YouTube Lyrics — Firefox Extension

Плавающая кнопка на YouTube → плавающая панель → текст песни по названию видео (с возможностью ручного поиска).

---

## 1. Стек

Зеркалю соседний `idk-modern-firefox-proxy-client-i-guess`, чтобы инструменты были одинаковые.

| Инструмент | Зачем |
|------------|-------|
| [WXT](https://wxt.dev) | Web Extension framework (build, dev, HMR), Firefox MV3 |
| TypeScript + React 19 | Язык + UI |
| Bun | Пакетный менеджер и раннер |
| Tailwind CSS v4 | Стили |
| Biome | Lint + format |
| Vitest | Юнит-тесты для парсера тайтлов и провайдеров |
| web-ext | Локальный запуск Firefox + подпись для релиза |
| `react-rnd` | Drag + resize для плавающей кнопки и панели (одна либа, ~10kb gz) |

Никакой поддержки Chrome — только Firefox, MV3, `browser.*` API.

---

## 2. Источники текстов

| Источник | Auth | Покрытие | Поиск с несколькими результатами | CORS |
|----------|------|----------|----------------------------------|------|
| **LRCLib** (`lrclib.net/api`) | нет | большая, EN+RU+много языков, есть синхронные LRC | да (`/api/search?q=`) | ок |
| **lyrics.ovh** (`api.lyrics.ovh/v1`) | нет | EN преимущественно | нет (только точное совпадение `artist/title`) | ок |
| **Genius** (`api.genius.com` + scrape `genius.com`) | API key | очень большая, EN+RU, но API отдаёт только метаданные — текст надо парсить со страницы | да | требует прокси через background |

Стратегия:
1. **LRCLib** — основной. Сначала пробуем `/api/get` с распарсенным artist+title (быстро, точно). Если миссa → `/api/search` для списка кандидатов.
2. **lyrics.ovh** — фоллбэк для англоязычных, когда LRCLib пуст.
3. **Genius** — опциональный, **off by default**. Включается когда пользователь вставил свой API key в options. Без ключа провайдер не загружается и в UI не светится.

### Про Genius (важно)
`api.genius.com` отдаёт только метаданные (artist, title, URL страницы). Сам текст — только в HTML на `genius.com/...-lyrics`. Поэтому подключение Genius на практике = парсить HTML их страницы (в `background.ts`, `fetch` + `DOMParser` по `<div data-lyrics-container>`).

- Формально это нарушает их ToS, но запрос идёт из браузера пользователя (его IP, его cookies) — risk-profile как у userscript'а; для некоммерческого опенсорса считаем допустимым.
- Genius иногда меняет вёрстку → парсер ломается раз в полгода-год. Принимаемая плата.

Все запросы — через background script (типобезопасный `@webext-core/messaging`), чтобы избежать сюрпризов с CORS и сложить ретраи/кэш в одно место.

---

## 3. Парсинг названия видео → artist + title

Тайтлы YouTube ужасно разнообразные. Эвристики (в порядке применения):

1. Снять стандартный мусор: `(Official Video)`, `[Official Music Video]`, `(Lyrics)`, `[Lyric Video]`, `(Audio)`, `(HD)`, `(4K)`, `(Remastered ...)`, `feat. ...`, `ft. ...` и т.п. — регэкспом.
2. Разделители: ` - `, ` – `, ` — `, `: `, ` by `. Берём первое сплит-вхождение → `[artist, title]`. Если разделителей нет — весь тайтл идёт в `title`, `artist` пустой.
3. Канал YouTube тоже даёт сигнал: имена вида `Artist - Topic` (auto-generated music) — снять ` - Topic`, использовать как уверенный `artist`, а весь тайтл считать `title`.
4. Если мы на `music.youtube.com` — DOM содержит явные artist/title (без эвристик).

Логика — чистая функция в `lib/parseTitle.ts`, юнит-тесты на 20+ реальных кейсов (видосы с разным форматированием).

---

## 4. UX

### Плавающая кнопка
- Появляется только на страницах `https://www.youtube.com/watch*` и `https://music.youtube.com/*`.
- Иконка ноты, ~40px, полупрозрачная пока не наведёшь.
- Перетаскивается мышью; позиция сохраняется в `browser.storage.local` (отдельно для YT vs YT Music на случай разных раскладок).
- Двойной клик по кнопке — сбросить позицию в дефолт (правый нижний угол).

### Плавающая панель
- Открывается по клику на кнопку. Закрывается крестиком или повторным кликом по кнопке.
- Drag за header, resize за правый/нижний край (через `react-rnd`).
- Размер и позиция сохраняются.
- Структура сверху вниз:
  - **Header**: drag handle, кнопка «обновить с текущего видео», крестик.
  - **Search bar**: поле ввода + кнопка поиска. Подставлено `${artist} ${title}` из текущего видео.
  - **Results selector** (показывается только когда несколько кандидатов): список карточек artist/title/album/duration, клик — загрузить текст.
  - **Lyrics area**: прокручиваемый текст. Моноширинный? нет — sans, но с `pre-wrap`. Кнопка «копировать», переключатель «plain / synced» если есть LRC.
  - **Footer status**: источник (LRCLib / lyrics.ovh / Genius), кнопка «попробовать другой источник».

### Реактивность на смену видео
- YouTube — SPA. Слушаем `yt-navigate-finish` (yt-шный кастомный event) + фоллбэк через `MutationObserver` на `<title>`.
- Когда видео меняется и панель открыта — автоматически перезапрашиваем (с дебаунсом 300мс).

### Изоляция стилей
- Контент-скрипт монтирует React в **shadow DOM**, чтобы стили YT не ломали панель и наоборот. WXT поддерживает это из коробки через `createShadowRootUi`.

---

## 5. Структура файлов

```
entrypoints/
  background.ts                # @webext-core/messaging handler: fetchLyrics, searchLyrics
  youtube.content.ts           # content script: matches youtube.com/watch + music.youtube.com
                               # монтирует React в shadow root, рендерит Button + Panel
  options/                     # настройки: API key Genius, дефолтный источник, очистить позиции
    App.tsx
    index.html
lib/
  parseTitle.ts                # эвристики; чистая функция; юнит-тесты
  lyrics/
    types.ts                   # LyricsResult, SearchHit, Provider
    lrclib.ts                  # клиент LRCLib
    lyricsOvh.ts               # клиент lyrics.ovh
    genius.ts                  # клиент Genius (опц.)
    index.ts                   # композиция: tryProviders(...)
  storage.ts                   # WXT typed storage: позиции, размер, geniusApiKey
  messaging.ts                 # протокол bg ↔ content
  youtubeMeta.ts               # извлечение title/artist/channel из YT и YT Music DOM
components/
  FloatingButton.tsx
  LyricsPanel.tsx
  SearchBar.tsx
  ResultsList.tsx
  LyricsView.tsx
public/
  icon-*.png                   # иконки расширения
```

---

## 6. Хранение

WXT typed storage (`browser.storage.local`):

- `ui.button.position` — `{ x, y }` × 2 раскладки (yt / yt-music)
- `ui.panel.position` — `{ x, y }`
- `ui.panel.size` — `{ width, height }`
- `settings.geniusApiKey` — `string | null` (если null → провайдер Genius выключен)
- `settings.preferredProvider` — `"lrclib" | "lyricsOvh" | "genius"` (по умолчанию `"lrclib"`)
- `cache.lyrics` — LRU по ключу `${artist}|${title}` на 50 записей (чтобы при возврате к видео не дёргать сеть)

---

## 7. Permissions / manifest

```ts
permissions: ["storage"]
host_permissions: [
  "https://www.youtube.com/*",
  "https://music.youtube.com/*",
  "https://lrclib.net/*",
  "https://api.lyrics.ovh/*",
  "https://api.genius.com/*",
  "https://genius.com/*"
]
content_scripts: matches: ["https://www.youtube.com/watch*", "https://music.youtube.com/*"]
browser_specific_settings.gecko.id: "yt-lyrics@local"
strict_min_version: "109.0"
```

---

## 8. CI / релизы

Зеркалю `proxy-client/.github/workflows/release.yml`, плюс добавлю отдельный workflow для сборки на каждом push, чтобы не ждать тега.

### `.github/workflows/build.yml` — на каждый push
- `actions/checkout`, `oven-sh/setup-bun`
- `bun install --frozen-lockfile`
- `bun run lint`, `bun run test`, `bun run build`
- `actions/upload-artifact@v4` с `.output/firefox-mv3/` → можно скачать `.xpi`-папку через UI Actions (живёт 90 дней).
- Триггер: `push` на любую ветку.

### `.github/workflows/release.yml` — на тег `v*`
- То же, что в proxy-client: build + `web-ext sign` через `AMO_API_KEY`/`AMO_API_SECRET` (unlisted channel) + `softprops/action-gh-release` с `.xpi` файлом.
- Триггер: `push` тега `v*`.

Релизный флоу (как в proxy-client):
1. Бамп `version` в `package.json`.
2. Коммит.
3. `git tag v0.1.0 && git push origin master --tags`.

---

## 9. Поэтапная реализация

**Фаза 0 — скаффолд** (≈ 30 мин)
- `wxt init` или ручная развёртка, портируя конфиги из proxy-client (biome, tsconfig, vitest, tailwind, wxt.config).
- `.github/workflows/build.yml` и `release.yml`.
- README-минимум.

**Фаза 1 — провайдеры и парсер** (≈ 1.5 ч, всё чисто юнит-тестируемо)
- `lib/parseTitle.ts` + тесты на корпусе тайтлов.
- `lib/lyrics/lrclib.ts` + `lyricsOvh.ts` + общая обёртка `tryProviders`.
- `lib/messaging.ts` + handler в `background.ts`.

**Фаза 2 — content script + UI** (≈ 3 ч)
- `youtubeMeta.ts`: достаём title/channel из DOM + слушаем `yt-navigate-finish`.
- Плавающая кнопка с drag (react-rnd), персист позиции.
- Плавающая панель: header/drag/resize, search bar, lyrics view.
- Авто-загрузка при открытии панели.

**Фаза 3 — поиск с выбором кандидатов** (≈ 1 ч)
- Ручной поиск через search bar.
- Список результатов, клик загружает текст.
- Кэш LRU.

**Фаза 4 — опции и шлифовка** (≈ 1 ч)
- Options-страница: Genius API key, дефолтный провайдер, кнопка сбросить позиции.
- Тёмная тема панели (auto: следить за `prefers-color-scheme`).
- Тост-сообщения об ошибках («не нашли»).

**Фаза 5 — релиз**
- Бамп версии, тег `v0.1.0`, проверить артефакт в Releases.

---

## 10. Отложено / решено позже

- **Synced lyrics (LRC, karaoke-режим)**: LRCLib часто отдаёт `syncedLyrics`. Сейчас игнорируем, показываем plain text. Добавление позже не потребует переписки — данные уже будут в ответе провайдера, просто появится альтернативный режим отображения.
- **Иконка**: пока возьму нейтральную ноту из публичных свободных SVG; можешь потом подменить.
