try {
  importScripts("service-worker.js");
} catch (error) {
  console.error("[Background] 15秒规则脚本加载失败:", error);
}

let imageList = [];
let videoList = [];
const CURRENT_VERSION = "10.2.14";
let versionStatus = { valid: true, message: "", warning: "", expireDate: "" };
let lastVersionCheck = 0;
const VERSION_CHECK_INTERVAL = 86400000;
const DOUBAO_SHARE_GET_URL = "https://www.doubao.com/im/message/share/get?aid=497858&device_platform=web&language=zh&pc_version=3.25.3&samantha_web=1";
const QAAB_SALT_BYTES = hexToBytes(
  "4dd4c2e6b83162090e52b3c7a6733ba4" +
  "1cb2462b829ab58a196b39db57177524" +
  "f49baf7f08e8d68d26a72e37c1a95a2f" +
  "1f05a51892aef2949732b62a38aadd58"
);
const TRUE_NO_WATERMARK_VARIANTS = [
  { name: "codec0_unwatermarked", codecType: "0", logoType: "unwatermarked" },
  { name: "codec0_no_watermark", codecType: "0", logoType: "no_watermark" },
  { name: "codec0_empty", codecType: "0", logoType: "" }
];

function isHttpUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url);
}

function isDoubaoUrl(url) {
  return isHttpUrl(url) && /(^https?:\/\/)([^/]+\.)?doubao\.com\//i.test(url);
}

function isDolaUrl(url) {
  return isHttpUrl(url) && /(^https?:\/\/)([^/]+\.)?dola\.com\//i.test(url);
}

function isSupportedUrl(url) {
  return isDoubaoUrl(url) || isDolaUrl(url);
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs.length ? tabs[0] : null;
}

async function injectDoubaoPageScripts(tabId) {
  const result = { injected: false, errors: [] };

  try {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["directory.css"]
    });
  } catch (error) {
    result.errors.push("directory.css: " + (error.message || error));
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
      world: "MAIN"
    });
    result.injected = true;
  } catch (error) {
    result.errors.push("content.js: " + (error.message || error));
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["forwarder.js"]
    });
    result.injected = true;
  } catch (error) {
    result.errors.push("forwarder.js: " + (error.message || error));
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["directory.js"]
    });
    result.injected = true;
  } catch (error) {
    result.errors.push("directory.js: " + (error.message || error));
  }

  return result;
}

async function ensureTabReady(tab, options = {}) {
  const result = {
    success: false,
    tabId: tab && tab.id,
    url: tab && tab.url,
    rulesAttached: false,
    scriptsInjected: false,
    reloaded: false,
    errors: []
  };

  if (!tab || !tab.id || !isSupportedUrl(tab.url)) {
    result.errors.push("当前标签页不是豆包或 Dola 页面");
    return result;
  }

  if (typeof ensureAttached === "function") {
    try {
      await ensureAttached(tab.id);
      result.rulesAttached = true;
    } catch (error) {
      result.errors.push("规则挂载失败: " + (error.message || error));
    }
  } else {
    result.errors.push("15秒规则模块未加载");
  }

  if (isDoubaoUrl(tab.url)) {
    const injectResult = await injectDoubaoPageScripts(tab.id);
    result.scriptsInjected = injectResult.injected;
    result.errors = result.errors.concat(injectResult.errors);
  }

  if (options.reload) {
    try {
      await chrome.tabs.reload(tab.id);
      result.reloaded = true;
    } catch (error) {
      result.errors.push("页面刷新失败: " + (error.message || error));
    }
  }

  result.success = result.errors.length === 0 || result.rulesAttached || result.scriptsInjected || result.reloaded;
  return result;
}

async function ensureAllOpenTabsReady() {
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (isSupportedUrl(tab.url)) {
      await ensureTabReady(tab).catch(function(error) {
        console.warn("[Background] 预热标签页失败:", error && error.message ? error.message : error);
      });
    }
  }
}

// 检查激活状态
async function checkActivationStatus() {
  await new Promise(function(resolve) {
    chrome.storage.local.set({
      activated: true,
      remainingCount: null,
      expireTime: "永久有效",
      cardType: "本地版"
    }, resolve);
  });
  return { activated: true, message: "已激活，永久有效", remainingCount: null, expireTime: "永久有效" };
}

// 下载图片
async function downloadImage(url, filename) {
  try {
    var downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
    return { success: true, downloadId: downloadId, filename: filename };
  } catch (e) {
    console.error("[Background] 图片下载失败:", e);
    return { success: false, error: e.message };
  }
}

