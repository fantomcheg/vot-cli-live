# 1.10.0 (2026-09-06 - Playlist Mode)

## New Features

- **`--playlist`**: playlist links are expanded into individual videos and processed with all other flags as usual. `youtube.com/playlist?list=...` links are expanded automatically; the flag additionally expands `watch?v=...&list=...` URLs into the full playlist (without it, a watch link with `list=` is processed as a single video, as before). Videos are processed in parallel via `yt-dlp --flat-playlist` (fast, no downloads). New helper `getPlaylistEntries` in `src/youtubeInfo.js`.

---

# 1.9.0 (2026-09-06 - RU preset, Multi-track Dubs, Chapters, YouTube Subtitles)

## New Features

- **`--ru` preset**: one-command Russian pack — multi-track mp4 where the default audio track is the Yandex RU translation mixed over the original, plus the pure Yandex RU track, the original audio and the YouTube RU auto-dub (if available); also downloads Russian auto-generated subtitles (.srt) and embeds chapters. Equivalent to `--merge-video --dub-langs="ru" --yt-auto-subs --sub-langs="ru"`.
- **`--all-dubs` / `--dub-langs "ru,de"`** (with `--merge-video`): multi-track container — mix track (Yandex translation over quieted original, default), pure Yandex translation, original audio, and YouTube auto-dub tracks in chosen languages (or all available). Tracks are titled (mp4 handler_name) and tagged with proper ISO 639-2 language codes. Works even when Yandex translation fails (dubs-only container).
- **`--chapters`** (default: true, disable with `--chapters=false`): YouTube chapters are embedded into the output mp4 via ffmetadata + `-map_chapters` (applies to plain merge, separate-tracks and multi-track modes).
- **`--yt-subs` / `--yt-auto-subs`**: download user-uploaded and/or auto-generated YouTube subtitles; **`--sub-langs "ru,en"`** sets subtitle languages separately from `--reslang` (Yandex subtitles via `--subs` still use `--reslang`). Retries on HTTP 429 and automatic fallback to the original auto-track when translated captions are rate-limited.
- New module `src/youtubeInfo.js` (yt-dlp -J cache, dub language detection, chapters, dub track and subtitle downloads).

## Bug Fixes

- **Default values of `--keep-original-audio` and `--normalize-audio` were broken**: minimist returns `false` (not `undefined`) for declared boolean flags, so `?? true` never applied. Options now work as documented (mix + normalization ON by default). Flags moved out of the boolean list, parsed manually.
- **dynaudnorm filter typo**: `gaussize` → `gausssize` (the normalization branch always failed with "Option not found" once actually enabled).
- **mp4 track metadata**: stream `title` is written as `handler_name` (mp4 muxer ignores stream title); 2-letter language codes ("ru") silently dropped by the mp4 muxer — now converted to ISO 639-2 ("rus").

---

# 1.8.0 (2026-09-06 - Long Videos Support + Yandex Auth)

## New Features

- **Long videos support (1+ hours)**: implemented the Yandex `AUDIO_REQUESTED` protocol — when Yandex can't fetch the audio itself, vot-cli-live now downloads the audio track via yt-dlp and uploads it to Yandex in ~5 MB chunks (same as the VOT browser extension)
- **PART_CONTENT status handling**: long videos are translated in parts; the CLI now waits for the full translation instead of failing with "Unknown translation status"
- **SESSION_REQUIRED status handling**: new `--api-token` argument (or `VOT_API_TOKEN` env variable) for videos that require Yandex ID authorization; automatic fallback from live voices to TTS
- **Server-driven waiting**: polling now follows the `remainingTime` hints from Yandex (up to 90 minutes) instead of fixed 10s/30s intervals with a 5-minute cap

## Fixes / Internal

- Added `translationId`, `shouldRetry`, `isLivelyVoice` fields to the translation response protobuf schema
- Added protobuf messages for audio upload (`VideoTranslationAudioRequest/Response`, `ChunkAudioObject`, `PartialAudioBufferObject`)
- `yandexRawRequest` now supports PUT method and promise-style usage
- New module `src/audioUploader.js` (yt-dlp audio download + chunked upload)
- Status 7 is no longer misreported as "Translation not available for this video"

---

# 1.7.5 (2024-12-17 - Quiet & JSON Output Modes + Translation Polling)

## ✨ New Features

