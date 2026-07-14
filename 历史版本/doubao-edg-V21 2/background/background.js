/**
 * 豆包去水印 - Background Service Worker v5 (V21)
 *
 * 两部分合并：
 *  A) 原有 V20 逻辑：video-sharing 下载拦截 + 右键菜单 + 消息中转
 *     - video-sharing 页面：调用 get_play_info API 替换下载为无水印版本
 *     - 即梦 / 通义千问：由 content script (inject.js) 处理
 *
 *  B) 新增对话页引擎（来自「豆包 Dola 15秒去水印助手」提取机制）：
 *     - 用 chrome.debugger 拦截对话流式接口 /im/chain/single
 *     - 从响应中提取：
 *         · image_ori_raw.url  → 原图（已无水印）
 *         · fallback_api       → 拼接 logo_type=unwatermarked 请求预签名 URL，
 *                                解码 main_url 得到真·无水印视频
 *     - 通过浮动面板（content-panel.js）展示并下载
 *
 *  注意：对话页的「下载」环节 credentials:omit（不带 cookie），fallback_api 为预签名 URL。
 */

// ═══════════════════════════════════════════════════════════════
// A) V20：video-sharing 标签页追踪 + 下载拦截
// ═══════════════════════════════════════════════════════════════

const doubaoVideoTabs = new Map(); // { tabId → { videoId, shareId, url } }
const extensionDownloadUrls = new Set(); // 防止循环拦截

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    const url = tab.url || changeInfo.url || '';
    const m = url.match(/doubao\.com\/video-sharing.*[?&]video_id=([^&]+)/);
    if (m) {
      let shareId = '';
      try { shareId = new URL(url).searchParams.get('share_id') || ''; } catch {}
      doubaoVideoTabs.set(tabId, { videoId: m[1], shareId, url });
      console.log(`[豆包去水印] 追踪标签页 ${tabId}: videoId=${m[1]}`);
    } else if (!url.includes('doubao.com/video-sharing')) {
      if (doubaoVideoTabs.has(tabId)) {
        doubaoVideoTabs.delete(tabId);
      }
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  doubaoVideoTabs.delete(tabId);
  attachedTabs.delete(tabId);
});

// 下载拦截：来自豆包视频页面的视频下载 → 自动替换为无水印版本
chrome.downloads.onCreated.addListener(async (item) => {
  const url = item.url || '';
  const referrer = item.referrer || '';
  const mime = item.mime || '';
  const filename = item.filename || '';

  // 跳过插件自己发起的下载
  if (extensionDownloadUrls.has(url)) {
    extensionDownloadUrls.delete(url);
    return;
  }

  const fromDoubaoVideoSharing = referrer.includes('doubao.com/video-sharing');

  if (!fromDoubaoVideoSharing) return; // chat 页面改由浮动面板处理，不在此拦截

  const isVideo = mime.startsWith('video/') ||
                  /\.(mp4|webm|mov|avi|mkv|flv)/i.test(url) ||
                  /\.(mp4|webm|mov|avi|mkv|flv)/i.test(filename);

  const fromCdn = url.includes('douyinvod.com') ||
                  url.includes('vlabvod.com') ||
                  url.includes('bytedance.com') ||
                  url.includes('byteimg.com') ||
                  url.includes('douyinpic.com') ||
                  url.includes('feiliao.com') ||
                  url.includes('tiktokcdn.com') ||
                  url.includes('ibytedtos.com') ||
                  url.includes('doubao.com');

  if (!isVideo && !fromCdn) return;

  const originalUrl = url;

  let videoId = null;
  let shareId = '';
  const refMatch = referrer.match(/doubao\.com\/video-sharing.*[?&]video_id=([^&]+)/);
  if (refMatch) {
    videoId = refMatch[1];
    try { shareId = new URL(referrer).searchParams.get('share_id') || ''; } catch {}
  }
  if (!videoId && item.tabId && doubaoVideoTabs.has(item.tabId)) {
    const info = doubaoVideoTabs.get(item.tabId);
    videoId = info.videoId;
    shareId = info.shareId;
  }
  if (!videoId) {
    for (const [, info] of doubaoVideoTabs) {
      videoId = info.videoId;
      shareId = info.shareId;
      break;
    }
  }
  if (!videoId) return;

  console.log(`[豆包去水印] video-sharing 拦截: videoId=${videoId}`);
  try { await chrome.downloads.cancel(item.id); } catch (e) {}
  try { await chrome.downloads.erase({ id: item.id }); } catch (e) {}

  try {
    const cleanUrl = await fetchNoWatermarkUrl(videoId);
    if (cleanUrl) {
      extensionDownloadUrls.add(cleanUrl);
      chrome.downloads.download({ url: cleanUrl, filename: `doubao_${videoId}.mp4`, saveAs: false });
      notifyTab('✅ 已自动替换为无水印视频下载', 'success');
    } else {
      extensionDownloadUrls.add(originalUrl);
      chrome.downloads.download({ url: originalUrl, saveAs: false });
      notifyTab('⚠️ 未获取到无水印地址，已恢复原始下载', 'warning');
    }
  } catch (err) {
    console.error('[豆包去水印] 去水印失败:', err);
    extensionDownloadUrls.add(originalUrl);
    chrome.downloads.download({ url: originalUrl, saveAs: false });
    notifyTab('❌ 去水印失败，已恢复原始下载', 'error');
  }

  setTimeout(() => extensionDownloadUrls.delete(originalUrl), 30000);
});

