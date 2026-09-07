import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import youtubeInfo from "./youtubeInfo.js";

const execAsync = promisify(exec);

// Обертка для execAsync с таймаутом
async function execWithTimeout(command, options = {}, timeoutMs = 600000) {
  const timeout = options.timeout || timeoutMs; // 10 минут по умолчанию
  return await execAsync(command, { ...options, timeout });
}

/**
 * Скачивает видео с YouTube используя yt-dlp
 * @param {string} videoUrl - URL видео
 * @param {string} outputPath - путь для сохранения
 * @returns {Promise<string>} - путь к скачанному видео
 */
async function downloadYouTubeVideo(videoUrl, outputDir, proxyUrl) {
  const videoPath = `${outputDir}/temp_video_${Date.now()}.mp4`;

  // Проверяем наличие yt-dlp
  try {
    await execWithTimeout("yt-dlp --version", {}, 5000); // 5 секунд на проверку версии
  } catch (error) {
    throw new Error(
      "yt-dlp не установлен. Установите: pip install yt-dlp или sudo apt install yt-dlp",
    );
  }

  // Скачиваем видео в лучшем качестве.
  // YouTube всё чаще отдаёт только раздельные потоки (SABR): video-only + audio-only,
  // поэтому combined-формат "best[ext=mp4]/best" часто недоступен
  // ("Requested format is not available"). Берём bestvideo+bestaudio —
  // yt-dlp сам склеит их через ffmpeg в mp4 (--merge-output-format).
  const commandParts = [
    "yt-dlp",
    `-f ${JSON.stringify("bv*+ba/b")}`,
    "--merge-output-format mp4",
    `-o ${JSON.stringify(videoPath)}`,
  ];
  if (proxyUrl) {
    commandParts.push(`--proxy ${JSON.stringify(proxyUrl)}`);
  }
  commandParts.push(JSON.stringify(videoUrl));
  const command = commandParts.join(" ");
  const env = proxyUrl
    ? {
        ...process.env,
        HTTP_PROXY: proxyUrl,
        http_proxy: proxyUrl,
        HTTPS_PROXY: proxyUrl,
        https_proxy: proxyUrl,
        ALL_PROXY: proxyUrl,
        all_proxy: proxyUrl,
      }
    : process.env;

  try {
    // 10 минут на скачивание видео
    await execWithTimeout(command, { env }, 600000);
  } catch (error) {
    if (error.killed && error.signal === "SIGTERM") {
      throw new Error(
        "yt-dlp timeout: Video download took too long (10 minutes)",
      );
    }
    // Пробуем найти СВОЙ скачанный файл (по собственному префиксу temp_video_<ts>).
    // ВАЖНО: не берём .part и стримы вида .fXXX — при параллельной обработке
    // плейлиста это чужие незавершённые файлы (можно было склеить видео из куска).
    const dir = path.dirname(videoPath);
    const prefix = path.basename(videoPath, path.extname(videoPath));
    const files = fs
      .readdirSync(dir)
      .filter(
        (f) =>
          (f === `${prefix}.mp4` ||
            f === `${prefix}.mkv` ||
            f === `${prefix}.webm`) &&
          !f.endsWith(".part"),
      );
    if (files.length > 0) {
      return path.join(dir, files[0]);
    }
    throw error;
  }

  return videoPath;
}

/**
 * Экранирует спецсимволы ffmetadata (= ; # \ и переводы строк)
 */
function escapeFfmetadata(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/=/g, "\\=")
    .replace(/#/g, "\\#")
    .replace(/[\r\n]+/g, " ");
}

/**
 * mp4-муксер ffmpeg требует 3-буквенные коды языков (ISO 639-2/B):
 * 2-буквенные ("ru") молча отбрасываются. Конвертируем базовую часть кода.
 */
