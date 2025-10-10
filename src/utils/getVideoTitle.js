import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Получает название видео с YouTube используя yt-dlp
 * @param {string} videoUrl - URL видео
 * @returns {Promise<string>} - название видео
 */
async function getVideoTitle(videoUrl) {
  try {
    // Проверяем наличие yt-dlp
    await execAsync("yt-dlp --version");
    
    // Получаем название видео
    const { stdout } = await execAsync(
      `yt-dlp --get-title "${videoUrl}"`,
      { timeout: 10000 }
    );
    
    // Очищаем название от недопустимых символов для имени файла
    const title = stdout.trim()
      .replace(/[<>:"/\\|?*]/g, "_")  // Заменяем недопустимые символы
      .replace(/\s+/g, "_")            // Пробелы на подчёркивания
      .substring(0, 100);              // Ограничиваем длину
    
    return title || null;
  } catch (error) {
    // Если yt-dlp не установлен или ошибка - возвращаем null
    return null;
  }
}

export default getVideoTitle;
