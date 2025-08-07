import { connect } from "cloudflare:sockets";
// import { createHash, createDecipheriv } from "node:crypto";
// import { Buffer } from "node:buffer";

// Variables
const rootDomain = "foolvpn.me"; // Ganti dengan domain utama kalian
const serviceName = "nautica"; // Ganti dengan nama workers kalian
const apiKey = ""; // Ganti dengan Global API key kalian (https://dash.cloudflare.com/profile/api-tokens)
const apiEmail = ""; // Ganti dengan email yang kalian gunakan
const accountID = ""; // Ganti dengan Account ID kalian (https://dash.cloudflare.com -> Klik domain yang kalian gunakan)
const zoneID = ""; // Ganti dengan Zone ID kalian (https://dash.cloudflare.com -> Klik domain yang kalian gunakan)
let isApiReady = false;
let proxyIP = "";
let cachedProxyList = [];

// Constant
// --- Telegram Bot Webhook Config ---
const BOT_TOKEN = ""; // ISI TOKEN BOT TELEGRAM ANDA DI SINI
const WEBHOOK_PATH = "/webhook"; // Path rahasia untuk webhook
const ADMIN_GROUP_ID = "-1002747373907"; // ID Grup Admin sudah diisi
// ----------------------------------

const APP_DOMAIN = `${serviceName}.${rootDomain}`;
const PORTS = [443, 80];
const PROTOCOLS = [reverse("najort"), reverse("sselv"), reverse("ss")];
const KV_PROXY_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/kvProxyList.json";
const PROXY_BANK_URL = "https://raw.githubusercontent.com/FoolVPN-ID/Nautica/refs/heads/main/proxyList.txt";
const DNS_SERVER_ADDRESS = "8.8.8.8";
const DNS_SERVER_PORT = 53;
const PROXY_HEALTH_CHECK_API = "https://id1.foolvpn.me/api/v1/check";
const CONVERTER_URL = "https://api.foolvpn.me/convert";
const DONATE_LINK = "https://trakteer.id/dickymuliafiqri/tip";
const BAD_WORDS_LIST =
  "https://gist.githubusercontent.com/adierebel/a69396d79b787b84d89b45002cb37cd6/raw/6df5f8728b18699496ad588b3953931078ab9cf1/kata-kasar.txt";
const PROXY_PER_PAGE = 24;
const WS_READY_STATE_OPEN = 1;
const WS_READY_STATE_CLOSING = 2;
const CORS_HEADER_OPTIONS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Max-Age": "86400",
};

async function getKVProxyList(kvProxyUrl = KV_PROXY_URL) {
  if (!kvProxyUrl) {
    throw new Error("No KV Proxy URL Provided!");
  }

  const kvProxy = await fetch(kvProxyUrl);
  if (kvProxy.status == 200) {
    return await kvProxy.json();
  } else {
    return {};
  }
}

async function getProxyList(proxyBankUrl = PROXY_BANK_URL) {
  /**
   * Format:
   *
   * <IP>,<Port>,<Country ID>,<ORG>
   * Contoh:
   * 1.1.1.1,443,SG,Cloudflare Inc.
   */
  if (!proxyBankUrl) {
    throw new Error("No Proxy Bank URL Provided!");
  }

  const proxyBank = await fetch(proxyBankUrl);
  if (proxyBank.status == 200) {
    const text = (await proxyBank.text()) || "";

    const proxyString = text.split("\n").filter(Boolean);
    cachedProxyList = proxyString
      .map((entry) => {
        const [proxyIP, proxyPort, country, org] = entry.split(",");
        return {
          proxyIP: proxyIP || "Unknown",
          proxyPort: proxyPort || "Unknown",
          country: country || "Unknown",
          org: org || "Unknown Org",
        };
      })
      .filter(Boolean);
  }

  return cachedProxyList;
}

async function reverseProxy(request, target, targetPath) {
  const targetUrl = new URL(request.url);
  const targetChunk = target.split(":");

  targetUrl.hostname = targetChunk[0];
  targetUrl.port = targetChunk[1]?.toString() || "443";
  targetUrl.pathname = targetPath || targetUrl.pathname;

  const modifiedRequest = new Request(targetUrl, request);

  modifiedRequest.headers.set("X-Forwarded-Host", request.headers.get("Host"));

  const response = await fetch(modifiedRequest);

  const newResponse = new Response(response.body, response);
  for (const [key, value] of Object.entries(CORS_HEADER_OPTIONS)) {
    newResponse.headers.set(key, value);
  }
  newResponse.headers.set("X-Proxied-By", "Cloudflare Worker");

  return newResponse;
}

