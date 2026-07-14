if (window.__DOUBAO_TOOLBOX_CONTENT_LOADED__) {
  console.log("[content.js] 跳过重复注入");
} else {
window.__DOUBAO_TOOLBOX_CONTENT_LOADED__ = true;

const originalXHROpen = XMLHttpRequest.prototype.open;
const originalXHRSend = XMLHttpRequest.prototype.send;
const originalFetch = window.fetch;
const nativeJsonParse = JSON.parse;
const processedUrls = new Set();
const MAX_DEDUP_SIZE = 100;
const MAX_PATCHABLE_VIDEO_CONFIG_TEXT_BYTES = 1024 * 1024;
const ONE_YEAR_MS = 315576e5;
const videoCache = new Map();
const messageCache = new Map();
const MAX_MESSAGE_CACHE_SIZE = 300;
const VIDEO_TARGET_DURATIONS = ["5", "10", "15"];
const VIDEO_DURATION_LABEL_REGEX = /^\s*(5|10|15)(s|秒)\s*$/;
const VIDEO_DURATION_VALUES = VIDEO_TARGET_DURATIONS.map((duration) => Number(duration));
const VIDEO_DURATION_STORAGE_KEY = "codex_doubao_video_duration_choice";
const VIDEO_DURATION_MARK = "data-codex-doubao-duration";
const VIDEO_DURATION_STYLE_ID = "codex-doubao-duration-style";
const webpackExportWrapperCache = new WeakMap();
const storeFactoryWrapperCache = new WeakMap();
let durationUiTickTimer = 0;
let lastDurationToolbarTrigger = null;
let lastDurationMenuRoot = null;
let suppressDurationObserverUntil = 0;

function patchVideoConfigPayload(payload) {
  try {
    return patchVideoConfigNode(payload, new WeakSet());
  } catch (error) {
    console.warn("[content.js][video-config] 补丁执行失败:", error);
    return false;
  }
}

function copyFunctionMetadata(target, source) {
  if (!target || !source) return target;
  try {
    Object.defineProperty(target, "name", {
      configurable: true,
      value: source.name
    });
  } catch {}
  try {
    Object.defineProperty(target, "length", {
      configurable: true,
      value: source.length
    });
  } catch {}
  try {
    Object.setPrototypeOf(target, Object.getPrototypeOf(source));
  } catch {}
  try {
    for (const key of Reflect.ownKeys(source)) {
      if (key === "length" || key === "name" || key === "prototype") continue;
      const descriptor = Object.getOwnPropertyDescriptor(source, key);
      if (descriptor) {
        Object.defineProperty(target, key, descriptor);
      }
    }
  } catch {}
  return target;
}

function cloneForStorePatch(value) {
  if (!value || typeof value !== "object") return null;
  try {
    return structuredClone(value);
  } catch {}
  try {
    return nativeJsonParse(JSON.stringify(value));
  } catch {}
  return null;
}

function buildPatchedStorePartial(state) {
  const partial = {};
  let changed = false;

  for (const [key, value] of Object.entries(state || {})) {
    if (!value || typeof value !== "object") continue;
    if (!/(input|option|config|capability|editor|action|video|skill)/i.test(key)) continue;

    const clone = cloneForStorePatch(value);
    if (!clone) continue;
    if (!patchVideoConfigPayload(clone)) continue;

    partial[key] = clone;
    changed = true;
  }

  return changed ? partial : null;
}

function patchVideoStoreState(storeHookOrState) {
  const storeHook = storeHookOrState && typeof storeHookOrState.getState === "function"
    ? storeHookOrState
    : null;
  const state = storeHook ? storeHook.getState() : storeHookOrState;
  if (!state || typeof state !== "object") return false;

  let changed = false;
  if (storeHook && typeof storeHook.setState === "function") {
    const partial = buildPatchedStorePartial(state);
    if (partial && Object.keys(partial).length) {
      storeHook.setState(partial);
      changed = true;
    }
  }

  changed = patchVideoConfigPayload(state) || changed;
  return changed;
}

function wrapVideoStoreAction(storeHook, state, actionName) {
  const originalAction = state && state[actionName];
  if (typeof originalAction !== "function" || originalAction.__DOUBAO_VIDEO_STORE_ACTION_WRAPPED__) {
    return false;
  }

  const wrappedAction = function(...args) {
    const finalizePatch = () => {
      try {
        patchVideoStoreState(storeHook);
      } catch (error) {
        console.warn("[content.js][video-config] store action patch failed:", actionName, error);
      }
    };

    const result = originalAction.apply(this, args);
    if (result && typeof result.then === "function") {
      return result.finally(finalizePatch);
    }
    finalizePatch();
    return result;
  };

  wrappedAction.__DOUBAO_VIDEO_STORE_ACTION_WRAPPED__ = true;
  state[actionName] = copyFunctionMetadata(wrappedAction, originalAction);
  return true;
}

function ensureVideoStoreHookPatched(storeHook) {
  if (!storeHook || typeof storeHook.getState !== "function") {
    return storeHook;
  }

  if (storeHook.__DOUBAO_VIDEO_STORE_HOOK_PATCHED__) {
    return storeHook;
  }

  const state = storeHook.getState();
  if (state && typeof state === "object") {
    patchVideoStoreState(storeHook);
    for (const actionName of Object.keys(state)) {
      if (typeof state[actionName] !== "function") continue;
      if (/^(init|update|set|reset|select|change|sync|apply)/i.test(actionName) || actionName === "initVideoList") {
        wrapVideoStoreAction(storeHook, state, actionName);
      }
    }
  }

  storeHook.__DOUBAO_VIDEO_STORE_HOOK_PATCHED__ = true;
  console.log("[content.js][video-config] video store hook patched");
  return storeHook;
}

function wrapVideoStoreFactory(factory) {
  if (typeof factory !== "function") return factory;
  if (storeFactoryWrapperCache.has(factory)) {
    return storeFactoryWrapperCache.get(factory);
  }

  const wrappedFactory = function(...args) {
    const result = factory.apply(this, args);
    return ensureVideoStoreHookPatched(result);
  };

  copyFunctionMetadata(wrappedFactory, factory);
  storeFactoryWrapperCache.set(factory, wrappedFactory);
  return wrappedFactory;
}

function maybeWrapWebpackExportValue(exportName, value) {
  if (!value || (typeof value !== "function" && typeof value !== "object")) {
    return value;
  }

  if (typeof value === "function" && exportName === "NS") {
    return wrapVideoStoreFactory(value);
  }

  if (typeof value === "function" && typeof value.getState === "function") {
    return ensureVideoStoreHookPatched(value);
  }

  return value;
}

function wrapWebpackExportGetter(exportName, getter) {
  if (typeof getter !== "function") return getter;
  if (webpackExportWrapperCache.has(getter)) {
    return webpackExportWrapperCache.get(getter);
  }

  const wrappedGetter = function() {
    return maybeWrapWebpackExportValue(exportName, getter());
  };

  webpackExportWrapperCache.set(getter, wrappedGetter);
  return wrappedGetter;
}

function wrapWebpackModuleFactory(factory, moduleId) {
  if (typeof factory !== "function" || factory.__DOUBAO_WEBPACK_FACTORY_WRAPPED__) {
    return factory;
  }

  const wrappedFactory = function(module, exports, webpackRequire) {
    const originalDefine = webpackRequire && webpackRequire.d;
    if (typeof originalDefine === "function") {
      webpackRequire.d = function(targetExports, definition) {
        const wrappedDefinition = {};
        for (const [exportName, getter] of Object.entries(definition || {})) {
          wrappedDefinition[exportName] = wrapWebpackExportGetter(exportName, getter);
        }
        return originalDefine.call(this, targetExports, wrappedDefinition);
      };
    }

    try {
      return factory.apply(this, arguments);
    } finally {
      if (webpackRequire && typeof originalDefine === "function") {
        webpackRequire.d = originalDefine;
      }

      try {
        if (module && module.exports && typeof module.exports === "object") {
          if (typeof module.exports.NS === "function") {
            module.exports.NS = wrapVideoStoreFactory(module.exports.NS);
            console.log("[content.js][video-config] webpack module export patched:", moduleId);
          }
        }
      } catch (error) {
        console.warn("[content.js][video-config] webpack module patch failed:", moduleId, error);
      }
    }
  };

  wrappedFactory.__DOUBAO_WEBPACK_FACTORY_WRAPPED__ = true;
  return copyFunctionMetadata(wrappedFactory, factory);
}

function wrapLoadableChunkEntry(entry) {
  if (!Array.isArray(entry) || !entry[1] || typeof entry[1] !== "object") {
    return entry;
  }

  const modules = entry[1];
  for (const [moduleId, factory] of Object.entries(modules)) {
    modules[moduleId] = wrapWebpackModuleFactory(factory, moduleId);
  }
  return entry;
}

function installWebpackVideoStoreHooks() {
  const chunkArray = self.__LOADABLE_LOADED_CHUNKS__ = self.__LOADABLE_LOADED_CHUNKS__ || [];
  if (chunkArray.__DOUBAO_VIDEO_STORE_HOOKS_INSTALLED__) return;

  for (let index = 0; index < chunkArray.length; index += 1) {
    wrapLoadableChunkEntry(chunkArray[index]);
  }

  const originalPush = chunkArray.push.bind(chunkArray);
  chunkArray.push = function(...entries) {
    return originalPush(...entries.map(wrapLoadableChunkEntry));
  };
  chunkArray.__DOUBAO_VIDEO_STORE_HOOKS_INSTALLED__ = true;
  console.log("[content.js][video-config] webpack store hooks installed");
}

installWebpackVideoStoreHooks();

function getOptionCollection(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node.options)) return node.options;
  if (Array.isArray(node.optionList)) return node.optionList;
  if (Array.isArray(node.option_list)) return node.option_list;
  return null;
}

function setOptionCollection(node, nextOptions) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node.optionList)) {
    node.optionList = nextOptions;
    return;
  }
  if (Array.isArray(node.option_list)) {
    node.option_list = nextOptions;
    return;
  }
  node.options = nextOptions;
}

function getMetaOptionList(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node.option_list)) return node.option_list;
  if (Array.isArray(node.optionList)) return node.optionList;
  return null;
}