- **Добавлен флаг `--quiet`** (Issue #1)
  - Минимальный вывод: только ссылка на аудио (или путь к видео если --merge-video) в stdout
  - Ошибки выводятся в stderr
  - Идеально для использования в скриптах и конвейерах (pipes)
  - Пример: `vot_audio=$(vot-cli-live --quiet "$url")`
  - Пример с merge: `video=$(vot-cli-live --quiet --merge-video "$url")`
  
- **Добавлен флаг `--json`**
  - Структурированный JSON вывод для программной обработки
  - Содержит: url, platform, videoTitle, success, audioUrl, error, voiceType
  - При --merge-video добавляется: mergedVideoPath, mergedVideoSize
  - Идеально для интеграции с другими инструментами
  - Пример: `vot-cli-live --json "$url" | jq '.[] | select(.success) | .audioUrl'`

- **Реализован polling mechanism для переводов**
  - Автоматическое ожидание когда перевод будет готов (до 5 минут)
  - Показывает прогресс: "⏳ Translation in progress... (30s elapsed, attempt 3/30)"
  - Интервал между попытками: 10 секунд
  - Работает для всех платформ (особенно важно для VK)

## 🐛 Bug Fixes

- Исправлен вывод в quiet/json режимах (отключен listr UI)
- Добавлена переменная окружения `VOT_CLI_QUIET` для дочерних модулей
- Исправлен exit code в quiet режиме (0 если хотя бы одно видео успешно)

## 📝 Documentation

- Обновлён README с примерами использования `--quiet` и `--json`
- Добавлены use cases для mpv, vlc и других плееров
- Обновлена таблица "Что нового в этом форке"

## 🎯 Use Cases

**Для mpv:**
```bash
url="https://www.youtube.com/watch?v=VIDEO_ID"
vot_audio=$(vot-cli-live --quiet "$url")
mpv "$url" --external-file="$vot_audio"
```

**Для автоматизации:**
```bash
vot-cli-live --json "$url" | jq '.[] | select(.success) | .audioUrl'
```

## 🎊 Benefits

- ✅ Удобная интеграция с внешними плеерами (mpv, vlc)
- ✅ Простое использование в bash/python скриптах
- ✅ Автоматическое ожидание перевода (не нужно запускать команду повторно)
- ✅ Чистый вывод без лишней информации для скриптов
- ✅ Структурированные данные для программной обработки

---

# 1.7.4 (2024-12-17 - Live Voices Platform Support Fix)

## 🐛 Bug Fixes

- **Исправлена поддержка live voices для разных платформ** (Issue #2)
  - Добавлен белый список платформ где live voices работает стабильно
  - Автоматический fallback на TTS для неподдерживаемых платформ (VK, OK.ru, Rutube)
  - VK видео теперь переводятся корректно (используется TTS автоматически)
  - Улучшенные сообщения об ошибках

## ✨ New Features

- **Добавлен параметр `--force-live-voices`**
  - Позволяет принудительно использовать live voices даже для неподдерживаемых платформ
  - Автоматический fallback на TTS если live voices не сработает
- **Платформы с официальной поддержкой live voices**:
  - ✅ YouTube
  - ✅ Twitch
  - ✅ Vimeo
- **Платформы где используется TTS** (для лучшей совместимости):
  - VK (vk.com)
  - OK.ru
  - Rutube
  - Mail.ru

## 📝 Other Changes

- Добавлен `liveVoicesSupportedPlatforms` в `constants.js`
- Улучшено логирование при выборе типа озвучки
- Обновлена документация в README
- Добавлен `ISSUE-2-ANALYSIS.md` с детальным анализом проблемы

## 🎯 Benefits

- ✅ VK видео теперь переводятся без ошибок
- ✅ Понятные сообщения о том, какой тип озвучки используется
- ✅ Возможность принудительно попробовать live voices
- ✅ Лучшая совместимость с разными платформами

---

# 1.7.3 (2024-12-17 - Audio Mixing Improvements)

## 🎚️ Audio Quality Improvements

- **Улучшен профиль ffmpeg для микширования аудио**:
  - Заменён `volume` на `weights` в amix — математически корректнее, меньше риска клиппинга
  - Добавлен фильтр `dynaudnorm` — автоматическое выравнивание громкости для комфортного прослушивания
  - Изменён `duration=longest` на `duration=first` — правильная длительность по видео
  - Добавлен `dropout_transition=2` — плавное затухание при обрыве дорожки
- **Добавлен параметр `--normalize-audio`** (по умолчанию: true)
  - Включает/отключает динамическую нормализацию громкости
  - При отключении обработка на ~10% быстрее, но громкость может скакать
- **Параметры dynaudnorm**: `framelen=30:gausssize=31:maxgain=12`
  - Быстрая реакция на изменения громкости
  - Сглаживание переходов
  - Защита от перегрузки (макс. усиление 12 dB)

## 📚 Documentation

- **Добавлен AUDIO-IMPROVEMENTS.md** — подробное описание улучшений аудио-микширования
  - Сравнение старого и нового профилей
  - Объяснение работы dynaudnorm
  - Практические примеры использования
  - Рекомендации когда использовать нормализацию
- **Обновлены README.md и README-EN.md** — добавлено описание `--normalize-audio`
- **Обновлён EXAMPLES.md** — добавлены примеры с нормализацией и без

## 🎯 Benefits

- ✅ Профессиональное качество звука (как в реальном аудио-продакшене)
- ✅ Меньше риска искажений и клиппинга
- ✅ Не нужно крутить громкость во время просмотра
- ✅ Конкурентное преимущество — оригинальный vot-cli этого не умеет!

---

# 1.7.2 (2025-11-28 - Documentation: Troubleshooting Guide)

## 📚 Documentation

- **Добавлен TROUBLESHOOTING.md** - подробный гайд по устранению проблем (500+ строк)
- **Описана проблема с конфликтом версий** - когда `/usr/bin/vot-cli-live` показывает старую версию вместо новой из nvm
- **Добавлены решения для всех известных ошибок**:
  - ECONNRESET с предложением использовать прокси
  - Timeout при скачивании/обработке видео
  - 3 уязвимости при установке (npm audit)
  - Проблемы с GitHub Release и аутентификацией
  - Большой размер git репозитория
- **Полезные команды для диагностики** - `which -a`, `npm cache clean`, `hash -r`, и др.
- **Обновлён README.md** - добавлена ссылка на TROUBLESHOOTING и краткий список проблем

---

# 1.7.1 (2025-11-28 - Patch: Version Bump)

## 📦 Version Management

- **Обновлена версия до 1.7.1** - для переопубликования после очистки репозитория
- Исправлена проблема с npm кешем при публикации

---

# 1.7.0 (2025-11-28 - Major Update: Bug Fixes & Beautiful UI)

## 🐛 Bug Fixes

- **Исправлен бесконечный цикл ожидания перевода** - добавлен максимум 10 попыток (5 минут)
- **Исправлено зависание при ошибках сети** - добавлен таймаут 60 секунд для запросов к Яндекс API
- **Исправлено зависание yt-dlp и ffmpeg** - добавлены таймауты (10 и 15 минут соответственно)
- **Улучшена обработка ошибок ECONNRESET** - теперь показывается совет использовать прокси

## ✨ New Features

- **Получение реальной длительности видео** через yt-dlp вместо фиксированных 341 секунды
- **Полная поддержка прокси в yt-dlp** - прокси теперь передается и через параметры, и через переменные окружения
- **Прогресс-индикатор попыток** - показывается "attempt 3/10" при ожидании перевода

## 📝 Other Changes

- Добавлен `logERROR.txt` в `.gitignore`
- Создана утилита `getVideoDuration.js` для определения длительности видео
- Улучшены сообщения об ошибках (более информативные)
- Добавлен файл `IMPROVEMENTS.md` с детальным описанием всех улучшений

## 🧪 Testing

- Протестировано на коротких видео (19 секунд)
- Протестировано на длинных видео (3+ минуты)
- Проверена работа с живыми голосами и TTS
- Проверено автоматическое именование файлов

## 📚 Documentation

См. `IMPROVEMENTS.md` для подробного описания всех изменений.

---

# 1.4.3

- Добавлена поддержка загрузки субтитров в `.srt` (#33)

# 1.4.2

- Добавлена поддержка /live/ для YouTube (#32)

# 1.4.1

- Обновлен Yandex HMAC

# 1.4.0

- Добавлен новый аргумент `--output-file`. Он позволяет установить имя файла для сохранения (требует указания пути сохранения аудио файла перевода в аргументе "--output")
- `Yandex Protobuf` обновлен до актуальной версии из [voice-over-translation](https://github.com/ilyhalight/voice-over-translation)
- Добавлена поддержка перевода Google Drive (только публичные ссылки, например: `https://drive.google.com/file/d/FILE_ID`)
- Добавлена поддержка перевода YouTube Shorts (`https://youtube.com/shorts/VIDEO_ID`)
- Добавлена поддержка короткой ссылки на YouTube `youtu.be`

# 1.3.1

- Добавлена поддержка короткой ссылки на yandex disk (`yadi.sk`)

# 1.3.0

- Добавлена поддержка кастомных ссылок с окончанием на `.mp4`
- Добавлена поддержка Одноклассников (`ok.ru`)
- Добавлена поддержка Peertube. Были добавлены 9 крупных сайтов, хостящих Peertube (libre.video не поддерживается - не просите):

  - `tube.shanti.cafe`
  - `bee-tube.fr`
  - `video.sadmin.io`
  - `dalek.zone`
  - `review.peertube.biz`
  - `peervideo.club`
  - `tube.la-dina.net`
  - `peertube.tmp.rcp.tf`

- Добавлена поддержка Dailymotion (`dailymotion.com/video/`)
- Добавлена поддержка Trovo (`trovo.live/s/`)
- Добавлена поддержка Яндекс Диск (`disk.yandex.ru/i/`)
- Добавлена поддержка Coursehunter (`coursehunter.net/course/`). Для перевода конкретного урока используйте query-параметр `?lesson=НОМЕР_УРОКА`
- Минимальная версия NodeJS в NPM пакете зафиксирована на **NodeJS 18**
- Добавлена эксперементальная поддержка HTTP и HTTPS прокси в формате `[<PROTOCOL>://]<USERNAME>:<PASSWORD>@<HOST>[:<port>]` (например: `http://127.0.0.1:8788`). Для установки прокси используйте аргумент `--proxy`

# 1.2.1

- Еще один фикс загрузки #4

# 1.2.0

- Добавлена возможность загрузки субтитров для видео вместо озвучки (используйте опцию `--subs` или `--subtitles`)
- Добавлена поддержка Rumble и EPorner (у последнего перевод занимает очень много времени)
- Фикс загрузки аудио файла для XVideos (#4)
- Актуализирован список языков доступных для TTS (уменьшен до 3 - ru, kk, en)
- `Yandex Protobuf` обновлен до актуальной версии из [voice-over-translation](https://github.com/ilyhalight/voice-over-translation)
- Добавлен хук pre-commit для автоформатирования при добавление в git
- Игнорирование папок перенесено в отдельный файл `.eslintignore`
- Задан явный конфиг для prettier (нужен для нормальной работы форматирования в редакторе)

# 1.1.1

- Возвращен показ ссылки на перевод

# 1.1.0

- Добавлены тесты для ютуба и вимео
- Улучшена работа одновременного перевода нескольких видео
- Теперь, имя аудио файла начинается с айди видео и имеет вид: "**VIDEO_ID---UUID4**"
- Добавлено отображение процентов загрузки аудио
- Возвращен слайдер при ожидание перевода
- Библиотека `node-downloader-helper` заменена асинхронной реализацией с `axios` и `fs`
- Библиотека `loading-cli` была заменена на `listr2`
- Немного изменена реализация функции `translate` для избежания ошибок при загрузке перевода сразу нескольких видео
- Добавлены новые аргументы:
  - `--lang` для установки языка исходного видео (см. вики, чтобы узнать какие языки поддерживаются)
  - `--reslang` для установки языка переведенной аудио дорожки (см. вики, чтобы узнать какие языки поддерживаются)
- Добавлены сокращенные версии опций: `--help` => `-h` и `--version` => `-v`
- Улучшена документация `vot-cli --help`
- Улучшена документация README.md
- Функция `getVideoId` обновлена до актуальной версии из [voice-over-translation](https://github.com/ilyhalight/voice-over-translation)
  - Добавлена поддержка Bitchute, Invidious, ProxyTok, Piped, Bilibili, Twitch Clips, Rutube
- `Yandex Protobuf` обновлен до актуальной версии из [voice-over-translation](https://github.com/ilyhalight/voice-over-translation)
- Все зависимости были обновлены до последних версий
- Почищены не используемые зависимости
- Добавлены prettier и eslint
- Изменена структура проекта. Теперь, все файлы, относящиеся к скрипту, находятся в папке `src`. Так же, теперь, часть функций была вынесена в отдельные файлы.
- vot-cli был перенесен в отдельный [репозиторий](https://github.com/FOSWLY/vot-cli)

# 1.0.4

- Добавлена поддержка mail.ru

# 1.0.3

- Добавлена поддержка Twitter

# 1.0.1 - 1.0.2

Список изменений был утерян

# 1.0.0.

- Был создана сам VOT-CLI с доступными запросами к YouTube, Twitch, VK, XVideos, Pornhub
