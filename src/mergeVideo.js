import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

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

  // Скачиваем видео в лучшем качестве
  const commandParts = [
    "yt-dlp",
    `-f ${JSON.stringify("best[ext=mp4]/best")}`,
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
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error("yt-dlp timeout: Video download took too long (10 minutes)");
    }
    // Если файл скачался но с другим расширением, попробуем найти его
    const dir = path.dirname(videoPath);
    const files = fs.readdirSync(dir).filter(f => f.startsWith('temp_video_'));
    if (files.length > 0) {
      return path.join(dir, files[0]);
    }
    throw error;
  }
  
  return videoPath;
}

/**
 * Объединяет видео и аудио перевод
 * @param {string} videoPath - путь к видео файлу
 * @param {string} audioPath - путь к аудио переводу
 * @param {string} outputPath - путь для сохранения результата
 * @param {object} options - дополнительные опции
 * @returns {Promise<void>}
 */
async function mergeVideoWithAudio(videoPath, audioPath, outputPath, options = {}) {
  const {
    keepOriginalAudio = true,
    audioVolume = 1.0,
    translationVolume = 1.0,
  } = options;

  // Проверяем наличие ffmpeg
  try {
    await execWithTimeout("ffmpeg -version", {}, 5000); // 5 секунд на проверку версии
  } catch (error) {
    throw new Error("ffmpeg не установлен. Установите: sudo apt install ffmpeg");
  }

  let command;

  if (keepOriginalAudio) {
    // Микшируем оригинальное аудио с переводом
    command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -filter_complex "[0:a]volume=${audioVolume}[a1];[1:a]volume=${translationVolume}[a2];[a1][a2]amix=inputs=2:duration=longest[aout]" -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -y "${outputPath}"`;
  } else {
    // Заменяем оригинальное аудио на перевод
    command = `ffmpeg -i "${videoPath}" -i "${audioPath}" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -y "${outputPath}"`;
  }

  try {
    // 15 минут на обработку видео с ffmpeg
    await execWithTimeout(command, {}, 900000);
  } catch (error) {
    if (error.killed && error.signal === 'SIGTERM') {
      throw new Error("ffmpeg timeout: Video processing took too long (15 minutes)");
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
  const { proxyUrl, ...mergeOptions } = options;
  let videoPath;

  try {
    // Скачиваем оригинальное видео
    console.log("Скачивание видео...");
    videoPath = await downloadYouTubeVideo(videoUrl, tempDir, proxyUrl);

    // Объединяем с переводом
    console.log("Объединение видео с переводом...");
    await mergeVideoWithAudio(videoPath, audioPath, outputPath, mergeOptions);

    // Удаляем временное видео
    if (fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }

    console.log(`✅ Видео с переводом сохранено: ${outputPath}`);
  } catch (error) {
    // Очистка временных файлов при ошибке
    if (videoPath && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    throw error;
  }
}

export default {
  downloadYouTubeVideo,
  mergeVideoWithAudio,
  createVideoWithTranslation,
};