function getMetaCapabilityMap(node) {
  if (!node || typeof node !== "object") return null;
  if (node.model_capability && typeof node.model_capability === "object") return node.model_capability;
  if (node.modelCapability && typeof node.modelCapability === "object") return node.modelCapability;
  return null;
}

function setMetaCapabilityMap(node, capabilityMap) {
  if (!node || typeof node !== "object") return;
  if (node.modelCapability && typeof node.modelCapability === "object" && !node.model_capability) {
    node.modelCapability = capabilityMap;
    return;
  }
  node.model_capability = capabilityMap;
}

function getCapabilityDurations(capability) {
  if (!capability || typeof capability !== "object") return null;
  if (Array.isArray(capability.supported_durations)) return capability.supported_durations;
  if (Array.isArray(capability.supportedDurations)) return capability.supportedDurations;
  return null;
}

function setCapabilityDurations(capability, nextDurations) {
  if (!capability || typeof capability !== "object") return;
  if (Array.isArray(capability.supportedDurations) && !Array.isArray(capability.supported_durations)) {
    capability.supportedDurations = nextDurations;
    return;
  }
  capability.supported_durations = nextDurations;
}

function getCapabilityResolutions(capability) {
  if (!capability || typeof capability !== "object") return null;
  if (Array.isArray(capability.supported_resolutions)) return capability.supported_resolutions;
  if (Array.isArray(capability.supportedResolutions)) return capability.supportedResolutions;
  return null;
}

function setCapabilityResolutions(capability, nextResolutions) {
  if (!capability || typeof capability !== "object") return;
  if (Array.isArray(capability.supportedResolutions) && !Array.isArray(capability.supported_resolutions)) {
    capability.supportedResolutions = nextResolutions;
    return;
  }
  capability.supported_resolutions = nextResolutions;
}

function hasCapabilityVideoRefFlag(capability) {
  return !!(capability && typeof capability === "object" && ("support_video_ref" in capability || "supportVideoRef" in capability));
}

function getCapabilityVideoRef(capability) {
  if (!capability || typeof capability !== "object") return undefined;
  if ("support_video_ref" in capability) return capability.support_video_ref;
  if ("supportVideoRef" in capability) return capability.supportVideoRef;
  return undefined;
}

function setCapabilityVideoRef(capability, value) {
  if (!capability || typeof capability !== "object") return;
  if ("supportVideoRef" in capability && !("support_video_ref" in capability)) {
    capability.supportVideoRef = value;
    return;
  }
  capability.support_video_ref = value;
}

function patchVideoConfigNode(node, visited) {
  if (!node || typeof node !== "object") return false;
  if (visited.has(node)) return false;
  visited.add(node);

  let changed = false;

  if (isDurationOptionNode(node)) {
    changed = ensureDurationOptionNode(node) || changed;
  }

  if (isModelCapabilityNode(node)) {
    changed = ensureCapabilityDurationNode(node) || changed;
  }

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

function isDurationOptionNode(node) {
  const options = getOptionCollection(node);
  if (!node || typeof node !== "object" || !Array.isArray(options)) return false;
  const key = String(node.key ?? node.value ?? node.name ?? "").trim();
  if (key === "duration") return true;
  return hasDurationLikeOptions(options);
}

function hasDurationLikeOptions(options) {
  const normalizedValues = [];
  for (const option of options || []) {
    const normalized = getDurationOptionValue(option);
    if (!normalized) return false;
    normalizedValues.push(normalized);
  }
  return normalizedValues.length > 0 && normalizedValues.length <= VIDEO_TARGET_DURATIONS.length;
}

function getDurationOptionValue(option) {
  if (option === undefined || option === null) return "";
  if (typeof option === "object") {
    const directValue = normalizeDurationValue(option.value);
    if (directValue) return directValue;
    const showNameValue = normalizeDurationValue(option.show_name);
    if (showNameValue) return showNameValue;
    const labelValue = normalizeDurationValue(option.label);
    if (labelValue) return labelValue;
    return "";
  }
  return normalizeDurationValue(option);
}

function normalizeDurationValue(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "";
  const normalized = text.endsWith("s") ? text.slice(0, -1) : text;
  return VIDEO_TARGET_DURATIONS.includes(normalized) ? normalized : "";
}

function buildDurationOption(template, duration) {
  if (!template || typeof template !== "object") {
    return { show_name: `${duration}s`, value: duration, is_default: duration === "10", sub_display: "" };
  }
  return {
    ...template,
    show_name: `${duration}s`,
    value: duration,
    is_default: duration === "10" ? !!template.is_default : false,
    sub_display: template.sub_display || ""
  };
}

function ensureDurationOptionNode(durationNode) {
  const currentOptions = getOptionCollection(durationNode) || [];
  if (!currentOptions.length && String(durationNode.key ?? durationNode.value ?? "") !== "duration") {
    return false;
  }

  const optionByValue = new Map();
  const extraOptions = [];
  const template = currentOptions.find((option) => option && typeof option === "object") || null;

  for (const option of currentOptions) {
    const normalized = getDurationOptionValue(option);
    if (normalized) {
      if (!optionByValue.has(normalized)) {
        optionByValue.set(normalized, option);
      }
      continue;
    }
    extraOptions.push(option);
  }

  let changed = false;
  for (const duration of VIDEO_TARGET_DURATIONS) {
    if (!optionByValue.has(duration)) {
      optionByValue.set(duration, buildDurationOption(template, duration));
      changed = true;
    }
  }

  const nextOptions = VIDEO_TARGET_DURATIONS
    .map((duration) => {
      const option = optionByValue.get(duration);
      if (!option || typeof option !== "object") {
        return buildDurationOption(template, duration);
      }
      return {
        ...option,
        show_name: option.show_name || `${duration}s`,
        value: duration
      };
    })
    .concat(extraOptions);

  if (changed || !sameDurationOptionList(nextOptions, currentOptions)) {
    setOptionCollection(durationNode, nextOptions);
    return true;
  }

  return false;
}

function sameDurationOptionList(left, right) {
  const leftValues = Array.isArray(left) ? left.map((option) => getDurationOptionValue(option)) : [];
  const rightValues = Array.isArray(right) ? right.map((option) => getDurationOptionValue(option)) : [];
  if (leftValues.length !== rightValues.length) return false;
  for (let index = 0; index < leftValues.length; index += 1) {
    if (leftValues[index] !== rightValues[index]) return false;
  }
  return true;
}

function isModelCapabilityNode(node) {
  return !!(
    node
    && typeof node === "object"
    && (Array.isArray(getCapabilityDurations(node)) || hasCapabilityVideoRefFlag(node))
  );
}

function buildVideoCapability(templateCapability) {
  const nextCapability = {
    ...templateCapability,
    supported_durations: VIDEO_TARGET_DURATIONS.slice(),
    supported_resolutions: Array.isArray(getCapabilityResolutions(templateCapability)) && getCapabilityResolutions(templateCapability).length
      ? getCapabilityResolutions(templateCapability).slice()
      : ["720p"],
    support_video_ref: !!getCapabilityVideoRef(templateCapability)
  };
  if ("supportedDurations" in (templateCapability || {}) && !("supported_durations" in (templateCapability || {}))) {
    delete nextCapability.supported_durations;
    nextCapability.supportedDurations = VIDEO_TARGET_DURATIONS.slice();
  }
  if ("supportedResolutions" in (templateCapability || {}) && !("supported_resolutions" in (templateCapability || {}))) {
    delete nextCapability.supported_resolutions;
    nextCapability.supportedResolutions = Array.isArray(getCapabilityResolutions(templateCapability)) && getCapabilityResolutions(templateCapability).length
      ? getCapabilityResolutions(templateCapability).slice()
      : ["720p"];
  }
  if ("supportVideoRef" in (templateCapability || {}) && !("support_video_ref" in (templateCapability || {}))) {
    delete nextCapability.support_video_ref;
    nextCapability.supportVideoRef = !!getCapabilityVideoRef(templateCapability);
  }
  return nextCapability;
}

function ensureCapabilityDurationNode(capability, templateCapability = capability) {
  if (!capability || typeof capability !== "object") return false;

  let changed = false;
  const currentDurations = getCapabilityDurations(capability);
  const nextDurations = mergeVideoDurations(currentDurations);
  if (!sameStringArray(nextDurations, currentDurations)) {
    setCapabilityDurations(capability, nextDurations);
    changed = true;
  }

  const currentResolutions = getCapabilityResolutions(capability);
  const templateResolutions = getCapabilityResolutions(templateCapability);
  if (!Array.isArray(currentResolutions) || !currentResolutions.length) {
    setCapabilityResolutions(capability, Array.isArray(templateResolutions) && templateResolutions.length
      ? templateResolutions.slice()
      : ["720p"]);
    changed = true;
  }

  if (typeof getCapabilityVideoRef(capability) !== "boolean") {
    setCapabilityVideoRef(capability, !!getCapabilityVideoRef(templateCapability));
    changed = true;
  }

  return changed;
}

function isLikelyVideoConfigMeta(node) {
  const optionList = getMetaOptionList(node);
  if (!Array.isArray(optionList)) return false;

  const optionValues = new Set(
    optionList
      .map((option) => option && option.value)
      .filter(Boolean)
      .map((value) => String(value))
  );

  const hasDuration = optionValues.has("duration");
  const hasModel = optionValues.has("model");
  const hasMovement = optionValues.has("movement");
  if (!(hasDuration && hasModel)) return false;

  const capabilityValues = Object.values(getMetaCapabilityMap(node) || {});
  return hasMovement || capabilityValues.some((capability) => {
    return capability
      && typeof capability === "object"
      && (Array.isArray(getCapabilityDurations(capability)) || hasCapabilityVideoRefFlag(capability));
  });
}

function patchVideoConfigMeta(meta) {
  let changed = false;
  changed = ensureDurationOptions(getMetaOptionList(meta) || []) || changed;
  changed = ensureModelCapabilities(meta) || changed;
  if (changed) {
    console.log("[content.js][video-config] 已补齐 5s/10s/15s 配置");
  }
  return changed;
}

function ensureDurationOptions(optionList) {
  const durationOption = optionList.find((option) => option && String(option.value) === "duration");
  if (!durationOption) return false;
  return ensureDurationOptionNode(durationOption);
}

function ensureModelCapabilities(meta) {
  const optionList = getMetaOptionList(meta);
  const modelOption = Array.isArray(optionList)
    ? optionList.find((option) => option && String(option.value) === "model")
    : null;
  const modelValues = [];

  const modelOptions = getOptionCollection(modelOption);
  if (modelOption && Array.isArray(modelOptions)) {
    for (const option of modelOptions) {
      const value = option && option.value !== undefined && option.value !== null ? String(option.value) : "";
      if (value && !modelValues.includes(value)) {
        modelValues.push(value);
      }
    }
  }

  const capabilityMap = getMetaCapabilityMap(meta) && typeof getMetaCapabilityMap(meta) === "object"
    ? getMetaCapabilityMap(meta)
    : {};
  let changed = capabilityMap !== getMetaCapabilityMap(meta);
  if (capabilityMap !== getMetaCapabilityMap(meta)) {
    setMetaCapabilityMap(meta, capabilityMap);
  }

  const templateCapability = Object.values(capabilityMap).find((capability) => capability && typeof capability === "object") || {
    supported_durations: VIDEO_TARGET_DURATIONS.slice(),
    supported_resolutions: ["720p"],
    support_video_ref: false
  };

  const targetModels = modelValues.length ? modelValues : Object.keys(capabilityMap);
  for (const modelValue of targetModels) {
    const capability = capabilityMap[modelValue];
    if (!capability || typeof capability !== "object") {
      capabilityMap[modelValue] = buildVideoCapability(templateCapability);
      changed = true;
      continue;
    }

    changed = ensureCapabilityDurationNode(capability, templateCapability) || changed;
  }

  return changed;
}

function mergeVideoDurations(values) {
  const merged = new Set(VIDEO_TARGET_DURATIONS);
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
  if (leftValues.length !== rightValues.length) return false;
  for (let index = 0; index < leftValues.length; index += 1) {
    if (leftValues[index] !== rightValues[index]) return false;
  }
  return true;
}

function installVideoConfigPatchHooks() {
  if (window.__DOUBAO_VIDEO_CONFIG_PATCH_INSTALLED__) return;
  window.__DOUBAO_VIDEO_CONFIG_PATCH_INSTALLED__ = true;

  JSON.parse = function(...args) {
    const result = nativeJsonParse.apply(this, args);
    patchVideoConfigPayload(result);
    return result;
  };

  if (typeof Response !== "undefined" && Response.prototype && typeof Response.prototype.json === "function") {
    const originalResponseJson = Response.prototype.json;
    Response.prototype.json = async function(...args) {
      const result = await originalResponseJson.apply(this, args);
      patchVideoConfigPayload(result);
      return result;
    };
  }
}

function looksLikeVideoConfigText(text, url) {
  if (typeof text !== "string" || !text || text.length > MAX_PATCHABLE_VIDEO_CONFIG_TEXT_BYTES) {
    return false;
  }

  const lowerUrl = String(url || "").toLowerCase();
  if (lowerUrl.includes("video") || lowerUrl.includes("actionbar") || lowerUrl.includes("item_conf") || lowerUrl.includes("skill") || lowerUrl.includes("creation")) {
    return text.includes("supported_durations")
      || (text.includes("\"duration\"") && text.includes("\"model\""))
      || text.includes("pc_skill_video_generation")
      || text.includes("video_generation");
  }

  return text.includes("supported_durations") || (text.includes("\"duration\"") && text.includes("\"model\""));
}

function tryPatchVideoConfigText(text, url) {
  if (!looksLikeVideoConfigText(text, url)) return null;

  let payload;
  try {
    payload = nativeJsonParse(text);
  } catch {
    return null;
  }

  if (!patchVideoConfigPayload(payload)) return null;
  return JSON.stringify(payload);
}

function buildPatchedTextResponse(response, patchedText) {
  return new Response(patchedText, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers)
  });
}

