export default function parseProxy(proxyString) {
  // proxyString is a string in format [<PROTOCOL>://]<USERNAME>:<PASSWORD>@<HOST>[:<port>]
  try {
    const normalizedProxyString = proxyString.includes("://")
      ? proxyString
      : `http://${proxyString}`;
    const parsedData = new URL(normalizedProxyString);
    const { protocol, hostname, port, username, password } = parsedData;
    if (!protocol.startsWith("http")) {
      console.error("Only HTTP and HTTPS proxies are supported");
      return false;
    }

    const proxyConfig = {
      protocol: protocol.replace(":", ""),
      host: hostname,
    };

    if (port) {
      proxyConfig.port = Number(port);
    }

    if (username || password) {
      proxyConfig.auth = {
        username: decodeURIComponent(username),
        password: decodeURIComponent(password),
      };
    }

    const authPart =
      username || password
        ? `${encodeURIComponent(username)}${
            password ? `:${encodeURIComponent(password)}` : ""
          }@`
        : "";
    const portPart = port ? `:${port}` : "";
    proxyConfig.proxyUrl = `${protocol}//${authPart}${hostname}${portPart}`;

    return proxyConfig;
  } catch (e) {
    console.error("Failed to parse entered proxy. Error:", e);
    return false;
  }
}
