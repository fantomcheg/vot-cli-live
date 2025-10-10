## 🎤 VOT-CLI with Live Voices

[![npm version](https://img.shields.io/npm/v/vot-cli-live)](https://www.npmjs.com/package/vot-cli-live)
[![npm downloads](https://img.shields.io/npm/dm/vot-cli-live)](https://www.npmjs.com/package/vot-cli-live)
[![GitHub stars](https://img.shields.io/github/stars/fantomcheg/vot-cli-live)](https://github.com/fantomcheg/vot-cli-live/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> ### 🔥 Fork with Yandex Live Voices Support!
> 
> Original [FOSWLY/vot-cli](https://github.com/FOSWLY/vot-cli) only downloaded standard TTS. 
> **This version uses Yandex live voices by default** - much more natural and higher quality voiceover!

---

## ✨ What's New in This Fork:

| Feature | Description | Status |
|---------|-------------|--------|
| 🎤 **Live Voices** | Support for `useLivelyVoice` - more natural voiceover from Yandex | ✅ Working |
| 🎚️ **Voice Type Selection** | `--voice-style` parameter (live/tts) to switch between live voices and TTS | ✅ Working |
| 🎬 **Video Merging** | `--merge-video` parameter to create video with embedded translation | ⚠️ Experimental |
| 🔊 **Volume Control** | `--translation-volume` and `--original-volume` parameters | ✅ Working |
| 📝 **Updated Documentation** | Usage examples in Russian and English | ✅ Ready |

---

## 🚀 Quick Start

### Installation:
```bash
npm install -g vot-cli-live
```

### Usage:
```bash
# Download translation with live voices (default)
vot-cli-live --output="." "https://www.youtube.com/watch?v=VIDEO_ID"

# Download with standard TTS
vot-cli-live --output="." --voice-style=tts "https://www.youtube.com/watch?v=VIDEO_ID"

# Download video with embedded translation (requires yt-dlp and ffmpeg)
vot-cli-live --output="." --merge-video "https://www.youtube.com/watch?v=VIDEO_ID"
```

---

Русская версия: [Link](https://github.com/fantomcheg/vot-cli2025/blob/main/README.md)

A small script that allows you to download an audio translation from Yandex via the terminal.

## 📖 Using

> 💡 **More examples:** [EXAMPLES.md](./EXAMPLES.md)

### Usage examples:

- `vot-cli [options] [args] <link> [link2] [link3] ...` — general example
- `vot-cli <link>` — get the audio translation from the link
- `vot-cli --help` — show help by commands
- `vot-cli --version` — show script version
- `vot-cli --output=<path> <link>` — get the audio translation from the link and save it to the specified path
- `vot-cli --output=<path> --reslang=en <link>` — get the audio translation into English and save it in the specified path
- `vot-cli --output=<path> --voice-style=live <link>` — get translation with live voices (default)
- `vot-cli --output=<path> --voice-style=tts <link>` — get translation with standard TTS voice
- `vot-cli --subs --output=<path> --lang=en <link>` — get English subtitles for the video and save them in the specified path
- `vot-cli --output="." "https://www.youtube.com/watch?v=X98VPQCE_WI" "https://www.youtube.com/watch?v=djr8j-4fS3A&t=900s"` - example with real data

### Arguments:

- `--output` — set the path to save the audio translation file
- `--output-file` — set the file name to download (requires specifying a dir to download in "--output" argument)
- `--lang` — set the source video language (look [wiki](https://github.com/FOSWLY/vot-cli/wiki/%5BEN%5D-Supported-langs), to find out which languages are supported)
- `--reslang` — set the language of the received audio file (look [wiki](https://github.com/FOSWLY/vot-cli/wiki/%5BEN%5D-Supported-langs), to find out which languages are supported)
- `--voice-style` — set voice style (tts - standard TTS, live - live voices. Default: live)
- `--merge-video` — merge video with translation audio (⚠️ experimental, requires yt-dlp and ffmpeg, may take a long time)
- `--keep-original-audio` — keep original audio when merging (mix with translation. Default: true)
- `--translation-volume` — set translation audio volume (0.0-2.0. Default: 1.0)
- `--original-volume` — set original audio volume (0.0-2.0. Default: 1.0)
- `--proxy` — set HTTP or HTTPS proxy in the format `[<PROTOCOL>://]<USERNAME>:<PASSWORD>@<HOST>[:<port>]`

### Options:

- `-h`, `--help` — Show help
- `-v`, `--version` — Show script version
- `--subs`, `--subtitles` — Get video subtitles instead of audio (the subtitle language for saving is taken from `--reslang`)
- `--subs-srt`, `--subtitles-srt` — Get video subtitles in `.srt` format instead of audio

## 💻 Installation

### From npm (recommended):

**Version with live voices:**
```bash
npm install -g vot-cli-live
```

**Original version (without live voices):**
```bash
npm install -g vot-cli
```

### Requirements:
- NodeJS 18+
- ffmpeg (for `--merge-video`): `sudo apt install ffmpeg`
- yt-dlp (for `--merge-video`): `pip install yt-dlp` or `sudo apt install yt-dlp`

## ⚙️ Installation from source

1. Install NodeJS 18+
2. Clone the repository:

```bash
git clone https://github.com/fantomcheg/vot-cli-live.git
cd vot-cli-live
```

3. Install dependencies:

```bash
npm install --ignore-scripts
```

4. Install globally:

```bash
sudo npm link
```

5. Done! Now `vot-cli-live` command is available in your terminal

## 📁 Useful links

1. Browser version: [Link](https://github.com/ilyhalight/voice-over-translation)
2. Script for downloading videos with built-in translation (add-on over vot-cli):
   | OS | Shell | Author | Link |
   | --- | --- | --- | --- |
   | Windows | PowerShell | Dragoy | [Link](https://github.com/FOSWLY/vot-cli/tree/main/scripts)
   | Unix | Fish | Musickiller | [Link](https://gitlab.com/musickiller/fishy-voice-over/)
   | Linux | Bash | s-n-alexeyev | [Link](https://github.com/s-n-alexeyev/yvt)
   | Cloud | Google Colab | alex2844 | [Link](https://github.com/alex2844/youtube-translate)

## ❗ Note

1. Wrap links in quotation marks in order to avoid errors
2. To write to the system partition (for example, to "Disk C" in Windows), administrator rights are required

![example btn](https://github.com/FOSWLY/vot-cli/blob/main/img/example.png "example")
