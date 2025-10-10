import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execAsync = promisify(exec);

/**
 * Скачивает видео с YouTube используя yt-dlp
 * @param {string} videoUrl - URL видео
 * @param {string} outputPath - путь для сохранения
 * @returns {Promise<string>} - путь к скачанному видео
 */
async function downloadYouTubeVideo(videoUrl, outputDir) {
  const videoPath = `${outputDir}/temp_video_${Date.now()}.mp4`;
  
  // Проверяем наличие yt-dlp
  try {
    await execAsync("yt-dlp --version");
  } catch (error) {
    throw new Error(
      "yt-dlp не установлен. Установите: pip install yt-dlp или sudo apt install yt-dlp",
    );
  }

  // Скачиваем видео в лучшем качестве
  const command = `yt-dlp -f "best[ext=mp4]/best" --merge-output-format mp4 -o "${videoPath}" "${videoUrl}"`;
  
  try {
    await execAsync(command);
  } catch (error) {
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
    await execAsync("ffmpeg -version");
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

  await execAsync(command);
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
  let videoPath;

  try {
    // Скачиваем оригинальное видео
    console.log("Скачивание видео...");
    videoPath = await downloadYouTubeVideo(videoUrl, tempDir);

    // Объединяем с переводом
    console.log("Объединение видео с переводом...");
    await mergeVideoWithAudio(videoPath, audioPath, outputPath, options);

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
