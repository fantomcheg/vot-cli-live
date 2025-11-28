#!/usr/bin/env node
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import chalk from "chalk";
import parseArgs from "minimist";
import { Listr } from "listr2";
import { v4 as uuidv4 } from "uuid";

import { availableLangs, additionalTTS } from "./config/constants.js";
import validate from "./utils/validator.js";
import getVideoId from "./utils/getVideoId.js";
import translateVideo from "./translateVideo.js";
import downloadFile from "./download.js";
import { clearFileName } from "./utils/utils.js";
import yandexRequests from "./yandexRequests.js";
import yandexProtobuf from "./yandexProtobuf.js";
import parseProxy from "./proxy.js";
import coursehunterUtils from "./utils/coursehunter.js";
import { createVideoWithTranslation } from "./mergeVideo.js";
import getVideoTitle from "./utils/getVideoTitle.js";

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
  --merge-video — Merge video with translation audio (requires yt-dlp and ffmpeg)
  --keep-original-audio — Keep original audio when merging (mix with translation. Default: true)
  --translation-volume — Set translation audio volume (0.0-2.0. Default: 1.0)
  --original-volume — Set original audio volume (0.0-2.0. Default: 1.0)
  --proxy — Set proxy in format ([<PROTOCOL>://]<USERNAME>:<PASSWORD>@<HOST>[:<port>])
  --force-proxy — Don't start the transfer if the proxy could not be identified (true | false. Default: false)

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
  boolean: ["merge-video", "keep-original-audio", "subs", "subtitles", "subs-srt", "subtitles-srt", "help", "h", "version", "v", "force-proxy"],
  string: ["output", "output-file", "lang", "reslang", "voice-style", "proxy", "translation-volume", "original-volume"],
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
const MERGE_VIDEO = argv["merge-video"] === true || argv["merge-video"] === "";
const KEEP_ORIGINAL_AUDIO = argv["keep-original-audio"] ?? true;
const TRANSLATION_VOLUME = parseFloat(argv["translation-volume"]) || 1.0;
const ORIGINAL_VOLUME = parseFloat(argv["original-volume"]) || 1.0;

if (argv["voice-style"] !== undefined) {
  const voiceStyleValue = argv["voice-style"].toLowerCase();
  if (voiceStyleValue === "tts" || voiceStyleValue === "live") {
    USE_LIVE_VOICES = (voiceStyleValue === "live");
    console.log(chalk.cyan(`🎤 Voice style is set to ${USE_LIVE_VOICES ? "live voices (живые голоса) 🔥" : "standard TTS 🤖"}`));
  } else {
    console.error(chalk.yellow("⚠️  Invalid voice-style value. Using default (live - live voices)"));
  }
}

if (availableLangs.includes(argv.lang)) {
  REQUEST_LANG = argv.lang;
  console.log(chalk.cyan(`🌐 Request language is set to ${chalk.bold(REQUEST_LANG.toUpperCase())}`));
}

if (
  additionalTTS.includes(argv.reslang) ||
  (Boolean(IS_SUBS_REQ) && argv.reslang)
) {
  RESPONSE_LANG = argv.reslang;
  console.log(chalk.cyan(`🗣️  Response language is set to ${chalk.bold(RESPONSE_LANG.toUpperCase())}`));
}

if (PROXY_STRING) {
  console.log(chalk.cyan(`🌍 Parsing proxy configuration...`));
  proxyData = parseProxy(PROXY_STRING);
  if (proxyData) {
    console.log(chalk.green(`✅ Proxy configured: ${proxyData.host}:${proxyData.port || 'default'}`));
  } else {
    console.log(chalk.red(`❌ Failed to parse proxy configuration`));
  }
}

if (FORCE_PROXY && !proxyData) {
  throw new Error(
    chalk.red(
      "❌ vot-cli operation was interrupted due to the force-proxy option",
    ),
  );
}

// TASKS
const tasks = new Listr([], {
  concurrent: true,
  exitOnError: false,
});

const translate = async (finalURL, task) => {
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
            throw new Error(
              chalk.red("The response doesn't contain a download link"),
            );
          }

          task.title = "Video translated successfully.";
          console.info(`Audio Link (${finalURL}): "${chalk.gray(urlOrError)}"`);
          translateData = {
            success,
            urlOrError,
          };

          return;
        }

        if (urlOrError === "The translation will take a few minutes") {
          task.title = `The translation is slightly delayed...`;
        } else {
          throw new Error(chalk.red(urlOrError));
        }
      },
      USE_LIVE_VOICES, // передаем параметр live voices
    );
  } catch (e) {
    return {
      success: false,
      urlOrError: e.message,
    };
  }

  return translateData;
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

  // Красивый баннер при запуске
  console.log(chalk.cyan('\n╔═══════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold.white('        🎬 VOT-CLI with Live Voices 🔥                ') + chalk.cyan('║'));
  console.log(chalk.cyan('╚═══════════════════════════════════════════════════════════╝'));
  console.log(chalk.gray('  Это форк продукта https://github.com/FOSWLY/vot-cli/'));
  console.log(chalk.gray('  Вся слава Илье @ToilOfficial 🙏\n'));
  
  console.log(chalk.gray(`📦 Version: ${version}`));
  console.log(chalk.gray(`🎯 Videos to process: ${ARG_LINKS.length}`));
  if (MERGE_VIDEO) {
    console.log(chalk.yellow(`🎬 Video merge mode: ${chalk.bold('ENABLED')}`));
    console.log(chalk.gray(`   ├─ Original volume: ${ORIGINAL_VOLUME * 100}%`));
    console.log(chalk.gray(`   └─ Translation volume: ${TRANSLATION_VOLUME * 100}%`));
  }
  console.log('');

  if (Boolean(OUTPUT_DIR) && !fs.existsSync(OUTPUT_DIR)) {
    try {
      console.log(chalk.cyan(`📁 Creating output directory: ${OUTPUT_DIR}`));
      fs.mkdirSync(OUTPUT_DIR);
      console.log(chalk.green(`✅ Directory created successfully\n`));
    } catch {
      throw new Error(chalk.red("❌ Invalid output directory"));
    }
  } else if (Boolean(OUTPUT_DIR)) {
    console.log(chalk.green(`✅ Output directory exists: ${OUTPUT_DIR}\n`));
  }

  for (const url of ARG_LINKS) {
    const service = validate(url);
    if (!service) {
      console.error(chalk.red(`URL: ${url} is unknown service`));
      continue;
    }

    let videoId = getVideoId(service.host, url);
    if (
      typeof videoId === "object" &&
      ["coursehunter"].includes(service.host)
    ) {
      const [statusOrID, lessonId] = videoId;
      if (!statusOrID) {
        console.error(chalk.red(`Entered unsupported link: ${url}`));
        continue;
      }

      const coursehunterData = await coursehunterUtils
        .getVideoData(statusOrID, lessonId)
        .then((data) => data);

      videoId = coursehunterData.url;
    }

    if (!videoId) {
      console.error(chalk.red(`Entered unsupported link: ${url}`));
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
                  console.log(chalk.gray(`   └─ URL: ${finalURL}`));
                  
                  // Получаем название видео для имени файла
                  try {
                    console.log(chalk.cyan(`   └─ 📺 Fetching video title...`));
                    parent.videoTitle = await getVideoTitle(finalURL);
                    if (parent.videoTitle) {
                      console.log(chalk.green(`   └─ ✅ Title: "${parent.videoTitle}"`));
                    }
                  } catch (e) {
                    console.log(chalk.yellow(`   └─ ⚠️  Could not fetch title, using video ID`));
                    parent.videoTitle = null;
                  }
                },
              },
              {
                title: `🎤 Translating (ID: ${videoId}) with ${USE_LIVE_VOICES ? 'live voices 🔥' : 'TTS 🤖'}`,
                enabled: !IS_SUBS_REQ,
                exitOnError: false,
                task: async (ctxSub, subtask) => {
                  // ! TODO: НЕ РАБОТАЕТ ЕСЛИ ВИДЕО НЕ ИМЕЕТ ПЕРЕВОДА
                  await new Promise(async (resolve, reject) => {
                    try {
                      let result;
                      const MAX_RETRIES = 10; // Максимум 10 попыток (5 минут)
                      const RETRY_INTERVAL = 30000; // 30 секунд между попытками
                      let retryCount = 0;

                      console.log(chalk.cyan(`   └─ 📡 Requesting translation from Yandex API...`));
                      result = await translate(parent.finalURL, subtask);
                      // console.log("transalting", result)
                      if (typeof result !== "object") {
                        console.log(chalk.yellow(`   └─ ⏳ Translation is being prepared, waiting...`));
                        await new Promise(async (resolve, reject) => {
                          const intervalId = setInterval(async () => {
                            retryCount++;
                            if (retryCount > MAX_RETRIES) {
                              clearInterval(intervalId);
                              const errorMsg = `Translation timeout after ${MAX_RETRIES} attempts (${(MAX_RETRIES * RETRY_INTERVAL) / 60000} minutes). Try again later.`;
                              subtask.title = `❌ ${errorMsg}`;
                              reject(new Error(errorMsg));
                              return;
                            }
                            
                            subtask.title = `🎤 Translating (ID: ${videoId}) - attempt ${retryCount}/${MAX_RETRIES} ⏰`;
                            console.log(chalk.gray(`   └─ ⏳ Retry ${retryCount}/${MAX_RETRIES} (waiting ${RETRY_INTERVAL / 1000}s)...`));
                            // console.log("interval...", result)
                            result = await translate(parent.finalURL, subtask);
                            if (typeof result === "object") {
                              // console.log("finished", parent.translateResult)
                              clearInterval(intervalId);
                              console.log(chalk.green(`   └─ ✅ Translation ready!`));
                              resolve(result);
                            }
                          }, RETRY_INTERVAL);
                        });
                      } else {
                        console.log(chalk.green(`   └─ ✅ Translation received instantly (cached)`));
                      }
                      // console.log("translated", result)
                      parent.translateResult = result;
                      if (!result.success) {
                        subtask.title = `❌ ${result.urlOrError}`;
                      } else {
                        subtask.title = `✅ Translated successfully with ${USE_LIVE_VOICES ? 'live voices 🔥' : 'TTS 🤖'}`;
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
                  
                  console.log(chalk.cyan(`   └─ 💾 Saving as: ${chalk.bold(filename)}`));
                  console.log(chalk.gray(`   └─ 🔗 Source: ${parent.translateResult.urlOrError.substring(0, 60)}...`));
                  
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
                      console.log(chalk.green(`   └─ ✅ File size: ${fileSizeMB} MB`));
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
                title: `🎬 Merging video with translation (ID: ${videoId})`,
                exitOnError: false,
                enabled: Boolean(OUTPUT_DIR) && Boolean(MERGE_VIDEO) && !IS_SUBS_REQ,
                task: async (ctxSub, subtask) => {
                  if (
                    !(
                      parent.translateResult?.success &&
                      parent.translateResult?.urlOrError
                    )
                  ) {
                    throw new Error(
                      chalk.red(
                        `Merging failed! Audio link not found`,
                      ),
                    );
                  }

                  console.log(chalk.cyan(`   └─ 🎥 Starting video merge process...`));
                  console.log(chalk.gray(`      ├─ Original volume: ${ORIGINAL_VOLUME * 100}%`));
                  console.log(chalk.gray(`      └─ Translation volume: ${TRANSLATION_VOLUME * 100}%`));

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

                  subtask.title = `📥 Downloading audio for merge...`;
                  console.log(chalk.cyan(`   └─ 📥 Step 1/3: Downloading translation audio...`));
                  await downloadFile(
                    parent.translateResult.urlOrError,
                    audioPath,
                    null,
                    null,
                  );
                  const audioSize = (fs.statSync(audioPath).size / 1024 / 1024).toFixed(2);
                  console.log(chalk.green(`      └─ ✅ Audio downloaded (${audioSize} MB)`));

                  subtask.title = `🎬 Creating video with translation...`;
                  console.log(chalk.cyan(`   └─ 🎬 Step 2/3: Merging video with translation...`));
                  console.log(chalk.gray(`      ├─ This may take several minutes...`));
                  console.log(chalk.gray(`      └─ Video: ${videoFilename}`));
                  
                  await createVideoWithTranslation(
                    parent.finalURL,
                    audioPath,
                    videoPath,
                    {
                      keepOriginalAudio: KEEP_ORIGINAL_AUDIO,
                      audioVolume: ORIGINAL_VOLUME,
                      translationVolume: TRANSLATION_VOLUME,
                      ...(proxyData?.proxyUrl
                        ? { proxyUrl: proxyData.proxyUrl }
                        : {}),
                    },
                  );

                  // Удаляем временный аудио файл
                  console.log(chalk.cyan(`   └─ 🧹 Step 3/3: Cleaning up temporary files...`));
                  if (fs.existsSync(audioPath)) {
                    fs.unlinkSync(audioPath);
                    console.log(chalk.gray(`      └─ ✅ Temporary audio file removed`));
                  }

                  const videoSize = (fs.statSync(videoPath).size / 1024 / 1024).toFixed(2);
                  subtask.title = `✅ Video created! (${videoSize} MB) - ${videoFilename}`;
                  console.log(chalk.green(`   └─ ✅ Final video size: ${videoSize} MB`));
                  console.log(chalk.green(`   └─ 📁 Saved to: ${videoPath}`));
                },
              },
              {
                title: `Finish (ID: ${videoId}).`,
                task: () => {
                  parent.title = `Translating finished! (ID: ${videoId}).`;
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
    await tasks.run();
    
    // Красивый финальный баннер
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
  } catch (e) {
    console.error('');
    console.error(chalk.red('╔═══════════════════════════════════════════════════════════╗'));
    console.error(chalk.red('║') + chalk.bold.white('                ❌ ERROR OCCURRED ❌                   ') + chalk.red('║'));
    console.error(chalk.red('╚═══════════════════════════════════════════════════════════╝'));
    console.error('');
    console.error(e);
    console.error('');
  }
}

await main().catch((e) => {
  console.error(chalk.red("[VOT]", e));
});