// 下载视频
async function downloadVideo(url, filename, backupUrl) {
  try {
    console.log("[Background] 开始下载视频, URL:", url);
    var downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: false,
      conflictAction: "uniquify"
    });
    console.log("[Background] 视频下载成功, ID:", downloadId);
    return { success: true, downloadId: downloadId, filename: filename };
  } catch (e) {
    console.error("[Background] 视频下载失败:", e);
    if (backupUrl) {
      try {
        console.log("[Background] 尝试备用URL:", backupUrl);
        var downloadId2 = await chrome.downloads.download({
          url: backupUrl,
          filename: filename,
          saveAs: false,
          conflictAction: "uniquify"
        });
        return { success: true, downloadId: downloadId2, filename: filename, usedBackup: true };
      } catch (e2) {
        console.error("[Background] 备用URL也失败:", e2);
        return { success: false, error: e2.message };
      }
    }
    return { success: false, error: e.message };
  }
}

// 豆包API - 获取视频分享信息
async function callDoubaoShareSave(messageId) {
  var body = { message_id: messageId };
  try {
    var response = await fetch("https://api-normal.doubao.com/alice/media/bigmusic/share_save?version_code=20800&language=zh&device_platform=web&aid=497858&real_aid=497858&pkg_type=release_version&device_id=7550681679050343936&pc_version=3.14.6&region=CN&sys_region=CN&samantha_web=1&use-olympus-account=1", {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Agw-Js-Conv": "str"
      },
      credentials: "include",
      body: JSON.stringify(body)
    });
    var rawText = await response.text();
    var data = JSON.parse(rawText);
    if (data.code === 0 && data.data) {
      var shareId = data.data.share_id;
      return {
        success: true,
        share_id: shareId,
        share_url: data.data.share_url || "https://www.doubao.com/video-sharing?share_id=" + shareId
      };
    }
    return { success: false, error: data.msg || data.message || "API错误" };
  } catch (e) {
    console.error("[Background] callDoubaoShareSave 失败:", e);
    return { success: false, error: e.message };
  }
}

function hexToBytes(hexText) {
  var text = String(hexText || "").replace(/\s+/g, "");
  var bytes = new Uint8Array(text.length / 2);
  for (var i = 0; i < text.length; i += 2) {
    bytes[i / 2] = parseInt(text.slice(i, i + 2), 16);
  }
  return bytes;
}

function concatUint8Arrays(parts) {
  var total = 0;
  for (var i = 0; i < parts.length; i++) {
    total += parts[i].length;
  }
  var out = new Uint8Array(total);
  var offset = 0;
  for (var j = 0; j < parts.length; j++) {
    out.set(parts[j], offset);
    offset += parts[j].length;
  }
  return out;
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
}

function padBase64Text(text) {
  var normalized = String(text || "").trim();
  var pad = (4 - normalized.length % 4) % 4;
  return normalized + "=".repeat(pad);
}

function binaryStringToBytes(binaryText) {
  var out = new Uint8Array(binaryText.length);
  for (var i = 0; i < binaryText.length; i++) {
    out[i] = binaryText.charCodeAt(i);
  }
  return out;
}

