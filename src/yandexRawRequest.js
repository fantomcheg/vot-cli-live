import axios from "axios";
import { workerHost, yandexUserAgent } from "./config/config.js";
import logger from "./utils/logger.js";

export default async function yandexRawRequest(
  path,
  body,
  headers,
  proxyData,
  callback,
  timeout = 60000, // Таймаут по умолчанию 60 секунд
) {
  logger.debug("yandexRequest:", path);
  await axios({
    url: `https://${workerHost}${path}`,
    method: "post",
    timeout: timeout, // Добавлен таймаут
    headers: {
      ...{
        Accept: "application/x-protobuf",
        "Accept-Language": "en",
        "Content-Type": "application/x-protobuf",
        "User-Agent": yandexUserAgent,
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Mode": "no-cors",
        "sec-ch-ua": null,
        "sec-ch-ua-mobile": null,
        "sec-ch-ua-platform": null,
      },
      ...headers,
    },
    proxy: proxyData,
    responseType: "arraybuffer",
    data: body,
  })
    .then((response) => {
      logger.debug("yandexRequest:", response.status, response.data);
      callback(response.status === 200, response.data);
    })
    .catch((err) => {
      console.error(err);
      const status = err.response?.status;
      const statusText = err.response?.statusText;
      const errorCode = err.code;
      const baseMessage = err.message;
      
      let message;
      if (errorCode === 'ECONNABORTED') {
        message = `Yandex API request timeout (${timeout}ms exceeded)`;
      } else if (errorCode === 'ECONNRESET') {
        message = `Yandex API connection reset. Try using a proxy with --proxy`;
      } else if (status !== undefined) {
        message = `Yandex API request failed with status ${status}${
          statusText ? ` ${statusText}` : ""
        }`;
      } else if (errorCode) {
        message = `Yandex API request failed: ${errorCode}`;
      } else {
        message = `Yandex API request failed: ${baseMessage}`;
      }
      
      callback(false, message);
    });
}
