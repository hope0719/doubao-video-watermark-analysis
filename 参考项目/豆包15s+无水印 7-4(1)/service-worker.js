const DEBUGGER_VERSION = "1.3";
const SKILL_PACK_URL_PART = "doubao.com/samantha/skill/pack";
const DOLA_SKILL_PACK_URL_PART = "dola.com/samantha/skill/pack";
const SKILL_PACK_FILE = "doubao-skill-pack-response.json";
const DOLA_SKILL_PACK_FILE = "dola-skill-pack-response.json";
const MAX_PATCHABLE_RESPONSE_BYTES = 1024 * 1024;
const TARGET_DURATIONS = ["5", "10", "15"];

const requestPatterns = [
  { urlPattern: `*${SKILL_PACK_URL_PART}*`, requestStage: "Request" },
  { urlPattern: `*${DOLA_SKILL_PACK_URL_PART}*`, requestStage: "Request" }
];

const responsePatterns = [
  { urlPattern: "*://*.doubao.com/*", resourceType: "XHR", requestStage: "Response" },
  { urlPattern: "*://*.doubao.com/*", resourceType: "Fetch", requestStage: "Response" },
  { urlPattern: "*://*.dola.com/*", resourceType: "XHR", requestStage: "Response" },
  { urlPattern: "*://*.dola.com/*", resourceType: "Fetch", requestStage: "Response" }
];

const fetchPatterns = requestPatterns.concat(responsePatterns);

const attachedTabs = new Set();
const responseFileBodyPromises = new Map();

chrome.runtime.onInstalled.addListener(() => {
  attachExistingTabs();
});

chrome.runtime.onStartup.addListener(() => {
  attachExistingTabs();
});

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

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId);
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
  if (method !== "Fetch.requestPaused" || !source.tabId || !params) {
    return;
  }

  handlePausedRequest(source.tabId, params);
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
    && (url.includes("doubao.com") || url.includes("dola.com"));
}

async function ensureAttached(tabId) {
  if (attachedTabs.has(tabId)) {
    return;
  }

  try {
    await attachDebugger(tabId);
  } catch (error) {
    console.warn("debugger attach failed:", error.message || error);
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
    if (url.includes(SKILL_PACK_URL_PART)) {
      await fulfillJsonFile(tabId, requestId, request.method, SKILL_PACK_FILE);
      return;
    }

    if (url.includes(DOLA_SKILL_PACK_URL_PART)) {
      await fulfillJsonFile(tabId, requestId, request.method, DOLA_SKILL_PACK_FILE);
      return;
    }

    if (shouldPatchResponse(url, event)) {
      const patched = await tryPatchVideoConfigResponse(tabId, requestId, event, url);
      if (patched) {
        return;
      }
    }

    await continueRequest(tabId, requestId);
  } catch (error) {
    console.warn("request handling failed:", error.message || error);
    await continueRequest(tabId, requestId).catch(() => {});
  }
}

async function fulfillJsonFile(tabId, requestId, method, fileName) {
  if ((method || "").toUpperCase() === "OPTIONS") {
    await sendCommand(tabId, "Fetch.fulfillRequest", {
      requestId,
      responseCode: 204,
      responsePhrase: "No Content",
      responseHeaders: corsHeaders()
    });
    return;
  }

  const body = await getResponseFileBody(fileName);
  await sendCommand(tabId, "Fetch.fulfillRequest", {
    requestId,
    responseCode: 200,
    responsePhrase: "OK",
    responseHeaders: [
      { name: "content-type", value: "application/json; charset=utf-8" },
      { name: "cache-control", value: "no-store" },
      ...corsHeaders()
    ],
    body: toBase64Utf8(body)
  });
}

function continueRequest(tabId, requestId) {
  return sendCommand(tabId, "Fetch.continueRequest", { requestId });
}

function getResponseFileBody(fileName) {
  if (!responseFileBodyPromises.has(fileName)) {
    responseFileBodyPromises.set(fileName, fetch(chrome.runtime.getURL(fileName))
      .then((response) => response.text()));
  }
  return responseFileBodyPromises.get(fileName);
}

function corsHeaders() {
  return [
    { name: "access-control-allow-origin", value: "*" },
    { name: "access-control-allow-credentials", value: "true" },
    { name: "access-control-allow-methods", value: "GET, POST, OPTIONS" },
    { name: "access-control-allow-headers", value: "*" }
  ];
}

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
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isResponseStage(event) {
  return typeof event.responseStatusCode === "number";
}

function getHeaderValue(headers, targetName) {
  const lowerTarget = String(targetName || "").toLowerCase();
  for (const header of headers || []) {
    if (String(header.name || "").toLowerCase() === lowerTarget) {
      return String(header.value || "");
    }
  }
  return "";
}

