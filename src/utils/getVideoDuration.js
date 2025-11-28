import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Получает длительность видео в секундах через yt-dlp
 * @param {string} videoUrl - URL видео
 * @param {object} proxyData - Данные прокси (опционально)
 * @returns {Promise<number>} - Длительность в секундах
 */
export default async function getVideoDuration(videoUrl, proxyData = null) {
  try {
    // Проверяем наличие yt-dlp
    try {
      await execAsync("yt-dlp --version", { timeout: 5000 });
    } catch (error) {
      console.warn("⚠️  yt-dlp not found, using default duration (341s)");
      return 341; // Возвращаем дефолтное значение
    }

    // Получаем длительность через yt-dlp
    let command = `yt-dlp --print duration`;
    
    // Добавляем прокси если указан
    if (proxyData?.proxyUrl) {
      command += ` --proxy "${proxyData.proxyUrl}"`;
    }
    
    command += ` "${videoUrl}"`;
    
    const env = proxyData?.proxyUrl
      ? {
          ...process.env,
          HTTP_PROXY: proxyData.proxyUrl,
          http_proxy: proxyData.proxyUrl,
          HTTPS_PROXY: proxyData.proxyUrl,
          https_proxy: proxyData.proxyUrl,
          ALL_PROXY: proxyData.proxyUrl,
          all_proxy: proxyData.proxyUrl,
        }
      : process.env;
    
    const { stdout } = await execAsync(command, { timeout: 30000, env });
    
    const duration = parseInt(stdout.trim(), 10);
    
    if (isNaN(duration) || duration <= 0) {
      console.warn("⚠️  Could not parse video duration, using default (341s)");
      return 341;
    }
    
    console.log(`✓ Video duration: ${duration}s (${Math.floor(duration / 60)}m ${duration % 60}s)`);
    return duration;
  } catch (error) {
    console.warn("⚠️  Failed to get video duration:", error.message);
    return 341; // Возвращаем дефолтное значение при ошибке
  }
}
