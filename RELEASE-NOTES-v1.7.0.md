# 🎉 vot-cli-live v1.6.3 - Critical Bug Fixes & Beautiful UI

## 🔥 Highlights

This release fixes critical timeout issues and adds a beautiful, informative UI with emojis!

---

## 🐛 Critical Bug Fixes

- **Fixed infinite hangs on translation** - Added max 10 retry attempts (5 minutes timeout)
- **Fixed network timeout issues** - Added 60 second timeout for Yandex API requests  
- **Fixed yt-dlp and ffmpeg hangs** - Added 10 and 15 minute timeouts respectively
- **Improved ECONNRESET errors** - Now suggests using proxy when connection fails

---

## ✨ New Features

### Real Video Duration Detection
- No more hardcoded 341 seconds!
- Automatically detects actual video length via yt-dlp
- Falls back gracefully if yt-dlp is unavailable

### Full Proxy Support
- Proxy now works everywhere: Yandex API, yt-dlp, duration detection
- Passed via both `--proxy` parameter and environment variables
- Fixes Issue #60 complaints about proxy not working

### Retry Progress Indicator
- Shows "attempt 3/10" during translation wait
- Users can now see progress instead of infinite hang

---

## 🎨 Beautiful UI Improvements

### Stunning Startup Banner
```
╔═══════════════════════════════════════════════════════════╗
║        🎬 VOT-CLI with Live Voices 🔥                ║
╚═══════════════════════════════════════════════════════════╝
  Это форк продукта https://github.com/FOSWLY/vot-cli/
  Вся слава Илье @ToilOfficial 🙏
```

### Detailed Progress at Every Step
- 🔗 Link formation with URL display
- 📺 Video title fetching with status
- 🎤 Translation type (live voices 🔥 or TTS 🤖)
- 📥 Download progress with file sizes
- 🎬 3-step merge visualization

### File Size Display
- Shows file sizes in MB at each step
- Helps users understand download progress
- Audio and final video sizes clearly displayed

### 3-Step Merge Process
```
Step 1/3: Downloading translation audio... ✅ (0.29 MB)
Step 2/3: Merging video with translation... 
Step 3/3: Cleaning up temporary files... ✅
```

---

## 📝 Documentation

### New Documentation Files
- **IMPROVEMENTS.md** - Detailed technical changelog
- **SUMMARY.md** - Quick summary of all changes  
- **UI-IMPROVEMENTS.md** - Complete UI/UX documentation
- **test-improvements.sh** - Automated testing script

### Updated Files
- **changelog.md** - Added v1.6.3 entry
- **package.json** - Version bumped to 1.6.3

---

## 🧪 Testing

All features thoroughly tested:
- ✅ Short videos (19 seconds)
- ✅ Long videos (24 minutes)  
- ✅ Live voices mode
- ✅ TTS mode
- ✅ Video merge with volume control
- ✅ Automatic file naming
- ✅ Duration detection

---

## 📦 Installation

### Via npm (recommended):
```bash
npm install -g vot-cli-live
```

### Via npm with version:
```bash
npm install -g vot-cli-live@1.6.3
```

### From source:
```bash
git clone https://github.com/fantomcheg/vot-cli-live.git
cd vot-cli-live
git checkout v1.6.3
npm install --ignore-scripts
sudo npm link
```

---

## 🚀 Usage Examples

### Basic download with live voices:
```bash
vot-cli-live --output="." "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Download with TTS:
```bash
vot-cli-live --output="." --voice-style=tts "https://www.youtube.com/watch?v=VIDEO_ID"
```

### Video merge with custom volumes:
```bash
vot-cli-live --output="." --merge-video \
  --original-volume=0.3 \
  --translation-volume=1.5 \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

### With proxy:
```bash
vot-cli-live --output="." \
  --proxy="http://user:pass@proxy.com:8080" \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

---

## 🔧 Technical Details

### Timeout Values:
- Yandex API: 60 seconds
- Translation retry: 10 attempts × 30s = 5 minutes max
- yt-dlp download: 10 minutes
- ffmpeg processing: 15 minutes

### New Files:
- `src/utils/getVideoDuration.js` - Video duration detection utility
- `IMPROVEMENTS.md` - Technical documentation
- `SUMMARY.md` - Quick reference
- `UI-IMPROVEMENTS.md` - UI documentation
- `test-improvements.sh` - Test automation
- `publish.sh` - Publication automation

### Modified Files:
- `src/index.js` - Beautiful UI, retry logic
- `src/yandexRawRequest.js` - Timeout handling
- `src/translateVideo.js` - Duration detection
- `src/mergeVideo.js` - Process timeouts
- `.gitignore` - Added logERROR.txt

---

## 🙏 Credits

- **Original vot-cli:** [@ToilOfficial](https://github.com/ilyhalight) (Ilya)
- **Fork maintainer:** [@fantomcheg](https://github.com/fantomcheg)
- **This release:** Co-authored with AI Assistant

Special thanks to all users who reported issues in #60!

---

## 📊 Changelog

See [IMPROVEMENTS.md](./IMPROVEMENTS.md) for detailed technical changes.
See [changelog.md](./changelog.md) for version history.

---

## 🐛 Known Issues

1. **Gender detection in live voices** - Sometimes incorrect (Yandex API issue, not fixable client-side)
2. **Translation queue** - Popular videos translate faster (Yandex prioritization)

---

## 🔗 Links

- 📦 **npm Package:** https://www.npmjs.com/package/vot-cli-live
- 🐙 **GitHub Repository:** https://github.com/fantomcheg/vot-cli-live
- 📚 **Documentation:** [Wiki](https://github.com/fantomcheg/vot-cli-live/wiki)
- 🐛 **Report Issues:** [GitHub Issues](https://github.com/fantomcheg/vot-cli-live/issues)
- 💬 **Original Project:** https://github.com/FOSWLY/vot-cli

---

## 📝 Full Changelog

```
v1.6.3 (2025-11-28)
├─ 🐛 Bug Fixes (4)
├─ ✨ New Features (3)
├─ 🎨 UI Improvements (7)
├─ 📝 Documentation (4 new files)
├─ 🧪 Testing (automated)
└─ 🙏 Credits added to banner

Files changed: 17
Lines added: ~950
Lines removed: ~45
```

---

**Enjoy the update! 🎊**
