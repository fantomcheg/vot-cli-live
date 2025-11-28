# 🚀 Инструкция по публикации vot-cli-live v1.7.0

## ✅ Подготовка завершена!

Репозиторий очищен от больших файлов (290MB → 25MB)
Все коммиты и теги готовы.

---

## 📤 Шаг 1: Push на GitHub

```bash
cd /home/xrapid/Projects/vot-cli/vot-cli

# Push ветки (force нужен т.к. переписали историю)
git push myfork feature/add-live-voices-support --force

# Push тегов
git push myfork --tags --force
```

---

## 🎯 Шаг 2: Создать Release на GitHub

1. Открой: https://github.com/fantomcheg/vot-cli-live/releases/new
2. Выбери тег: **v1.7.0**
3. Title: **v1.7.0 - Major Update: Bug Fixes & Beautiful UI**
4. Description: Скопируй из файла **RELEASE-NOTES-v1.7.0.md**
5. Нажми **Publish release**

---

## 📦 Шаг 3: Публикация на npm

```bash
# Проверь что залогинен
npm whoami

# Если нет, то залогинься
npm login

# Проверь что будет опубликовано
npm pack --dry-run

# Публикуй!
npm publish
```

---

## ✅ Проверка после публикации

```bash
# Проверь что опубликовано
npm view vot-cli-live

# Установи глобально и протестируй
npm install -g vot-cli-live
vot-cli-live --version  # Должно показать 1.7.0
```

---

## 🎊 Готово!

После публикации:
- 📦 **npm:** https://www.npmjs.com/package/vot-cli-live
- 🐙 **GitHub:** https://github.com/fantomcheg/vot-cli-live
- 🎉 **Release:** https://github.com/fantomcheg/vot-cli-live/releases/tag/v1.7.0

---

## ⚠️ Важно

После force push другие разработчики должны сделать:
```bash
git fetch myfork
git reset --hard myfork/feature/add-live-voices-support
```

Но т.к. ты один работаешь - всё ОК! 👍
