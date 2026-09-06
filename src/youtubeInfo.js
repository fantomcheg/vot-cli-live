import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

// Кэш yt-dlp -J на один запуск (инфо нужно в нескольких местах: дабы, главы, субтитры)
const infoCache = new Map();

function proxyArgs(proxyUrl) {
  return proxyUrl ? ` --proxy ${JSON.stringify(proxyUrl)}` : "";
}

/**
 * Полная информация о видео через yt-dlp -J (с кэшем на процесс).
 */
export async function getVideoInfo(videoUrl, proxyUrl = null) {
  if (infoCache.has(videoUrl)) {
    return infoCache.get(videoUrl);
  }
  const command = `yt-dlp -J${proxyArgs(proxyUrl)} ${JSON.stringify(videoUrl)}`;
  const { stdout } = await execAsync(command, {
    timeout: 120000,
    maxBuffer: 128 * 1024 * 1024,
  });
  const info = JSON.parse(stdout);
  infoCache.set(videoUrl, info);
  return info;
}

/**
 * Список языков автодубляжа YouTube (форматы с format_note "* dubbed *").
 * @returns {Promise<string[]>} например ["ar", "bn", "de-DE", ..., "ru", ...]
 */
export async function getDubLanguages(videoUrl, proxyUrl = null) {
  const info = await getVideoInfo(videoUrl, proxyUrl);
  const langs = [];
  const seen = new Set();
  for (const f of info.formats ?? []) {
    if (
      f.vcodec === "none" &&
      f.language &&
      /dubbed/i.test(String(f.format_note ?? "")) &&
      !seen.has(f.language)
    ) {
      seen.add(f.language);
      langs.push(f.language);
    }
  }
  return langs;
}

/**
 * Главки видео из метаданных YouTube (info.chapters).
 * @returns {Promise<Array<{start_time:number,end_time:number,title:string}>|null>}
 */
export async function getVideoChapters(videoUrl, proxyUrl = null) {
  const info = await getVideoInfo(videoUrl, proxyUrl);
  return Array.isArray(info.chapters) && info.chapters.length > 0
    ? info.chapters
    : null;
}

/**
 * Скачивает одну аудиодорожку дубляжа на указанном языке.
 * yt-dlp сам допишет расширение к outputPath.
 * @returns {Promise<string>} путь к реальному скачанному файлу
 */
export async function downloadDubTrack(
  videoUrl,
  language,
  outputPath,
  proxyUrl = null,
) {
  const command =
    `yt-dlp -f ${JSON.stringify(`ba[language=${language}]`)}` +
    ` --no-playlist -o ${JSON.stringify(outputPath)}${proxyArgs(proxyUrl)}` +
    ` ${JSON.stringify(videoUrl)}`;
  await execAsync(command, {
    timeout: 30 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024,
  });

  // yt-dlp дописывает расширение (.webm/.m4a) — ищем фактический файл
  const dir = path.dirname(outputPath);
  const base = path.basename(outputPath);
  const candidates = fs
    .readdirSync(dir)
    .filter((f) => f === base || f.startsWith(`${base}.`));
  if (candidates.length === 0) {
    throw new Error(`Dub track "${language}" was not downloaded`);
  }
  return path.join(dir, candidates[0]);
}

/**
 * Скачивает субтитры YouTube (пользовательские и/или автосгенерированные).
 * @param {object} opts
 * @param {string[]} opts.langs языки, например ["ru"] или ["ru","en"]
 * @param {boolean} opts.auto автосгенерированные (иначе пользовательские)
 * @param {string} opts.outputDir куда сохранять
 * @param {string} opts.baseName базовое имя файла (без расширения)
 * @returns {Promise<string[]>} список сохранённых файлов субтитров
 */
export async function downloadYouTubeSubtitles(
  videoUrl,
  { langs, auto = false, outputDir, baseName, proxyUrl = null },
) {
  const langStr = langs.join(",");
  const outTemplate = path.join(outputDir, `${baseName}.%(ext)s`);
  const command =
    "yt-dlp --skip-download --sleep-requests 1" +
    (auto ? " --write-auto-subs" : " --write-subs") +
    ` --sub-langs ${JSON.stringify(langStr)}` +
    ' --sub-format "srt/vtt/best"' +
    ` -o ${JSON.stringify(outTemplate)}${proxyArgs(proxyUrl)}` +
    ` ${JSON.stringify(videoUrl)}`;

  // YouTube часто отвечает 429 (Too Many Requests) — делаем до 3 попыток с паузой.
  // Важно: при 429 в auto-режиме не бросаем ошибку сразу — ниже fallback на оригинальный трек.
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await execAsync(command, {
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
      });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      const msg = String(e.message);
      const is429 = /429|Too Many Requests/i.test(msg);
      // ручных субтитров может просто не быть — это не ошибка скачивания
      if (!auto && /no subtitles/i.test(msg)) {
        break;
      }
      if (!is429) {
        throw e;
      }
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 15000 * attempt));
      }
    }
  }

  const written1 = listNewSubtitleFiles(outputDir, baseName);
  if (written1.length > 0) {
    return written1;
  }

  const lastErrorMsg = lastError ? String(lastError.message) : "";
  const is429 = /429|Too Many Requests/i.test(lastErrorMsg);
  const isNoManual = !auto && /no subtitles/i.test(lastErrorMsg);

  // Машинно-переведённые автотреки часто ловят стойкий 429 по IP.
  // Fallback: скачать хотя бы оригинальный автотрек (для пересказа обычно достаточно).
  if (auto && lastError && is429) {
    const info = await getVideoInfo(videoUrl, proxyUrl);
    const origLang = info.original_language || info.language || "en";
    if (!process.env.VOT_CLI_QUIET) {
      console.log(
        `⚠️  Переведённые автосубтитры (${langStr}) недоступны (HTTP 429 — rate limit YouTube). ` +
          `Скачиваю оригинальный автотрек (${origLang})...`,
      );
    }
    const fallbackTemplate = path.join(outputDir, `${baseName}.%(ext)s`);
    const fallbackCommand =
      "yt-dlp --skip-download --sleep-requests 1 --write-auto-subs" +
      ` --sub-langs ${JSON.stringify(origLang)}` +
      ' --sub-format "srt/vtt/best"' +
      ` -o ${JSON.stringify(fallbackTemplate)}${proxyArgs(proxyUrl)}` +
      ` ${JSON.stringify(videoUrl)}`;
    try {
      await execAsync(fallbackCommand, {
        timeout: 120000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch {
      // и оригинал не скачался — бросаем исходную ошибку ниже
    }
    const written2 = listNewSubtitleFiles(outputDir, baseName);
    if (written2.length > 0) {
      return written2;
    }
  }

  if (lastError && !isNoManual) {
    throw lastError;
  }

  throw new Error(
    `No ${auto ? "auto-generated" : "manual"} subtitles found for languages: ${langStr}`,
  );
}

function listNewSubtitleFiles(outputDir, baseName) {
  return fs
    .readdirSync(outputDir)
    .filter(
      (f) =>
        f.startsWith(baseName) && (f.endsWith(".vtt") || f.endsWith(".srt")),
    )
    .map((f) => path.join(outputDir, f));
}

export default {
  getVideoInfo,
  getDubLanguages,
  getVideoChapters,
  downloadDubTrack,
  downloadYouTubeSubtitles,
};