function base64ToBytesLoose(text) {
  var input = String(text || "").trim();
  var variants = [
    input,
    input.replace(/\$/g, "_").replace(/@/g, "/").replace(/#/g, "."),
    input.replace(/\$/g, "+").replace(/@/g, "/").replace(/#/g, "=")
  ];
  var seen = new Set();
  var lastError = null;
  for (var i = 0; i < variants.length; i++) {
    var candidate = variants[i];
    if (!candidate || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    try {
      var normalized = padBase64Text(candidate).replace(/-/g, "+").replace(/_/g, "/");
      return binaryStringToBytes(atob(normalized));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("base64 decode failed");
}

function tryDecodeLooseBase64Url(text) {
  try {
    var bytes = base64ToBytesLoose(text);
    var decoded = new TextDecoder().decode(bytes);
    return /^https?:\/\//i.test(decoded) ? decoded : null;
  } catch (error) {
    return null;
  }
}

function extractKeySeedText(raw) {
  var text = String(raw || "");
  var match = text.match(/(?:^|[?&])key_seed=([^&"'<>\\\s]+)/i) || text.match(/["']key_seed["']\s*:\s*["']([^"']+)/i);
  return match ? safeDecodeURIComponent(match[1]) : null;
}

function parseJsonMaybe(value) {
  if (typeof value !== "string") {
    return value;
  }
  var text = value.trim();
  if (!text || (text[0] !== "{" && text[0] !== "[")) {
    return value;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return value;
  }
}

function findKeySeedDeep(value, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 10 || value == null) {
    return "";
  }
  if (typeof value === "string") {
    return extractKeySeedText(value) || "";
  }
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) {
      var arrayHit = findKeySeedDeep(value[i], depth + 1);
      if (arrayHit) {
        return arrayHit;
      }
    }
    return "";
  }
  if (typeof value === "object") {
    if (typeof value.key_seed === "string" && value.key_seed.trim()) {
      return value.key_seed.trim();
    }
    var objectValues = Object.values(value);
    for (var j = 0; j < objectValues.length; j++) {
      var nestedHit = findKeySeedDeep(objectValues[j], depth + 1);
      if (nestedHit) {
        return nestedHit;
      }
    }
  }
  return "";
}

function collectShareVideoCandidates(shareData) {
  var messageList = (((shareData || {}).message_snapshot || {}).message_list) || [];
  var candidates = [];
  for (var i = 0; i < messageList.length; i++) {
    var message = messageList[i] || {};
    var creationMaterialInfo = parseJsonMaybe(message.ext && message.ext.creation_material_info);
    if (!creationMaterialInfo || typeof creationMaterialInfo !== "object") {
      continue;
    }
    var taskIds = Object.keys(creationMaterialInfo);
    for (var j = 0; j < taskIds.length; j++) {
      var taskId = taskIds[j];
      var material = creationMaterialInfo[taskId] || {};
      var video = ((material.result || {}).video) || null;
      if (!video) {
        continue;
      }
      candidates.push({
        taskId: taskId,
        messageId: String(message.message_id || "").trim(),
        referencedMessageId: String(((message.reference_info || {}).referenced_message_id) || message.bot_reply_message_id || "").trim(),
        video: video,
        model: parseJsonMaybe(video.video_model),
        shareMessageIndex: i
      });
    }
  }
  return candidates;
}

function selectBestShareVideoCandidate(candidates, targetMessageId) {
  var targetId = String(targetMessageId || "").trim();
  var bestCandidate = null;
  var bestScore = -1;
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var score = 0;
    if (candidate.messageId && candidate.messageId === targetId) {
      score += 1000;
    }
    if (candidate.referencedMessageId && candidate.referencedMessageId === targetId) {
      score += 400;
    }
    if (candidate.model && candidate.model.fallback_api) {
      score += 100;
    }
    if (candidate.video && candidate.video.download_url) {
      score += 20;
    }
    score += i;
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }
  return bestCandidate;
}

function getShareIdCandidates(shareResult) {
  var ids = [];
  var rawShareId = shareResult && shareResult.share_id ? String(shareResult.share_id).trim() : "";
  var rawShareUrl = shareResult && shareResult.share_url ? String(shareResult.share_url).trim() : "";

  if (rawShareId) {
    ids.push(rawShareId);
  }
  if (rawShareUrl) {
    var threadMatch = rawShareUrl.match(/\/thread\/([a-z0-9]+)/i);
    if (threadMatch && threadMatch[1]) {
      ids.push(threadMatch[1]);
    }
    var shareMatch = rawShareUrl.match(/[?&]share_id=([a-z0-9]+)/i);
    if (shareMatch && shareMatch[1]) {
      ids.push(shareMatch[1]);
    }
  }

  return ids.filter(function(id, index) {
    return id && ids.indexOf(id) === index;
  });
}

async function postJson(url, body, options) {
  var response = await fetch(url, Object.assign({
    method: "POST",
    credentials: "include",
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json; charset=utf-8",
      "Agw-Js-Conv": "str"
    },
    body: JSON.stringify(body || {})
  }, options || {}));
  var rawText = await response.text();
  var data = null;
  try {
    data = JSON.parse(rawText);
  } catch (error) {
    throw new Error("响应不是合法 JSON: " + rawText.slice(0, 200));
  }
  return { response: response, data: data, rawText: rawText };
}

async function getDoubaoShareSnapshot(shareId) {
  var payload = await postJson(DOUBAO_SHARE_GET_URL, {
    share_id: shareId,
    need_bot_info: true
  });
  if (payload.data.code !== 0 || !payload.data.data) {
    throw new Error(payload.data.msg || payload.data.message || "分享页接口返回异常");
  }
  return payload.data.data;
}

function mutateFplayUrl(fplayUrl, variant) {
  var parsed = new URL(fplayUrl);
  parsed.searchParams.set("codec_type", variant.codecType);
  parsed.searchParams.set("logo_type", variant.logoType);
  return parsed.toString();
}

async function getFplayInfo(fplayUrl) {
  var response = await fetch(fplayUrl, {
    method: "GET",
    headers: {
      "Accept": "application/json,text/plain,*/*"
    }
  });
  var rawText = await response.text();
  var payload = null;
  try {
    payload = JSON.parse(rawText);
  } catch (error) {
    throw new Error("fplay 响应不是合法 JSON: " + rawText.slice(0, 200));
  }
  var videoInfo = payload.video_info || ((payload.data || {}).video_info) || payload;
  var data = videoInfo.data || videoInfo;
  return { raw: payload, data: data };
}

async function sha512Bytes(bytes) {
  return new Uint8Array(await crypto.subtle.digest("SHA-512", bytes));
}

async function deriveQaabKeyIv(keySeedText) {
  var keySeedBytes = base64ToBytesLoose(keySeedText);
  var seed32 = keySeedBytes.slice(0, 32);
  var digest1 = await sha512Bytes(seed32);
  var digest2 = await sha512Bytes(concatUint8Arrays([digest1, QAAB_SALT_BYTES]));
  return {
    key: digest2.slice(0, 16),
    iv: digest2.slice(16, 32)
  };
}

function stripPkcs7(bytes) {
  if (!bytes || !bytes.length) {
    return null;
  }
  var pad = bytes[bytes.length - 1];
  if (!pad || pad < 1 || pad > 16 || pad > bytes.length) {
    return null;
  }
  for (var i = bytes.length - pad; i < bytes.length; i++) {
    if (bytes[i] !== pad) {
      return null;
    }
  }
  return bytes.slice(0, bytes.length - pad);
}

function bytesToMaybeText(bytes) {
  var decoders = [new TextDecoder("utf-8"), new TextDecoder("iso-8859-1")];
  for (var i = 0; i < decoders.length; i++) {
    try {
      var text = decoders[i].decode(bytes);
      if (/^[\x09\x0a\x0d\x20-\x7e]+$/.test(text)) {
        return text;
      }
    } catch (error) {}
  }
  return "";
}

async function decryptAesCbc(payload, keyBytes, ivBytes) {
  var cryptoKey = await crypto.subtle.importKey("raw", keyBytes, "AES-CBC", false, ["decrypt"]);
  var decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBytes }, cryptoKey, payload);
  return new Uint8Array(decrypted);
}

async function decodeQaabToken(token, keySeedText) {
  var data = base64ToBytesLoose(token);
  var derived = await deriveQaabKeyIv(keySeedText);
  var attempts = [];

  if (data.length >= 4 && data[0] === 0xa8 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) {
    attempts.push({ payload: data.slice(4), key: derived.key, iv: derived.iv });
    attempts.push({ payload: data.slice(4), key: derived.iv, iv: derived.key });
    if (data.length > 36) {
      attempts.push({ payload: data.slice(36), key: derived.key, iv: data.slice(20, 36) });
      attempts.push({ payload: data.slice(36), key: derived.key, iv: derived.iv });
    }
  } else {
    attempts.push({ payload: data, key: derived.key, iv: derived.iv });
  }

  for (var i = 0; i < attempts.length; i++) {
    var attempt = attempts[i];
    if (!attempt.payload.length || attempt.payload.length % 16 !== 0) {
      continue;
    }
    try {
      var plainBytes = await decryptAesCbc(attempt.payload, attempt.key, attempt.iv);
      var directText = bytesToMaybeText(plainBytes);
      if (/^https?:\/\//i.test(directText)) {
        return directText;
      }
      var unpadded = stripPkcs7(plainBytes);
      if (!unpadded) {
        continue;
      }
      var text = bytesToMaybeText(unpadded);
      if (/^https?:\/\//i.test(text)) {
        return text;
      }
    } catch (error) {}
  }

  return "";
}

async function decodeVideoTokenToUrl(token, keySeedText) {
  if (!token || typeof token !== "string") {
    return "";
  }
  if (/^https?:\/\//i.test(token)) {
    return token;
  }
  var direct = tryDecodeLooseBase64Url(token);
  if (direct) {
    return direct;
  }
  if (!token.startsWith("qAAB") || !keySeedText) {
    return "";
  }
  return decodeQaabToken(token, keySeedText);
}

function buildResolvedMediaCandidates(fplayData, variantName, keySeedText) {
  var candidates = [];
  var data = (fplayData && fplayData.data) || {};
  var derivedKeySeed = findKeySeedDeep(data) || keySeedText || "";
  var videoList = data.video_list || {};
  var entries = Object.keys(videoList).length ? videoList : { video_1: data };

  return Promise.all(Object.keys(entries).map(async function(entryName) {
    var info = entries[entryName] || {};
    var mainUrl = await decodeVideoTokenToUrl(info.main_url || info.play_url || "", derivedKeySeed);
    var backupUrl = "";
    var backupFields = ["backup_url_1", "backup_url_2", "backup_url_3"];
    for (var i = 0; i < backupFields.length; i++) {
      var decodedBackup = await decodeVideoTokenToUrl(info[backupFields[i]] || "", derivedKeySeed);
      if (decodedBackup) {
        backupUrl = decodedBackup;
        break;
      }
    }
    if (!mainUrl) {
      return null;
    }

    var parsed = new URL(mainUrl);
    var lr = (parsed.searchParams.get("lr") || "").toLowerCase();
    var cs = parsed.searchParams.get("cs") || "";
    var qs = parsed.searchParams.get("qs") || "";
    candidates.push({
      variant: variantName,
      definition: info.definition || "",
      quality: info.quality || "",
      width: info.vwidth || info.width || null,
      height: info.vheight || info.height || null,
      bitrate: Number(info.bitrate || info.real_bitrate || 0),
      logoType: lr,
      cs: cs,
      qs: qs,
      videoUrl: mainUrl,
      backupUrl: backupUrl,
      trueNoWatermark: cs === "0" && qs === "13" && (!lr || lr === "unwatermarked" || lr === "no_watermark")
    });
    return null;
  })).then(function() {
    return candidates;
  });
}

function resolvedCandidateScore(candidate) {
  var score = 0;
  if (candidate.trueNoWatermark) {
    score += 10000;
  }
  if (candidate.logoType === "unwatermarked") {
    score += 2000;
  } else if (candidate.logoType === "no_watermark") {
    score += 1500;
  }
  if (candidate.qs === "13") {
    score += 300;
  }
  if (candidate.cs === "0") {
    score += 300;
  }
  score += candidate.bitrate || 0;
  return score;
}

function isTrueNoWatermarkMediaUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    return false;
  }
  try {
    var parsed = new URL(url);
    var lr = (parsed.searchParams.get("lr") || "").toLowerCase();
    var cs = parsed.searchParams.get("cs") || "";
    var qs = parsed.searchParams.get("qs") || "";
    return cs === "0" && qs === "13" && (!lr || lr === "unwatermarked" || lr === "no_watermark");
  } catch (error) {
    return false;
  }
}