// 调用无水印API（仅 video-sharing 页面使用）
async function fetchNoWatermarkUrl(videoId) {
  const res = await fetch(
    'https://www.doubao.com/samantha/media/get_play_info?aid=497858&device_platform=web&language=zh-CN',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
      },
      body: JSON.stringify({ key: videoId })
    }
  );

  const json = await res.json();
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || 'API返回异常');
  }

  return json.data.original_media_info?.main_url ||
         json.data.media_info?.[0]?.main_url ||
         null;
}

function notifyTab(message, type) {
  chrome.tabs.query({ url: '*://www.doubao.com/*' }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message,
        type
      }).catch(() => {});
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// B) 对话页引擎：chrome.debugger 拦截 /im/chain/single 提取媒体
// ═══════════════════════════════════════════════════════════════

const DEBUGGER_VERSION = "1.3";
const DOUBAO_CHAIN_SINGLE_URL_PART = "doubao.com/im/chain/single";
const DOLA_CHAIN_SINGLE_URL_PART = "dola.com/im/chain/single";
const QAAB_SALT_HEX = "4dd4c2e6b83162090e52b3c7a6733ba4"
  + "1cb2462b829ab58a196b39db57177524"
  + "f49baf7f08e8d68d26a72e37c1a95a2f"
  + "1f05a51892aef2949732b62a38aadd58";

const fetchPatterns = [
  { urlPattern: `*${DOUBAO_CHAIN_SINGLE_URL_PART}*`, requestStage: "Response" },
  { urlPattern: `*${DOLA_CHAIN_SINGLE_URL_PART}*`, requestStage: "Response" }
];

const attachedTabs = new Set();

chrome.runtime.onInstalled.addListener(attachExistingTabs);
chrome.runtime.onStartup.addListener(attachExistingTabs);

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await safeGetTab(tabId);
  if (tab && shouldAttachToTab(tab.url)) {
    ensureAttached(tabId);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (shouldAttachToTab(url)) {
    ensureAttached(tabId);
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab && tab.id) {
    ensureAttached(tab.id);
  }
});

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) {
    attachedTabs.delete(source.tabId);
    setBadge(source.tabId, "");
  }
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === "Fetch.requestPaused" && source.tabId && params) {
    handlePausedRequest(source.tabId, params);
  }
});

async function attachExistingTabs() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id && shouldAttachToTab(tab.url)) {
      ensureAttached(tab.id);
    }
  }
}

async function safeGetTab(tabId) {
  try {
    return await chrome.tabs.get(tabId);
  } catch {
    return null;
  }
}

function shouldAttachToTab(url) {
  return typeof url === "string"
    && /^https?:\/\//i.test(url)
    && (url.includes("doubao.com/chat") || url.includes("dola.com/chat"));
}

async function ensureAttached(tabId) {
  if (attachedTabs.has(tabId)) {
    return;
  }

  try {
    await attachDebugger(tabId);
  } catch (error) {
    console.warn("debugger attach failed:", error.message || error);
    return;
  }

  try {
    await sendCommand(tabId, "Fetch.enable", { patterns: fetchPatterns });
    attachedTabs.add(tabId);
    setBadge(tabId, "ON");
  } catch (error) {
    console.warn("Fetch.enable failed:", error.message || error);
    setBadge(tabId, "");
  }
}

function attachDebugger(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, DEBUGGER_VERSION, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function sendCommand(tabId, method, params = {}) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve(result);
    });
  });
}

