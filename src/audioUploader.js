import fs from "fs";
import os from "os";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { randomUUID } from "crypto";

import yandexRequests from "./yandexRequests.js";
import yandexProtobuf from "./yandexProtobuf.js";
import logger from "./utils/logger.js";

const execAsync = promisify(exec);

// Размер чанка как в браузерном расширении VOT (audioDownloader/strategies)
const CHUNK_SIZE = 5_295_308;

/**
 * Скачивает аудиодорожку видео через yt-dlp во временный файл.
 * @returns {Promise<string>} путь к скачанному файлу
 */
async function downloadAudioTrack(videoUrl, proxyData = null) {
  const tempFile = path.join(
    os.tmpdir(),
    `vot-audio-${Date.now()}-${randomUUID()}.webm`,
  );

  let command = `yt-dlp -f "ba[ext=webm]/ba" --no-playlist -o "${tempFile}"`;
  if (proxyData?.proxyUrl) {
    command += ` --proxy "${proxyData.proxyUrl}"`;
  }
  command += ` "${videoUrl}"`;

  logger.debug("downloadAudioTrack:", command);

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

  await execAsync(command, {
    timeout: 30 * 60 * 1000, // до 30 минут на скачивание длинной дорожки
    env,
    maxBuffer: 16 * 1024 * 1024,
  });

  if (!fs.existsSync(tempFile) || fs.statSync(tempFile).size === 0) {
    throw new Error("yt-dlp did not produce an audio file");
  }

  return tempFile;
}

/**
 * Загружает аудиофайл на Yandex чанками (протокол AUDIO_REQUESTED).
 * Точно повторяет поведение браузерного расширения VOT:
 * чанки по ~5 МБ, fileId = random-web_mse_proxy-<uuid>, version = 1,
 * audioPartsLength = 0 для всех чанков кроме последнего (на последнем — общее число).
 *
 * @param {string} videoUrl канонический URL видео
 * @param {string} translationId translationId из ответа AUDIO_REQUESTED
 * @param {string} audioPath путь к аудиофайлу
 * @param {object|null} proxyData
 * @param {string|null} apiToken OAuth-токен Яндекса (опционально)
 * @param {function} [onProgress] (chunkIndex, totalChunks) => void
 */
async function uploadAudioChunks(
  videoUrl,
  translationId,
  audioPath,
  proxyData = null,
  apiToken = null,
  onProgress = null,
) {
  const audio = fs.readFileSync(audioPath);
  const fileId = `random-web_mse_proxy-${randomUUID()}`;
  const totalChunks = Math.ceil(audio.length / CHUNK_SIZE);

  logger.debug(
    `uploadAudioChunks: ${totalChunks} chunks, fileId=${fileId}, size=${audio.length}`,
  );

  for (let i = 0; i < totalChunks; i++) {
    const chunk = audio.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const isLast = i === totalChunks - 1;

    const result = await yandexRequests.requestVideoTranslationAudio(
      videoUrl,
      translationId,
      new Uint8Array(chunk),
      {
        chunkId: i,
        audioPartsLength: isLast ? totalChunks : 0,
        fileId,
        version: 1,
      },
      proxyData,
      apiToken,
    );

    if (!result.success) {
      throw new Error(
        `Failed to upload audio chunk ${i + 1}/${totalChunks}: ${result.error}`,
      );
    }

    const audioResponse = yandexProtobuf.decodeTranslationAudioResponse(
      result.data,
    );
    // status: 1 — чанк принят, 2 — принят последний чанк
    if (audioResponse.status !== 1 && audioResponse.status !== 2) {
      throw new Error(
        `Yandex rejected audio chunk ${i + 1}/${totalChunks} (status ${audioResponse.status})`,
      );
    }

    onProgress?.(i + 1, totalChunks);
  }
}

/**
 * Полный цикл: скачать аудио -> загрузить чанками -> удалить временный файл.
 */
async function downloadAndUploadAudio(
  videoUrl,
  translationId,
  proxyData = null,
  apiToken = null,
  onProgress = null,
) {
  let audioPath = null;
  try {
    onProgress?.(0, 0); // сигнал "скачиваем аудио"
    audioPath = await downloadAudioTrack(videoUrl, proxyData);
    await uploadAudioChunks(
      videoUrl,
      translationId,
      audioPath,
      proxyData,
      apiToken,
      onProgress,
    );
  } finally {
    if (audioPath && fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch {
        // не критично — временный файл в системной temp-папке
      }
    }
  }
}

export default {
  downloadAudioTrack,
  uploadAudioChunks,
  downloadAndUploadAudio,
};