function selectBestTrueNoWatermarkCandidate(candidates) {
  var trueNoWatermark = (candidates || []).filter(function(item) {
    return item && item.trueNoWatermark;
  }).sort(function(a, b) {
    return resolvedCandidateScore(b) - resolvedCandidateScore(a);
  });
  return trueNoWatermark.length ? trueNoWatermark[0] : null;
}

async function resolveTrueNoWatermarkVideoFromRuntimePayload(payload) {
  payload = payload || {};
  var resolved = [];
  var parsedModel = parseJsonMaybe(payload.videoModel);
  var keySeedText = payload.keySeed || findKeySeedDeep(parsedModel) || findKeySeedDeep(payload) || "";
  var decodedDownloadUrl = tryDecodeLooseBase64Url(payload.downloadUrl || "") || payload.downloadUrl || "";

  if (isTrueNoWatermarkMediaUrl(payload.directNoWatermarkUrl)) {
    resolved.push({
      variant: "runtime_direct_url",
      definition: "",
      quality: "original",
      width: null,
      height: null,
      bitrate: 0,
      logoType: "unwatermarked",
      cs: "0",
      qs: "13",
      videoUrl: payload.directNoWatermarkUrl,
      backupUrl: "",
      trueNoWatermark: true
    });
  }

  if (isTrueNoWatermarkMediaUrl(decodedDownloadUrl)) {
    resolved.push({
      variant: "runtime_download_url",
      definition: "",
      quality: "original",
      width: null,
      height: null,
      bitrate: 0,
      logoType: "unwatermarked",
      cs: "0",
      qs: "13",
      videoUrl: decodedDownloadUrl,
      backupUrl: "",
      trueNoWatermark: true
    });
  }

  if (parsedModel && typeof parsedModel === "object" && keySeedText) {
    var modelCandidates = await buildResolvedMediaCandidates({ data: parsedModel }, "runtime_video_model", keySeedText);
    resolved = resolved.concat(modelCandidates);
  }

  var fplayUrls = [];
  if (payload.fallbackApi) {
    fplayUrls.push(payload.fallbackApi);
  }
  if (Array.isArray(payload.fplayUrls)) {
    for (var i = 0; i < payload.fplayUrls.length; i++) {
      if (payload.fplayUrls[i]) {
        fplayUrls.push(payload.fplayUrls[i]);
      }
    }
  }
  fplayUrls = fplayUrls.filter(function(url, index) {
    return /^https?:\/\//i.test(url || "") && fplayUrls.indexOf(url) === index;
  });

  for (var j = 0; j < fplayUrls.length; j++) {
    var baseFplayUrl = fplayUrls[j];
    var localKeySeed = keySeedText || extractKeySeedText(baseFplayUrl) || "";
    for (var k = 0; k < TRUE_NO_WATERMARK_VARIANTS.length; k++) {
      var variant = TRUE_NO_WATERMARK_VARIANTS[k];
      var variantUrl = mutateFplayUrl(baseFplayUrl, variant);
      var fplayData = await getFplayInfo(variantUrl);
      var variantCandidates = await buildResolvedMediaCandidates(fplayData, "runtime_" + variant.name, localKeySeed);
      resolved = resolved.concat(variantCandidates);
    }
  }

  var best = selectBestTrueNoWatermarkCandidate(resolved);
  if (!best) {
    throw new Error("未解析到页面运行时真无水印视频链接");
  }

  return {
    vid: payload.vid || "",
    videoUrl: best.videoUrl,
    backupUrl: best.backupUrl,
    width: best.width || null,
    height: best.height || null,
    definition: best.definition || "",
    quality: best.quality || "",
    source: "runtime_payload_fplay_qaab"
  };
}

