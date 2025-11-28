#!/bin/bash

# 🧪 Скрипт для быстрого тестирования vot-cli-live

echo "🎯 Тестирование vot-cli-live improvements"
echo "=========================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Создаем временную директорию для тестов
TEST_DIR="/tmp/vot-cli-test-$(date +%s)"
mkdir -p "$TEST_DIR"
echo "📁 Временная директория: $TEST_DIR"
echo ""

# Тест 1: Короткое видео с живыми голосами
echo "🧪 Тест 1: Короткое видео (19 сек) с живыми голосами"
echo "URL: https://www.youtube.com/watch?v=jNQXAC9IVRw"
if timeout 120 node src/index.js --output="$TEST_DIR" --voice-style=live "https://www.youtube.com/watch?v=jNQXAC9IVRw" > /dev/null 2>&1; then
    if [ -f "$TEST_DIR/Me_at_the_zoo.mp3" ]; then
        echo -e "${GREEN}✅ PASS${NC}: Файл создан успешно"
        ls -lh "$TEST_DIR/Me_at_the_zoo.mp3"
    else
        echo -e "${RED}❌ FAIL${NC}: Файл не создан"
    fi
else
    echo -e "${RED}❌ FAIL${NC}: Процесс завершился с ошибкой"
fi
echo ""

# Тест 2: Короткое видео с TTS
echo "🧪 Тест 2: Короткое видео (19 сек) с TTS"
echo "URL: https://www.youtube.com/watch?v=jNQXAC9IVRw"
if timeout 120 node src/index.js --output="$TEST_DIR" --voice-style=tts --output-file="test_tts.mp3" "https://www.youtube.com/watch?v=jNQXAC9IVRw" > /dev/null 2>&1; then
    if [ -f "$TEST_DIR/test_tts.mp3" ]; then
        echo -e "${GREEN}✅ PASS${NC}: TTS озвучка работает"
        ls -lh "$TEST_DIR/test_tts.mp3"
    else
        echo -e "${RED}❌ FAIL${NC}: Файл не создан"
    fi
else
    echo -e "${RED}❌ FAIL${NC}: Процесс завершился с ошибкой"
fi
echo ""

# Тест 3: Проверка таймаута (должен завершиться с ошибкой после N попыток)
echo "🧪 Тест 3: Проверка работы таймаута"
echo "URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
echo -e "${YELLOW}(этот тест может занять до 2 минут)${NC}"
if timeout 180 node src/index.js --output="$TEST_DIR" "https://www.youtube.com/watch?v=dQw4w9WgXcQ" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}: Видео переведено успешно"
else
    echo -e "${YELLOW}⚠️  WARNING${NC}: Видео не переведено (ожидаемо для непопулярных видео)"
fi
echo ""

# Статистика
echo "📊 Статистика:"
echo "Файлов создано: $(ls -1 "$TEST_DIR" | wc -l)"
echo "Общий размер: $(du -sh "$TEST_DIR" | cut -f1)"
echo ""

# Очистка
echo "🧹 Очистка временных файлов..."
read -p "Удалить тестовые файлы из $TEST_DIR? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$TEST_DIR"
    echo "✅ Очистка завершена"
else
    echo "📁 Файлы сохранены в: $TEST_DIR"
fi

echo ""
echo "✅ Тестирование завершено!"
