#!/usr/bin/env node
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import chalk from "chalk";
import parseArgs from "minimist";
import { Listr } from "listr2";
import { v4 as uuidv4 } from "uuid";

import { 
  availableLangs, 
  additionalTTS,
  liveVoicesSupportedPlatforms,
} from "./config/constants.js";
import validate from "./utils/validator.js";
import getVideoId from "./utils/getVideoId.js";
import translateVideo from "./translateVideo.js";
import downloadFile from "./download.js";
import { clearFileName } from "./utils/utils.js";
import yandexRequests from "./yandexRequests.js";
import yandexProtobuf from "./yandexProtobuf.js";
import parseProxy from "./proxy.js";
import coursehunterUtils from "./utils/coursehunter.js";
import {
  createVideoWithTranslation,
  createVideoWithAllAudioTracks,
} from "./mergeVideo.js";
import getVideoTitle from "./utils/getVideoTitle.js";
import youtubeInfo from "./youtubeInfo.js";

// Автоматически читаем версию из package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync(join(__dirname, "../package.json"), "utf8"));
const version = packageJson.version;
const HELP_MESSAGE = `
A small script that allows you to download an audio translation from Yandex via the terminal.

Usage:
  vot-cli [options] [args] <link> [link2] [link3] ...

Args:
  --output — Set the directory to download
  --output-file — Set the file name to download (requires specifying a dir to download in "--output" argument)
  --lang — Set the source video language
  --reslang — Set the audio track language (You can see all supported languages in the documentation. Default: ru)
  --voice-style — Set voice style (tts - standard TTS, live - live voices/живые голоса. Default: live)
                  Note: Live voices work best with YouTube, Twitch, Vimeo
                  For other platforms (VK, OK.ru), TTS is used automatically
  --force-live-voices — Try live voices even for unsupported platforms (may fail. Default: false)
  --merge-video — Merge video with translation audio (requires yt-dlp and ffmpeg)
  --ru — RU preset (implies --merge-video): multi-track container where the default track
         is the Yandex RU translation mixed over the original, plus the pure Yandex RU track,
         the original audio and the YouTube RU auto-dub (if available). Also downloads
         Russian auto-generated subtitles and embeds chapters. Equivalent to:
         --merge-video --dub-langs="ru" --yt-auto-subs --sub-langs="ru"
  --keep-original-audio — Keep original audio when merging (mix with translation. Default: true)
  --separate-tracks — Don't mix: put translation and original as separate audio tracks
                      (switchable in the player. Requires --merge-video. Default: false)
  --all-dubs — With --merge-video: also mux ALL YouTube auto-dub audio tracks into the container
               (plus Yandex translation track and a mix track). See also --dub-langs
  --dub-langs — Comma-separated YouTube auto-dub languages to add (e.g. "ru,de").
                Separate from --reslang. Requires --merge-video. Example: --dub-langs="ru,es"
  --chapters — Embed YouTube chapters into the output video (true | false. Default: true)
  --yt-subs — Download user-uploaded YouTube subtitles (langs from --sub-langs)
  --yt-auto-subs — Download auto-generated YouTube subtitles (langs from --sub-langs)
  --sub-langs — Comma-separated languages for --yt-subs/--yt-auto-subs (default: same as --reslang)
                (Yandex subtitles are downloaded via --subs and use --reslang as before)
  --normalize-audio — Normalize audio levels for consistent volume (uses dynaudnorm. Default: true)
  --translation-volume — Set translation audio volume (0.0-2.0. Default: 1.0)
  --original-volume — Set original audio volume (0.0-2.0. Default: 1.0)
  --proxy — Set proxy in format ([<PROTOCOL>://]<USERNAME>:<PASSWORD>@<HOST>[:<port>])
  --force-proxy — Don't start the transfer if the proxy could not be identified (true | false. Default: false)
  --api-token — Yandex OAuth token for videos that require authorization (SESSION_REQUIRED).
                Can also be set via the VOT_API_TOKEN environment variable
  --quiet — Minimal output mode: only audio URL to stdout, errors to stderr (for scripting)
  --json — JSON output mode: structured data for programmatic processing

Options:
  -h, --help — Show help
  -v, --version — Show version
  --subs, --subtitles — Get video subtitles instead of audio (the subtitle language for saving is taken from --reslang)
`;

// LANG PAIR
let REQUEST_LANG = "en";
let RESPONSE_LANG = "ru";
let USE_LIVE_VOICES = true; // по умолчанию используем живые голоса
let proxyData = false;

// ARG PARSER
const argv = parseArgs(process.argv.slice(2), {
  boolean: ["merge-video", "separate-tracks", "all-dubs", "yt-subs", "yt-auto-subs", "ru", "force-live-voices", "subs", "subtitles", "subs-srt", "subtitles-srt", "help", "h", "version", "v", "force-proxy", "quiet", "json"],
  string: ["output", "output-file", "lang", "reslang", "voice-style", "proxy", "translation-volume", "original-volume", "api-token", "dub-langs", "sub-langs"],
});