async function resolveTrueNoWatermarkVideo(candidate) {
  var model = candidate.model || {};
  var fallbackUrl = model.fallback_api || candidate.video.fallback_api || "";
  var keySeedText = findKeySeedDeep(model) || extractKeySeedText(fallbackUrl) || findKeySeedDeep(candidate.video) || "";
  if (!fallbackUrl) {
    throw new Error("未找到 fallback_api");
  }
  if (!keySeedText) {
    throw new Error("未找到 key_seed");
  }

  var resolved = [];
  for (var i = 0; i < TRUE_NO_WATERMARK_VARIANTS.length; i++) {
    var variant = TRUE_NO_WATERMARK_VARIANTS[i];
    var variantUrl = mutateFplayUrl(fallbackUrl, variant);
    var fplayData = await getFplayInfo(variantUrl);
    var variantCandidates = await buildResolvedMediaCandidates(fplayData, variant.name, keySeedText);
    resolved = resolved.concat(variantCandidates);
  }

  var trueNoWatermark = resolved.filter(function(item) {
    return item.trueNoWatermark;
  }).sort(function(a, b) {
    return resolvedCandidateScore(b) - resolvedCandidateScore(a);
  });

  if (!trueNoWatermark.length) {
    throw new Error("未解析到真无水印视频链接");
  }

  var best = trueNoWatermark[0];
  return {
    vid: candidate.video.vid || candidate.video.video_id || "",
    videoUrl: best.videoUrl,
    backupUrl: best.backupUrl,
    width: best.width,
    height: best.height,
    definition: best.definition,
    quality: best.quality,
    source: "share_get_fplay_qaab"
  };
}

