# 🎉 vot-cli-live v1.7.1 - Major Update

## 🔥 Highlights

This is a **MAJOR RELEASE** fixing critical timeout issues and adding a stunning, professional UI!

## 🐛 Critical Bug Fixes

- **Fixed infinite hangs on translation** - Max 10 retry attempts (5 minutes)
- **Fixed network timeout issues** - 60 second timeout for Yandex API  
- **Fixed yt-dlp and ffmpeg hangs** - Added 10 and 15 minute timeouts
- **Improved ECONNRESET errors** - Suggests using proxy when connection fails
- **Full proxy support** - Works everywhere: API, yt-dlp, duration detection
- **Real video duration** - No more hardcoded 341 seconds!

## ✨ New Features

- 📏 **Automatic video duration detection** via yt-dlp
- 🌐 **Full proxy support** - passed via params and environment variables
- ⏳ **Retry progress indicator** - shows "attempt 3/10" during translation wait
- 📝 **Smart file naming** - uses actual video title from YouTube

## 🎨 Beautiful UI Revolution

### Startup Banner
```
╔═══════════════════════════════════════════════════════════╗
║        🎬 VOT-CLI with Live Voices 🔥                ║
╚═══════════════════════════════════════════════════════════╝
  Это форк продукта https://github.com/FOSWLY/vot-cli/
  Вся слава Илье @ToilOfficial 🙏
```

### Features
- 🎬 **Stunning startup banner** with credits to original author
- 📊 **Detailed progress** at every step with emojis
- 🎨 **Colorized output** throughout (cyan, green, yellow, red)
- 📥 **File sizes** displayed everywhere in MB
- 🎬 **3-step merge visualization** (download → merge → cleanup)
- ⏰ **Progress indicators** for long operations
- 🔥 **Voice type indicators** - live voices 🔥 or TTS 🤖

## 📦 Installation

```bash
npm install -g vot-cli-live
```

## 🚀 Usage Examples

### Basic download with live voices
```bash
vot-cli-live --output="." "https://www.youtube.com/watch?v=VIDEO_ID"
```

### With video merge and volume control
```bash
vot-cli-live --output="." --merge-video \
  --original-volume=0.3 \
  --translation-volume=1.5 \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

### With proxy support
```bash
vot-cli-live --output="." \
  --proxy="http://user:pass@proxy.com:8080" \
  "https://www.youtube.com/watch?v=VIDEO_ID"
```

## 📝 Technical Details

### Timeout Values
- Yandex API requests: **60 seconds**
- Translation retry: **10 attempts × 30s = 5 minutes max**
- yt-dlp download: **10 minutes**
- ffmpeg processing: **15 minutes**

### New Files
- `src/utils/getVideoDuration.js` - Video duration detection
- `IMPROVEMENTS.md` - Technical documentation (8KB)
- `SUMMARY.md` - Quick reference (4KB)
- `UI-IMPROVEMENTS.md` - UI documentation (9KB)
- `RELEASE-NOTES-v1.7.0.md` - Full changelog (6KB)

### Modified Files
- `src/index.js` - Beautiful UI + retry logic
- `src/yandexRawRequest.js` - Timeout handling
- `src/translateVideo.js` - Duration detection
- `src/mergeVideo.js` - Process timeouts
- `.gitignore` - Added test media files

## 🧪 Testing

Thoroughly tested on:
- ✅ Short videos (19 seconds)
- ✅ Long videos (24 minutes)
- ✅ Live voices mode
- ✅ TTS mode  
- ✅ Video merge with volume control
- ✅ Proxy support
- ✅ Automatic file naming

## 🙏 Credits

- **Original vot-cli:** [@ToilOfficial](https://github.com/ilyhalight) (Ilya) - Вся слава Илье!
- **Fork maintainer:** [@fantomcheg](https://github.com/fantomcheg)
- **This release:** Co-authored with AI Assistant

Special thanks to all users who reported issues in [#60](https://github.com/FOSWLY/vot-cli/issues/60)!

## 📚 Documentation

- [IMPROVEMENTS.md](./IMPROVEMENTS.md) - Technical details of all changes
- [UI-IMPROVEMENTS.md](./UI-IMPROVEMENTS.md) - Complete UI/UX documentation
- [SUMMARY.md](./SUMMARY.md) - Quick work summary
- [changelog.md](./changelog.md) - Version history

## 🔗 Links

- 📦 **npm:** https://www.npmjs.com/package/vot-cli-live
- 🐙 **GitHub:** https://github.com/fantomcheg/vot-cli-live
- 📚 **Wiki:** https://github.com/fantomcheg/vot-cli-live/wiki
- 🐛 **Issues:** https://github.com/fantomcheg/vot-cli-live/issues
- 💬 **Original:** https://github.com/FOSWLY/vot-cli

---

**Install now:** `npm install -g vot-cli-live` 🚀
