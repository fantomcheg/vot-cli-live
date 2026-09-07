import yandexRawRequest from "./yandexRawRequest.js";
import yandexProtobuf from "./yandexProtobuf.js";
import getUUID from "./utils/getUUID.js";
import getSignature from "./utils/getSignature.js";
import logger from "./utils/logger.js";

// Заголовок авторизации Яндекс ID (нужен для видео, где Yandex отвечает SESSION_REQUIRED)
function authHeader(apiToken) {
  return apiToken ? { Authorization: `OAuth ${apiToken}` } : {};
}

// Request video translation from Yandex API
async function requestVideoTranslation(
  url,
  duration,
  requestLang,
  responseLang,
  translationHelp,
  proxyData,
  callback,
  useLiveVoices = true, // по умолчанию используем живые голоса
  apiToken = null,
) {
  try {
    logger.debug("requestVideoTranslation");
    // Initialize variables
    const body = yandexProtobuf.encodeTranslationRequest(
      url,
      duration,
      requestLang,
      responseLang,
      translationHelp,
      useLiveVoices,
    );
    // Send the request
    await yandexRawRequest(
      "/video-translation/translate",
      body,
      {
        "Vtrans-Signature": await getSignature(body),
        "Sec-Vtrans-Token": getUUID(false),
        ...authHeader(apiToken),
      },
      proxyData,
      callback,
    );
  } catch (exception) {
    // console.error(chalk.red("[VOT-CLI] Link:", url, exception));
    // Handle errors
    callback(false);
  }
}

// Promise-вариант запроса перевода (для цикла ожидания в translateVideo)
async function requestVideoTranslationAsync(
  url,
  duration,
  requestLang,
  responseLang,
  translationHelp,
  proxyData,
  useLiveVoices = true,
  apiToken = null,
) {
  const body = yandexProtobuf.encodeTranslationRequest(
    url,
    duration,
    requestLang,
    responseLang,
    translationHelp,
    useLiveVoices,
  );
  return await yandexRawRequest(
    "/video-translation/translate",
    body,
    {
      "Vtrans-Signature": await getSignature(body),
      "Sec-Vtrans-Token": getUUID(false),
      ...authHeader(apiToken),
    },
    proxyData,
    null,
  );
}

// Загрузка одного чанка аудио (PUT /video-translation/audio)
// Отправляется, когда Yandex отвечает AUDIO_REQUESTED (статус 6) —
// для длинных/некэшированных видео Yandex просит аудиодорожку у клиента.
async function requestVideoTranslationAudio(
  url,
  translationId,
  audioChunk,
  chunkMeta, // { chunkId, audioPartsLength, fileId, version }
  proxyData,
  apiToken = null,
) {
  const body = yandexProtobuf.encodeTranslationAudioRequest(
    url,
    translationId,
    audioChunk,
    chunkMeta,
  );
  return await yandexRawRequest(
    "/video-translation/audio",
    body,
    {
      "Vtrans-Signature": await getSignature(body),
      "Sec-Vtrans-Token": getUUID(false),
      ...authHeader(apiToken),
    },
    proxyData,
    null,
    120000, // чанки по ~5 МБ могут грузиться дольше минуты на медленном канале
    "put",
  );
}

// Request video subtitles from Yandex API
async function requestVideoSubtitles(url, requestLang, proxyData, callback) {
  try {
    logger.debug("requestVideoSubtitles");
    // Initialize variables
    const body = yandexProtobuf.encodeSubtitlesRequest(url, requestLang);
    // Send the request
    await yandexRawRequest(
      "/video-subtitles/get-subtitles",
      body,
      {
        "Vsubs-Signature": await getSignature(body),
        "Sec-Vsubs-Token": getUUID(false),
      },
      proxyData,
      callback,
    );
  } catch (exception) {
    // console.error(chalk.red("[VOT-CLI] Link:", url, exception));
    // Handle errors
    callback(false);
  }
}

export default {
  requestVideoTranslation,
  requestVideoTranslationAsync,
  requestVideoTranslationAudio,
  requestVideoSubtitles,
};