function buildDoubaoVideoFilename(videoInfo) {
  var dimension = videoInfo && videoInfo.width && videoInfo.height ? "_" + videoInfo.width + "x" + videoInfo.height : "";
  return "doubao_video" + dimension + "_" + Date.now() + ".mp4";
}

async function resolveAndDownloadDoubaoVideoByMessageId(messageId) {
  var shareResult = await callDoubaoShareSave(messageId);
  if (!shareResult || !shareResult.success) {
    return { success: false, error: (shareResult && shareResult.error) || "获取视频分享ID失败", messageId: messageId };
  }

  var shareIds = getShareIdCandidates(shareResult);
  if (!shareIds.length) {
    return { success: false, error: "未从分享结果中拿到 share_id", messageId: messageId };
  }

  var shareData = null;
  var resolvedShareId = "";
  var lastShareError = null;
  for (var i = 0; i < shareIds.length; i++) {
    try {
      shareData = await getDoubaoShareSnapshot(shareIds[i]);
      resolvedShareId = shareIds[i];
      break;
    } catch (error) {
      lastShareError = error;
    }
  }

  if (!shareData) {
    return {
      success: false,
      error: (lastShareError && lastShareError.message) || "分享页解析失败",
      messageId: messageId,
      shareId: shareResult.share_id
    };
  }

  var shareCandidates = collectShareVideoCandidates(shareData);
  var selectedCandidate = selectBestShareVideoCandidate(shareCandidates, messageId);
  if (!selectedCandidate) {
    return {
      success: false,
      error: "分享页中未找到视频素材",
      messageId: messageId,
      shareId: resolvedShareId || shareResult.share_id
    };
  }

  try {
    var resolvedVideo = await resolveTrueNoWatermarkVideo(selectedCandidate);
    var fileName = buildDoubaoVideoFilename(resolvedVideo);
    var downloadResult = await downloadVideo(resolvedVideo.videoUrl, fileName, resolvedVideo.backupUrl);
    return {
      success: !!downloadResult.success,
      messageId: messageId,
      shareId: resolvedShareId || shareResult.share_id,
      vid: resolvedVideo.vid,
      videoUrl: resolvedVideo.videoUrl,
      backupUrl: resolvedVideo.backupUrl,
      width: resolvedVideo.width,
      height: resolvedVideo.height,
      definition: resolvedVideo.definition,
      quality: resolvedVideo.quality,
      source: resolvedVideo.source,
      filename: fileName,
      downloadResult: downloadResult,
      error: downloadResult.success ? "" : (downloadResult.error || "下载失败")
    };
  } catch (error) {
    console.error("[Background] 新版豆包无水印解析失败:", error);
    return {
      success: false,
      messageId: messageId,
      shareId: resolvedShareId || shareResult.share_id,
      error: error && error.message ? error.message : String(error)
    };
  }
}