const ARG_LINKS = argv._;
const OUTPUT_DIR = argv.output;
const OUTPUT_FILE = argv["output-file"];
const IS_SUBS_FORMAT_SRT = argv["subs-srt"] || argv["subtitles-srt"];
const RESPONSE_SUBTITLES_FORMAT = IS_SUBS_FORMAT_SRT ? "srt" : "json";
const IS_SUBS_REQ = argv.subs || argv.subtitles || IS_SUBS_FORMAT_SRT;
const ARG_HELP = argv.help || argv.h;
const ARG_VERSION = argv.version || argv.v;
const PROXY_STRING = argv.proxy;
let FORCE_PROXY = argv["force-proxy"] ?? false;
// Пресет --ru: RU-перевод + автодубляж RU + автосубтитры RU + главы в мульти-трек контейнере
const RU_PACK = argv["ru"] === true || argv["ru"] === "";
const MERGE_VIDEO = argv["merge-video"] === true || argv["merge-video"] === "" || RU_PACK;
// ВАЖНО: эти флаги НЕ в boolean-списке minimist, т.к. minimist даёт boolean-флагам
// значение false (не undefined) при отсутствии — ломало дефолты `?? true`.
// Значение по умолчанию true, отключение: --keep-original-audio=false / --normalize-audio=false / --chapters=false
const isExplicitFalse = (v) => v === false || v === "false" || v === "0";
const KEEP_ORIGINAL_AUDIO = isExplicitFalse(argv["keep-original-audio"]) ? false : true;
const NORMALIZE_AUDIO = isExplicitFalse(argv["normalize-audio"]) ? false : true;
const SEPARATE_TRACKS = argv["separate-tracks"] ?? false;
const FORCE_LIVE_VOICES = argv["force-live-voices"] ?? false;
const TRANSLATION_VOLUME = parseFloat(argv["translation-volume"]) || 1.0;
const ORIGINAL_VOLUME = parseFloat(argv["original-volume"]) || 1.0;
const QUIET_MODE = argv.quiet ?? false;
const JSON_MODE = argv.json ?? false;
const API_TOKEN = argv["api-token"] || process.env.VOT_API_TOKEN || null;

// Set environment variable for child modules
if (QUIET_MODE || JSON_MODE) {
  process.env.VOT_CLI_QUIET = '1';
}

// Validate conflicting flags
if (QUIET_MODE && JSON_MODE) {
  console.error(chalk.red("❌ Cannot use --quiet and --json together. Choose one."));
  process.exit(1);
}

// Helper functions for output modes
const log = (...args) => {
  if (!QUIET_MODE && !JSON_MODE) {
    console.log(...args);
  }
};

const logError = (...args) => {
  if (JSON_MODE) {
    // В JSON режиме ошибки тоже будут в JSON
    return;
  }
  console.error(...args);
};

// Storage for results (used in quiet/json modes)
const processedResults = [];

if (argv["voice-style"] !== undefined) {
  const voiceStyleValue = argv["voice-style"].toLowerCase();
  if (voiceStyleValue === "tts" || voiceStyleValue === "live") {
    USE_LIVE_VOICES = (voiceStyleValue === "live");
    log(chalk.cyan(`🎤 Voice style is set to ${USE_LIVE_VOICES ? "live voices (живые голоса) 🔥" : "standard TTS 🤖"}`));
  } else {
    logError(chalk.yellow("⚠️  Invalid voice-style value. Using default (live - live voices)"));
  }
}

if (availableLangs.includes(argv.lang)) {
  REQUEST_LANG = argv.lang;
  log(chalk.cyan(`🌐 Request language is set to ${chalk.bold(REQUEST_LANG.toUpperCase())}`));
}

if (
  additionalTTS.includes(argv.reslang) ||
  (Boolean(IS_SUBS_REQ) && argv.reslang)
) {
  RESPONSE_LANG = argv.reslang;
  log(chalk.cyan(`🗣️  Response language is set to ${chalk.bold(RESPONSE_LANG.toUpperCase())}`));
}

// * Пресет --ru: мульти-трек с русским переводом + русский автодубляж (если есть)
//   + русские автосубтитры + главы. Основная дорожка — микс перевода Яндекса с оригиналом.
//   (RU_PACK объявлен выше — до MERGE_VIDEO)

// * YouTube автодубляжи (--all-dubs / --dub-langs / --ru) — язык дорожек задаётся ОТДЕЛЬНО от --reslang
const ALL_DUBS = argv["all-dubs"] === true || argv["all-dubs"] === "";
const DUB_LANGS = argv["dub-langs"]
  ? String(argv["dub-langs"])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : null;
const IS_DUBS_MODE = Boolean(ALL_DUBS || DUB_LANGS || RU_PACK);

// * YouTube субтитры (--yt-subs / --yt-auto-subs / --ru) — языки тоже отдельным ключом --sub-langs
const YT_SUBS_MODES = [
  ...(argv["yt-subs"] ? [false] : []), // пользовательские (только явно)
  ...(argv["yt-auto-subs"] || RU_PACK ? [true] : []), // автосгенерированные (в пресете --ru включены)
];
const IS_YT_SUBS_REQ = YT_SUBS_MODES.length > 0;
const SUB_LANGS = argv["sub-langs"]
  ? String(argv["sub-langs"])
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  : [RESPONSE_LANG];