async function handlePausedRequest(tabId, event) {
  const requestId = event.requestId;
  const request = event.request || {};
  const url = request.url || "";

  try {
    if (url.includes(DOUBAO_CHAIN_SINGLE_URL_PART)) {
      await inspectChainSingleResponse(tabId, event, "doubao");
      return;
    }
    if (url.includes(DOLA_CHAIN_SINGLE_URL_PART)) {
      await inspectChainSingleResponse(tabId, event, "dola");
      return;
    }
    await continueRequest(tabId, requestId);
  } catch (error) {
    console.warn("request handling failed:", error.message || error);
    await continueRequest(tabId, requestId).catch(() => {});
  }
}

// 先取响应体，立即放行页面（不阻塞对话流），再异步提取媒体发送给面板
async function inspectChainSingleResponse(tabId, event, source) {
  const sourceKey = `${source}:${event.requestId}`;
  let responseBody = "";

  try {
    const response = await getPausedResponseBody(tabId, event.requestId);
    responseBody = response.body || "";
  } catch (error) {
    console.warn(`${source} get body failed:`, error.message || error);
  }

  // 立即放行，避免卡住豆包对话
  await continueRequest(tabId, event.requestId).catch(() => {});

  if (!responseBody) return;

  let items = [];
  try {
    const json = JSON.parse(responseBody);
    if (source === "doubao") {
      items = await extractDoubaoItems(json, responseBody);
    } else {
      items = extractDolaItems(json);
    }
  } catch (error) {
    console.warn(`${source} chain parse failed:`, error.message || error);
  }

  if (items.length) {
    await sendToTab(tabId, { type: "MEDIA_FOUND", sourceKey, items });
  } else {
    await sendToTab(tabId, { type: "MEDIA_STATUS", sourceKey, text: "未提取到资源" });
  }
}

async function getPausedResponseBody(tabId, requestId) {
  const response = await sendCommand(tabId, "Fetch.getResponseBody", { requestId });
  return {
    body: response.base64Encoded ? fromBase64Utf8(response.body) : response.body
  };
}

async function extractDoubaoItems(json, rawBody) {
  const items = [];
  const seenUrls = new Set();

  for (const url of findImageOriRawUrls(json)) {
    addItem(items, seenUrls, "image", url);
  }

  for (const fallbackApi of findDoubaoFallbackApis(json, rawBody)) {
    const videoUrl = await getDoubaoVideoUrlFromFallbackApi(fallbackApi);
    if (videoUrl) {
      addItem(items, seenUrls, "video", videoUrl);
    }
  }

  return items;
}

function findDoubaoFallbackApis(json, rawBody) {
  const apis = new Set();

  for (const value of findValuesByKey(json, "fallback_api")) {
    addFallbackApi(apis, value);
  }

  const patterns = [
    /fallback_api\\":\\"(.*?)\\"/g,
    /"fallback_api"\s*:\s*"([^"]+)"/g
  ];

  for (const pattern of patterns) {
    let match = pattern.exec(rawBody);
    while (match) {
      addFallbackApi(apis, decodeJsonEscapedFragment(match[1]));
      match = pattern.exec(rawBody);
    }
  }

  return Array.from(apis);
}

function addFallbackApi(apis, value) {
  if (typeof value !== "string" || !value) {
    return;
  }
  const url = decodeJsonEscapedFragment(value);
  if (isHttpUrl(url)) {
    apis.add(url);
  }
}

function decodeJsonEscapedFragment(value) {
  let text = value;
  for (let index = 0; index < 3; index += 1) {
    try {
      const decoded = JSON.parse(`"${text.replace(/"/g, '\\"')}"`);
      if (decoded === text) {
        break;
      }
      text = decoded;
    } catch {
      break;
    }
  }
  return text.replace(/\\u0026/g, "&").replace(/\\\//g, "/");
}

// 关键：用预签名 fallback_api + logo_type=unwatermarked 拿真·无水印视频
async function getDoubaoVideoUrlFromFallbackApi(fallbackApi) {
  try {
    const url = replaceQueryParams(fallbackApi, {
      channel: "no",
      codec_type: "8",
      logo_type: "unwatermarked"
    });
    const response = await fetch(url, {
      method: "GET",
      credentials: "omit",
      headers: {
        "accept": "application/json,text/plain,*/*"
      }
    });
    const payload = await response.json();
    const data = getVideoData(payload);
    const token = pickMainUrlToken(data);
    if (!token) {
      return "";
    }
    return await decodeMainUrl(token, findKeySeedDeep(payload));
  } catch (error) {
    console.warn("doubao fallback_api failed:", error.message || error);
    return "";
  }
}

function replaceQueryParams(url, params) {
  const parsedUrl = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    parsedUrl.searchParams.set(key, value);
  }
  return parsedUrl.toString();
}