async function resolveAndDownloadDoubaoVideoFromRuntimePayload(payload) {
  payload = payload || {};
  var runtimeFailure = "";
  try {
    var resolvedVideo = await resolveTrueNoWatermarkVideoFromRuntimePayload(payload);
    var fileName = buildDoubaoVideoFilename(resolvedVideo);
    var downloadResult = await downloadVideo(resolvedVideo.videoUrl, fileName, resolvedVideo.backupUrl);
    if (downloadResult.success) {
      return {
        success: true,
        messageId: payload.messageId || payload.requestMessageId || "",
        vid: resolvedVideo.vid,
        videoUrl: resolvedVideo.videoUrl,
        backupUrl: resolvedVideo.backupUrl,
        width: resolvedVideo.width,
        height: resolvedVideo.height,
        definition: resolvedVideo.definition,
        quality: resolvedVideo.quality,
        source: resolvedVideo.source,
        filename: fileName,
        downloadResult: downloadResult
      };
    }
    runtimeFailure = (downloadResult && downloadResult.error) || "运行时链路下载失败";
  } catch (error) {
    runtimeFailure = error && error.message ? error.message : String(error);
    console.warn("[Background] 运行时页面数据无水印解析失败，准备回退分享链:", runtimeFailure);
  }

  var fallbackResult = await resolveAndDownloadDoubaoVideoByMessageId(payload.messageId || payload.requestMessageId || "");
  if (!fallbackResult.success && runtimeFailure) {
    fallbackResult.error = fallbackResult.error
      ? fallbackResult.error + "；运行时链路：" + runtimeFailure
      : runtimeFailure;
  }
  return fallbackResult;
}

// 版本检查
async function checkVersionUpdate() {
  var now = Date.now();
  lastVersionCheck = now;
  versionStatus = { valid: true, message: "", warning: "", expireDate: "", updateUrl: "", newVersion: "" };
  return {
    valid: true,
    message: "",
    warning: "",
    expireDate: "",
    updateUrl: "",
    newVersion: "",
    version: CURRENT_VERSION,
    lastCheck: lastVersionCheck,
    cached: false
  };
}