const ISO_639_1_TO_2 = {
  ru: "rus",
  en: "eng",
  es: "spa",
  fr: "fre",
  de: "ger",
  it: "ita",
  pt: "por",
  pl: "pol",
  uk: "ukr",
  tr: "tur",
  ar: "ara",
  hi: "hin",
  ja: "jpn",
  ko: "kor",
  zh: "zho",
  nl: "dut",
  id: "ind",
  he: "heb",
  iw: "heb",
  bn: "ben",
  ml: "mal",
  pa: "pan",
  ta: "tam",
  te: "tel",
  sv: "swe",
  fi: "fin",
  da: "dan",
  no: "nor",
  cs: "ces",
  el: "ell",
  hu: "hun",
  ro: "ron",
  bg: "bul",
  sr: "srp",
  hr: "hrv",
  sk: "slk",
  sl: "slv",
  lt: "lit",
  lv: "lav",
  et: "est",
  fa: "fas",
  ur: "urd",
  vi: "vie",
  th: "tha",
  ms: "msa",
  az: "aze",
  ka: "kat",
  hy: "hye",
  kk: "kaz",
  uz: "uzb",
  mn: "mon",
  be: "bel",
};

function toMp4Language(lang) {
  if (!lang) return null;
  const base = String(lang).split("-")[0].toLowerCase();
  return ISO_639_1_TO_2[base] ?? base;
}

/**
 * Метаданные аудиодорожки: в mp4 title пишется как handler_name,
 * язык нужен в ISO 639-2. В mkv работает и title, и обычный язык.
 */
function audioTrackMeta(
  index,
  { title = null, language = null, disposition = null },
) {
  const args = [];
  if (disposition !== null) {
    args.push(`-disposition:a:${index} ${disposition}`);
  }
  if (title) {
    args.push(`-metadata:s:a:${index} title=${JSON.stringify(title)}`);
    args.push(`-metadata:s:a:${index} handler_name=${JSON.stringify(title)}`);
  }
  const mp4Lang = toMp4Language(language);
  if (mp4Lang) {
    args.push(`-metadata:s:a:${index} language=${mp4Lang}`);
  }
  return args;
}

/**
 * Записывает главы YouTube в ffmetadata-файл для ffmpeg.
 * @param {Array<{start_time:number,end_time:number,title:string}>} chapters
 * @param {string} filePath
 * @returns {string} filePath
 */
function writeChaptersFile(chapters, filePath) {
  const lines = [";FFMETADATA1"];
  for (const ch of chapters) {
    lines.push(
      "[CHAPTER]",
      "TIMEBASE=1/1000",
      `START=${Math.max(0, Math.round((ch.start_time ?? 0) * 1000))}`,
      `END=${Math.max(0, Math.round((ch.end_time ?? 0) * 1000))}`,
      `title=${escapeFfmetadata(ch.title ?? "")}`,
    );
  }
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
  return filePath;
}

/**
 * Объединяет видео и аудио перевод
 * @param {string} videoPath - путь к видео файлу
 * @param {string} audioPath - путь к аудио переводу
 * @param {string} outputPath - путь для сохранения результата
 * @param {object} options - дополнительные опции
 * @returns {Promise<void>}
 */