// * Главы YouTube -> контейнер (по умолчанию ON, отключается --chapters=false)
const CHAPTERS = isExplicitFalse(argv["chapters"]) ? false : true;

if (RU_PACK) {
  log(chalk.cyan(`🇷🇺 RU preset: multi-track RU translation + RU auto-dub + RU auto-subs + chapters`));
}

if (IS_DUBS_MODE) {
  const effectiveDubLangs = DUB_LANGS ?? (RU_PACK ? ["ru"] : []);
  const langsDesc = ALL_DUBS ? "все доступные" : effectiveDubLangs.join(", ");
  log(chalk.cyan(`🎧 YouTube auto-dub mode: ${chalk.bold(langsDesc)}`));
}
if (IS_YT_SUBS_REQ) {
  log(chalk.cyan(`📝 YouTube subtitles: ${YT_SUBS_MODES.map((a) => (a ? "auto" : "manual")).join(" + ")}, langs: ${chalk.bold(SUB_LANGS.join(","))}`));
}
if (!CHAPTERS) {
  log(chalk.yellow(`📍 Chapters embedding is disabled`));
}

if (PROXY_STRING) {
  log(chalk.cyan(`🌍 Parsing proxy configuration...`));
  proxyData = parseProxy(PROXY_STRING);
  if (proxyData) {
    log(chalk.green(`✅ Proxy configured: ${proxyData.host}:${proxyData.port || 'default'}`));
  } else {
    logError(chalk.red(`❌ Failed to parse proxy configuration`));
  }
}

if (FORCE_PROXY && !proxyData) {
  throw new Error(
    chalk.red(
      "❌ vot-cli operation was interrupted due to the force-proxy option",
    ),
  );
}

if (API_TOKEN) {
  log(chalk.cyan(`🔑 Yandex OAuth token is set (used when Yandex requires authorization)`));
}

// TASKS - renderer будет установлен позже в зависимости от режима
let tasks;

const translate = async (finalURL, task, useLiveVoices = USE_LIVE_VOICES) => {
  // Весь цикл ожидания (WAITING/PART_CONTENT/AUDIO_REQUESTED/SESSION_REQUIRED)
  // выполняется внутри translateVideo, которая следует интервалам remainingTime
  // от Яндекса и ждёт до 90 минут — этого хватает и для длинных видео.
  let translateData;

  try {
    await translateVideo(
      finalURL,
      REQUEST_LANG,
      RESPONSE_LANG,
      null,
      proxyData,
      (success, urlOrError) => {
        if (success) {
          if (!urlOrError) {
            translateData = {
              success: false,
              urlOrError: "The response doesn't contain a download link",
            };
            return;
          }

          task.title = "Video translated successfully.";
          if (!QUIET_MODE && !JSON_MODE) {
            console.info(`Audio Link (${finalURL}): "${chalk.gray(urlOrError)}"`);
          }
          translateData = {
            success,
            urlOrError,
          };
          return;
        }

        translateData = {
          success: false,
          urlOrError: urlOrError || "Translation failed",
        };
      },
      useLiveVoices,
      {
        apiToken: API_TOKEN,
        onProgress: (message) => {
          task.title = `⏳ ${message}`;
          if (!QUIET_MODE && !JSON_MODE) {
            console.log(chalk.gray(`   └─ ⏳ ${message}`));
          }
        },
      },
    );
  } catch (e) {
    return {
      success: false,
      urlOrError: e.message,
    };
  }

  return (
    translateData ?? {
      success: false,
      urlOrError: "Translation failed: no response from Yandex API",
    }
  );
};

const fetchSubtitles = async (finalURL, task) => {
  let subtitlesData;

  try {
    await yandexRequests.requestVideoSubtitles(
      finalURL,
      REQUEST_LANG,
      proxyData,
      (success, response) => {
        if (!success) {
          throw new Error(chalk.red("Failed to get Yandex subtitles"));
        }

        const subtitlesResponse =
          yandexProtobuf.decodeSubtitlesResponse(response);

        let subtitles = subtitlesResponse.subtitles ?? [];
        subtitles = subtitles.reduce((result, yaSubtitlesObject) => {
          if (
            yaSubtitlesObject.language &&
            !result.find((e) => {
              if (
                e.source === "yandex" &&
                e.language === yaSubtitlesObject.language &&
                !e.translatedFromLanguage
              ) {
                return e;
              }
            })
          ) {
            result.push({
              source: "yandex",
              language: yaSubtitlesObject.language,
              url: yaSubtitlesObject.url,
            });
          }
          if (yaSubtitlesObject.translatedLanguage) {
            result.push({
              source: "yandex",
              language: yaSubtitlesObject.translatedLanguage,
              translatedFromLanguage: yaSubtitlesObject.language,
              url: yaSubtitlesObject.translatedUrl,
            });
          }
          return result;
        }, []);

        task.title = "Subtitles for the video have been received.";
        console.info(
          `Subtitles response (${finalURL}): "${chalk.gray(
            JSON.stringify(subtitles, null, 2),
          )}"`,
        );

        subtitlesData = {
          success: true,
          subsOrError: subtitles,
        };
      },
    );
  } catch (e) {
    return {
      success: false,
      subsOrError: e.message,
    };
  }

  return subtitlesData;
};

