/**
 * 豆包去水印 - Page Context Injection (MAIN world) v3
 *
 * 运行在页面上下文中，可以访问页面的 fetch / XMLHttpRequest
 * 用于拦截豆包 API 响应，提取 video_id 等关键信息
 *
 * v3 修复：
 * - 添加 /im/chain/ 到 isVideoApi 检查（chat 页面视频数据来源）
 * - scanCreations 支持 vid 字段（chat 页面 API 使用 vid 而非 video_id）
 * - chat 页面 /im/chain/single 响应包含 video.vid，这才是真正的 video_id
 */

(function () {
  'use strict';

  // 避免重复注入
  if (window.__doubaoInjectLoaded) return;
  window.__doubaoInjectLoaded = true;

  // ═══════════════════════════════════════════════════════════
  // 噪音 API 过滤（这些 API 返回的 ID 与视频无关）
  // ═══════════════════════════════════════════════════════════

  const NOISY_API_PATTERNS = [
    '/abtest_config',
    '/service/2/abtest',
    '/mcs.doubao.com/service',
    '/boe/',
    '/sentry/',
    '/log/',
    '/track',
    '/report',
    '/mcs.zijieapi.com',
    '/toblog',
    '/frontier',
    '/applog',
    '/mss',
    '/verify',
  ];

  function isNoisyApi(url) {
    if (!url) return true;
    for (const pattern of NOISY_API_PATTERNS) {
      if (url.includes(pattern)) return true;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // 拦截 fetch
  // ═══════════════════════════════════════════════════════════

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');

      // 过滤噪音 API
      if (isNoisyApi(url)) return response;

      if (url.includes('doubao.com') || url.includes('samantha') || url.includes('volcengine')) {
        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            scanForVideoData(data, url);
          } catch (e) { /* 非 JSON 响应，忽略 */ }
        }).catch(() => {});
      }
    } catch (e) { /* 拦截失败不影响正常请求 */ }

    return response;
  };

  // ═══════════════════════════════════════════════════════════
  // 拦截 XMLHttpRequest
  // ═══════════════════════════════════════════════════════════

  const origXhrOpen = XMLHttpRequest.prototype.open;
  const origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__doubaoUrl = url;
    return origXhrOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const url = this.__doubaoUrl || '';
        // 过滤噪音 API
        if (isNoisyApi(url)) return;

        if (url.includes('doubao.com') || url.includes('samantha') || url.includes('volcengine')) {
          const json = JSON.parse(this.responseText);
          scanForVideoData(json, url);
        }
      } catch (e) { /* 非 JSON 或解析失败 */ }
    });
    return origXhrSend.apply(this, args);
  };

  // ═══════════════════════════════════════════════════════════
  // 扫描 API 响应中的视频数据
  // ═══════════════════════════════════════════════════════════

  function scanForVideoData(data, apiUrl) {
    if (!data || typeof data !== 'object') return;

    const jsonStr = JSON.stringify(data);

    // ─── 提取 video_id / item_id（仅从视频相关 API） ───
    // 注意：vid 字段太通用，abtest_config 也用 vid，必须配合 API URL 判断
    const isVideoApi = apiUrl.includes('samantha') ||
                       apiUrl.includes('video') ||
                       apiUrl.includes('creation') ||
                       apiUrl.includes('media') ||
                       apiUrl.includes('alice/') ||
                       apiUrl.includes('chat/') ||
                       apiUrl.includes('generate') ||
                       apiUrl.includes('/im/chain/');  // chat 页面视频数据来源

    const idPatterns = [
      { key: 'video_id', pattern: /"video_id"\s*:\s*"([^"]+)"/g },
      { key: 'item_id', pattern: /"item_id"\s*:\s*"([^"]+)"/g },
    ];

    // vid 只在视频 API 中提取，避免从 abtest_config 误取
    if (isVideoApi) {
      idPatterns.push({ key: 'vid', pattern: /"vid"\s*:\s*"([^"]+)"/g });
      idPatterns.push({ key: 'item_oid', pattern: /"item_oid"\s*:\s*"([^"]+)"/g });
      idPatterns.push({ key: 'object_id', pattern: /"object_id"\s*:\s*"([^"]+)"/g });
    }

    for (const { key, pattern } of idPatterns) {
      let match;
      while ((match = pattern.exec(jsonStr)) !== null) {
        const id = match[1];
        // video_id 通常较长（20+ 字符），短 ID 大概率是实验/配置 ID
        if (id && id.length >= 10) {
          postToContentScript('VIDEO_ID', { key, id, apiUrl: apiUrl.slice(0, 120) });
        }
      }
    }

    // ─── 提取无水印视频 URL ───
    const urlPatterns = [
      { key: 'original_url', pattern: /"original_url"\s*:\s*"([^"]+)"/g },
      { key: 'origin_video', pattern: /"origin_video"\s*:\s*"([^"]+)"/g },
      { key: 'download_url', pattern: /"download_url"\s*:\s*"([^"]+)"/g },
      { key: 'main_url', pattern: /"main_url"\s*:\s*"([^"]+)"/g },
      { key: 'play_addr_url', pattern: /"play_addr".*?"url_list"\s*:\s*\["([^"]+)"/g },
    ];

    for (const { key, pattern } of urlPatterns) {
      let match;
      while ((match = pattern.exec(jsonStr)) !== null) {
        const url = match[1];
        // 过滤掉明显带水印的 URL
        if (url && url.startsWith('http') && !url.includes('video_gen_watermark')) {
          postToContentScript('VIDEO_URL', { key, url, apiUrl: apiUrl.slice(0, 120) });
        }
      }
    }

    // ─── 检查 creation 相关数据（chat 页面 AI 生成内容） ───
    try {
      if (isVideoApi) {
        scanCreations(data, apiUrl);
      }
    } catch (e) {}
  }

  /**
   * 递归搜索 creation / video 相关嵌套结构
   */
  function scanCreations(obj, apiUrl, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 8 || !obj || typeof obj !== 'object') return;

    // 检查当前对象是否包含视频创建信息
    if (obj.video_id || obj.item_id || obj.object_id || obj.vid) {
      const id = obj.video_id || obj.item_id || obj.object_id || obj.vid;
      if (id && String(id).length >= 10) {
        const key = obj.video_id ? 'video_id' : obj.item_id ? 'item_id' : obj.vid ? 'vid' : 'object_id';
        postToContentScript('VIDEO_ID', { key, id: String(id), apiUrl: apiUrl.slice(0, 120) });
      }
    }

    // 检查是否有 creation_block
    if (obj.creations && Array.isArray(obj.creations)) {
      for (const creation of obj.creations) {
        if (creation.video) {
          const vid = creation.video.video_id || creation.video.item_id || creation.video.vid;
          if (vid && String(vid).length >= 10) {
            postToContentScript('VIDEO_ID', { key: 'creation_video_id', id: String(vid), apiUrl: apiUrl.slice(0, 120) });
          }
          // 发送 vid → download_url 映射，供多视频场景匹配用
          const downloadUrl = creation.video.download_url;
          if (vid && downloadUrl && String(vid).length >= 10) {
            postToContentScript('VIDEO_MAP', { vid: String(vid), downloadUrl, apiUrl: apiUrl.slice(0, 120) });
          }
          if (creation.video.play_addr?.url_list?.[0]) {
            const playUrl = creation.video.play_addr.url_list[0];
            if (!playUrl.includes('video_gen_watermark')) {
              postToContentScript('VIDEO_URL', { key: 'creation_play_addr', url: playUrl, apiUrl: apiUrl.slice(0, 120) });
            }
          }
        }
      }
    }

    // 递归搜索
    if (Array.isArray(obj)) {
      for (const item of obj) scanCreations(item, apiUrl, depth + 1);
    } else {
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') scanCreations(val, apiUrl, depth + 1);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 传递数据给 content script
  // ═══════════════════════════════════════════════════════════

  function postToContentScript(type, data) {
    window.postMessage({
      source: 'doubao-inject',
      type: type,
      data: data,
      timestamp: Date.now()
    }, '*');
  }

  console.log('[豆包去水印] 网络拦截已注入 v3（支持 /im/chain/ chat API）');
})();
