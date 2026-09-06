import yandexRequests from "./yandexRequests.js";
import yandexProtobuf from "./yandexProtobuf.js";
import getVideoDuration from "./utils/getVideoDuration.js";
import audioUploader from "./audioUploader.js";
import logger from "./utils/logger.js";

// Статусы ответа Yandex VOT (как в vot.js 3.x VideoTranslationStatus)
const TRANSLATION_STATUS = {
  FAILED: 0,
  FINISHED: 1,
  WAITING: 2,
  LONG_WAITING: 3,
  PART_CONTENT: 5, // перевод длинного видео готовится частями
  AUDIO_REQUESTED: 6, // Yandex просит клиента загрузить аудиодорожку
  SESSION_REQUIRED: 7, // требуется авторизация Яндекс ID (OAuth токен)
};

// Длинные видео могут переводиться десятки минут — ждём до 90 минут
const MAX_WAIT_MS = 90 * 60 * 1000;
const MAX_FAILED_RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function calcSleepMs(remainingTime) {
  // Yandex подсказывает интервал до следующего запроса через remainingTime
  const secs = Number(remainingTime);
  if (!Number.isFinite(secs) || secs <= 0) return 10000;
  return Math.min(Math.max(secs, 5), 60) * 1000;
}

export default async function translateVideo(
  url,
  requestLang,
  responseLang,
  translationHelp,
  proxyData,
  callback,
  useLiveVoices = true, // по умолчанию используем живые голоса
  options = {}, // { apiToken, onProgress, maxWaitMs }
) {
  const {
    apiToken = null,
    onProgress = null,
    maxWaitMs = MAX_WAIT_MS,
  } = options;

  // Получаем реальную длительность видео
  const duration = await getVideoDuration(url, proxyData);

  const deadline = Date.now() + maxWaitMs;
  let liveVoice = useLiveVoices;
  let failedRetries = 0;
  let uploadedForTranslationId = null;
  let audioUploadAttempts = 0;

  while (Date.now() < deadline) {
    const result = await yandexRequests.requestVideoTranslationAsync(
      url,
      duration,
      requestLang,
      responseLang,
      translationHelp,
      proxyData,
      liveVoice,
      apiToken,
    );

    if (!result.success) {
      callback(false, result.error || "Failed to request video translation");
      return;
    }

    const translateResponse = yandexProtobuf.decodeTranslationResponse(
      result.data,
    );
    logger.debug("translateVideo response:", translateResponse);

    switch (translateResponse.status) {
      case TRANSLATION_STATUS.FINISHED: {
        const hasUrl = translateResponse.url != null;
        callback(
          hasUrl,
          hasUrl ? translateResponse.url : "Audio link not received",
        );
        return;
      }

      case TRANSLATION_STATUS.WAITING:
      case TRANSLATION_STATUS.LONG_WAITING: {
        onProgress?.(
          `Translation in progress... (~${translateResponse.remainingTime ?? "?"}s left)`,
        );
        await sleep(calcSleepMs(translateResponse.remainingTime));
        break;
      }

      case TRANSLATION_STATUS.PART_CONTENT: {
        // Длинное видео переводится частями: ссылка уже есть, но аудио ещё
        // дописывается. Ждём FINISHED, чтобы скачать файл целиком.
        onProgress?.(
          `Translating parts of a long video... (~${translateResponse.remainingTime ?? "?"}s left)`,
        );
        await sleep(calcSleepMs(translateResponse.remainingTime));
        break;
      }

      case TRANSLATION_STATUS.AUDIO_REQUESTED: {
        // Yandex не смог сам получить аудио (типично для длинных видео) —
        // скачиваем дорожку через yt-dlp и загружаем её чанками.
        const translationId = translateResponse.translationId;
        if (!translationId) {
          callback(
            false,
            "Yandex requested audio, but didn't provide translationId",
          );
          return;
        }
        if (uploadedForTranslationId === translationId) {
          audioUploadAttempts++;
          if (audioUploadAttempts >= 3) {
            callback(
              false,
              "Audio was uploaded, but Yandex keeps requesting it again",
            );
            return;
          }
          await sleep(calcSleepMs(translateResponse.remainingTime));
          break;
        }
        try {
          await audioUploader.downloadAndUploadAudio(
            url,
            translationId,
            proxyData,
            apiToken,
            (chunkIndex, totalChunks) => {
              onProgress?.(
                chunkIndex === 0
                  ? "Yandex requested audio: downloading audio track via yt-dlp..."
                  : `Uploading audio to Yandex: chunk ${chunkIndex}/${totalChunks}`,
              );
            },
          );
          uploadedForTranslationId = translationId;
          onProgress?.("Audio uploaded, waiting for translation...");
        } catch (e) {
          callback(false, `Failed to provide audio to Yandex: ${e.message}`);
          return;
        }
        break;
      }

      case TRANSLATION_STATUS.SESSION_REQUIRED: {
        // Для части видео Yandex требует авторизацию. Сначала пробуем
        // fallback на обычный TTS (часто работает без авторизации).
        if (liveVoice) {
          liveVoice = false;
          onProgress?.(
            "Live voices require Yandex auth for this video, retrying with standard TTS...",
          );
          break;
        }
        callback(
          false,
          "Yandex requires authorization for this video (SESSION_REQUIRED). " +
            "Log in via the VOT browser extension to get a Yandex OAuth token " +
            "and pass it via --api-token (or VOT_API_TOKEN env variable)",
        );
        return;
      }

      case TRANSLATION_STATUS.FAILED:
      default: {
        const message =
          translateResponse.message ||
          `Yandex couldn't translate video (status ${translateResponse.status})`;
        if (
          translateResponse.status === TRANSLATION_STATUS.FAILED &&
          translateResponse.shouldRetry &&
          failedRetries < MAX_FAILED_RETRIES
        ) {
          failedRetries++;
          onProgress?.(
            `Translation failed, retrying (${failedRetries}/${MAX_FAILED_RETRIES})...`,
          );
          await sleep(calcSleepMs(translateResponse.remainingTime));
          break;
        }
        callback(false, message);
        return;
      }
    }
  }

  callback(
    false,
    `Translation timeout: exceeded maximum wait time (${Math.round(maxWaitMs / 60000)} minutes)`,
  );
}