async function mergeVideoWithAudio(
  videoPath,
  audioPath,
  outputPath,
  options = {},
) {
  const {
    keepOriginalAudio = true,
    audioVolume = 1.0,
    translationVolume = 1.0,
    normalizeAudio = true,
    separateTracks = false,
    chaptersFile = null,
  } = options;

  // Проверяем наличие ffmpeg
  try {
    await execWithTimeout("ffmpeg -version", {}, 5000); // 5 секунд на проверку версии
  } catch (error) {
    throw new Error(
      "ffmpeg не установлен. Установите: sudo apt install ffmpeg",
    );
  }

  // Главы: ffmeta подключается ОТДЕЛЬНЫМ ВХОДОМ сразу после аудио-входа.
  // ffmpeg относит все опции, стоящие до "-i", к этому входу, поэтому "-i" с ffmeta
  // нельзя ставить после выходных опций (-map и т.п.) — иначе "Option map cannot be
  // applied to input url". А вот -map_chapters — выходная опция.
  const chaptersInput = chaptersFile
    ? ` -i ${JSON.stringify(chaptersFile)}`
    : "";
  const chaptersOutput = chaptersFile ? ` -map_chapters 2` : "";

  let command;

  if (separateTracks) {
    // Две отдельные аудиодорожки: перевод (по умолчанию) + оригинал.
    // Дорожку можно переключить в плеере. Оригинал не микшируется.
    // "-map 0:a:0?" — опционально: у видео может не быть аудио.
    command =
      `ffmpeg -i "${videoPath}" -i "${audioPath}"${chaptersInput} ` +
      `-map 0:v:0 -map 1:a:0 -map 0:a:0? ` +
      `-c:v copy -c:a aac -b:a 192k ` +
      `${audioTrackMeta(0, { title: "Translation", language: "ru", disposition: "default" }).join(" ")} ` +
      `${audioTrackMeta(1, { title: "Original", disposition: "0" }).join(" ")} ` +
      `${chaptersOutput} ` +
      `-y "${outputPath}"`;
  } else if (keepOriginalAudio) {
    // Улучшенный профиль микширования с weights и dynaudnorm
    // Используем weights вместо volume для более корректного микширования
    const weight1 = audioVolume; // вес оригинала (0.0-2.0)
    const weight2 = translationVolume; // вес перевода (0.0-2.0)

    if (normalizeAudio) {
      // С динамической нормализацией громкости (рекомендуется)
      // dynaudnorm автоматически выравнивает громкость для комфортного прослушивания
      command =
        `ffmpeg -i "${videoPath}" -i "${audioPath}"${chaptersInput} ` +
        `-c:v copy -map 0:v:0 ` +
        `-filter_complex "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2:weights=${weight1} ${weight2}[m];[m]dynaudnorm=framelen=30:gausssize=31:maxgain=12[aout]" ` +
        `-map "[aout]" -c:a aac -b:a 192k${chaptersOutput} -y "${outputPath}"`;
    } else {
      // Без нормализации (быстрее, но может быть неравномерная громкость)
      command =
        `ffmpeg -i "${videoPath}" -i "${audioPath}"${chaptersInput} ` +
        `-c:v copy -map 0:v:0 ` +
        `-filter_complex "[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=2:weights=${weight1} ${weight2}[aout]" ` +
        `-map "[aout]" -c:a aac -b:a 192k${chaptersOutput} -y "${outputPath}"`;
    }
  } else {
    // Заменяем оригинальное аудио на перевод
    command = `ffmpeg -i "${videoPath}" -i "${audioPath}"${chaptersInput} -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest${chaptersOutput} -y "${outputPath}"`;
  }

  try {
    // 15 минут на обработку видео с ffmpeg
    await execWithTimeout(command, {}, 900000);
  } catch (error) {
    if (error.killed && error.signal === "SIGTERM") {
      throw new Error(
        "ffmpeg timeout: Video processing took too long (15 minutes)",
      );
    }
    throw error;
  }
}

/**
 * Полный процесс: скачивание видео, получение перевода и объединение
 * @param {string} videoUrl - URL видео
 * @param {string} audioPath - путь к аудио переводу
 * @param {string} outputPath - путь для сохранения результата
 * @param {object} options - дополнительные опции
 * @returns {Promise<void>}
 */