function getAllConfig(request, hostName, proxyList, page = 0) {
  const startIndex = PROXY_PER_PAGE * page;

  try {
    const uuid = crypto.randomUUID();

    // Build URI
    const uri = new URL(`${reverse("najort")}://${hostName}`);
    uri.searchParams.set("encryption", "none");
    uri.searchParams.set("type", "ws");
    uri.searchParams.set("host", hostName);

    // Build HTML
    const document = new Document(request);
    document.setTitle("Welcome to <span class='text-blue-500 font-semibold'>Nautica</span>");
    document.addInfo(`Total: ${proxyList.length}`);
    document.addInfo(`Page: ${page}/${Math.floor(proxyList.length / PROXY_PER_PAGE)}`);

    for (let i = startIndex; i < startIndex + PROXY_PER_PAGE; i++) {
      const proxy = proxyList[i];
      if (!proxy) break;

      const { proxyIP, proxyPort, country, org } = proxy;

      uri.searchParams.set("path", `/${proxyIP}-${proxyPort}`);

      const proxies = [];
      for (const port of PORTS) {
        uri.port = port.toString();
        uri.hash = `${i + 1} ${getFlagEmoji(country)} ${org} WS ${port == 443 ? "TLS" : "NTLS"} [${serviceName}]`;
        for (const protocol of PROTOCOLS) {
          // Special exceptions
          if (protocol === "ss") {
            uri.username = btoa(`none:${uuid}`);
            uri.searchParams.set(
              "plugin",
              `v2ray-plugin${
                port == 80 ? "" : ";tls"
              };mux=0;mode=websocket;path=/${proxyIP}-${proxyPort};host=${hostName}`
            );
          } else {
            uri.username = uuid;
            uri.searchParams.delete("plugin");
          }

          uri.protocol = protocol;
          uri.searchParams.set("security", port == 443 ? "tls" : "none");
          uri.searchParams.set("sni", port == 80 && protocol == reverse("sselv") ? "" : hostName);

          // Build VPN URI
          proxies.push(uri.toString());
        }
      }
      document.registerProxies(
        {
          proxyIP,
          proxyPort,
          country,
          org,
        },
        proxies
      );
    }

    // Build pagination
    document.addPageButton("Prev", `/sub/${page > 0 ? page - 1 : 0}`, page > 0 ? false : true);
    document.addPageButton("Next", `/sub/${page + 1}`, page < Math.floor(proxyList.length / 10) ? false : true);

    return document.build();
  } catch (error) {
    return `An error occurred while generating the ${reverse("SSELV")} configurations. ${error}`;
  }
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const upgradeHeader = request.headers.get("Upgrade");

      if (apiKey && apiEmail && accountID && zoneID) {
        isApiReady = true;
      }

      if (upgradeHeader === "websocket") {
        const proxyMatch = url.pathname.match(/^\/(.+[:=-]\d+)$/);

        if (url.pathname.length == 3 || url.pathname.match(",")) {
          const proxyKeys = url.pathname.replace("/", "").toUpperCase().split(",");
          const proxyKey = proxyKeys[Math.floor(Math.random() * proxyKeys.length)];
          const kvProxy = await getKVProxyList();

          proxyIP = kvProxy[proxyKey][Math.floor(Math.random() * kvProxy[proxyKey].length)];

          return await websocketHandler(request);
        } else if (proxyMatch) {
          proxyIP = proxyMatch[1];
          return await websocketHandler(request);
        }
      }

      if (url.pathname.startsWith("/sub")) {
        const page = url.pathname.match(/^\/sub\/(\d+)$/);
        const pageIndex = parseInt(page ? page[1] : "0");
        const hostname = request.headers.get("Host");

        const countrySelect = url.searchParams.get("cc")?.split(",");
        const proxyBankUrl = url.searchParams.get("proxy-list") || env.PROXY_BANK_URL;
        let proxyList = (await getProxyList(proxyBankUrl)).filter((proxy) => {
          if (countrySelect) {
            return countrySelect.includes(proxy.country);
          }
          return true;
        });

        const result = getAllConfig(request, hostname, proxyList, pageIndex);
        return new Response(result, {
          status: 200,
          headers: { "Content-Type": "text/html;charset=utf-8" },
        });
      } else if (url.pathname.startsWith("/check")) {
        const target = url.searchParams.get("target").split(":");
        const result = await checkProxyHealth(target[0], target[1] || "443");

        return new Response(JSON.stringify(result), {
          status: 200,
          headers: {
            ...CORS_HEADER_OPTIONS,
            "Content-Type": "application/json",
          },
        });
      } else if (url.pathname.startsWith("/api/v1")) {
        const apiPath = url.pathname.replace("/api/v1", "");

        if (apiPath.startsWith("/domains")) {
          if (!isApiReady) {
            return new Response("Api not ready", { status: 500 });
          }

          const wildcardApiPath = apiPath.replace("/domains", "");
          const cloudflareApi = new CloudflareApi();

          if (wildcardApiPath == "/get") {
            const domains = await cloudflareApi.getDomainList();
            return new Response(JSON.stringify(domains), {
              headers: { ...CORS_HEADER_OPTIONS },
            });
          } else if (wildcardApiPath == "/put") {
            const domain = url.searchParams.get("domain");
            const register = await cloudflareApi.registerDomain(domain);
            return new Response(register.toString(), {
              status: register,
              headers: { ...CORS_HEADER_OPTIONS },
            });
          }
        } else if (apiPath.startsWith("/sub")) {
          const filterCC = url.searchParams.get("cc")?.split(",") || [];
          const filterPort = url.searchParams.get("port")?.split(",") || PORTS;
          const filterVPN = url.searchParams.get("vpn")?.split(",") || PROTOCOLS;
          const filterLimit = parseInt(url.searchParams.get("limit")) || 10;
          const filterFormat = url.searchParams.get("format") || "raw";
          const fillerDomain = url.searchParams.get("domain") || APP_DOMAIN;

          const proxyBankUrl = url.searchParams.get("proxy-list") || env.PROXY_BANK_URL;
          const proxyList = await getProxyList(proxyBankUrl)
            .then((proxies) => {
              if (filterCC.length) {
                return proxies.filter((proxy) => filterCC.includes(proxy.country));
              }
              return proxies;
            })
            .then((proxies) => {
              shuffleArray(proxies);
              return proxies;
            });

          const uuid = crypto.randomUUID();
          const result = [];
          for (const proxy of proxyList) {
            const uri = new URL(`${reverse("najort")}://${fillerDomain}`);
            uri.searchParams.set("encryption", "none");
            uri.searchParams.set("type", "ws");
            uri.searchParams.set("host", APP_DOMAIN);

            for (const port of filterPort) {
              for (const protocol of filterVPN) {
                if (result.length >= limit) break;

                uri.protocol = protocol;
                uri.port = port.toString();
                if (protocol == "ss") {
                  uri.username = btoa(`none:${uuid}`);
                  uri.searchParams.set(
                    "plugin",
                    `v2ray-plugin${port == 80 ? "" : ";tls"};mux=0;mode=websocket;path=/${proxy.proxyIP}-${
                      proxy.proxyPort
                    };host=${APP_DOMAIN}`
                  );
                } else {
                  uri.username = uuid;
                }

                uri.searchParams.set("security", port == 443 ? "tls" : "none");
                uri.searchParams.set("sni", port == 80 && protocol == reverse("sselv") ? "" : APP_DOMAIN);
                uri.searchParams.set("path", `/${proxy.proxyIP}-${proxy.proxyPort}`);

                uri.hash = `${result.length + 1} ${getFlagEmoji(proxy.country)} ${proxy.org} WS ${
                  port == 443 ? "TLS" : "NTLS"
                } [${serviceName}]`;
                result.push(uri.toString());
              }
            }
          }

          let finalResult = "";
          switch (filterFormat) {
            case "raw":
              finalResult = result.join("\n");
              break;
            case "v2ray":
              finalResult = btoa(result.join("\n"));
              break;
            case "clash":
            case "sfa":
            case "bfr":
              const res = await fetch(CONVERTER_URL, {
                method: "POST",
                body: JSON.stringify({
                  url: result.join(","),
                  format: filterFormat,
                  template: "cf",
                }),
              });
              if (res.status == 200) {
                finalResult = await res.text();
              } else {
                return new Response(res.statusText, {
                  status: res.status,
                  headers: { ...CORS_HEADER_OPTIONS },
                });
              }
              break;
          }
          return new Response(finalResult, {
            status: 200,
            headers: { ...CORS_HEADER_OPTIONS },
          });
        } else if (apiPath.startsWith("/myip")) {
          return new Response(
            JSON.stringify({
              ip:
                request.headers.get("cf-connecting-ipv6") ||
                request.headers.get("cf-connecting-ip") ||
                request.headers.get("x-real-ip"),
              colo: request.headers.get("cf-ray")?.split("-")[1],
              ...request.cf,
            }),
            { headers: { ...CORS_HEADER_OPTIONS } }
          );
        }
      } else if (url.pathname === WEBHOOK_PATH) {
        if (request.method === "POST") {
          try {
            const update = await request.json();
            await handleUpdate(update, env);
            return new Response("OK", { status: 200 });
          } catch (e) {
            console.error(e);
            return new Response("Invalid Request", { status: 400 });
          }
        }
        return new Response("POST requests only", { status: 405 });
      }

      const targetReverseProxy = env.REVERSE_PROXY_TARGET || "example.com";
      return await reverseProxy(request, targetReverseProxy);
    } catch (err) {
      console.error(err);
      return new Response(`An error occurred: ${err.toString()}`, {
        status: 500,
        headers: { ...CORS_HEADER_OPTIONS },
      });
    }
  },
};