async function main() {
  if (ARG_LINKS.length === 0) {
    if (ARG_HELP) {
      return console.log(HELP_MESSAGE);
    } else if (ARG_VERSION) {
      return console.log(`🎬 vot-cli ${version}`);
    } else {
      return console.error(chalk.red("❌ No links provided"));
    }
  }

  // Создаём tasks с правильным renderer
  tasks = new Listr([], {
    concurrent: true,
    exitOnError: false,
    renderer: (QUIET_MODE || JSON_MODE) ? 'silent' : 'default',
  });

  // Красивый баннер при запуске (только в обычном режиме)
  if (!QUIET_MODE && !JSON_MODE) {
    console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.white('        🎬 VOT-CLI with Live Voices 🔥                ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════╝'));
    console.log(chalk.gray('  Это форк продукта https://github.com/FOSWLY/vot-cli/'));
    console.log(chalk.gray('  Вся слава Илье @ToilOfficial 🙏\n'));
    
    console.log(chalk.gray(`📦 Version: ${version}`));
    console.log(chalk.gray(`🎯 Videos to process: ${ARG_LINKS.length}`));
    if (MERGE_VIDEO) {
      console.log(chalk.yellow(`🎬 Video merge mode: ${chalk.bold('ENABLED')}`));
      if (SEPARATE_TRACKS) {
        console.log(chalk.gray(`   ├─ Audio tracks: translation + original (separate, switchable in player)`));
      } else {
        console.log(chalk.gray(`   ├─ Original volume: ${ORIGINAL_VOLUME * 100}%`));
        console.log(chalk.gray(`   ├─ Translation volume: ${TRANSLATION_VOLUME * 100}%`));
      }
      console.log(chalk.gray(`   └─ Audio normalization: ${NORMALIZE_AUDIO && !SEPARATE_TRACKS ? chalk.green('ON') + ' 🎚️' : chalk.yellow('OFF')}`));
    }
    console.log('');
  }

  if (Boolean(OUTPUT_DIR) && !fs.existsSync(OUTPUT_DIR)) {
    try {
      log(chalk.cyan(`📁 Creating output directory: ${OUTPUT_DIR}`));
      fs.mkdirSync(OUTPUT_DIR);
      log(chalk.green(`✅ Directory created successfully\n`));
    } catch {
      throw new Error(chalk.red("❌ Invalid output directory"));
    }
  } else if (Boolean(OUTPUT_DIR)) {
    log(chalk.green(`✅ Output directory exists: ${OUTPUT_DIR}\n`));
  }

  for (const url of ARG_LINKS) {
    const service = validate(url);
    if (!service) {
      logError(chalk.red(`URL: ${url} is unknown service`));
      continue;
    }

    let videoId = getVideoId(service.host, url);
    if (
      typeof videoId === "object" &&
      ["coursehunter"].includes(service.host)
    ) {
      const [statusOrID, lessonId] = videoId;
      if (!statusOrID) {
        logError(chalk.red(`Entered unsupported link: ${url}`));
        continue;
      }

      const coursehunterData = await coursehunterUtils
        .getVideoData(statusOrID, lessonId)
        .then((data) => data);

      videoId = coursehunterData.url;
    }

    if (!videoId) {
      logError(chalk.red(`Entered unsupported link: ${url}`));
      continue;
    }

    tasks.add([
      {
        title: `Performing various tasks (ID: ${videoId}).`,
        task: async (ctx, task) =>
          task.newListr(
            (parent) => [
              {
                title: `🔗 Forming a link to the video`,
                task: async () => {
                  const finalURL =
                    videoId.startsWith("https://") || service.host === "custom"
                      ? videoId
                      : `${service.url}${videoId}`;
                  if (!finalURL) {
                    throw new Error(`Entered unsupported link: ${finalURL}`);
                  }
                  parent.finalURL = finalURL;
                  parent.serviceHost = service.host;
                  if (!QUIET_MODE && !JSON_MODE) {
                    console.log(chalk.gray(`   └─ URL: ${finalURL}`));
                    console.log(chalk.gray(`   └─ Platform: ${service.host}`));
                  }
                  
                  // Проверяем поддержку live voices для данной платформы
                  parent.useLiveVoices = USE_LIVE_VOICES;
                  
                  if (USE_LIVE_VOICES && !liveVoicesSupportedPlatforms.includes(service.host)) {
                    if (!QUIET_MODE && !JSON_MODE) {
                      console.log(chalk.yellow(`   └─ ⚠️  Live voices not officially supported for ${service.host}`));
                    }
                    
                    if (FORCE_LIVE_VOICES) {
                      if (!QUIET_MODE && !JSON_MODE) {
                        console.log(chalk.yellow(`      Trying anyway due to --force-live-voices flag...`));
                      }
                      parent.useLiveVoices = true;
                      parent.shouldFallbackToTTS = true; // Если не сработает, попробуем TTS
                    } else {
                      if (!QUIET_MODE && !JSON_MODE) {
                        console.log(chalk.cyan(`      Using standard TTS instead (better compatibility)`));
                      }
                      parent.useLiveVoices = false;
                    }
                  }
                  
                  // Получаем название видео для имени файла
                  try {
                    if (!QUIET_MODE && !JSON_MODE) {
                      console.log(chalk.cyan(`   └─ 📺 Fetching video title...`));
                    }
                    parent.videoTitle = await getVideoTitle(finalURL);
                    if (parent.videoTitle && !QUIET_MODE && !JSON_MODE) {
                      console.log(chalk.green(`   └─ ✅ Title: "${parent.videoTitle}"`));
                    }
                  } catch (e) {
                    if (!QUIET_MODE && !JSON_MODE) {
                      console.log(chalk.yellow(`   └─ ⚠️  Could not fetch title, using video ID`));
                    }
                    parent.videoTitle = null;
                  }
                },
              },
              {
                title: `🎤 Translating (ID: ${videoId})`,
                enabled: !IS_SUBS_REQ,
                exitOnError: false,
                task: async (ctxSub, subtask) => {
                  await new Promise(async (resolve, reject) => {
                    try {
                      let result;
                      const voiceType = parent.useLiveVoices ? 'live voices 🔥' : 'TTS 🤖';
                      subtask.title = `🎤 Translating (ID: ${videoId}) with ${voiceType}`;

                      if (!QUIET_MODE && !JSON_MODE) {
                        console.log(chalk.cyan(`   └─ 📡 Requesting translation from Yandex API...`));
                      }
                      result = await translate(parent.finalURL, subtask, parent.useLiveVoices);

                      // Проверяем нужен ли fallback на TTS
                      if (!result.success && parent.shouldFallbackToTTS && parent.useLiveVoices) {
                        if (!QUIET_MODE && !JSON_MODE) {
                          console.log(chalk.yellow(`   └─ ⚠️  Live voices failed, retrying with TTS...`));
                        }
                        parent.useLiveVoices = false;
                        subtask.title = `🎤 Translating (ID: ${videoId}) with TTS 🤖 (fallback)`;
                        result = await translate(parent.finalURL, subtask, false);
                      }

                      parent.translateResult = result;
                      if (!result.success) {
                        subtask.title = `❌ ${result.urlOrError}`;
                      } else {
                        const finalVoiceType = parent.useLiveVoices ? 'live voices 🔥' : 'TTS 🤖';
                        subtask.title = `✅ Translated successfully with ${finalVoiceType}`;
                      }
                      resolve(result);
                    } catch (e) {
                      reject(e);
                    }
                  });
                },
              },
              {
                title: `Fetching subtitles (ID: ${videoId}).`,
                enabled: Boolean(IS_SUBS_REQ),
                exitOnError: false,
                task: async (ctxSub, subtask) => {
                  await new Promise(async (resolve, reject) => {
                    try {
                      let result;
                      result = await fetchSubtitles(parent.finalURL, subtask);
                      parent.translateResult = result;
                      if (!result.success) {
                        subtask.title = result.urlOrError;
                      }
                      resolve(result);
                    } catch (e) {
                      reject(e);
                    }
                  });
                },
              },
              {
                title: `📥 Downloading audio translation (ID: ${videoId})`,
                exitOnError: false,
                enabled: Boolean(OUTPUT_DIR) && !IS_SUBS_REQ,
                task: async (ctxSub, subtask) => {
                  // * Video download

                  if (
                    !(
                      parent.translateResult?.success &&
                      parent.translateResult?.urlOrError
                    )
                  ) {
                    throw new Error(
                      chalk.red(
                        `Downloading failed! Link "${parent.translateResult?.urlOrError}" not found`,
                      ),
                    );
                  }

                  const taskSubTitle = `(ID: ${videoId})`;
                  const filename = OUTPUT_FILE
                    ? OUTPUT_FILE.endsWith(".mp3")
                      ? OUTPUT_FILE
                      : `${OUTPUT_FILE}.mp3`
                    : parent.videoTitle
                      ? `${parent.videoTitle}.mp3`
                      : `${clearFileName(videoId)}---${uuidv4()}.mp3`;
                  
                  if (!QUIET_MODE && !JSON_MODE) {
                    console.log(chalk.cyan(`   └─ 💾 Saving as: ${chalk.bold(filename)}`));
                    console.log(chalk.gray(`   └─ 🔗 Source: ${parent.translateResult.urlOrError.substring(0, 60)}...`));
                  }
                  
                  await downloadFile(
                    parent.translateResult.urlOrError,
                    `${OUTPUT_DIR}/${filename}`,
                    subtask,
                    `(ID: ${videoId} as ${filename})`,
                  )
                    .then(() => {
                      const fileSize = fs.statSync(`${OUTPUT_DIR}/${filename}`).size;
                      const fileSizeMB = (fileSize / 1024 / 1024).toFixed(2);
                      subtask.title = `✅ Audio downloaded! (${fileSizeMB} MB)`;
                      if (!QUIET_MODE && !JSON_MODE) {
                        console.log(chalk.green(`   └─ ✅ File size: ${fileSizeMB} MB`));
                      }
                    })
                    .catch((e) => {
                      subtask.title = `❌ Error. Download ${taskSubTitle} failed! Reason: ${e.message}`;
                    });
                },
              },
              {
                title: `Downloading (ID: ${videoId}).`,
                exitOnError: false,
                enabled: Boolean(OUTPUT_DIR) && Boolean(IS_SUBS_REQ),
                task: async (ctxSub, subtask) => {
                  // * Subs download

                  if (
                    !(
                      parent.translateResult?.success &&
                      parent.translateResult?.subsOrError
                    )
                  ) {
                    throw new Error(
                      chalk.red(
                        `Downloading failed! Link "${parent.translateResult?.subsOrError}" not found`,
                      ),
                    );
                  }

                  const subOnReqLang = parent.translateResult.subsOrError.find(
                    (s) => s.language === RESPONSE_LANG,
                  );
                  if (!subOnReqLang) {
                    throw new Error(
                      chalk.red(
                        `Downloading failed! Failed to find ${RESPONSE_LANG} in the resulting list of subtitles`,
                      ),
                    );
                  }

                  const taskSubTitle = `(ID: ${videoId})`;
                  const filename = OUTPUT_FILE
                    ? OUTPUT_FILE.endsWith(`.${RESPONSE_SUBTITLES_FORMAT}`)
                      ? OUTPUT_FILE
                      : `${OUTPUT_FILE}.${RESPONSE_SUBTITLES_FORMAT}`
                    : `${subOnReqLang.language}---${clearFileName(
                        videoId,
                      )}---${uuidv4()}.${RESPONSE_SUBTITLES_FORMAT}`;
                  await downloadFile(
                    subOnReqLang.url,
                    `${OUTPUT_DIR}/${filename}`,
                    subtask,
                    `(ID: ${videoId} as ${filename})`,
                  )
                    .then(() => {
                      subtask.title = `Download ${taskSubTitle} completed!`;
                    })
                    .catch((e) => {
                      subtask.title = `Error. Download ${taskSubTitle} failed! Reason: ${e.message}`;
                    });
                },
              },
              {
                title: `Downloading YouTube subtitles (ID: ${videoId}).`,
                enabled: Boolean(OUTPUT_DIR) && IS_YT_SUBS_REQ,
                exitOnError: false,
                task: async (ctxSub, subtask) => {
                  const baseName = OUTPUT_FILE
                    ? OUTPUT_FILE.replace(/\.(mp3|mp4|srt|json)$/i, "")
                    : clearFileName(parent.videoTitle || videoId);
                  const files = [];
                  const errors = [];
                  try {
                    for (const auto of YT_SUBS_MODES) {
                      try {
                        const downloaded = await youtubeInfo.downloadYouTubeSubtitles(
                          parent.finalURL,
                          {
                            langs: SUB_LANGS,
                            auto,
                            outputDir: OUTPUT_DIR,
                            baseName: baseName + (auto ? ".auto" : ".manual"),
                            ...(proxyData?.proxyUrl
                              ? { proxyUrl: proxyData.proxyUrl }
                              : {}),
                          },
                        );
                        files.push(...downloaded);
                      } catch (e) {
                        // у видео может не быть субтитров одного из типов — не фатально
                        errors.push(`${auto ? "auto" : "manual"}: ${e.message}`);
                      }
                    }
                    if (files.length === 0) {
                      throw new Error(errors.join("; ") || "no subtitles found");
                    }
                    if (errors.length > 0 && !QUIET_MODE && !JSON_MODE) {
                      console.log(chalk.yellow(`   └─ ⚠️  ${errors.join("; ")}`));
                    }
                    parent.ytSubtitleFiles = files;
                    subtask.title = `✅ YouTube subtitles downloaded (${files.length} file(s))`;
                    if (!QUIET_MODE && !JSON_MODE) {
                      for (const f of files) {
                        console.log(chalk.green(`   └─ 📝 ${f}`));
                      }
                    }
                  } catch (e) {
                    subtask.title = `❌ YouTube subtitles failed: ${e.message}`;
                    throw new Error(chalk.red(`YouTube subtitles failed: ${e.message}`));
                  }
                },
              },
              {
                title: `🎬 Merging video with translation (ID: ${videoId})`,
                exitOnError: false,
                enabled: Boolean(OUTPUT_DIR) && Boolean(MERGE_VIDEO) && !IS_SUBS_REQ,
                task: async (ctxSub, subtask) => {
                  const hasYandexAudio = Boolean(
                    parent.translateResult?.success &&
                      parent.translateResult?.urlOrError,
                  );
                  // В мульти-трек режиме (--all-dubs/--dub-langs) можно собирать контейнер
                  // и без перевода Яндекса (только оригинал + дубляжи)
                  if (!hasYandexAudio && !IS_DUBS_MODE) {
                    throw new Error(
                      chalk.red(
                        `Merging failed! Audio link not found`,
                      ),
                    );
                  }

                  if (!QUIET_MODE && !JSON_MODE) {
                    console.log(chalk.cyan(`   └─ 🎥 Starting video merge process...`));
                    if (IS_DUBS_MODE) {
                      const effectiveLangs = DUB_LANGS ?? (RU_PACK ? ["ru"] : []);
                      const langsDesc = ALL_DUBS ? "ALL available" : effectiveLangs.join(", ");
                      console.log(chalk.gray(`      ├─ YouTube auto-dubs: ${langsDesc}`));
                      console.log(chalk.gray(`      ├─ Yandex translation track: ${hasYandexAudio ? "yes" : "no"}`));
                      console.log(chalk.gray(`      ├─ Mix track volumes: original ${ORIGINAL_VOLUME * 100}% / translation ${TRANSLATION_VOLUME * 100}%`));
                      console.log(chalk.gray(`      └─ Chapters: ${CHAPTERS ? "embed" : "skip"}`));
                    } else {
                      console.log(chalk.gray(`      ├─ Original volume: ${ORIGINAL_VOLUME * 100}%`));
                      console.log(chalk.gray(`      └─ Translation volume: ${TRANSLATION_VOLUME * 100}%`));
                    }
                  }

                  const audioFilename = OUTPUT_FILE
                    ? OUTPUT_FILE.endsWith(".mp3")
                      ? OUTPUT_FILE
                      : `${OUTPUT_FILE}.mp3`
                    : `${clearFileName(videoId)}---${uuidv4()}.mp3`;
                  const audioPath = `${OUTPUT_DIR}/${audioFilename}`;

                  const videoFilename = OUTPUT_FILE
                    ? (OUTPUT_FILE.endsWith(".mp4") ? OUTPUT_FILE : `${OUTPUT_FILE}.mp4`)
                    : parent.videoTitle
                      ? `${parent.videoTitle}.mp4`
                      : `${clearFileName(videoId)}---${uuidv4()}.mp4`;
                  const videoPath = `${OUTPUT_DIR}/${videoFilename}`;

                  if (hasYandexAudio) {
                    subtask.title = `📥 Downloading audio for merge...`;
                    if (!QUIET_MODE && !JSON_MODE) {
                      console.log(chalk.cyan(`   └─ 📥 Step 1/3: Downloading translation audio...`));
                    }
                    await downloadFile(
                      parent.translateResult.urlOrError,
                      audioPath,
                      null,
                      null,
                    );
                    const audioSize = (fs.statSync(audioPath).size / 1024 / 1024).toFixed(2);
                    if (!QUIET_MODE && !JSON_MODE) {
                      console.log(chalk.green(`      └─ ✅ Audio downloaded (${audioSize} MB)`));
                    }
                  } else if (!QUIET_MODE && !JSON_MODE) {
                    console.log(chalk.yellow(`   └─ ⚠️  Skipping Yandex audio (not available) — building dubs-only container`));
                  }

                  subtask.title = `🎬 Creating video with translation...`;
                  if (!QUIET_MODE && !JSON_MODE) {
                    console.log(chalk.cyan(`   └─ 🎬 Step 2/3: Merging video with translation...`));
                    console.log(chalk.gray(`      ├─ This may take several minutes...`));
                    console.log(chalk.gray(`      └─ Video: ${videoFilename}`));
                  }

                  if (IS_DUBS_MODE) {
                    // Мульти-трек: микс + перевод + оригинал + все автодубляжи + главы
                    const dubInfo = await createVideoWithAllAudioTracks(
                      parent.finalURL,
                      hasYandexAudio && fs.existsSync(audioPath) ? audioPath : null,
                      videoPath,
                      {
                        dubLangs: ALL_DUBS
                          ? "all"
                          : DUB_LANGS ?? (RU_PACK ? ["ru"] : null),
                        audioVolume: ORIGINAL_VOLUME,
                        translationVolume: TRANSLATION_VOLUME,
                        chapters: CHAPTERS,
                        ...(proxyData?.proxyUrl
                          ? { proxyUrl: proxyData.proxyUrl }
                          : {}),
                      },
                    );
                    parent.dubInfo = dubInfo;
                  } else {
                    await createVideoWithTranslation(
                      parent.finalURL,
                      audioPath,
                      videoPath,
                      {
                        keepOriginalAudio: KEEP_ORIGINAL_AUDIO,
                        separateTracks: SEPARATE_TRACKS,
                        audioVolume: ORIGINAL_VOLUME,
                        translationVolume: TRANSLATION_VOLUME,
                        normalizeAudio: NORMALIZE_AUDIO,
                        chapters: CHAPTERS,
                        ...(proxyData?.proxyUrl
                          ? { proxyUrl: proxyData.proxyUrl }
                          : {}),
                      },
                    );
                  }

                  // Удаляем временный аудио файл
                  if (!QUIET_MODE && !JSON_MODE) {
                    console.log(chalk.cyan(`   └─ 🧹 Step 3/3: Cleaning up temporary files...`));
                  }
                  if (fs.existsSync(audioPath)) {
                    fs.unlinkSync(audioPath);
                    if (!QUIET_MODE && !JSON_MODE) {
                      console.log(chalk.gray(`      └─ ✅ Temporary audio file removed`));
                    }
                  }

                  const videoSize = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(2);
                  subtask.title = `✅ Video created! (${videoSize} MB) - ${videoFilename}`;
                  
                  // Сохраняем путь к видео для quiet/json режимов
                  parent.mergedVideoPath = videoPath;
                  parent.mergedVideoSize = videoSize;
                  
                  if (!QUIET_MODE && !JSON_MODE) {
                    console.log(chalk.green(`   └─ ✅ Final video size: ${videoSize} MB`));
                    console.log(chalk.green(`   └─ 📁 Saved to: ${videoPath}`));
                  }
                },
              },
              {
                title: `Finish (ID: ${videoId}).`,
                task: () => {
                  parent.title = `Translating finished! (ID: ${videoId}).`;
                  
                  // Сохраняем результаты для quiet/json режимов
                  if (QUIET_MODE || JSON_MODE) {
                    const result = {
                      url: parent.finalURL,
                      platform: parent.serviceHost,
                      videoTitle: parent.videoTitle,
                      success: parent.translateResult?.success || false,
                      audioUrl: parent.translateResult?.success ? parent.translateResult.urlOrError : null,
                      error: !parent.translateResult?.success ? parent.translateResult?.urlOrError : null,
                      voiceType: parent.useLiveVoices ? 'live' : 'tts',
                    };
                    
                    // Если создано видео с переводом, добавляем путь к нему
                    if (parent.mergedVideoPath) {
                      result.mergedVideoPath = parent.mergedVideoPath;
                      result.mergedVideoSize = parent.mergedVideoSize;
                    }

                    if (parent.ytSubtitleFiles) {
                      result.youtubeSubtitleFiles = parent.ytSubtitleFiles;
                    }

                    if (parent.dubInfo) {
                      result.dubs = parent.dubInfo.dubs;
                      result.audioTracks = parent.dubInfo.audioTracks;
                      result.chaptersCount = parent.dubInfo.chaptersCount;
                    }

                    processedResults.push(result);
                  }
                },
              },
            ],
            {
              concurrent: false,
              rendererOptions: {
                collapseSubtasks: false,
              },
              exitOnError: false,
            },
          ),
      },
    ]);
  }

  try {
    // В quiet/json режиме отключаем listr UI полностью
    const runOptions = (QUIET_MODE || JSON_MODE) ? { renderer: 'silent' } : {};
    
    await tasks.run(runOptions);
    
    // Обработка результатов в зависимости от режима
    if (QUIET_MODE) {
      // В quiet режиме выводим путь к видео (если merge) или ссылку на аудио (stdout) и ошибки (stderr)
      let hasSuccess = false;
      let hasError = false;
      
      for (const result of processedResults) {
        if (result.success) {
          // Если создано видео - выводим путь к видео, иначе ссылку на аудио
          if (result.mergedVideoPath) {
            console.log(result.mergedVideoPath);
          } else if (result.audioUrl) {
            console.log(result.audioUrl);
          }
          hasSuccess = true;
        } else if (!result.success) {
          console.error(result.error || 'Unknown error');
          hasError = true;
        }
      }
      
      // Выходим с кодом 1 только если ВСЕ видео failed
      if (hasError && !hasSuccess) {
        process.exit(1);
      }
    } else if (JSON_MODE) {
      // В JSON режиме выводим структурированные данные
      console.log(JSON.stringify(processedResults, null, 2));
    } else {
      // Обычный режим с красивым UI
      console.log('');
      console.log(chalk.green('╔═══════════════════════════════════════════════════════════╗'));
      console.log(chalk.green('║') + chalk.bold.white('            🎉 ALL TASKS COMPLETED! 🎉                 ') + chalk.green('║'));
      console.log(chalk.green('╚═══════════════════════════════════════════════════════════╝'));
      console.log('');
      console.log(chalk.cyan(`✅ Successfully processed ${ARG_LINKS.length} video(s)`));
      if (OUTPUT_DIR) {
        console.log(chalk.cyan(`📁 Output directory: ${OUTPUT_DIR}`));
      }
      console.log('');
    }
  } catch (e) {
    if (JSON_MODE) {
      console.log(JSON.stringify({ success: false, error: e.message }, null, 2));
      process.exit(1);
    } else if (QUIET_MODE) {
      console.error(e.message);
      process.exit(1);
    } else {
      console.error('');
      console.error(chalk.red('╔═══════════════════════════════════════════════════════════╗'));
      console.error(chalk.red('║') + chalk.bold.white('                ❌ ERROR OCCURRED ❌                   ') + chalk.red('║'));
      console.error(chalk.red('╚═══════════════════════════════════════════════════════════╝'));
      console.error('');
      console.error(e);
      console.error('');
    }
  }
}

await main().catch((e) => {
  console.error(chalk.red("[VOT]", e));
});