function getContentLength(headers) {
  const rawValue = getHeaderValue(headers, "content-length");
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isJsonLikeResponse(event) {
  const contentType = getHeaderValue(event.responseHeaders, "content-type").toLowerCase();
  return contentType.includes("json") || contentType.includes("text/plain");
}

function shouldPatchResponse(url, event) {
  if (!isResponseStage(event)) {
    return false;
  }

  if ((event.responseStatusCode || 0) < 200 || (event.responseStatusCode || 0) >= 300) {
    return false;
  }

  if (!isJsonLikeResponse(event)) {
    return false;
  }

  const contentLength = getContentLength(event.responseHeaders);
  if (contentLength > MAX_PATCHABLE_RESPONSE_BYTES) {
    return false;
  }

  const lowerUrl = String(url || "").toLowerCase();
  if (lowerUrl.includes("chat/completion")) {
    return false;
  }

  return true;
}

async function tryPatchVideoConfigResponse(tabId, requestId, event, url) {
  let bodyResult;

  try {
    bodyResult = await sendCommand(tabId, "Fetch.getResponseBody", { requestId });
  } catch (error) {
    return false;
  }

  const originalText = bodyResult.base64Encoded ? fromBase64Utf8(bodyResult.body) : bodyResult.body;
  if (!looksLikeVideoConfigResponse(originalText, url)) {
    return false;
  }

  let payload;
  try {
    payload = JSON.parse(originalText);
  } catch (error) {
    return false;
  }

  const changed = patchVideoConfigPayload(payload);
  if (!changed) {
    return false;
  }

  await sendCommand(tabId, "Fetch.fulfillRequest", {
    requestId,
    responseCode: event.responseStatusCode || 200,
    responsePhrase: event.responseStatusText || "OK",
    responseHeaders: buildPatchedResponseHeaders(event.responseHeaders),
    body: toBase64Utf8(JSON.stringify(payload))
  });

  return true;
}

function looksLikeVideoConfigResponse(text, url) {
  if (typeof text !== "string" || !text) {
    return false;
  }

  if (text.length > MAX_PATCHABLE_RESPONSE_BYTES) {
    return false;
  }

  if (/("option_list"|"model_capability"|"supported_durations"|"video_generation")/.test(text)) {
    return true;
  }

  const lowerUrl = String(url || "").toLowerCase();
  return lowerUrl.includes("actionbar")
    || lowerUrl.includes("action_bar")
    || lowerUrl.includes("item_conf")
    || lowerUrl.includes("video_generation")
    || lowerUrl.includes("pc_skill_video_generation");
}

function buildPatchedResponseHeaders(headers) {
  const filteredHeaders = [];
  const blockedHeaders = new Set(["content-length", "content-encoding", "transfer-encoding"]);

  for (const header of headers || []) {
    const headerName = String(header.name || "");
    if (!headerName) {
      continue;
    }

    if (blockedHeaders.has(headerName.toLowerCase())) {
      continue;
    }

    filteredHeaders.push({
      name: headerName,
      value: String(header.value || "")
    });
  }

  if (!filteredHeaders.some((header) => header.name.toLowerCase() === "content-type")) {
    filteredHeaders.push({ name: "content-type", value: "application/json; charset=utf-8" });
  }

  return filteredHeaders;
}

function patchVideoConfigPayload(payload) {
  return patchVideoConfigNode(payload, new WeakSet());
}

function patchVideoConfigNode(node, visited) {
  if (!node || typeof node !== "object") {
    return false;
  }

  if (visited.has(node)) {
    return false;
  }
  visited.add(node);

  let changed = false;

  if (isLikelyVideoConfigMeta(node)) {
    changed = patchVideoConfigMeta(node) || changed;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      changed = patchVideoConfigNode(item, visited) || changed;
    }
    return changed;
  }

  for (const value of Object.values(node)) {
    changed = patchVideoConfigNode(value, visited) || changed;
  }

  return changed;
}

function isLikelyVideoConfigMeta(node) {
  if (!Array.isArray(node.option_list)) {
    return false;
  }

  const optionValues = new Set(
    node.option_list
      .map((option) => option && option.value)
      .filter(Boolean)
      .map((value) => String(value))
  );

  const hasDurationOption = optionValues.has("duration");
  const hasModelOption = optionValues.has("model");
  const hasMovementOption = optionValues.has("movement");

  if (!(hasDurationOption && hasModelOption)) {
    return false;
  }

  const capabilityValues = Object.values(node.model_capability || {});
  return hasMovementOption || capabilityValues.some((capability) => {
    return capability
      && typeof capability === "object"
      && (Array.isArray(capability.supported_durations) || "support_video_ref" in capability);
  });
}

function patchVideoConfigMeta(meta) {
  let changed = false;
  changed = ensureDurationOptions(meta.option_list) || changed;
  changed = ensureModelCapabilities(meta) || changed;
  return changed;
}