// --- Telegram Bot Webhook Handlers ---

async function callTelegramApi(methodName, params) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${methodName}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const json = await response.json();
  if (!json.ok) {
    console.error("Telegram API Error:", json.description);
  }
  return json;
}

async function logToAdmin(text) {
    if (ADMIN_GROUP_ID) {
        await callTelegramApi("sendMessage", {
            chat_id: ADMIN_GROUP_ID,
            text: `📝 LOG: ${text}`,
            disable_notification: true,
        });
    }
}

async function handleUpdate(update, env) {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, env);
  } else if (update.message) {
    await handleMessage(update.message, env);
  }
}

async function handleMessage(message, env) {
  const chatId = message.chat.id;
  if (message.text === "/start") {
    const user = message.from;
    await logToAdmin(`User ${user.first_name} (@${user.username || 'N/A'}) memulai bot.`);

    const caption = `
Selamat datang di server *DIANA STORE*!

*Peraturan Bot:*
1. Gunakan bot dengan bijak.
2. Dilarang melakukan spam.
3. Patuhi arahan dari admin.

*Tujuan Bot:*
Bot ini bertujuan untuk menyediakan koneksi proksi yang aman dan stabil untuk kebutuhan Anda.

*Donasi:*
Dukung kami agar server tetap berjalan dengan berdonasi melalui link di bawah.

Silakan pilih menu di bawah ini.
    `;
    const imageUrl = "https://i.postimg.cc/Kvggpvt0/b86ba0a6-87f5-4911-9982-2229e58f5d36.png";

    const mainMenuKeyboard = {
      inline_keyboard: [
        [{ text: "Dapatkan Proksi", callback_data: "get_proxies" }],
        [{ text: "Donasi", url: DONATE_LINK }],
      ],
    };

    await callTelegramApi("sendPhoto", {
      chat_id: chatId,
      photo: imageUrl,
      caption: caption,
      parse_mode: "Markdown",
      reply_markup: mainMenuKeyboard,
    });
  }
}