function getVideoData(payload) {
  const videoInfo = payload?.video_info || payload?.data?.video_info || payload;
  const data = videoInfo?.data || videoInfo;
  return data && typeof data === "object" ? data : {};
}

function pickMainUrlToken(data) {
  const videoList = data?.video_list;
  const entries = videoList && typeof videoList === "object" && Object.keys(videoList).length
    ? Object.values(videoList)
    : [data];
  let best = null;

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const token = entry.main_url || entry.play_url || "";
    if (typeof token !== "string" || !token.trim()) {
      continue;
    }
    const score = Number(entry.bitrate || entry.real_bitrate || 0)
      + Number(entry.vwidth || entry.width || 0) * Number(entry.vheight || entry.height || 0);
    if (!best || score > best.score) {
      best = { token: token.trim(), score };
    }
  }

  return best ? best.token : "";
}

function findKeySeedDeep(value, depth = 0) {
  if (depth > 10 || value == null) {
    return "";
  }

  if (typeof value === "string") {
    let match = value.match(/(?:^|[?&])key_seed=([^&"'<>\\\s]+)/i);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    match = value.match(/["']key_seed["']\s*:\s*["']([^"']+)/i);
    return match ? decodeURIComponent(match[1]) : "";
  }

  if (typeof value !== "object") {
    return "";
  }

  if (typeof value.key_seed === "string" && value.key_seed.trim()) {
    return value.key_seed.trim();
  }

  for (const item of Object.values(value)) {
    const hit = findKeySeedDeep(item, depth + 1);
    if (hit) {
      return hit;
    }
  }

  return "";
}

async function decodeMainUrl(token, keySeed = "") {
  if (isHttpUrl(token)) {
    return token;
  }

  const plainUrl = tryDecodeBase64Url(token);
  if (plainUrl) {
    return plainUrl;
  }

  if (token.startsWith("qAAB") && keySeed) {
    return await decodeQaabToken(token, keySeed);
  }

  return "";
}

function tryDecodeBase64Url(token) {
  const bytes = base64DecodeLoose(token);
  if (!bytes) {
    return "";
  }
  const text = asciiUrlFromBytes(bytes);
  return isHttpUrl(text) ? text : "";
}

function base64DecodeLoose(text) {
  const input = String(text || "").trim();
  const variants = [
    input,
    input.replace(/[$@#]/g, (char) => ({ "$": "_", "@": "/", "#": "." }[char])),
    input.replace(/[$@#]/g, (char) => ({ "$": "+", "@": "/", "#": "=" }[char]))
  ];
  const seen = new Set();

  for (const candidate of variants) {
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    try {
      const normalized = padBase64(candidate).replace(/-/g, "+").replace(/_/g, "/");
      const binary = atob(normalized);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    } catch {
      // Try the next variant.
    }
  }

  return null;
}

function padBase64(text) {
  const pad = (4 - (text.length % 4)) % 4;
  return text + "=".repeat(pad);
}

function asciiUrlFromBytes(bytes) {
  if (!bytes || !bytes.length) {
    return "";
  }
  for (const byte of bytes) {
    if (byte !== 9 && byte !== 10 && byte !== 13 && (byte < 32 || byte > 126)) {
      return "";
    }
  }
  return new TextDecoder().decode(bytes);
}

async function decodeQaabToken(token, keySeed) {
  const data = base64DecodeLoose(token);
  const seed = base64DecodeLoose(keySeed);
  if (!data || !seed) {
    return "";
  }

  const digest1 = await crypto.subtle.digest("SHA-512", seed.slice(0, 32));
  const salt = hexToBytes(QAAB_SALT_HEX);
  const digest2Input = concatBytes(new Uint8Array(digest1), salt);
  const digest2 = new Uint8Array(await crypto.subtle.digest("SHA-512", digest2Input));
  const key = digest2.slice(0, 16);
  const iv = digest2.slice(16, 32);
  const attempts = [];

  if (data.length >= 4 && data[0] === 0xa8 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) {
    attempts.push({ payload: data.slice(4), key, iv });
    attempts.push({ payload: data.slice(4), key: iv, iv: key });
    if (data.length > 36) {
      attempts.push({ payload: data.slice(36), key, iv: data.slice(20, 36) });
      attempts.push({ payload: data.slice(36), key, iv });
    }
  } else {
    attempts.push({ payload: data, key, iv });
  }

  for (const attempt of attempts) {
    const url = await decryptAesCbcUrl(attempt.payload, attempt.key, attempt.iv);
    if (url) {
      return url;
    }
  }

  return "";
}

async function decryptAesCbcUrl(payload, keyBytes, ivBytes) {
  if (!payload.length || payload.length % 16 !== 0) {
    return "";
  }

  try {
    const key = await crypto.subtle.importKey("raw", keyBytes, "AES-CBC", false, ["decrypt"]);
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBytes }, key, payload));
    const direct = asciiUrlFromBytes(plain);
    if (isHttpUrl(direct)) {
      return direct;
    }
    const stripped = stripPkcs7(plain);
    const url = asciiUrlFromBytes(stripped);
    return isHttpUrl(url) ? url : "";
  } catch {
    return "";
  }
}

function stripPkcs7(bytes) {
  if (!bytes || !bytes.length) {
    return new Uint8Array();
  }
  const pad = bytes[bytes.length - 1];
  if (pad < 1 || pad > 16 || pad > bytes.length) {
    return bytes;
  }
  for (let index = bytes.length - pad; index < bytes.length; index += 1) {
    if (bytes[index] !== pad) {
      return bytes;
    }
  }
  return bytes.slice(0, bytes.length - pad);
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function concatBytes(first, second) {
  const bytes = new Uint8Array(first.length + second.length);
  bytes.set(first, 0);
  bytes.set(second, first.length);
  return bytes;
}

function extractDolaItems(json) {
  const items = [];
  const seenUrls = new Set();

  for (const url of findImageOriRawUrls(json)) {
    addItem(items, seenUrls, "image", url);
  }

  for (const encodedUrl of findDolaEncodedVideoUrls(json)) {
    const url = decodeBase64Url(encodedUrl);
    if (url) {
      addItem(items, seenUrls, "video", url);
    }
  }

  return items;
}

function findDolaEncodedVideoUrls(json) {
  const values = [];
  for (const value of findValuesByKey(json, "man_url")) {
    values.push(value);
  }
  for (const value of findValuesByKey(json, "main_url")) {
    values.push(value);
  }
  return values;
}

function findImageOriRawUrls(value) {
  const urls = [];
  walkJsonAndStrings(value, (node) => {
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const image = node.image_ori_raw;
      if (image && typeof image === "object" && isHttpUrl(image.url)) {
        urls.push(image.url);
      }
    }
  });
  return urls;
}

function findValuesByKey(value, targetKey) {
  const values = [];
  walkJsonAndStrings(value, (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(node, targetKey)) {
      values.push(node[targetKey]);
    }
  });
  return values;
}

function walkJsonAndStrings(value, visitor, seen = new Set()) {
  if (value == null) {
    return;
  }

  if (typeof value === "string") {
    const parsed = parseJsonString(value);
    if (parsed !== null) {
      walkJsonAndStrings(parsed, visitor, seen);
    }
    return;
  }

  if (typeof value !== "object" || seen.has(value)) {
    return;
  }

  seen.add(value);
  visitor(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      walkJsonAndStrings(item, visitor, seen);
    }
    return;
  }

  for (const key of Object.keys(value)) {
    walkJsonAndStrings(value[key], visitor, seen);
  }
}

function parseJsonString(text) {
  const trimmed = text.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function addItem(items, seenUrls, type, url) {
  if (!isHttpUrl(url) || seenUrls.has(url)) {
    return;
  }
  seenUrls.add(url);
  items.push({ type, url });
}

function decodeBase64Url(value) {
  if (typeof value !== "string" || !value) {
    return "";
  }

  if (isHttpUrl(value)) {
    return value;
  }

  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const decoded = fromBase64Utf8(padded);
    return isHttpUrl(decoded) ? decoded : "";
  } catch {
    return "";
  }
}

function continueRequest(tabId, requestId) {
  return sendCommand(tabId, "Fetch.continueRequest", { requestId });
}

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

async function sendToTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.warn("send panel message failed:", error.message || error);
  }
}