export async function createVideoWithTranslation(
  videoUrl,
  audioPath,
  outputPath,
  options = {},
) {
  const tempDir = path.dirname(outputPath);
  const { proxyUrl, chapters = true, ...mergeOptions } = options;
  let videoPath;
  let chaptersFile = null;

  try {
    // Главы YouTube -> ffmetadata
    if (chapters) {
      try {
        const chs = await youtubeInfo.getVideoChapters(videoUrl, proxyUrl);
        if (chs) {
          chaptersFile = path.join(
            tempDir,
            `temp_chapters_${Date.now()}.ffmeta`,
          );
          writeChaptersFile(chs, chaptersFile);
          if (!process.env.VOT_CLI_QUIET) {
            console.log(
              `📍 Найдено глав: ${chs.length} — будут добавлены в контейнер`,
            );
          }
        }
      } catch (e) {
        if (!process.env.VOT_CLI_QUIET) {
          console.log(`⚠️  Не удалось получить главы: ${e.message}`);
        }
      }
    }

    // Скачиваем оригинальное видео
    if (!process.env.VOT_CLI_QUIET) {
      console.log("Скачивание видео...");
    }
    videoPath = await downloadYouTubeVideo(videoUrl, tempDir, proxyUrl);

    // Объединяем с переводом
    if (!process.env.VOT_CLI_QUIET) {
      console.log("Объединение видео с переводом...");
    }
    await mergeVideoWithAudio(videoPath, audioPath, outputPath, {
      ...mergeOptions,
      ...(chaptersFile ? { chaptersFile } : {}),
    });

    // Удаляем временные файлы
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    if (chaptersFile && fs.existsSync(chaptersFile)) {
      fs.unlinkSync(chaptersFile);
    }

    if (!process.env.VOT_CLI_QUIET) {
      console.log(`✅ Видео с переводом сохранено: ${outputPath}`);
    }
  } catch (error) {
    // Очистка временных файлов при ошибке
    if (videoPath && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    if (chaptersFile && fs.existsSync(chaptersFile)) {
      fs.unlinkSync(chaptersFile);
    }
    throw error;
  }
}

/**
 * Мульти-трек режим (--all-dubs / --dub-langs):
 * видео + микс (перевод поверх приглушённого оригинала) + чистый перевод Яндекса
 * + оригинал + все запрошенные автодубляжи YouTube + главы — в одном контейнере.
 *
 * @param {string} videoUrl
 * @param {string|null} yandexAudioPath mp3 перевода Яндекса (null — без яндексовских дорожек)
 * @param {string} outputPath
 * @param {object} options { dubLangs: "all" | string[], audioVolume, translationVolume, chapters, proxyUrl }
 * @returns {Promise<{audioTracks:number, dubs:string[], chaptersCount:number}>}
 */
export async function createVideoWithAllAudioTracks(
  videoUrl,
  yandexAudioPath,
  outputPath,
  options = {},
) {
  const {
    dubLangs = "all",
    audioVolume = 1.0,
    translationVolume = 1.0,
    chapters = true,
    proxyUrl,
  } = options;

  const tempDir = path.dirname(outputPath);
  const tempFiles = [];

  try {
    // 1) Определяем языки автодубляжа
    let available = [];
    let requested = [];
    if (
      dubLangs === "all" ||
      (Array.isArray(dubLangs) && dubLangs.length > 0)
    ) {
      available = await youtubeInfo.getDubLanguages(videoUrl, proxyUrl);
      requested =
        dubLangs === "all"
          ? available
          : available.filter((l) => dubLangs.includes(l));
      if (Array.isArray(dubLangs) && dubLangs !== "all") {
        const missing = dubLangs.filter((l) => !available.includes(l));
        if (missing.length > 0 && !process.env.VOT_CLI_QUIET) {
          console.log(
            `⚠️  Нет автодубляжа для языков: ${missing.join(", ")}` +
              `${available.length ? ` (доступно: ${available.join(", ")})` : ""}`,
          );
        }
      }
    }

    // 2) Видео с оригинальной дорожкой
    if (!process.env.VOT_CLI_QUIET) {
      console.log("Скачивание видео с оригинальной дорожкой...");
    }
    const videoPath = await downloadYouTubeVideo(videoUrl, tempDir, proxyUrl);
    tempFiles.push(videoPath);

    // 3) Автодубляжи
    const dubFiles = [];
    for (const lang of requested) {
      const safeLang = String(lang).replace(/[^a-zA-Z0-9-]/g, "_");
      const base = path.join(tempDir, `temp_dub_${safeLang}_${Date.now()}`);
      try {
        if (!process.env.VOT_CLI_QUIET) {
          console.log(`🎧 Скачивание автодубляжа: ${lang}...`);
        }
        const dubPath = await youtubeInfo.downloadDubTrack(
          videoUrl,
          lang,
          base,
          proxyUrl,
        );
        dubFiles.push({ lang, path: dubPath });
        tempFiles.push(dubPath);
      } catch (e) {
        if (!process.env.VOT_CLI_QUIET) {
          console.log(`⚠️  Не удалось скачать дубляж ${lang}: ${e.message}`);
        }
      }
    }

    // 4) Главы
    let chaptersFile = null;
    let chaptersCount = 0;
    if (chapters) {
      try {
        const chs = await youtubeInfo.getVideoChapters(videoUrl, proxyUrl);
        if (chs) {
          chaptersFile = path.join(
            tempDir,
            `temp_chapters_${Date.now()}.ffmeta`,
          );
          writeChaptersFile(chs, chaptersFile);
          tempFiles.push(chaptersFile);
          chaptersCount = chs.length;
          if (!process.env.VOT_CLI_QUIET) {
            console.log(`📍 Найдено глав: ${chs.length}`);
          }
        }
      } catch (e) {
        if (!process.env.VOT_CLI_QUIET) {
          console.log(`⚠️  Не удалось получить главы: ${e.message}`);
        }
      }
    }

    // 5) Проверка ffmpeg
    try {
      await execWithTimeout("ffmpeg -version", {}, 5000);
    } catch (error) {
      throw new Error(
        "ffmpeg не установлен. Установите: sudo apt install ffmpeg",
      );
    }

    // 6) Собираем ffmpeg-команду: входы
    const inputArgs = [`-i ${JSON.stringify(videoPath)}`];
    let nextInput = 1;
    let yandexIdx = -1;
    if (yandexAudioPath) {
      yandexIdx = nextInput++;
      inputArgs.push(`-i ${JSON.stringify(yandexAudioPath)}`);
    }
    const dubInputs = dubFiles.map((d) => {
      const index = nextInput++;
      inputArgs.push(`-i ${JSON.stringify(d.path)}`);
      return { lang: d.lang, index };
    });
    let chaptersIdx = -1;
    if (chaptersFile) {
      chaptersIdx = nextInput++;
      inputArgs.push(`-i ${JSON.stringify(chaptersFile)}`);
    }

    // 7) Мапы и метаданные дорожек
    const maps = ["-map 0:v:0"];
    const metaArgs = [];
    const filters = [];
    let audioTrackCount = 0;

    if (yandexIdx >= 0) {
      // Микс: перевод поверх оригинала (как ползунок громкости в расширении VOT)
      filters.push(
        `[0:a:0][${yandexIdx}:a:0]amix=inputs=2:duration=first:dropout_transition=2:weights=${audioVolume} ${translationVolume}[mix]`,
      );
      maps.push('-map "[mix]"');
      metaArgs.push(
        ...audioTrackMeta(audioTrackCount, {
          title: "RU - Yandex (mix over original)",
          language: "ru",
          disposition: "default",
        }),
      );
      audioTrackCount++;
      maps.push(`-map ${yandexIdx}:a:0`);
      metaArgs.push(
        ...audioTrackMeta(audioTrackCount, {
          title: "RU - Yandex translation",
          language: "ru",
          disposition: "0",
        }),
      );
      audioTrackCount++;
    }

    // Оригинал (может отсутствовать — потому опционально)
    maps.push("-map 0:a:0?");
    metaArgs.push(
      ...audioTrackMeta(audioTrackCount, {
        title: "Original",
        disposition: yandexIdx >= 0 ? "0" : "default",
      }),
    );
    audioTrackCount++;

    // Автодубляжи YouTube
    for (const d of dubInputs) {
      maps.push(`-map ${d.index}:a:0`);
      metaArgs.push(
        ...audioTrackMeta(audioTrackCount, {
          title: `YouTube dub (${d.lang})`,
          language: d.lang,
          disposition: "0",
        }),
      );
      audioTrackCount++;
    }

    const command =
      `ffmpeg ${inputArgs.join(" ")} ` +
      (filters.length > 0
        ? `-filter_complex ${JSON.stringify(filters.join(";"))} `
        : "") +
      `${maps.join(" ")} -c:v copy -c:a aac -b:a 192k ` +
      `${metaArgs.join(" ")} ` +
      (chaptersIdx >= 0 ? `-map_chapters ${chaptersIdx} ` : "") +
      `-y ${JSON.stringify(outputPath)}`;

    if (process.env.VOT_DEBUG) {
      fs.writeFileSync(
        path.join(tempDir, "vot-debug-command.txt"),
        command,
        "utf8",
      );
    }

    if (!process.env.VOT_CLI_QUIET) {
      console.log(
        `🎬 Сборка мульти-трек контейнера (аудиодорожек: ${audioTrackCount}, дубляжей: ${dubFiles.length})...`,
      );
    }
    await execWithTimeout(command, {}, 1800000); // до 30 минут

    if (!process.env.VOT_CLI_QUIET) {
      console.log(`✅ Мульти-трек видео сохранено: ${outputPath}`);
    }
    return {
      audioTracks: audioTrackCount,
      dubs: dubFiles.map((d) => d.lang),
      chaptersCount,
    };
  } finally {
    for (const f of tempFiles) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      } catch {
        // не критично
      }
    }
  }
}

export default {
  downloadYouTubeVideo,
  mergeVideoWithAudio,
  createVideoWithTranslation,
  createVideoWithAllAudioTracks,
};
