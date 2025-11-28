import yandexRequests from "./yandexRequests.js";
import yandexProtobuf from "./yandexProtobuf.js";
import getVideoDuration from "./utils/getVideoDuration.js";

export default async function translateVideo(
  url,
  requestLang,
  responseLang,
  translationHelp,
  proxyData,
  callback,
  useLiveVoices = true, // по умолчанию используем живые голоса
) {
  // Получаем реальную длительность видео
  const duration = await getVideoDuration(url, proxyData);
  
  await yandexRequests.requestVideoTranslation(
    url,
    duration,
    requestLang,
    responseLang,
    translationHelp,
    proxyData,
    (success, response) => {
      if (!success) {
        let errorMessage = "Failed to request video translation";
        if (typeof response === "string" && response.trim()) {
          errorMessage = response.trim();
        } else if (
          typeof response === "object" &&
          response !== null &&
          typeof response.message === "string" &&
          response.message.trim()
        ) {
          errorMessage = response.message.trim();
        } else if (
          typeof Buffer !== "undefined" &&
          Buffer.isBuffer(response)
        ) {
          const bufferText = response.toString("utf8").trim();
          if (bufferText) {
            errorMessage = bufferText;
          }
        }
        callback(false, errorMessage);
        return;
      }

      const translateResponse =
        yandexProtobuf.decodeTranslationResponse(response);
      switch (translateResponse.status) {
        case 0:
          callback(false, translateResponse.message);
          return;
        case 1: {
          const hasUrl = translateResponse.url != null;
          callback(
            hasUrl,
            hasUrl ? translateResponse.url : "Audio link not received",
          );
          return;
        }
        case 2:
          callback(false, "The translation will take a few minutes");
          return;
      }
    },
    useLiveVoices, // передаем параметр useLiveVoices
  );
}