function setBadge(tabId, text) {
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#166534" }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
// 右键菜单
// ═══════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'doubao-extract',
    title: '🫧 豆包去水印 - 提取当前页面',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://www.doubao.com/*',
      'https://qwen.cn/*',
      'https://qianwen.com/*',
      'https://xiaoyunque.jianying.com/*',
      'https://jimeng.jianying.com/*',
      'https://dreamina.com/*'
    ]
  });

  chrome.contextMenus.create({
    id: 'doubao-extract-link',
    title: '🫧 豆包去水印 - 提取此链接',
    contexts: ['link'],
    targetUrlPatterns: [
      'https://www.doubao.com/video-sharing*',
      'https://www.doubao.com/thread/*',
      'https://qwen.cn/*',
      'https://qianwen.com/*',
      'https://xiaoyunque.jianying.com/*',
      'https://jimeng.jianying.com/*',
      'https://dreamina.com/*'
    ]
  });

  chrome.contextMenus.create({
    id: 'doubao-video-save',
    title: '🫧 豆包去水印 - 无水印下载视频',
    contexts: ['video'],
    documentUrlPatterns: ['https://www.doubao.com/*']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  let url = '';

  if (info.menuItemId === 'doubao-extract') {
    url = tab.url;
  } else if (info.menuItemId === 'doubao-extract-link') {
    url = info.linkUrl;
  } else if (info.menuItemId === 'doubao-video-save') {
    handleVideoContextMenu(tab);
    return;
  }

  if (url) {
    chrome.runtime.sendMessage({
      action: 'autoExtract',
      url: url
    }).catch(() => {
      chrome.action.openPopup();
    });
  }
});