function decoratePatchedFetchResponse(response, patchedText) {
  const makeClone = () => buildPatchedTextResponse(response, patchedText);
  try {
    Object.defineProperty(response, "text", {
      configurable: true,
      value: async function() {
        return patchedText;
      }
    });
    Object.defineProperty(response, "json", {
      configurable: true,
      value: async function() {
        return nativeJsonParse(patchedText);
      }
    });
    Object.defineProperty(response, "clone", {
      configurable: true,
      value: function() {
        return makeClone();
      }
    });
    return response;
  } catch {
    return makeClone();
  }
}

async function patchVideoConfigFetchResponse(response, url) {
  try {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json") && !contentType.includes("text/plain")) {
      return response;
    }

    const patchedText = tryPatchVideoConfigText(await response.clone().text(), url);
    if (!patchedText) return response;

    console.log("[content.js][video-config] fetch 响应已补齐 5s/10s/15s:", url);
    return decoratePatchedFetchResponse(response, patchedText);
  } catch (error) {
    console.warn("[content.js][video-config] fetch 响应补丁失败:", error);
    return response;
  }
}

function tryPatchVideoConfigXHR(xhr, url) {
  if (xhr.__DOUBAO_VIDEO_CONFIG_XHR_PATCHED__) return false;

  try {
    const responseType = xhr.responseType || "";
    if (responseType === "json") {
      const response = xhr.response;
      if (!response || typeof response !== "object") return false;
      if (!patchVideoConfigPayload(response)) return false;

      Object.defineProperty(xhr, "response", {
        configurable: true,
        get() {
          return response;
        }
      });
      xhr.__DOUBAO_VIDEO_CONFIG_XHR_PATCHED__ = true;
      console.log("[content.js][video-config] XHR JSON 响应已补齐 5s/10s/15s:", url);
      return true;
    }

    if (responseType && responseType !== "text") return false;
    const responseText = typeof xhr.responseText === "string" ? xhr.responseText : "";
    const patchedText = tryPatchVideoConfigText(responseText, url);
    if (!patchedText) return false;

    Object.defineProperty(xhr, "responseText", {
      configurable: true,
      get() {
        return patchedText;
      }
    });
    Object.defineProperty(xhr, "response", {
      configurable: true,
      get() {
        return patchedText;
      }
    });
    xhr.__DOUBAO_VIDEO_CONFIG_XHR_PATCHED__ = true;
    console.log("[content.js][video-config] XHR 文本响应已补齐 5s/10s/15s:", url);
    return true;
  } catch (error) {
    console.warn("[content.js][video-config] XHR 响应补丁失败:", error);
    return false;
  }
}

installVideoConfigPatchHooks();

function normalizeVideoDurationValue(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return "";
  const match = text.match(/^(\d+)(s|秒)?$/);
  if (!match) return "";
  const normalized = String(Number(match[1]));
  return VIDEO_TARGET_DURATIONS.includes(normalized) ? normalized : "";
}

function getSelectedCustomVideoDuration() {
  try {
    const normalized = normalizeVideoDurationValue(localStorage.getItem(VIDEO_DURATION_STORAGE_KEY));
    return VIDEO_TARGET_DURATIONS.includes(normalized) ? normalized : "";
  } catch {
    return "";
  }
}

function saveSelectedCustomVideoDuration(value) {
  try {
    const normalized = normalizeVideoDurationValue(value);
    if (VIDEO_TARGET_DURATIONS.includes(normalized)) {
      localStorage.setItem(VIDEO_DURATION_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(VIDEO_DURATION_STORAGE_KEY);
    }
  } catch {}
}

function isChatCompletionUrl(input) {
  const raw = typeof input === "string"
    ? input
    : (input && (input.url || input.href)) || String(input || "");
  try {
    const parsed = new URL(raw, location.href);
    return /(^|\.)doubao\.com$/i.test(parsed.hostname) && parsed.pathname === "/chat/completion";
  } catch {
    return /\/chat\/completion(?:\?|$)/.test(raw);
  }
}

function parseAbilityParam(value) {
  if (value && typeof value === "object") return { ...value };
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = nativeJsonParse(value);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {}
  }
  return {};
}

function patchVideoCompletionRequestBody(rawBody) {
  const selectedDuration = getSelectedCustomVideoDuration();
  if (!selectedDuration || typeof rawBody !== "string" || !rawBody.trim()) {
    return { changed: false, body: rawBody };
  }

  let payload;
  try {
    payload = nativeJsonParse(rawBody);
  } catch {
    return { changed: false, body: rawBody };
  }

  const ability = payload && payload.chat_ability;
  if (!ability || Number(ability.ability_type) !== 17) {
    return { changed: false, body: rawBody };
  }

  const durationNumber = Number(selectedDuration);
  const abilityParam = parseAbilityParam(ability.ability_param);
  abilityParam.duration = durationNumber;
  if ("video_duration" in abilityParam) {
    abilityParam.video_duration = durationNumber;
  }
  if ("generate_duration" in abilityParam) {
    abilityParam.generate_duration = durationNumber;
  }
  ability.ability_param = JSON.stringify(abilityParam);
  return { changed: true, body: JSON.stringify(payload) };
}

async function patchChatCompletionFetchArgs(args) {
  const nextArgs = Array.from(args);
  const [input, init] = nextArgs;

  try {
    if (!isChatCompletionUrl(input)) return nextArgs;

    if (init && Object.prototype.hasOwnProperty.call(init, "body")) {
      const patched = patchVideoCompletionRequestBody(init.body);
      if (patched.changed) {
        nextArgs[1] = { ...init, body: patched.body };
      }
      return nextArgs;
    }

    if (typeof Request !== "undefined" && input instanceof Request && String(input.method || "").toUpperCase() === "POST") {
      const patched = patchVideoCompletionRequestBody(await input.clone().text());
      if (patched.changed) {
        nextArgs[0] = new Request(input, { body: patched.body });
      }
    }
  } catch (error) {
    console.warn("[content.js][video-config] fetch 请求补丁失败:", error);
  }

  return nextArgs;
}

function patchChatCompletionXHRBody(method, url, body) {
  try {
    if (String(method || "").toUpperCase() !== "POST" || !isChatCompletionUrl(url)) {
      return { changed: false, body };
    }
    return patchVideoCompletionRequestBody(body);
  } catch (error) {
    console.warn("[content.js][video-config] XHR 请求补丁失败:", error);
    return { changed: false, body };
  }
}

