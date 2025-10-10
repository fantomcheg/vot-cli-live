# 📖 Примеры использования VOT-CLI Live

## 🎤 Базовое использование

### Скачать перевод с живыми голосами (по умолчанию)
```bash
vot-cli-live --output="./downloads" "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### Скачать со стандартным TTS
```bash
vot-cli-live --output="./downloads" --voice-style=tts "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

---

## 🌍 Работа с разными языками

### Перевод на английский
```bash
vot-cli-live --output="." --reslang=en "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Указать исходный язык видео
```bash
vot-cli-live --output="." --lang=es --reslang=ru "https://www.youtube.com/watch?v=VIDEO_ID"
```

---

## 🎬 Создание видео с переводом (экспериментально)

### Видео с микшированным аудио (оригинал + перевод)
```bash
vot-cli-live --output="." --merge-video "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Видео только с переводом (без оригинального аудио)
```bash
vot-cli-live --output="." --merge-video --keep-original-audio=false "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Настройка громкости
```bash
# Тихий оригинал, громкий перевод
vot-cli-live --output="." --merge-video --original-volume=0.3 --translation-volume=1.5 "https://www.youtube.com/watch?v=VIDEO_ID"
```

---

## 📝 Работа с субтитрами

### Скачать субтитры в формате JSON
```bash
vot-cli-live --subs --output="." --reslang=ru "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Скачать субтитры в формате SRT
```bash
vot-cli-live --subs-srt --output="." --reslang=ru "https://www.youtube.com/watch?v=VIDEO_ID"
```

---

## 🔄 Пакетная обработка

### Скачать переводы для нескольких видео
```bash
vot-cli-live --output="./batch" \
  "https://www.youtube.com/watch?v=VIDEO_ID_1" \
  "https://www.youtube.com/watch?v=VIDEO_ID_2" \
  "https://www.youtube.com/watch?v=VIDEO_ID_3"
```

---

## 🌐 Использование прокси

### С HTTP прокси
```bash
vot-cli-live --output="." --proxy="http://user:pass@proxy.com:8080" "https://www.youtube.com/watch?v=VIDEO_ID"
```

### С обязательным прокси
```bash
vot-cli-live --output="." --proxy="http://proxy.com:8080" --force-proxy=true "https://www.youtube.com/watch?v=VIDEO_ID"
```

---

## 💡 Полезные комбинации

### Английское видео → Русский перевод с живыми голосами
```bash
vot-cli-live --output="./translations" --lang=en --reslang=ru --voice-style=live "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Сохранить с конкретным именем файла
```bash
vot-cli-live --output="./my_videos" --output-file="my_translation.mp3" "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Создать видео с переводом и сохранить с именем
```bash
vot-cli-live --output="./videos" --output-file="translated_video.mp4" --merge-video "https://www.youtube.com/watch?v=VIDEO_ID"
```

---

## 🆚 Сравнение живых голосов и TTS

Чтобы услышать разницу, скачай одно видео двумя способами:

```bash
# С живыми голосами
vot-cli-live --output="./compare" --output-file="live_voice.mp3" --voice-style=live "https://www.youtube.com/watch?v=VIDEO_ID"

# Со стандартным TTS
vot-cli-live --output="./compare" --output-file="tts_voice.mp3" --voice-style=tts "https://www.youtube.com/watch?v=VIDEO_ID"
```

Прослушай оба файла - живые голоса звучат намного естественнее! 🎧

---

## ⚙️ Системные требования для --merge-video

Для использования функции объединения видео нужно установить:

### Linux (Debian/Ubuntu):
```bash
sudo apt install ffmpeg yt-dlp
```

### Linux (Arch):
```bash
sudo pacman -S ffmpeg yt-dlp
```

### macOS:
```bash
brew install ffmpeg yt-dlp
```

### Через pip:
```bash
pip install yt-dlp
```

---

## 🐛 Решение проблем

### Ошибка "yt-dlp не установлен"
Установите yt-dlp: `pip install yt-dlp` или `sudo apt install yt-dlp`

### Ошибка "ffmpeg не установлен"
Установите ffmpeg: `sudo apt install ffmpeg`

### Видео скачивается очень долго
Это нормально для больших видео. Функция `--merge-video` экспериментальная и может занимать много времени.

### Не работает команда vot-cli-live
Проверьте установку: `npm list -g vot-cli-live`

---

## 📞 Поддержка

- 🐛 Issues: https://github.com/fantomcheg/vot-cli-live/issues
- ⭐ Поставь звезду если проект помог!
- 🔄 Оригинальный репозиторий: https://github.com/FOSWLY/vot-cli