async function handleVideoContextMenu(tab) {
  const url = tab.url || '';

  // video-sharing 页面 → 用 API
  const m = url.match(/doubao\.com\/video-sharing.*[?&]video_id=([^&]+)/);
  if (m) {
    const videoId = m[1];
    try {
      const cleanUrl = await fetchNoWatermarkUrl(videoId);
      if (cleanUrl) {
        extensionDownloadUrls.add(cleanUrl);
        chrome.downloads.download({ url: cleanUrl, filename: `doubao_${videoId}.mp4`, saveAs: false });
        notifyTab('✅ 无水印视频下载已开始！', 'success');
      } else {
        notifyTab('❌ 未获取到无水印视频地址', 'error');
      }
    } catch (err) {
      notifyTab('❌ ' + (err.message || '获取失败'), 'error');
    }
    return;
  }

  // chat 页面 → 提示使用浮动面板
  if (url.includes('doubao.com/chat')) {
    notifyTab('💡 请使用页面右下角「无水印资源」面板下载', 'info');
    return;
  }

  chrome.tabs.sendMessage(tab.id, {
    action: 'showNotification',
    message: '❌ 当前页面不是豆包视频页面',
    type: 'error'
  }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
// 消息处理（来自 popup / content script / 面板）
// ═══════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  // V20：popup 下载请求
  if (message.action === 'download') {
    handleDownload(message.url, message.filename);
    sendResponse({ ok: true });
  }

  // V20：popup 页面提取
  if (message.action === 'extractFromPage') {
    handlePageExtract(message.url).then(result => {
      sendResponse({ ok: true, data: result });
    }).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  // V20：视频右键点击通知
  if (message.action === 'videoRightClick') {
    console.log(`[豆包去水印] 用户在视频元素上右键`);
    sendResponse({ ok: true });
  }

  // 浮动面板：下载媒体（无水印视频/原图）
  if (message.type === 'DOWNLOAD_MEDIA' && isHttpUrl(message.url)) {
    handleDownload(message.url, message.filename);
    sendResponse({ ok: true });
  }
});

function handleDownload(url, filename) {
  if (!url) return;

  extensionDownloadUrls.add(url);
  setTimeout(() => extensionDownloadUrls.delete(url), 30000);

  chrome.downloads.download({
    url: url,
    filename: filename || defaultNameFromUrl(url),
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      extensionDownloadUrls.delete(url);
      console.error('下载失败:', chrome.runtime.lastError.message);
    } else {
      console.log('下载已开始, ID:', downloadId);
    }
  });
}

function defaultNameFromUrl(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop() || 'doubao_media';
    if (/\.(mp4|webm|mov|png|jpg|jpeg|webp|gif)$/i.test(seg)) return seg;
  } catch {}
  return 'doubao_media';
}

async function handlePageExtract(url) {
  return { url };
}

// ═══════════════════════════════════════════════════════════════
// 通用编解码工具
// ═══════════════════════════════════════════════════════════════

function toBase64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64Utf8(base64Text) {
  const binary = atob(base64Text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}