function installVideoDurationFallbackStyle() {
  if (document.getElementById(VIDEO_DURATION_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = VIDEO_DURATION_STYLE_ID;
  style.textContent = `
    [${VIDEO_DURATION_MARK}-overlay="1"] {
      position: fixed !important;
      z-index: 2147483647 !important;
      min-width: 156px !important;
      padding: 12px 8px 8px !important;
      border-radius: 16px !important;
      border: 1px solid rgba(15, 23, 42, 0.08) !important;
      background: #ffffff !important;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14) !important;
    }
    [${VIDEO_DURATION_MARK}-overlay="1"][hidden] {
      display: none !important;
    }
    [${VIDEO_DURATION_MARK}-overlay-title="1"] {
      padding: 0 14px 8px !important;
      color: rgba(15, 23, 42, 0.45) !important;
      font-size: 14px !important;
      line-height: 20px !important;
      user-select: none !important;
    }
    [${VIDEO_DURATION_MARK}-menu="1"] {
      display: flex !important;
      flex-direction: column !important;
      gap: 4px !important;
      padding: 0 !important;
    }
    [${VIDEO_DURATION_MARK}-button="1"] {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 24px !important;
      width: 100% !important;
      min-height: 44px !important;
      padding: 0 22px !important;
      border: 0 !important;
      border-radius: 12px !important;
      background: transparent !important;
      color: inherit !important;
      font: inherit !important;
      text-align: left !important;
      cursor: pointer !important;
    }
    [${VIDEO_DURATION_MARK}-button="1"]:hover {
      background: rgba(15, 23, 42, 0.05) !important;
    }
    [${VIDEO_DURATION_MARK}-button="1"][${VIDEO_DURATION_MARK}-selected="1"] {
      color: #1677ff !important;
      background: rgba(22, 119, 255, 0.08) !important;
      font-weight: 600 !important;
    }
    [${VIDEO_DURATION_MARK}-check] {
      margin-left: auto !important;
      flex: 0 0 auto !important;
      line-height: 1 !important;
      visibility: hidden;
    }
    [${VIDEO_DURATION_MARK}-button="1"][${VIDEO_DURATION_MARK}-selected="1"] [${VIDEO_DURATION_MARK}-check] {
      visibility: visible;
    }
    [${VIDEO_DURATION_MARK}-native-check="hidden"] {
      visibility: hidden !important;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function isVisibleElement(element) {
  if (!element || !element.isConnected) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
}

function rawCompactText(element) {
  return String((element && element.textContent) || "")
    .replace(/\s+/g, "")
    .replace(/[✓✔√]/g, "")
    .trim();
}

function getClickableAncestor(node) {
  let current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  for (let index = 0; current && index < 8; index += 1, current = current.parentElement) {
    const role = current.getAttribute && current.getAttribute("role");
    if (
      current.tagName === "BUTTON"
      || role === "button"
      || role === "menuitem"
      || role === "option"
      || current.tabIndex >= 0
      || /pointer/.test(String(getComputedStyle(current).cursor || ""))
    ) {
      return current;
    }
  }
  return node && node.parentElement;
}

function getExactDurationFromElement(element) {
  const match = rawCompactText(element).match(/^(5|10|15)(s|秒)$/);
  return match ? Number(match[1]) : 0;
}

function getDurationTextNode(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (VIDEO_DURATION_LABEL_REGEX.test(walker.currentNode.nodeValue || "")) {
      return walker.currentNode;
    }
  }
  return null;
}

function isLikelyDurationMenuRootElement(element, requireNativeOptions = false) {
  if (!element || !isVisibleElement(element)) return false;
  if (element.closest(`[${VIDEO_DURATION_MARK}-menu="1"]`)) return false;

  const text = rawCompactText(element);
  if (text.length < 3 || text.length > 260) return false;
  if (!/时长/.test(text)) return false;
  if (!/(5s|10s|15s|5秒|10秒|15秒)/.test(text)) return false;
  if (/比例/.test(text) || /视频生成x/.test(text)) return false;

  if (requireNativeOptions) {
    const nativeCount = findMenuDurationOptions(element, { includeManaged: false }).length;
    if (nativeCount < 2) return false;
  }

  return true;
}

function findDurationMenuRoot() {
  if (lastDurationMenuRoot && lastDurationMenuRoot.isConnected && isLikelyDurationMenuRootElement(lastDurationMenuRoot, false)) {
    return lastDurationMenuRoot;
  }

  if (!document.body) return null;

  const nextRoot = Array.from(document.querySelectorAll('[role="menu"], [role="listbox"], [data-slot*="dropdown-menu"], div'))
    .filter((element) => isLikelyDurationMenuRootElement(element, true))
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return leftRect.width * leftRect.height - rightRect.width * rightRect.height;
    })[0] || null;

  lastDurationMenuRoot = nextRoot;
  return nextRoot;
}

function findMenuDurationOptions(root, { includeManaged = false } = {}) {
  const items = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return VIDEO_DURATION_LABEL_REGEX.test(node.nodeValue || "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });

  while (walker.nextNode()) {
    const clickable = getClickableAncestor(walker.currentNode);
    if (!clickable || !root.contains(clickable) || !isVisibleElement(clickable)) continue;
    if (!includeManaged && clickable.closest(`[${VIDEO_DURATION_MARK}-menu="1"]`)) continue;
    if (!getExactDurationFromElement(clickable)) continue;
    if (items.some((item) => item === clickable || item.contains(clickable))) continue;
    for (let index = items.length - 1; index >= 0; index -= 1) {
      if (clickable.contains(items[index])) items.splice(index, 1);
    }
    items.push(clickable);
  }

  return items;
}

function isLikelyToolbarDurationClickable(element) {
  if (!element || !isVisibleElement(element)) return false;
  if (element.closest('[role="menu"], [role="listbox"], [data-slot*="dropdown-menu"]')) return false;
  const rect = element.getBoundingClientRect();
  if (rect.top < window.innerHeight * 0.55) return false;
  if (!VIDEO_DURATION_LABEL_REGEX.test(rawCompactText(element))) return false;

  let current = element;
  for (let index = 0; current && index < 8; index += 1, current = current.parentElement) {
    const text = rawCompactText(current);
    if (/比例/.test(text) && /(模型|Mini|Seedance|视频生成|2\.0)/.test(text)) {
      return true;
    }
  }
  return false;
}

function bindToolbarDurationTrigger(element) {
  if (!element || element.hasAttribute(`${VIDEO_DURATION_MARK}-trigger`)) return;
  element.setAttribute(`${VIDEO_DURATION_MARK}-trigger`, "1");
  element.addEventListener("pointerdown", (event) => {
    if (typeof event.button === "number" && event.button !== 0) return;
    lastDurationToolbarTrigger = element;
    element.setAttribute(`${VIDEO_DURATION_MARK}-pointerdown-at`, String(Date.now()));
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toggleManagedDurationOverlay(element);
  }, true);
  element.addEventListener("click", (event) => {
    lastDurationToolbarTrigger = element;
    const pointerdownAt = Number(element.getAttribute(`${VIDEO_DURATION_MARK}-pointerdown-at`) || 0);
    if (Date.now() - pointerdownAt < 500) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toggleManagedDurationOverlay(element);
  }, true);
}

function findDurationToolbarTrigger() {
  if (lastDurationToolbarTrigger && lastDurationToolbarTrigger.isConnected && isLikelyToolbarDurationClickable(lastDurationToolbarTrigger)) {
    return lastDurationToolbarTrigger;
  }

  const candidates = Array.from(document.querySelectorAll('button, [role="button"], [tabindex], div'))
    .filter(isLikelyToolbarDurationClickable)
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const topDiff = rightRect.top - leftRect.top;
      if (Math.abs(topDiff) > 6) return topDiff;
      return (leftRect.width * leftRect.height) - (rightRect.width * rightRect.height);
    });

  const trigger = candidates[0] || null;
  if (trigger) {
    lastDurationToolbarTrigger = trigger;
    bindToolbarDurationTrigger(trigger);
  }
  return trigger;
}

function replaceDurationTextInElement(element, duration) {
  if (!element) return false;
  const nextLabel = `${duration}s`;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return VIDEO_DURATION_LABEL_REGEX.test(node.nodeValue || "")
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    }
  });

  while (walker.nextNode()) {
    walker.currentNode.nodeValue = nextLabel;
    return true;
  }

  const fallback = Array.from(element.querySelectorAll("span, div, p"))
    .find((node) => VIDEO_DURATION_LABEL_REGEX.test(rawCompactText(node)));
  if (fallback) {
    fallback.textContent = nextLabel;
    return true;
  }

  return false;
}

function setToolbarDurationText(duration) {
  const trigger = findDurationToolbarTrigger();
  if (!trigger) return;
  if (getToolbarDurationValue() === Number(duration)) {
    bindToolbarDurationTrigger(trigger);
    return;
  }
  suppressDurationObserver();
  replaceDurationTextInElement(trigger, duration);
  bindToolbarDurationTrigger(trigger);
}

function getToolbarDurationValue() {
  const trigger = findDurationToolbarTrigger();
  if (!trigger) return 0;
  const normalized = normalizeVideoDurationValue(rawCompactText(trigger));
  return normalized ? Number(normalized) : 0;
}

function suppressDurationObserver(ms = 220) {
  suppressDurationObserverUntil = Date.now() + ms;
}

function isDurationObserverSuppressed() {
  return Date.now() < suppressDurationObserverUntil;
}

function getManagedDurationOverlay() {
  return document.querySelector(`[${VIDEO_DURATION_MARK}-overlay="1"]`);
}

function ensureManagedDurationOverlay() {
  if (!document.body) return null;

  let overlay = getManagedDurationOverlay();
  if (overlay) return overlay;

  overlay = document.createElement("div");
  overlay.hidden = true;
  overlay.setAttribute(`${VIDEO_DURATION_MARK}-overlay`, "1");

  const title = document.createElement("div");
  title.setAttribute(`${VIDEO_DURATION_MARK}-overlay-title`, "1");
  title.textContent = "时长";
  overlay.appendChild(title);

  const menu = document.createElement("div");
  menu.setAttribute(`${VIDEO_DURATION_MARK}-menu`, "1");
  overlay.appendChild(menu);

  document.body.appendChild(overlay);
  return overlay;
}

function cleanupStaleManagedDurationUi() {
  const overlay = getManagedDurationOverlay();
  const activeMenu = overlay && overlay.querySelector(`[${VIDEO_DURATION_MARK}-menu="1"]`);

  for (const menu of document.querySelectorAll(`[${VIDEO_DURATION_MARK}-menu="1"]`)) {
    if (menu !== activeMenu && !menu.closest(`[${VIDEO_DURATION_MARK}-overlay="1"]`)) {
      menu.remove();
    }
  }

  for (const node of document.querySelectorAll(`[${VIDEO_DURATION_MARK}-hidden="1"]`)) {
    node.style.removeProperty("display");
    node.removeAttribute("aria-hidden");
    node.removeAttribute(`${VIDEO_DURATION_MARK}-hidden`);
  }

  if (lastDurationMenuRoot && (!lastDurationMenuRoot.isConnected || !isVisibleElement(lastDurationMenuRoot))) {
    lastDurationMenuRoot = null;
  }
}

function ensureManagedDurationMenu(root) {
  const overlay = ensureManagedDurationOverlay();
  if (!overlay) return null;
  return overlay.querySelector(`[${VIDEO_DURATION_MARK}-menu="1"]`);
}

function ensureManagedDurationButton(menu, duration) {
  const normalized = normalizeVideoDurationValue(duration);
  if (!menu || !normalized) return null;

  let button = menu.querySelector(`[${VIDEO_DURATION_MARK}-button="1"][${VIDEO_DURATION_MARK}-value="${normalized}"]`);
  if (!button) {
    button = document.createElement("button");
    button.type = "button";
    button.setAttribute(`${VIDEO_DURATION_MARK}-button`, "1");
    button.setAttribute(`${VIDEO_DURATION_MARK}-value`, normalized);

    const label = document.createElement("span");
    label.setAttribute(`${VIDEO_DURATION_MARK}-label`, "1");
    button.appendChild(label);

    const check = document.createElement("span");
    check.setAttribute(`${VIDEO_DURATION_MARK}-check`, "1");
    check.textContent = "✓";
    button.appendChild(check);

    menu.appendChild(button);
  }

  const label = button.querySelector(`[${VIDEO_DURATION_MARK}-label="1"]`);
  if (label) {
    label.textContent = `${normalized}s`;
  }

  if (!button.hasAttribute(`${VIDEO_DURATION_MARK}-bound`)) {
    button.setAttribute(`${VIDEO_DURATION_MARK}-bound`, "1");
    button.addEventListener("click", (event) => {
      const nextDuration = normalizeVideoDurationValue(button.getAttribute(`${VIDEO_DURATION_MARK}-value`));
      if (!nextDuration) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      saveSelectedCustomVideoDuration(nextDuration);
      setToolbarDurationText(Number(nextDuration));
      renderVideoDurationMenuSelection();
      suppressDurationObserver(260);
      closeManagedDurationOverlay();
    }, true);
  }

  return button;
}

function getManagedMenuDurationButtons(root) {
  const overlay = getManagedDurationOverlay();
  const scope = overlay || root;
  if (!scope) return [];
  return Array.from(scope.querySelectorAll(`[${VIDEO_DURATION_MARK}-button="1"]`))
    .filter((button) => button.closest(`[${VIDEO_DURATION_MARK}-overlay="1"]`))
    .filter(isVisibleElement)
    .sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return leftRect.top - rightRect.top;
    });
}

function positionManagedDurationOverlay(trigger) {
  const overlay = ensureManagedDurationOverlay();
  if (!overlay || !trigger) return;

  overlay.hidden = false;
  overlay.style.visibility = "hidden";
  overlay.style.left = "0px";
  overlay.style.top = "0px";

  const triggerRect = trigger.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const margin = 8;
  let left = triggerRect.left + (triggerRect.width - overlayRect.width) / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - overlayRect.width - margin));

  let top = triggerRect.top - overlayRect.height - 12;
  if (top < margin) {
    top = triggerRect.bottom + 12;
  }

  overlay.style.left = `${Math.round(left)}px`;
  overlay.style.top = `${Math.round(top)}px`;
  overlay.style.visibility = "";
}

function closeManagedDurationOverlay() {
  const overlay = getManagedDurationOverlay();
  if (!overlay) return;
  overlay.hidden = true;
  overlay.removeAttribute(`${VIDEO_DURATION_MARK}-open`);
}

function isManagedDurationOverlayOpen() {
  const overlay = getManagedDurationOverlay();
  return !!overlay && !overlay.hidden;
}

function openManagedDurationOverlay(trigger) {
  const overlay = ensureManagedDurationOverlay();
  const menu = ensureManagedDurationMenu();
  if (!overlay || !menu || !trigger) return;

  suppressDurationObserver(260);
  cleanupStaleManagedDurationUi();
  for (const duration of VIDEO_DURATION_VALUES) {
    ensureManagedDurationButton(menu, duration);
  }

  overlay.hidden = false;
  overlay.setAttribute(`${VIDEO_DURATION_MARK}-open`, "1");
  renderVideoDurationMenuSelection();
  positionManagedDurationOverlay(trigger);
}

function toggleManagedDurationOverlay(trigger) {
  if (isManagedDurationOverlayOpen()) {
    closeManagedDurationOverlay();
    return;
  }
  openManagedDurationOverlay(trigger);
}

function renderVideoDurationMenuSelection() {
  const selectedDuration = Number(getSelectedCustomVideoDuration()) || getToolbarDurationValue() || 10;
  for (const button of getManagedMenuDurationButtons()) {
    const duration = Number(button.getAttribute(`${VIDEO_DURATION_MARK}-value`) || 0);
    if (duration && duration === selectedDuration) {
      button.setAttribute(`${VIDEO_DURATION_MARK}-selected`, "1");
    } else {
      button.removeAttribute(`${VIDEO_DURATION_MARK}-selected`);
    }
  }
}

function injectVideoDurationFallbackOptions() {
  const trigger = findDurationToolbarTrigger();
  if (!trigger) return;
  openManagedDurationOverlay(trigger);
}

function runVideoDurationFallbackTick() {
  cleanupStaleManagedDurationUi();
  let selectedDuration = Number(getSelectedCustomVideoDuration());
  if (!selectedDuration) {
    selectedDuration = getToolbarDurationValue() || 10;
    saveSelectedCustomVideoDuration(String(selectedDuration));
  }

  const trigger = findDurationToolbarTrigger();
  if (!trigger) {
    closeManagedDurationOverlay();
    return;
  }

  setToolbarDurationText(selectedDuration);
  bindToolbarDurationTrigger(trigger);

  if (isManagedDurationOverlayOpen()) {
    renderVideoDurationMenuSelection();
    positionManagedDurationOverlay(trigger);
  }
}

function scheduleVideoDurationFallbackTick() {
  if (isDurationObserverSuppressed()) return;
  clearTimeout(durationUiTickTimer);
  durationUiTickTimer = setTimeout(runVideoDurationFallbackTick, 120);
}

function startVideoDurationFallback() {
  if (window.__DOUBAO_VIDEO_DURATION_FALLBACK_STARTED__) return;
  window.__DOUBAO_VIDEO_DURATION_FALLBACK_STARTED__ = true;
  installVideoDurationFallbackStyle();
  runVideoDurationFallbackTick();

  const waitForBody = () => {
    if (!document.body) {
      setTimeout(waitForBody, 200);
      return;
    }
    const observer = new MutationObserver(() => {
      if (isDurationObserverSuppressed()) return;
      scheduleVideoDurationFallbackTick();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", scheduleVideoDurationFallbackTick, true);
    document.addEventListener("pointerdown", (event) => {
      const overlay = getManagedDurationOverlay();
      if (!overlay || overlay.hidden) return;
      const trigger = findDurationToolbarTrigger();
      const target = event.target;
      if (overlay.contains(target)) return;
      if (trigger && trigger.contains && trigger.contains(target)) return;
      closeManagedDurationOverlay();
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeManagedDurationOverlay();
      }
    }, true);
    window.addEventListener("resize", scheduleVideoDurationFallbackTick, true);
    window.addEventListener("scroll", () => {
      if (!isManagedDurationOverlayOpen()) return;
      const trigger = findDurationToolbarTrigger();
      if (!trigger) {
        closeManagedDurationOverlay();
        return;
      }
      positionManagedDurationOverlay(trigger);
    }, true);
    scheduleVideoDurationFallbackTick();
  };

  waitForBody();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startVideoDurationFallback, { once: true });
} else {
  startVideoDurationFallback();
}

// ========== 新增：调用 get_play_info 接口获取无水印视频（修复核心）==========
async function callGetPlayInfo(videoKey) {
  const baseUrl = 'https://www.doubao.com/samantha/media/get_play_info';
  const params = new URLSearchParams({
    aid: '497858',
    device_platform: 'web',
    samantha_web: '1',
    'use-olympus-account': '1',
    version_code: '20800',
    pkg_type: 'release_version',
    web_tab_id: crypto.randomUUID()
  });
  const url = `${baseUrl}?${params.toString()}`;
  console.log('[content.js][get_play_info] 请求URL:', url);
  console.log('[content.js][get_play_info] 请求body:', JSON.stringify({ key: videoKey, type: 'video' }));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'agw-js-conv': 'str',
      'origin': location.origin,
      'referer': location.href
    },
    credentials: 'include',
    body: JSON.stringify({ key: videoKey, type: 'video' })
  });
  
  console.log('[content.js][get_play_info] HTTP状态:', response.status, response.statusText);
  const rawText = await response.text();
  console.log('[content.js][get_play_info] 原始响应文本:', rawText);
  
  let json;
  try {
    json = JSON.parse(rawText);
  } catch (parseErr) {
    console.error('[content.js][get_play_info] JSON解析失败:', parseErr);
    throw new Error(`get_play_info 响应不是合法JSON: ${rawText.slice(0, 200)}`);
  }
  
  console.log('[content.js][get_play_info] 解析后JSON:', json);
  if (json.code !== 0) {
    throw new Error(`get_play_info 接口返回错误: code=${json.code}, msg=${json.msg || '未知'}`);
  }
  
  const data = json.data;
  if (!data) throw new Error('响应中无 data 字段');
  console.log('[content.js][get_play_info] data字段keys:', Object.keys(data));
  
  // 从 original_media_info 中获取无水印地址
  const originalMedia = data.original_media_info;
  console.log('[content.js][get_play_info] original_media_info:', originalMedia);
  if (!originalMedia || !originalMedia.main_url) {
    // 回退到 play_infos
    console.warn('[content.js][get_play_info] 未找到 original_media_info.main_url，尝试使用 play_infos');
    const playInfos = data.play_infos || (data.play_info ? [data.play_info] : []);
    console.log('[content.js][get_play_info] play_infos:', playInfos);
    const playInfo = playInfos[0];
    if (!playInfo || !playInfo.main) {
      throw new Error('未找到视频播放地址(play_infos为空或无main)');
    }
    const mainUrl = playInfo.main.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark');
    const backupUrl = playInfo.backup ? playInfo.backup.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark') : null;
    return {
      success: true,
      mainUrl: mainUrl,
      backupUrl: backupUrl,
      width: playInfo.width,
      height: playInfo.height,
      definition: playInfo.definition || 'unknown'
    };
  }
  
  // 使用 original_media_info 中的无水印地址
  let mainUrl = originalMedia.main_url;
  let backupUrl = originalMedia.backup_url || null;
  
  // 强制替换水印参数
  mainUrl = mainUrl.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark');
  if (backupUrl) backupUrl = backupUrl.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark');
  
  return {
    success: true,
    mainUrl: mainUrl,
    backupUrl: backupUrl,
    width: originalMedia.width || null,
    height: originalMedia.height || null,
    definition: originalMedia.definition || data.video_info?.definition || 'unknown'
  };
}
// ========== 新增结束 ==========

function findVideoAndMessageId() {
  const routerData = window._ROUTER_DATA;
  console.log('[content.js][findVideo] window._ROUTER_DATA 存在:', !!routerData);
  if (!routerData) return null;
  const cells = routerData?.loaderData?.chat_layout?.trimmedChainRecentConvCells || [];
  console.log('[content.js][findVideo] cells数量:', cells.length);
  for (const cell of cells) {
    const messages = cell?.conversation?.messages || [];
    for (const msg of messages) {
      const msgId = String(msg.message_id || "").trim();
      if (!msgId || msgId === "0") continue;
      const vid = findVidInObject(msg);
      if (vid) return { vid, messageId: msgId };
    }
  }
  console.warn('[content.js][findVideo] 遍历完所有cells未找到vid');
  return null;
}

function findVidByMessageId(messageId) {
  const cached = videoCache.get(messageId);
  if (cached) return { vid: cached, messageId };
  const msg = findMessageObjById(messageId);
  if (msg) {
    const vid = findVidInObject(msg);
    if (vid) {
      videoCache.set(messageId, vid);
      return { vid, messageId };
    }
  }
  return null;
}

function findVidInObject(obj, depth = 0) {
  if (depth > 10 || !obj) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findVidInObject(item, depth + 1);
      if (found) return found;
    }
  } else if (typeof obj === "object") {
    const vid = obj.vid || obj.video_id;
    if (vid && typeof vid === "string" && vid.startsWith("v0")) return vid;
    for (const val of Object.values(obj)) {
      const found = findVidInObject(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

async function callDoubaoShareSave(messageId) {
  return new Promise((resolve) => {
    function handler(ev) {
      if (ev.data?.type === "doubaoShareSaveResult") {
        window.removeEventListener("message", handler);
        resolve(ev.data.data);
      }
    }
    window.postMessage({ type: "doubaoShareSave", messageId }, "*");
    window.addEventListener("message", handler);
    setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, 15000);
  });
}

async function callGetVideoShareInfo(shareId, vid) {
  const url = "https://www.doubao.com/creativity/share/get_video_share_info?version_code=20800&language=zh&device_platform=web&aid=497858&real_aid=497858&pkg_type=release_version&device_id=7550681679050343936&pc_version=3.14.6&region=CN&sys_region=CN&samantha_web=1&use-olympus-account=1&web_tab_id=" + crypto.randomUUID();
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "agw-js-conv": "str"
      },
      credentials: "include",
      body: JSON.stringify({ share_id: shareId, vid, creation_id: "" })
    });
    console.log('[content.js][get_video_share_info] HTTP状态:', resp.status, resp.statusText);
    const rawText = await resp.text();
    console.log('[content.js][get_video_share_info] 原始响应:', rawText);
    const json = JSON.parse(rawText);
    if (json.code === 0 && json.data) return json.data;
    console.warn('[content.js][get_video_share_info] 返回异常 code:', json.code, 'msg:', json.msg);
    return null;
  } catch (e) {
    console.error('[content.js][get_video_share_info] 异常:', e);
    return null;
  }
}

function extractNoWatermarkVideoUrl(data) {
  const playInfo = data?.play_infos?.[0] || data?.play_info || (data?.main ? data : null);
  if (!playInfo?.main) return null;
  const replaceLr = (url) => url?.replace(/lr=video_gen_watermark_dyn/, "lr=video_gen_no_watermark").replace(/lr=video_gen_watermark/, "lr=video_gen_no_watermark");
  return {
    mainUrl: replaceLr(playInfo.main),
    backupUrl: replaceLr(playInfo.backup),
    width: playInfo.width,
    height: playInfo.height,
    definition: playInfo.definition
  };
}

// ========== 新增：直接从页面 _ROUTER_DATA 提取视频地址（最稳，不依赖接口）==========
function decodeBase64Url(b64) {
  if (!b64) return null;
  try {
    const decoded = atob(b64);
    return /^https?:\/\//.test(decoded) ? decoded : b64;
  } catch (e) {
    return b64;
  }
}

function replaceWatermarkLr(url) {
  if (!url) return null;
  return url.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark');
}

// 从 video_model 字符串里挑分辨率最高的清晰度
function pickBestFromVideoModel(videoModelStr) {
  let model;
  try {
    model = typeof videoModelStr === 'string' ? JSON.parse(videoModelStr) : videoModelStr;
  } catch (e) {
    console.warn('[content.js][local] video_model 解析失败:', e);
    return null;
  }
  const list = model?.video_list;
  if (!list) return null;
  const entries = Object.values(list).filter(Boolean);
  if (!entries.length) return null;
  entries.sort((a, b) => ((b.vwidth || 0) * (b.vheight || 0)) - ((a.vwidth || 0) * (a.vheight || 0)));
  const best = entries[0];
  return {
    main: best.main_url ? decodeBase64Url(best.main_url) : null,
    backup: best.backup_url_1 ? decodeBase64Url(best.backup_url_1) : (best.backup_url ? decodeBase64Url(best.backup_url) : null),
    width: best.vwidth || null,
    height: best.vheight || null,
    definition: best.definition || 'unknown'
  };
}

// 递归找到含视频地址的对象
function findVideoObjInObject(obj, depth = 0) {
  if (depth > 12 || !obj) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findVideoObjInObject(item, depth + 1);
      if (found) return found;
    }
  } else if (typeof obj === 'object') {
    if ((obj.download_url || obj.video_model) && (obj.vid || obj.video_id)) return obj;
    for (const val of Object.values(obj)) {
      const found = findVideoObjInObject(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// 根据 messageId 找到原始 message 对象
function findMessageObjById(messageId) {
  const targetId = normalizeMessageId(messageId);
  if (!targetId) return null;
  const messages = getAllKnownMessages();
  for (const msg of messages) {
    const msgId = normalizeMessageId(msg?.message_id);
    if (msgId === targetId) return msg;
  }
  return null;
}

// 找第一个含视频的 message
function findFirstVideoMessageObj() {
  const messages = getAllKnownMessages();
  for (const msg of messages) {
    const msgId = String(msg.message_id || "").trim();
    if (!msgId || msgId === "0") continue;
    const videoObj = findVideoObjInObject(msg);
    if (videoObj) return { msg, messageId: msgId, videoObj };
  }
  return null;
}

function parseJsonMaybe(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || (text[0] !== '{' && text[0] !== '[')) return value;
  try {
    return JSON.parse(text);
  } catch (e) {
    return value;
  }
}

function normalizeMessageId(value) {
  return String(value || '').trim();
}

function trimMessageCache() {
  while (messageCache.size > MAX_MESSAGE_CACHE_SIZE) {
    const first = messageCache.keys().next().value;
    messageCache.delete(first);
  }
}

function cacheMessageObject(message, fallbackMessageId = '') {
  if (!message || typeof message !== 'object') return null;
  const messageId = normalizeMessageId(message.message_id || fallbackMessageId);
  if (!messageId || messageId === '0') return null;
  const prev = messageCache.get(messageId);
  const next = prev && typeof prev === 'object'
    ? { ...prev, ...message, message_id: messageId }
    : { ...message, message_id: messageId };
  messageCache.delete(messageId);
  messageCache.set(messageId, next);
  trimMessageCache();
  return next;
}

function cacheMessages(messages) {
  if (!Array.isArray(messages)) return;
  for (const message of messages) {
    cacheMessageObject(message);
  }
}

function findDeepValueByKeys(obj, keys, depth = 0) {
  if (depth > 12 || !obj) return null;
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findDeepValueByKeys(item, keys, depth + 1);
      if (found != null) return found;
    }
    return null;
  }
  if (typeof obj !== 'object') return null;
  for (const key of keys) {
    if (typeof obj[key] === 'string' && obj[key].trim()) return obj[key].trim();
  }
  for (const val of Object.values(obj)) {
    const found = findDeepValueByKeys(val, keys, depth + 1);
    if (found != null) return found;
  }
  return null;
}

function collectDeepValuesByKeys(obj, keys, depth = 0, out = []) {
  if (depth > 12 || !obj) return out;
  if (Array.isArray(obj)) {
    for (const item of obj) collectDeepValuesByKeys(item, keys, depth + 1, out);
    return out;
  }
  if (typeof obj !== 'object') return out;
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) out.push(value.trim());
    if (Array.isArray(value)) {
      for (const item of value) if (typeof item === 'string' && item.trim()) out.push(item.trim());
    }
  }
  for (const val of Object.values(obj)) collectDeepValuesByKeys(val, keys, depth + 1, out);
  return out;
}

function extractKeySeedFromText(text) {
  if (!text || typeof text !== 'string') return '';
  const match = text.match(/(?:^|[?&])key_seed=([^&"'<>\\\s]+)/i) || text.match(/["']key_seed["']\s*:\s*["']([^"']+)/i);
  if (!match || !match[1]) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch (e) {
    return match[1];
  }
}

function collectFplayUrlsFromObject(obj, depth = 0, out = []) {
  if (depth > 12 || !obj) return out;
  if (typeof obj === 'string') {
    const matches = obj.match(/https?:\/\/[^"'<>\\\s]+\/video\/fplay\/[^"'<>\\\s]+/ig);
    if (matches) out.push(...matches);
    return out;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectFplayUrlsFromObject(item, depth + 1, out);
    return out;
  }
  if (typeof obj !== 'object') return out;
  for (const val of Object.values(obj)) collectFplayUrlsFromObject(val, depth + 1, out);
  return out;
}

function isTrueNoWatermarkUrl(url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const lr = (parsed.searchParams.get('lr') || '').toLowerCase();
    const cs = parsed.searchParams.get('cs') || '';
    const qs = parsed.searchParams.get('qs') || '';
    return cs === '0' && qs === '13' && (!lr || lr === 'unwatermarked' || lr === 'no_watermark');
  } catch (e) {
    return false;
  }
}

function findFirstTrueNoWatermarkUrl(obj, depth = 0) {
  if (depth > 12 || !obj) return '';
  if (typeof obj === 'string') {
    const decoded = decodeBase64Url(obj);
    if (isTrueNoWatermarkUrl(decoded)) return decoded;
    if (isTrueNoWatermarkUrl(obj)) return obj;
    return '';
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const found = findFirstTrueNoWatermarkUrl(item, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof obj !== 'object') return '';
  for (const val of Object.values(obj)) {
    const found = findFirstTrueNoWatermarkUrl(val, depth + 1);
    if (found) return found;
  }
  return '';
}

function getRouterMessages() {
  const routerData = window._ROUTER_DATA;
  if (!routerData) return [];
  const cells = routerData?.loaderData?.chat_layout?.trimmedChainRecentConvCells || [];
  const messages = [];
  for (const cell of cells) {
    const cellMessages = cell?.conversation?.messages || [];
    cacheMessages(cellMessages);
    messages.push(...cellMessages);
  }
  return messages;
}

function getAllKnownMessages() {
  const dedup = new Map();
  for (const message of getRouterMessages()) {
    const messageId = normalizeMessageId(message?.message_id);
    if (!messageId || messageId === '0') continue;
    dedup.set(messageId, cacheMessageObject(message) || message);
  }
  for (const message of messageCache.values()) {
    const messageId = normalizeMessageId(message?.message_id);
    if (!messageId || messageId === '0') continue;
    const prev = dedup.get(messageId);
    dedup.set(messageId, prev && typeof prev === 'object' ? { ...prev, ...message, message_id: messageId } : message);
  }
  return Array.from(dedup.values());
}

function resolveVideoMessageContextByMessageId(messageId) {
  const targetId = String(messageId || '').trim();
  const messages = getAllKnownMessages();
  let exact = null;
  let referenced = null;
  let firstVideo = null;
  for (const msg of messages) {
    const msgId = String(msg?.message_id || '').trim();
    if (!msgId || msgId === '0') continue;
    const videoObj = findVideoObjInObject(msg);
    const referencedId = String(msg?.reference_info?.referenced_message_id || msg?.bot_reply_message_id || '').trim();
    if (videoObj && !firstVideo) firstVideo = { msg, messageId: msgId, videoObj };
    if (msgId === targetId) {
      exact = { msg, messageId: msgId, videoObj };
      if (videoObj) return exact;
    }
    if (referencedId === targetId && videoObj && !referenced) {
      referenced = { msg, messageId: msgId, videoObj };
    }
  }
  return referenced || exact || firstVideo || null;
}

function buildVideoRuntimePayloadByMessageId(messageId) {
  const context = resolveVideoMessageContextByMessageId(messageId);
  if (!context || !context.videoObj) {
    return { success: false, error: '未找到视频运行时数据', messageId };
  }
  const model = parseJsonMaybe(context.videoObj.video_model);
  const keySeed = findDeepValueByKeys(model, ['key_seed']) || findDeepValueByKeys(context.videoObj, ['key_seed']) || findDeepValueByKeys(context.msg, ['key_seed']) || extractKeySeedFromText(findDeepValueByKeys(model, ['fallback_api']) || '');
  const fallbackApi = findDeepValueByKeys(model, ['fallback_api']) || findDeepValueByKeys(context.videoObj, ['fallback_api']) || findDeepValueByKeys(context.msg, ['fallback_api']) || '';
  const fplayUrls = Array.from(new Set(collectFplayUrlsFromObject(context.msg).concat(collectFplayUrlsFromObject(context.videoObj))));
  const decodedDownloadUrl = decodeBase64Url(context.videoObj.download_url || '');
  const directNoWatermarkUrl = findFirstTrueNoWatermarkUrl(context.msg) || findFirstTrueNoWatermarkUrl(context.videoObj) || (isTrueNoWatermarkUrl(decodedDownloadUrl) ? decodedDownloadUrl : '');
  return {
    success: true,
    data: {
      requestMessageId: String(messageId || '').trim(),
      messageId: context.messageId,
      vid: context.videoObj.vid || context.videoObj.video_id || '',
      keySeed: keySeed || '',
      fallbackApi: fallbackApi || '',
      fplayUrls,
      directNoWatermarkUrl,
      videoModel: typeof context.videoObj.video_model === 'string' ? context.videoObj.video_model : JSON.stringify(context.videoObj.video_model || ''),
      downloadUrl: decodedDownloadUrl || context.videoObj.download_url || '',
      resolvedByReference: context.messageId !== String(messageId || '').trim()
    }
  };
}

// 核心：从 message 对象里提取无水印视频地址
function extractVideoUrlFromMessage(msg) {
  const videoObj = findVideoObjInObject(msg);
  if (!videoObj) {
    console.warn('[content.js][local] 未在 message 中找到视频对象');
    return null;
  }
  console.log('[content.js][local] 找到视频对象, vid:', videoObj.vid || videoObj.video_id);

  // 1. 优先用 video_model（含多清晰度，可取最高画质）
  if (videoObj.video_model) {
    const best = pickBestFromVideoModel(videoObj.video_model);
    if (best && best.main) {
      console.log('[content.js][local] video_model 提取成功, 画质:', best.definition, best.width + 'x' + best.height);
      return {
        mainUrl: replaceWatermarkLr(best.main),
        backupUrl: replaceWatermarkLr(best.backup),
        width: best.width,
        height: best.height,
        definition: best.definition
      };
    }
  }

  // 2. 回退到 download_url
  if (videoObj.download_url) {
    console.log('[content.js][local] 使用 download_url 回退');
    return {
      mainUrl: replaceWatermarkLr(videoObj.download_url),
      backupUrl: null,
      width: parseInt(videoObj.width) || null,
      height: parseInt(videoObj.height) || null,
      definition: 'source'
    };
  }

  console.warn('[content.js][local] 视频对象内无 video_model 也无 download_url');
  return null;
}
// ========== 新增结束 ==========

// ========== 修复：startVideoDownload 优先使用新接口 ==========
async function startVideoDownload() {
  console.log("[content.js] startVideoDownload 开始执行");
  const info = findVideoAndMessageId();
  if (!info) return { success: false, error: "未找到视频内容" };
  console.log("[content.js] 找到视频:", info);

  // 0. 最优先：直接从页面数据提取（不依赖接口，最稳）
  try {
    const msgObj = findMessageObjById(info.messageId);
    const localResult = msgObj ? extractVideoUrlFromMessage(msgObj) : null;
    if (localResult && localResult.mainUrl) {
      console.log("[content.js] 本地数据提取成功:", localResult.mainUrl);
      return {
        success: true,
        messageId: info.messageId,
        vid: info.vid,
        videoUrl: localResult.mainUrl,
        backupUrl: localResult.backupUrl,
        width: localResult.width,
        height: localResult.height,
        definition: localResult.definition,
        source: "local_router_data"
      };
    }
  } catch (err) {
    console.warn("[content.js] 本地提取失败，继续尝试接口:", err && err.message, err);
  }
  
  // 1. 优先尝试新接口 get_play_info（直接获取无水印）
  try {
    console.log("[content.js] 尝试新接口 callGetPlayInfo, vid:", info.vid);
    const playResult = await callGetPlayInfo(info.vid);
    if (playResult && playResult.mainUrl) {
      console.log("[content.js] 新接口获取成功:", playResult.mainUrl);
      return {
        success: true,
        messageId: info.messageId,
        vid: info.vid,
        videoUrl: playResult.mainUrl,
        backupUrl: playResult.backupUrl,
        width: playResult.width,
        height: playResult.height,
        definition: playResult.definition,
        source: "get_play_info"
      };
    }
  } catch (err) {
    console.warn("[content.js] 新接口失败，回退旧逻辑。错误详情:", err && err.message, err);
  }
  
  // 2. 回退原有逻辑
  console.log("[content.js] 使用旧接口获取视频");
  const share = await callDoubaoShareSave(info.messageId);
  console.log("[content.js] callDoubaoShareSave 返回:", share);
  if (!share?.share_id) return { success: false, error: "获取视频分享ID失败" };
  console.log("[content.js] 获取分享ID成功:", share.share_id);
  
  const videoData = await callGetVideoShareInfo(share.share_id, info.vid);
  if (!videoData) return { success: false, error: "获取视频信息失败" };
  console.log("[content.js] 获取视频信息成功");
  
  const extracted = extractNoWatermarkVideoUrl(videoData);
  if (!extracted) return { success: false, error: "提取下载链接失败" };
  console.log("[content.js] 提取无水印URL成功");
  
  return {
    success: true,
    messageId: info.messageId,
    shareId: share.share_id,
    vid: info.vid,
    videoUrl: extracted.mainUrl,
    backupUrl: extracted.backupUrl,
    width: extracted.width,
    height: extracted.height,
    definition: extracted.definition,
    source: "legacy"
  };
}

// ========== 修复：startVideoDownloadByMessageId 优先使用新接口 ==========
async function startVideoDownloadByMessageId(messageId) {
  console.log("[content.js] startVideoDownloadByMessageId 开始执行, messageId:", messageId);
  const info = findVidByMessageId(messageId);
  if (!info) return { success: false, error: "未找到视频内容", messageId };
  console.log("[content.js] 找到视频:", info);

  // 0. 最优先：直接从页面数据提取（不依赖接口，最稳）
  try {
    const msgObj = findMessageObjById(info.messageId);
    const localResult = msgObj ? extractVideoUrlFromMessage(msgObj) : null;
    if (localResult && localResult.mainUrl) {
      console.log("[content.js] 本地数据提取成功:", localResult.mainUrl);
      return {
        success: true,
        messageId: info.messageId,
        vid: info.vid,
        videoUrl: localResult.mainUrl,
        backupUrl: localResult.backupUrl,
        width: localResult.width,
        height: localResult.height,
        definition: localResult.definition,
        source: "local_router_data"
      };
    }
  } catch (err) {
    console.warn("[content.js] 本地提取失败，继续尝试接口:", err && err.message, err);
  }
  
  // 1. 优先尝试新接口 get_play_info
  try {
    console.log("[content.js] 尝试新接口 callGetPlayInfo, vid:", info.vid);
    const playResult = await callGetPlayInfo(info.vid);
    if (playResult && playResult.mainUrl) {
      console.log("[content.js] 新接口获取成功:", playResult.mainUrl);
      return {
        success: true,
        messageId: info.messageId,
        vid: info.vid,
        videoUrl: playResult.mainUrl,
        backupUrl: playResult.backupUrl,
        width: playResult.width,
        height: playResult.height,
        definition: playResult.definition,
        source: "get_play_info"
      };
    }
  } catch (err) {
    console.warn("[content.js] 新接口失败，回退旧逻辑。错误详情:", err && err.message, err);
  }
  
  // 2. 回退原有逻辑
  console.log("[content.js] 使用旧接口获取视频");
  const share = await callDoubaoShareSave(info.messageId);
  console.log("[content.js] callDoubaoShareSave 返回:", share);
  if (!share?.share_id) return { success: false, error: "获取视频分享ID失败", messageId };
  console.log("[content.js] 获取分享ID成功:", share.share_id);
  
  const videoData = await callGetVideoShareInfo(share.share_id, info.vid);
  if (!videoData) return { success: false, error: "获取视频信息失败", messageId };
  console.log("[content.js] 获取视频信息成功");
  
  const extracted = extractNoWatermarkVideoUrl(videoData);
  if (!extracted) return { success: false, error: "提取下载链接失败", messageId };
  console.log("[content.js] 提取无水印URL成功");
  
  return {
    success: true,
    messageId: info.messageId,
    shareId: share.share_id,
    vid: info.vid,
    videoUrl: extracted.mainUrl,
    backupUrl: extracted.backupUrl,
    width: extracted.width,
    height: extracted.height,
    definition: extracted.definition,
    source: "legacy"
  };
}
// ========== 修复结束 ==========

function scanInitialVideoData() {
  const routerData = window._ROUTER_DATA;
  if (!routerData) return;
  const cells = routerData?.loaderData?.chat_layout?.trimmedChainRecentConvCells || [];
  const videos = [];
  for (const cell of cells) {
    const messages = cell?.conversation?.messages || [];
    cacheMessages(messages);
    for (const msg of messages) {
      const msgId = String(msg.message_id || "").trim();
      if (!msgId || msgId === "0") continue;
      const vid = findVidInObject(msg);
      if (vid) {
        videoCache.set(msgId, vid);
        videos.push({ vid, messageId: msgId });
      }
    }
  }
  if (videos.length) window.postMessage({ type: "videoDataExtracted", data: videos }, "*");
}

function scanInitialMediaData() {
  const messages = getAllKnownMessages();
  if (!messages.length) return;
  publishImages(extractFromMessages(messages));
  publishVideos(extractVideoFromMessages(messages));
}

function extractFromCreations(creations) {
  const images = [];
  for (const cr of creations) {
    const img = cr?.image;
    const raw = img?.image_ori_raw;
    if (raw?.url) {
      const match = raw.url.match(/x-expires=(\d+)/);
      const expires = match ? new Date(parseInt(match[1]) * 1000).toISOString() : null;
      images.push({
        watermark_url: img.image_thumb?.url,
        no_watermark_url: raw.url,
        expires_at: expires,
        width: raw.width || null,
        height: raw.height || null
      });
    }
  }
  return images;
}

function extractFromPatchOps(patchOps) {
  let images = [];
  for (const op of patchOps) {
    const blocks = op?.patch_value?.content_block;
    if (blocks) {
      for (const block of blocks) {
        const creations = block?.content?.creation_block?.creations;
        if (creations) images.push(...extractFromCreations(creations));
      }
    }
  }
  return images;
}

function extractFromMessages(messages) {
  let images = [];
  for (const msg of messages) {
    for (const block of msg?.content_block || []) {
      const creations = block?.content?.creation_block?.creations;
      if (creations) images.push(...extractFromCreations(creations));
    }
  }
  return images;
}

function extractVideoFromMessages(messages) {
  const videos = [];
  for (const msg of messages) {
    cacheMessageObject(msg);
    const msgId = String(msg.message_id || "").trim();
    if (!msgId || msgId === "0") continue;
    const vid = findVidInObject(msg);
    if (vid) {
      videoCache.set(msgId, vid);
      videos.push({ vid, messageId: msgId });
    }
  }
  return videos;
}

function markProcessed(url) {
  if (url) {
    processedUrls.add(url);
    if (processedUrls.size > MAX_DEDUP_SIZE) {
      const first = processedUrls.values().next().value;
      processedUrls.delete(first);
    }
  }
}

function publishImages(images) {
  if (!images.length) return;
  const now = Date.now();
  const valid = images.filter(img => !img.expires_at || new Date(img.expires_at).getTime() > now + ONE_YEAR_MS);
  if (valid.length) window.postMessage({ type: "imageDataExtracted", data: valid }, "*");
}

function publishVideos(videos) {
  if (videos.length) window.postMessage({ type: "videoDataExtracted", data: videos }, "*");
}

async function readSSEStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const match = part.match(/^data: (.+)$/m);
        if (match) {
          try {
            const data = JSON.parse(match[1]);
            const patchOps = data?.patch_op;
            if (patchOps) {
              const images = extractFromPatchOps(patchOps);
              if (images.length) window.postMessage({ type: "imageDataExtracted", data: images }, "*");
              const msgId = String(data?.message_id || "").trim();
              for (const op of patchOps) {
                const pv = op?.patch_value;
                if (!pv) continue;
                const id = String(pv.message_id || msgId || "").trim();
                if (!id || id === "0") continue;
                cacheMessageObject(pv, id);
                const vid = findVidInObject(pv);
                if (vid) {
                  videoCache.set(id, vid);
                  window.postMessage({ type: "videoDataExtracted", data: [{ vid, messageId: id }] }, "*");
                }
              }
            }
          } catch(e) {}
        }
      }
    }
  } catch(e) {}
}

function extractAndPublishFromXHR(response, url) {
  if (url && processedUrls.has(url)) return;
  const messages = response?.downlink_body?.pull_singe_chain_downlink_body?.messages;
  if (!messages) return;
  cacheMessages(messages);
  const images = extractFromMessages(messages);
  markProcessed(url);
  publishImages(images);
  publishVideos(extractVideoFromMessages(messages));
}

// 消息监听
window.addEventListener("message", (ev) => {
  const msg = ev.data;
  if (msg?.type === "startVideoDownload") {
    startVideoDownload().then(result => {
      console.log("[content.js] startVideoDownload 结果:", result);
      window.postMessage({ type: "videoDownloadResult", data: result }, "*");
    });
  } else if (msg?.type === "startVideoDownloadByMessageId") {
    startVideoDownloadByMessageId(msg.messageId).then(result => {
      console.log("[content.js] startVideoDownloadByMessageId 结果:", result);
      window.postMessage({ type: "videoDownloadResult", data: result }, "*");
    });
  } else if (msg?.type === "extractVideoRuntimeByMessageId") {
    const payload = buildVideoRuntimePayloadByMessageId(msg.messageId);
    window.postMessage({ type: "doubaoVideoRuntimePayload", requestId: msg.requestId, data: payload }, "*");
  } else if (msg?.type === "scanInitialMedia") {
    scanInitialMediaData();
  } else if (msg?.type === "scanInitialVideos") {
    scanInitialMediaData();
    scanInitialVideoData();
  }
});

// 劫持 fetch 和 XHR
window.fetch = function(...args) {
  const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
  if (typeof url === "string" && url.includes("chat/completion")) {
    return patchChatCompletionFetchArgs(args).then((patchedArgs) => originalFetch.apply(this, patchedArgs)).then(async (resp) => {
      const contentType = resp.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        return patchVideoConfigFetchResponse(resp, url);
      }
      const [stream1, stream2] = resp.body.tee();
      const newResp = new Response(stream1, { status: resp.status, statusText: resp.statusText, headers: resp.headers });
      readSSEStream(stream2);
      return newResp;
    });
  }
  return originalFetch.apply(this, args).then((resp) => patchVideoConfigFetchResponse(resp, url));
};

XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  this.__cx_method = method;
  this._url = url;
  return originalXHROpen.call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.send = function(...args) {
  const patchedRequest = patchChatCompletionXHRBody(this.__cx_method, this.responseURL || this._url || "", args[0]);
  if (patchedRequest.changed) {
    args[0] = patchedRequest.body;
  }

  const maybePatchVideoConfigResponse = () => {
    if (this.readyState !== 4) return;
    tryPatchVideoConfigXHR(this, this.responseURL || this._url || "");
  };

  this.addEventListener("readystatechange", maybePatchVideoConfigResponse);
  this.addEventListener("load", () => {
    maybePatchVideoConfigResponse();
    if (typeof this._url === "string" && this._url.includes("chain/single")) {
      try {
        extractAndPublishFromXHR(JSON.parse(this.responseText), this._url);
      } catch(e) {}
    }
  });
  return originalXHRSend.apply(this, args);
};

}
