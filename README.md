## 🎤 VOT-CLI with Live Voices | VOT-CLI с живыми голосами

[![npm version](https://img.shields.io/npm/v/vot-cli-live)](https://www.npmjs.com/package/vot-cli-live)
[![npm downloads](https://img.shields.io/npm/dm/vot-cli-live)](https://www.npmjs.com/package/vot-cli-live)
[![GitHub stars](https://img.shields.io/github/stars/fantomcheg/vot-cli-live)](https://github.com/fantomcheg/vot-cli-live/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> ### 🔥 Форк с поддержкой живых голосов Яндекса!
> 
> Оригинальный [FOSWLY/vot-cli](https://github.com/FOSWLY/vot-cli) качал только стандартный TTS. 
> **Эта версия использует живые голоса Яндекса по умолчанию** - озвучка звучит намного естественнее и качественнее!

---

## ✨ Что нового в этом форке:

| Фича | Описание | Статус |
|------|----------|--------|
| 🎤 **Живые голоса** | Поддержка `useLivelyVoice` - более естественная озвучка от Яндекса | ✅ Работает |
| 🎚️ **Выбор типа озвучки** | Параметр `--voice-style` (live/tts) для переключения между живыми голосами и TTS | ✅ Работает |
| 📝 **Умные названия файлов** | Автоматическое именование по названию видео (например: `Rick_Astley_-_Never_Gonna_Give_You_Up.mp3`) | ✅ Работает |
| 🎬 **Объединение видео** | Параметр `--merge-video` для создания видео с встроенным переводом | ⚠️ Экспериментально |
| 🔊 **Настройка громкости** | Параметры `--translation-volume` и `--original-volume` | ✅ Работает |
| 🤖 **Режимы вывода** | `--quiet` для скриптов (только ссылка), `--json` для программной обработки | ✅ Работает |
| 📚 **Полная документация** | Wiki на 1200+ строк с примерами и FAQ | ✅ Готово |

---

## 🚀 Быстрый старт

### Установка:
```bash
npm install -g vot-cli-live
```

### Использование:
```bash
# Скачать только аудио перевод с живыми голосами (файл назовётся по названию видео)
vot-cli-live --output="." "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
# Результат: Rick_Astley_-_Never_Gonna_Give_You_Up.mp3

# Скачать со стандартным TTS
vot-cli-live --output="." --voice-style=tts "https://www.youtube.com/watch?v=VIDEO_ID"

# Скачать ВИДЕО с встроенным переводом (требует yt-dlp и ffmpeg)
vot-cli-live --output="." --merge-video "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
# Результат: Rick_Astley_-_Never_Gonna_Give_You_Up.mp4 (видео с переводом)

# Видео с переводом БЕЗ оригинального аудио
vot-cli-live --output="." --merge-video --keep-original-audio=false "https://www.youtube.com/watch?v=VIDEO_ID"

# Настройка громкости: тихий оригинал (30%), громкий перевод (150%)
vot-cli-live --output="." --merge-video --original-volume=0.3 --translation-volume=1.5 "https://www.youtube.com/watch?v=VIDEO_ID"
# Идеально для изучения языка: слышишь оригинал на фоне + чёткий перевод

# 🤖 Для скриптов и автоматизации:
# Получить только ссылку на аудио (для mpv, vlc и других плееров)
vot-cli-live --quiet "https://www.youtube.com/watch?v=VIDEO_ID"
# Результат: https://vtrans.s3-private.mds.yandex.net/...

# Получить путь к видео с переводом (если используется --merge-video)
vot-cli-live --quiet --merge-video "https://www.youtube.com/watch?v=VIDEO_ID"
# Результат: ./Video_Title.mp4

# Получить JSON с полной информацией (для программной обработки)
vot-cli-live --json "https://www.youtube.com/watch?v=VIDEO_ID"
# Результат: [{"url":"...","audioUrl":"...","success":true,"voiceType":"live"}]

# JSON с merge-video содержит дополнительно mergedVideoPath и mergedVideoSize
vot-cli-live --json --merge-video "https://www.youtube.com/watch?v=VIDEO_ID"
# Результат: [{"url":"...","audioUrl":"...","mergedVideoPath":"./Video.mp4","mergedVideoSize":"45.2","success":true}]
```

---

English version: [Link](https://github.com/fantomcheg/vot-cli-live/blob/main/README-EN.md)

Небольшой скрипт, позволяющий скачать аудио перевод от Яндекса через терминал.

## 📖 Использование

> 💡 **Полная документация:** [Wiki](https://github.com/fantomcheg/vot-cli-live/wiki)  
> 💡 **Больше примеров:** [EXAMPLES.md](./EXAMPLES.md)  
> 🔧 **Устранение проблем:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Примеры использования:

- `vot-cli [options] [args] <link> [link2] [link3] ...` — общий пример
- `vot-cli <link>` — получить перевод аудио по ссылке
- `vot-cli --ru --output=<path> <link>` — **RU-пресет одной командой**: мульти-трек mp4, где основная дорожка — перевод Яндекса, отмикшированный с оригиналом, плюс чистый перевод Яндекса, оригинал и русский автодубляж YouTube (если есть), плюс русские автосубтитры (.srt) и главы видео. Эквивалент: `--merge-video --dub-langs="ru" --yt-auto-subs --sub-langs="ru"`
- `vot-cli --playlist --output=<path> --ru <playlist_url>` — перевести весь плейлист в RU-пресете (ссылки на youtube.com/playlist?list=... можно передавать и без флага --playlist)
- `vot-cli --help` — показать помощь по командам
- `vot-cli --version` — показать версию скрипта
- `vot-cli --output=<path> <link>` — получить перевод аудио по ссылке и сохранить его по указаному пути
- `vot-cli --output=<path> --reslang=en <link>` — получить перевод аудио на английский и сохранить его по указаному пути
- `vot-cli --output=<path> --voice-style=live <link>` — получить перевод с живыми голосами (по умолчанию)
- `vot-cli --output=<path> --voice-style=tts <link>` — получить перевод со стандартной озвучкой TTS
- `vot-cli --output=<path> --merge-video <link>` — скачать видео с встроенным переводом (требует yt-dlp и ffmpeg)
- `vot-cli --output=<path> --merge-video --keep-original-audio=false <link>` — видео только с переводом (без оригинального аудио)
- `vot-cli --subs --output=<path> --lang=en <link>` — получить английские субтитры к видео и сохранить их по указанному пути
- `vot-cli --output="." "https://www.youtube.com/watch?v=X98VPQCE_WI" "https://www.youtube.com/watch?v=djr8j-4fS3A&t=900s"` - пример с реальными данными

### Аргументы:

- `--output` — установить путь сохранения аудио файла перевода
- `--output-file` — установить имя файла для сохранения (требует указания пути в "--output"). Если не указано, используется название видео с YouTube
- `--lang` — установить язык исходного видео (см. [Wiki - Работа с языками](https://github.com/fantomcheg/vot-cli-live/wiki/Home#-работа-с-языками), чтобы узнать какие языки поддерживаются)
- `--reslang` — установить язык полученного аудио файла (см. [Wiki - Работа с языками](https://github.com/fantomcheg/vot-cli-live/wiki/Home#-работа-с-языками), чтобы узнать какие языки поддерживаются)
- `--voice-style` — установить тип озвучки (tts - стандартный TTS, live - живые голоса. По умолчанию: live)
  - **Примечание:** Живые голоса лучше всего работают с YouTube, Twitch, Vimeo
  - Для других платформ (VK, OK.ru) автоматически используется TTS для лучшей совместимости
- `--force-live-voices` — принудительно использовать живые голоса даже для неподдерживаемых платформ (может не работать. По умолчанию: false)
- `--merge-video` — объединить видео с аудио переводом (⚠️ экспериментально, требует yt-dlp и ffmpeg, может занять много времени)
- `--keep-original-audio` — сохранить оригинальное аудио при объединении (микшировать с переводом. По умолчанию: true)
- `--separate-tracks` — не микшировать: сохранить перевод и оригинал как отдельные аудиодорожки (переключаются в плеере. Работает с --merge-video. По умолчанию: false)
- `--playlist` — режим плейлистов: ссылки `youtube.com/playlist?list=...` раскрываются в отдельные видео автоматически; флаг `--playlist` дополнительно раскрывает и ссылки вида `watch?v=...&list=...` в полный плейлист. Комбинируется с любыми другими флагами (`--ru`, `--merge-video`, `--yt-auto-subs`, ...). Видео из плейлиста обрабатываются параллельно
- `--ru` — RU-пресет (подразумевает --merge-video): мульти-трек контейнер, где основная дорожка — микс перевода Яндекса с оригиналом, плюс чистый перевод Яндекса, оригинал и русский автодубляж YouTube (если есть); дополнительно скачиваются русские автосубтитры и встраиваются главы. Эквивалент: `--merge-video --dub-langs="ru" --yt-auto-subs --sub-langs="ru"`
- `--all-dubs` — вместе с --merge-video: добавить в контейнер **все** автодубляжи YouTube (плюс микс-дорожка и чистый перевод Яндекса). Языки — все доступные
- `--dub-langs` — автодубляжи YouTube конкретных языков, через запятую (например `--dub-langs="ru,de"`). Задаётся отдельно от --reslang. Требует --merge-video
- `--chapters` — встроить главы YouTube в итоговое видео (По умолчанию: true, отключить: `--chapters=false`)
- `--yt-subs` — скачать пользовательские субтитры YouTube (языки — из --sub-langs)
- `--yt-auto-subs` — скачать автосгенерированные субтитры YouTube (языки — из --sub-langs; при HTTP 429 автоматически скачивается оригинальный автотрек)
- `--sub-langs` — языки для --yt-subs/--yt-auto-subs через запятую (по умолчанию — как --reslang). Яндексовские субтитры скачиваются через --subs и используют --reslang, как раньше
- `--normalize-audio` — нормализовать уровни громкости для равномерного звучания (использует dynaudnorm. По умолчанию: true)
- `--translation-volume` — установить громкость перевода (0.0-2.0. По умолчанию: 1.0)
- `--original-volume` — установить громкость оригинала (0.0-2.0. По умолчанию: 1.0)
- `--proxy` — установить HTTP или HTTPS прокси в формате `[<PROTOCOL>://]<USERNAME>:<PASSWORD>@<HOST>[:<port>]`
- `--api-token` — OAuth-токен Яндекса для видео, требующих авторизации (Yandex отвечает SESSION_REQUIRED). Можно также задать через переменную окружения `VOT_API_TOKEN`
- `--quiet` — минимальный вывод: только ссылка на аудио (или путь к видео если --merge-video) в stdout, ошибки в stderr (для использования в скриптах и конвейерах)
- `--json` — JSON вывод: структурированные данные для программной обработки (url, audioUrl, success, voiceType, error, mergedVideoPath, mergedVideoSize)

### Опции:

- `-h`, `--help` — показать помощь по использованию
- `-v`, `--version` — показать версию скрипта
- `--subs`, `--subtitles` — получить субтитры к видео вместо аудио (язык субтитров для сохранения берется из `--reslang`)
- `--subs-srt`, `--subtitles-srt` — получить субтитры в формате `.srt` к видео вместо аудио

## 💻 Установка

### Из npm (рекомендуется):

**Версия с живыми голосами:**
```bash
npm install -g vot-cli-live
```

**Оригинальная версия (без живых голосов):**
```bash
npm install -g vot-cli
```

### Требования:
- NodeJS 18+
- yt-dlp (рекомендуется для автоматических названий файлов): `pip install yt-dlp` или `sudo apt install yt-dlp`
- ffmpeg (для `--merge-video`): `sudo apt install ffmpeg`

> 💡 **Примечание:** Без yt-dlp файлы будут называться по videoId (например: `dQw4w9WgXcQ.mp3`)

## ⚙️ Установка из исходников

1. Установите NodeJS 18+
2. Клонируйте репозиторий:

```bash
git clone https://github.com/fantomcheg/vot-cli-live.git
cd vot-cli-live
```

3. Установите зависимости:

```bash
npm install --ignore-scripts
```

4. Установите глобально из локальной папки (любой из вариантов):

```bash
# Вариант А: npm link (режим разработки — правки в исходниках применяются сразу)
npm link          # на Windows без sudo; на Linux/macOS может понадобиться sudo

# Вариант Б: установка напрямую из папки (снапшот текущего состояния)
npm install -g .
```

5. Готово! Теперь команда `vot-cli-live` доступна в терминале

### Установка напрямую из GitHub (минуя npm registry):

```bash
npm install -g github:fantomcheg/vot-cli-live
# или конкретную ветку/коммит:
npm install -g github:fantomcheg/vot-cli-live#main
```

### Обновление локальной установки:

```bash
cd vot-cli-live
git pull
npm install --ignore-scripts   # если добавились зависимости
# при установке через "npm install -g ." повторите эту команду;
# при "npm link" ничего делать не нужно — изменения подхватываются автоматически
```

## 🔊 Длинные видео и авторизация Яндекса

Начиная с v1.8.0 поддерживаются длинные видео (1+ час), для которых Yandex не хранит готовый перевод:

- Если Yandex отвечает **AUDIO_REQUESTED** — vot-cli-live сам скачивает аудиодорожку через yt-dlp и загружает её на серверы Yandex чанками (~5 МБ), затем ждёт завершения перевода (перевод идёт частями, это нормально; ожидание может занять десятки минут)
- Если Yandex отвечает **SESSION_REQUIRED** — для этого видео нужна авторизация. Получите OAuth-токен Яндекса (например, авторизовавшись в браузерном расширении VOT) и передайте его через `--api-token` или переменную окружения `VOT_API_TOKEN`. Для живых голосов автоматически выполняется fallback на стандартный TTS, который часто работает без авторизации

## 📁 Полезные ссылки

1. Версия для браузера: [Ссылка](https://github.com/ilyhalight/voice-over-translation)
2. Скрипт для скачивания видео с встроенным переводом (надстройка над vot-cli):
   | OS | Оболочка | Автор | Ссылка |
   | --- | --- | --- | --- |
   | Windows | PowerShell | Dragoy | [Ссылка](https://github.com/FOSWLY/vot-cli/tree/main/scripts)
   | Unix | Fish | Musickiller | [Ссылка](https://gitlab.com/musickiller/fishy-voice-over/)
   | Linux | Bash | s-n-alexeyev | [Ссылка](https://github.com/s-n-alexeyev/yvt)
   | Cloud | Google Colab | alex2844 | [Ссылка](https://github.com/alex2844/youtube-translate)

## 🔧 Устранение проблем

Если после обновления `--version` показывает старую версию, или у вас другие проблемы - смотрите:
📖 **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - подробный гайд по решению всех известных проблем

### Основные проблемы:
- ❌ **Старая версия после обновления** → [решение](./TROUBLESHOOTING.md#проблема---version-показывает-старую-версию-после-обновления)
- ❌ **ECONNRESET ошибки** → [решение](./TROUBLESHOOTING.md#проблема-ошибка-econnreset-при-переводе-видео)
- ⏰ **Timeout при скачивании** → [решение](./TROUBLESHOOTING.md#проблема-timeout-при-скачиваниеобработке-видео)
- 🔒 **3 уязвимости при установке** → [решение](./TROUBLESHOOTING.md#проблема-3-уязвимости-после-установки)

### 📊 Что нового в последних версиях:

#### v1.9.0 (latest) - RU preset, Multi-track, Chapters & Subtitles
- ✅ **`--ru`**: RU-пресет одной командой — мульти-трек mp4 (основная дорожка: микс перевода Яндекса с оригиналом + чистый перевод + оригинал + русский автодубляж YouTube если есть) + русские автосубтитры .srt + главы
- ✅ **`--all-dubs` / `--dub-langs`**: мульти-трек контейнер — микс (перевод поверх оригинала) + чистый перевод Яндекса + оригинал + автодубляжи YouTube, дорожки подписаны и с правильными языками (ISO 639-2)
- ✅ **`--chapters`**: главы YouTube встраиваются в итоговый mp4, по умолчанию ON (`--chapters=false` — отключить)
- ✅ **`--yt-subs` / `--yt-auto-subs` / `--sub-langs`**: пользовательские и автосгенерированные субтитры YouTube (языки задаются отдельно от --reslang), ретраи при 429 + fallback на оригинальный автотрек
- 🐛 Исправлен дефолт `--keep-original-audio` / `--normalize-audio` (minimist возвращал false — опции не работали, как задокументировано)
- 🐛 Исправлена опечатка `gaussize` → `gausssize` в dynaudnorm (нормализация падала с "Option not found")

#### v1.8.0 - Long videos support
- ✅ **Поддержка длинных видео (1+ час)**: реализован протокол AUDIO_REQUESTED — загрузка аудиодорожки на Yandex чанками по ~5 МБ (как в браузерном расширении VOT)
- ✅ Обработка статуса **PART_CONTENT** — перевод длинных видео частями, ожидание полной готовности
- ✅ Обработка статуса **SESSION_REQUIRED** — новый аргумент `--api-token` (или env `VOT_API_TOKEN`) для видео, требующих авторизации Яндекс ID + авто-fallback на TTS
- ✅ Ожидание перевода по `remainingTime` от сервера (до 90 минут) вместо фиксированных 5 минут
- ✅ Добавлено поле `translationId` в protobuf-схему ответа

#### v1.7.2 - Documentation
- ✅ Добавлен **TROUBLESHOOTING.md** (500+ строк)
- ✅ Решения всех известных проблем
- ✅ Обновлён README.md

#### v1.7.0 - Major Update
- 🐛 Исправлены критические баги (timeout, ECONNRESET)
- 🎨 Красивый UI с эмоджи и прогресс-барами
- ⏰ Таймауты для всех операций (60s API, 10m yt-dlp, 15m ffmpeg)
- 📏 Автоопределение длительности видео

**Полный changelog:** [changelog.md](./changelog.md) | **Releases:** [GitHub Releases](https://github.com/fantomcheg/vot-cli-live/releases)

## ❗ Примечание

1. Оборачивайте ссылки в кавычки, дабы избежать ошибок
2. Для записи в системный раздел (например на "Диск C" в Windows) необходимы права администратора

![example btn](https://github.com/FOSWLY/vot-cli/blob/main/img/example.png "example")