function ensureDurationOptions(optionList) {
  const durationOption = optionList.find((option) => option && String(option.value) === "duration");
  if (!durationOption) {
    return false;
  }

  const currentOptions = Array.isArray(durationOption.options) ? durationOption.options : [];
  const optionByValue = new Map();

  for (const option of currentOptions) {
    if (!option || option.value === undefined || option.value === null) {
      continue;
    }
    optionByValue.set(String(option.value), option);
  }

  const template = currentOptions.find(Boolean) || { show_name: "", sub_display: "", is_default: false };
  let changed = false;

  for (const duration of TARGET_DURATIONS) {
    if (!optionByValue.has(duration)) {
      optionByValue.set(duration, createDurationOption(template, duration));
      changed = true;
    }
  }

  const nextOptions = TARGET_DURATIONS
    .map((duration) => optionByValue.get(duration))
    .filter(Boolean)
    .concat(currentOptions.filter((option) => {
      if (!option || option.value === undefined || option.value === null) {
        return true;
      }
      return !TARGET_DURATIONS.includes(String(option.value));
    }));

  if (changed || nextOptions.length !== currentOptions.length) {
    durationOption.options = nextOptions;
    return true;
  }

  return false;
}

function createDurationOption(template, duration) {
  return {
    ...template,
    show_name: `${duration}s`,
    value: duration,
    is_default: duration === "10" ? !!template.is_default : false,
    sub_display: template.sub_display || ""
  };
}

function ensureModelCapabilities(meta) {
  const modelOption = Array.isArray(meta.option_list)
    ? meta.option_list.find((option) => option && String(option.value) === "model")
    : null;
  const modelValues = [];

  if (modelOption && Array.isArray(modelOption.options)) {
    for (const option of modelOption.options) {
      const value = option && option.value !== undefined && option.value !== null
        ? String(option.value)
        : "";
      if (value && !modelValues.includes(value)) {
        modelValues.push(value);
      }
    }
  }

  const capabilityMap = meta.model_capability && typeof meta.model_capability === "object"
    ? meta.model_capability
    : {};
  let changed = capabilityMap !== meta.model_capability;

  if (capabilityMap !== meta.model_capability) {
    meta.model_capability = capabilityMap;
  }

  const capabilityTemplate = Object.values(capabilityMap).find((capability) => capability && typeof capability === "object") || {
    supported_durations: TARGET_DURATIONS.slice(),
    supported_resolutions: ["720p"],
    support_video_ref: false
  };

  const targetModelValues = modelValues.length ? modelValues : Object.keys(capabilityMap);
  for (const modelValue of targetModelValues) {
    const currentCapability = capabilityMap[modelValue];
    if (!currentCapability || typeof currentCapability !== "object") {
      capabilityMap[modelValue] = createModelCapability(capabilityTemplate);
      changed = true;
      continue;
    }

    const nextDurations = mergeDurations(currentCapability.supported_durations);
    if (!sameStringArray(nextDurations, currentCapability.supported_durations)) {
      currentCapability.supported_durations = nextDurations;
      changed = true;
    }

    if (!Array.isArray(currentCapability.supported_resolutions) || !currentCapability.supported_resolutions.length) {
      currentCapability.supported_resolutions = Array.isArray(capabilityTemplate.supported_resolutions) && capabilityTemplate.supported_resolutions.length
        ? capabilityTemplate.supported_resolutions.slice()
        : ["720p"];
      changed = true;
    }

    if (typeof currentCapability.support_video_ref !== "boolean") {
      currentCapability.support_video_ref = !!capabilityTemplate.support_video_ref;
      changed = true;
    }
  }

  return changed;
}

function createModelCapability(template) {
  return {
    ...template,
    supported_durations: TARGET_DURATIONS.slice(),
    supported_resolutions: Array.isArray(template.supported_resolutions) && template.supported_resolutions.length
      ? template.supported_resolutions.slice()
      : ["720p"],
    support_video_ref: !!template.support_video_ref
  };
}

function mergeDurations(values) {
  const merged = new Set(TARGET_DURATIONS);
  for (const value of Array.isArray(values) ? values : []) {
    if (value !== undefined && value !== null && String(value)) {
      merged.add(String(value));
    }
  }
  return Array.from(merged).sort((left, right) => Number(left) - Number(right));
}

function sameStringArray(left, right) {
  const leftValues = Array.isArray(left) ? left.map((value) => String(value)) : [];
  const rightValues = Array.isArray(right) ? right.map((value) => String(value)) : [];

  if (leftValues.length !== rightValues.length) {
    return false;
  }

  for (let index = 0; index < leftValues.length; index += 1) {
    if (leftValues[index] !== rightValues[index]) {
      return false;
    }
  }

  return true;
}

function setBadge(tabId, text) {
  chrome.action.setBadgeText({ tabId, text }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#2F7D57" }).catch(() => {});
}