// 消息监听
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  console.log("[Background] 收到消息:", message.type);

  if (message.type === "ENSURE_CURRENT_TAB_READY") {
    getActiveTab().then(function(tab) {
      if (!tab) {
        sendResponse({ success: false, error: "未找到当前标签页" });
        return;
      }
      ensureTabReady(tab).then(sendResponse).catch(function(error) {
        sendResponse({ success: false, error: error.message || String(error) });
      });
    });
    return true;
  }

  if (message.type === "REPAIR_CURRENT_TAB") {
    getActiveTab().then(function(tab) {
      if (!tab) {
        sendResponse({ success: false, error: "未找到当前标签页" });
        return;
      }
      ensureTabReady(tab, { reload: true }).then(sendResponse).catch(function(error) {
        sendResponse({ success: false, error: error.message || String(error) });
      });
    });
    return true;
  }
  
  if (message.type === "ACTIVATE_CARD") {
    chrome.storage.local.set({
      activated: true,
      remainingCount: null,
      expireTime: "永久有效",
      cardType: "本地版"
    }, function() {
      sendResponse({ success: true, message: "已激活，永久有效", remainingCount: null, expireTime: "永久有效", cardType: "本地版" });
    });
    return true;
  }
  
  if (message.type === "CHECK_ACTIVATION") {
    checkActivationStatus().then(function(result) {
      sendResponse(result);
    });
    return true;
  }
  
  if (message.type === "GET_ACTIVATION_INFO") {
    sendResponse({ activated: true, remainingCount: null, expireTime: "永久有效", cardType: "本地版" });
    return true;
  }
  
  if (message.type === "downloadImage") {
    console.log("[Background] 图片下载请求");
    
    downloadImage(message.url, message.filename).then(function(result) {
      sendResponse(result);
    }).catch(function(err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (message.type === "imageDataExtracted") {
    var newData = message.data || [];
    var existingUrls = new Set(imageList.map(function(i) { return i.no_watermark_url; }));
    var filtered = newData.filter(function(i) { return !existingUrls.has(i.no_watermark_url); });
    if (filtered.length > 0) {
      imageList = imageList.concat(filtered);
    }
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === "GET_IMAGE_LIST") {
    sendResponse({ success: true, data: imageList });
    return true;
  }
  
  if (message.type === "CHECK_VERSION") {
    checkVersionUpdate().then(function(result) {
      sendResponse({
        valid: result.valid,
        message: result.message,
        warning: result.warning,
        expireDate: result.expireDate,
        updateUrl: result.updateUrl || "",
        newVersion: result.newVersion || "",
        imageCount: imageList.length,
        videoCount: videoList.length,
        version: CURRENT_VERSION,
        lastCheck: lastVersionCheck
      });
    });
    return true;
  }
  
  if (message.type === "CLEAR_IMAGES") {
    imageList = [];
    videoList = [];
    sendResponse({ success: true });
    return true;
  }
  
  if (message.type === "videoDataExtracted") {
    var newData = message.data || [];
    var existingVids = new Set(videoList.map(function(v) { return v.vid; }));
    var filtered = newData.filter(function(v) { return !existingVids.has(v.vid); });
    if (filtered.length > 0) {
      videoList = videoList.concat(filtered);
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "DOWNLOAD_DOUBAO_VIDEO_BY_MESSAGE_ID") {
    resolveAndDownloadDoubaoVideoByMessageId(message.messageId).then(function(result) {
      sendResponse(result);
    }).catch(function(error) {
      sendResponse({
        success: false,
        messageId: message.messageId,
        error: error && error.message ? error.message : String(error)
      });
    });
    return true;
  }

  if (message.type === "DOWNLOAD_DOUBAO_VIDEO_WITH_RUNTIME_PAYLOAD") {
    resolveAndDownloadDoubaoVideoFromRuntimePayload(message.payload).then(function(result) {
      sendResponse(result);
    }).catch(function(error) {
      sendResponse({
        success: false,
        messageId: (message.payload && (message.payload.messageId || message.payload.requestMessageId)) || "",
        error: error && error.message ? error.message : String(error)
      });
    });
    return true;
  }
  
  if (message.type === "startVideoDownload") {
    console.log("[Background] 视频下载请求");
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs || tabs.length === 0) {
        sendResponse({ success: false, error: "未找到活动标签页" });
        return;
      }
      var tab = tabs[0];
      if (tab.url && tab.url.includes("doubao.com")) {
        chrome.tabs.sendMessage(tab.id, { type: "startVideoDownload" }, function(res) {
          if (chrome.runtime.lastError) {
            console.error("[Background] 发送消息失败:", chrome.runtime.lastError);
            sendResponse({ success: false, error: "无法连接到页面，请刷新页面后重试" });
          } else {
            sendResponse({ success: true });
          }
        });
      } else {
        sendResponse({ success: false, error: "请在豆包页面使用此功能" });
      }
    });
    return true;
  }
  
  if (message.type === "doubaoShareSave") {
    callDoubaoShareSave(message.messageId).then(function(result) {
      sendResponse(result);
    }).catch(function(err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
  
  if (message.type === "videoDownloadResult") {
    console.log("[Background] 收到视频下载结果");
    var videoData = message.data;
    console.log("[Background] videoData:", JSON.stringify(videoData));
    if (videoData && videoData.success && videoData.videoUrl) {
      var fileName = "doubao_video" + (videoData.width && videoData.height ? "_" + videoData.width + "x" + videoData.height : "") + "_" + Date.now() + ".mp4";
      console.log("[Background] 下载视频文件:", fileName);
      downloadVideo(videoData.videoUrl, fileName, videoData.backupUrl).then(function(result) {
        videoData.downloadResult = result;
        chrome.runtime.sendMessage({ type: "videoDownloadResult", data: videoData }).catch(function() {});
      }).catch(function(err) {
        videoData.downloadResult = { success: false, error: err.message };
        chrome.runtime.sendMessage({ type: "videoDownloadResult", data: videoData }).catch(function() {});
      });
    } else {
      console.log("[Background] 视频数据无效:", videoData);
      chrome.runtime.sendMessage({ type: "videoDownloadResult", data: videoData }).catch(function() {});
    }
    sendResponse({ success: true });
    return true;
  }
});

// 扩展安装时
chrome.runtime.onInstalled.addListener(function(event) {
  checkVersionUpdate();
  ensureAllOpenTabsReady().catch(function(error) {
    console.warn("[Background] 初始化标签页失败:", error && error.message ? error.message : error);
  });
  if (event.reason === 'install') {
    chrome.storage.local.set({ activated: true, remainingCount: null, expireTime: "永久有效", cardType: "本地版" });
    console.log("[Background] 扩展已安装");
    console.log("[Background] 扩展ID (机器码):", chrome.runtime.id);
  }
});

chrome.runtime.onStartup.addListener(function() {
  ensureAllOpenTabsReady().catch(function(error) {
    console.warn("[Background] 启动预热失败:", error && error.message ? error.message : error);
  });
});

chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (chrome.runtime.lastError || !tab || !isSupportedUrl(tab.url)) {
      return;
    }
    ensureTabReady(tab).catch(function(error) {
      console.warn("[Background] 激活标签页挂载失败:", error && error.message ? error.message : error);
    });
  });
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status !== "complete" || !tab || !isSupportedUrl(tab.url)) {
    return;
  }
  ensureTabReady(tab).catch(function(error) {
    console.warn("[Background] 更新标签页挂载失败:", error && error.message ? error.message : error);
  });
});

// 初始检查
checkVersionUpdate();