async function handleCallbackQuery(callbackQuery, env) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const user = callbackQuery.from;

  await callTelegramApi("answerCallbackQuery", { callback_query_id: callbackQuery.id });

  if (data === "start_menu") {
    await logToAdmin(`User ${user.first_name} (@${user.username || 'N/A'}) kembali ke menu utama.`);
    const text = "Silakan pilih salah satu menu di bawah ini:";
    const keyboard = {
      inline_keyboard: [
        [{ text: "Dapatkan Proksi", callback_data: "get_proxies" }],
        [{ text: "Donasi", url: DONATE_LINK }],
      ],
    };
    await callTelegramApi("editMessageCaption", { chat_id: chatId, message_id: messageId, caption: text, reply_markup: keyboard, parse_mode: "Markdown" });

  } else if (data === "get_proxies") {
    await logToAdmin(`User ${user.first_name} (@${user.username || 'N/A'}) meminta daftar negara.`);

    await callTelegramApi("editMessageCaption", { chat_id: chatId, message_id: messageId, caption: "Mengambil daftar negara yang tersedia..." });

    const kvProxyList = await getKVProxyList();
    const countryCodes = Object.keys(kvProxyList);
    const countryButtons = countryCodes.map((code) => {
      const flag = code.toUpperCase().split("").map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
      return { text: `${flag} ${code}`, callback_data: `get_country_${code}` };
    });

    const buttonRows = [];
    const chunkSize = 4;
    for (let i = 0; i < countryButtons.length; i += chunkSize) {
      buttonRows.push(countryButtons.slice(i, i + chunkSize));
    }
    buttonRows.push([{ text: "<< Kembali ke Menu Utama", callback_data: "start_menu" }]);

    await callTelegramApi("editMessageCaption", {
      chat_id: chatId,
      message_id: messageId,
      caption: "Silakan pilih negara untuk proksi yang Anda inginkan:",
      reply_markup: { inline_keyboard: buttonRows },
    });

  } else if (data.startsWith("get_country_")) {
    const countryCode = data.replace("get_country_", "");
    await logToAdmin(`User ${user.first_name} (@${user.username || 'N/A'}) memilih negara: ${countryCode}.`);

    const text = `Anda memilih negara ${countryCode}. Silakan pilih jenis proksi:`;
    const keyboard = {
      inline_keyboard: [
        [
          { text: "Trojan TLS", callback_data: `get_proxy_${countryCode}_trojan_tls` },
          { text: "Trojan Non-TLS", callback_data: `get_proxy_${countryCode}_trojan_ntls` },
        ],
        [
          { text: "VLESS TLS", callback_data: `get_proxy_${countryCode}_vless_tls` },
          { text: "VLESS Non-TLS", callback_data: `get_proxy_${countryCode}_vless_ntls` },
        ],
        [
          { text: "SS TLS", callback_data: `get_proxy_${countryCode}_ss_tls` },
          { text: "SS Non-TLS", callback_data: `get_proxy_${countryCode}_ss_ntls` },
        ],
        [{ text: "<< Kembali (Pilih Negara)", callback_data: "get_proxies" }],
      ],
    };
    await callTelegramApi("editMessageCaption", { chat_id: chatId, message_id: messageId, caption: text, reply_markup: keyboard });

  } else if (data.startsWith("get_proxy_")) {
    const parts = data.split("_");
    const countryCode = parts[2];
    const protocol = parts[3];
    const security = parts[4];
    const protocolName = protocol.toUpperCase();
    const securityName = security === 'tls' ? 'TLS' : 'Non-TLS';

    await logToAdmin(`User ${user.first_name} (@${user.username || 'N/A'}) meminta proksi ${protocolName} ${securityName} untuk negara ${countryCode}.`);

    await callTelegramApi("editMessageCaption", {
      chat_id: chatId,
      message_id: messageId,
      caption: `Mencari proksi untuk ${countryCode} dengan protokol ${protocolName} ${securityName}...`,
    });

    const proxies = await getProxiesForApi(countryCode, 15, protocol, security);

    if (proxies.length === 0) {
      await callTelegramApi("sendMessage", { chat_id: chatId, text: "Tidak ada proksi yang ditemukan untuk kombinasi ini." });
    } else {
      for (const proxy of proxies) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: `\`${proxy}\``,
          parse_mode: "MarkdownV2",
        });
      }
      await callTelegramApi("sendMessage", { chat_id: chatId, text: `Selesai! ${proxies.length} proksi ${protocolName} ${securityName} telah dikirim.` });
    }

    await callTelegramApi("sendMessage", {
        chat_id: chatId,
        text: 'Pilih tindakan selanjutnya:',
        reply_markup: {
            inline_keyboard: [
                [{ text: "Kembali ke Menu Utama", callback_data: "start_menu" }]
            ]
        }
    });
  }
}

// ... (rest of the file remains the same)
```
