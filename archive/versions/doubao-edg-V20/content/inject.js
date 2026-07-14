/**
 * 豆包去水印 - Page Context Injection (MAIN world) v5
 *
 * 运行在页面上下文中，可以访问页面的 fetch / XMLHttpRequest
 * 支持平台：豆包 / 即梦(Dreamina) / 通义千问
 *
 * v23 新增（vid → poster 精确匹配）：
 * - scanCreations 拦截 creation.video.cover.url / poster_url / cover_image.url 等
 * - 发送 VIDEO_COVER_MAP 消息给 content script
 * - 用于 chat 页面多视频场景的精确关联（video.poster ↔ coverUrl）
 *
 * v5 新增（即梦支持）：
 * - 拦截 jianying.com / capcut.com 域名下的 API 请求
 * - 扫描 byteimg.com / vlabvod.com / vlabstatic.com 等 CDN URL
 * - 支持 get_user_local_item_list、item_list、video_info、image_info 等 API
 * - 图片质量筛选：过滤低于 1080px 的 UI 图标
 *
 * v4 保留：
 * - 拦截图片数据：scanForImageData 提取 image_ori_raw / image_ori / url 等字段
 * - 发送 IMAGE_URL 消息给 content script
 * - 豆包视频 vid → get_play_info API
 */

(function () {
  'use strict';

  // 避免重复注入
  if (window.__doubaoInjectLoaded) return;
  window.__doubaoInjectLoaded = true;

  // ═══════════════════════════════════════════════════════════
  // 配置
  // ═══════════════════════════════════════════════════════════

  // 噪音 API 过滤
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

  // CDN 域名白名单（即梦/剪映资源）
  const CDN_PATTERNS = [
    'byteimg.com',
    'vlabstatic.com',
    'vlabvod.com',
    'douyin.com',
    'byted-static.net',
    'pstatp.com',
    'ixigua.com',
    'ibytedtos.com',
    'lf3-capsule.vlabstatic.com',
    'lf6-capsule.vlabstatic.com',
  ];

  // ═══════════════════════════════════════════════════════════
  // 工具函数
  // ═══════════════════════════════════════════════════════════

  function isNoisyApi(url) {
    if (!url) return true;
    for (const pattern of NOISY_API_PATTERNS) {
      if (url.includes(pattern)) return true;
    }
    return false;
  }

  function isCDNUrl(url) {
    if (!url || typeof url !== 'string') return false;
    // 排除非资源域名
    const skipDomains = ['google.com', 'facebook.com', 'twitter.com', 'baidu.com',
      'amazonaws.com', 'youtube.com', 'vimeo.com', 'github.com', 'qq.com', 'weixin.qq.com'];
    for (const d of skipDomains) {
      if (url.includes(d)) return false;
    }
    // CDN 域名匹配
    for (const p of CDN_PATTERNS) {
      if (url.includes(p)) return true;
    }
    // 媒体路径关键词
    if (/\/(obj|video|image|img|media|asset|tos-cn|thumb|bucket|cover|preview)\//i.test(url)) return true;
    // 字节特有后缀
    if (url.includes('~tplv') || url.includes('~cbpeditor')) return true;
    // CDN 签名参数
    if (/\?.*(?:lk3s|x-expires|x-signature|a_bogus)/.test(url)) return true;
    return false;
  }

  function isVideoUrl(url) {
    if (!url) return false;
    if (/\.(mp4|webm|mov)(\?|$|#)/i.test(url)) return true;
    if (/mime_type=video_(mp4|webm|mov)/i.test(url)) return true;
    if (/\/video\/tos\//i.test(url)) return true;
    if (/\/obj\/(video|videodb|bytedance)/i.test(url)) return true;
    return false;
  }

  function getImageQuality(url) {
    if (!url) return 0;
    if (url.includes('aigc_resize:0:0')) return 9999;
    if (url.includes('aigc_resize_loss')) return 100;
    if (url.includes('aigc_smart_crop')) return 50;
    if (/_2048\./.test(url)) return 2048;
    if (/_1920\./.test(url)) return 1920;
    if (/_1080\./.test(url)) return 1080;
    if (/_900\./.test(url)) return 900;
    if (/_720\./.test(url)) return 720;
    const m = url.match(/resize:(\d+):(\d+)/);
    if (m) return Math.max(parseInt(m[1]), parseInt(m[2]));
    return 100;
  }

  function isJimengDomain(url) {
    if (!url) return false;
    return url.includes('jianying.com') || url.includes('capcut.com');
  }

  function isInterestingJimengRequest(url) {
    if (!url) return false;
    // jianying.com / capcut.com：拦截所有跨域请求
    const u = new URL(url, location.href);
    const host = u.hostname;
    const isCapcut = host.includes('capcut.com') || host.includes('bytedance.com');
    if (isCapcut) return true;
    // jianying.com：必须在特定路径
    if (host.includes('jianying.com')) {
      return /\/(mweb|api|v1)\//.test(url);
    }
    return false;
  }

  function postToContentScript(type, data) {
    window.postMessage({
      source: 'doubao-inject',
      type: type,
      data: data,
      timestamp: Date.now()
    }, '*');
  }

  // ═══════════════════════════════════════════════════════════
  // 拦截 fetch
  // ═══════════════════════════════════════════════════════════

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');

      if (isNoisyApi(url)) return response;

      // 豆包平台
      if (url.includes('doubao.com') || url.includes('samantha') || url.includes('volcengine')) {
        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            scanForVideoData(data, url);
          } catch (e) { /* 非 JSON */ }
        }).catch(() => {});
      }

      // 即梦 / Dreamina 平台
      if (isJimengDomain(url) && isInterestingJimengRequest(url)) {
        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            scanForJimengData(data, url);
          } catch (e) { /* 非 JSON */ }
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
        if (isNoisyApi(url)) return;

        // 豆包平台
        if (url.includes('doubao.com') || url.includes('samantha') || url.includes('volcengine')) {
          const json = JSON.parse(this.responseText);
          scanForVideoData(json, url);
        }

        // 即梦 / Dreamina 平台
        if (isJimengDomain(url) && isInterestingJimengRequest(url)) {
          const json = JSON.parse(this.responseText);
          scanForJimengData(json, url);
        }
      } catch (e) { /* 非 JSON 或解析失败 */ }
    });
    return origXhrSend.apply(this, args);
  };

  // ═══════════════════════════════════════════════════════════
  // 扫描豆包视频数据（原 v4 逻辑）
  // ═══════════════════════════════════════════════════════════

  function scanForVideoData(data, apiUrl) {
    if (!data || typeof data !== 'object') return;

    const jsonStr = JSON.stringify(data);

    const isVideoApi = apiUrl.includes('samantha') ||
                       apiUrl.includes('video') ||
                       apiUrl.includes('creation') ||
                       apiUrl.includes('media') ||
                       apiUrl.includes('alice/') ||
                       apiUrl.includes('chat/') ||
                       apiUrl.includes('generate') ||
                       apiUrl.includes('/im/chain/');

    const idPatterns = [
      { key: 'video_id', pattern: /"video_id"\s*:\s*"([^"]+)"/g },
      { key: 'item_id', pattern: /"item_id"\s*:\s*"([^"]+)"/g },
    ];

    if (isVideoApi) {
      idPatterns.push({ key: 'vid', pattern: /"vid"\s*:\s*"([^"]+)"/g });
      idPatterns.push({ key: 'item_oid', pattern: /"item_oid"\s*:\s*"([^"]+)"/g });
      idPatterns.push({ key: 'object_id', pattern: /"object_id"\s*:\s*"([^"]+)"/g });
    }

    for (const { key, pattern } of idPatterns) {
      let match;
      while ((match = pattern.exec(jsonStr)) !== null) {
        const id = match[1];
        if (id && id.length >= 10) {
          postToContentScript('VIDEO_ID', { key, id, apiUrl: apiUrl.slice(0, 120) });
        }
      }
    }

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
        if (url && url.startsWith('http') && !url.includes('video_gen_watermark')) {
          postToContentScript('VIDEO_URL', { key, url, apiUrl: apiUrl.slice(0, 120) });
        }
      }
    }

    try { scanForImageData(data, apiUrl); } catch (e) {}
    try { if (isVideoApi) scanCreations(data, apiUrl); } catch (e) {}
  }

  // ═══════════════════════════════════════════════════════════
  // 扫描豆包图片数据（原 v4 逻辑）
  // ═══════════════════════════════════════════════════════════

  // v13: 判断图片URL是否为UI图标（头像/logo/图标等）
  function isUiIconUrl(url) {
    if (!url || typeof url !== 'string') return true;
    const u = url.toLowerCase();
    // 明确排除的UI图标关键词
    const iconKeywords = [
      'avatar', 'icon', 'logo', 'favicon', 'badge', 'sticker',
      'emoji', 'thumb_', '_thumb', 'small', 'tiny', 'mini',
      'headimg', 'profile', 'face', 'portrait',
      'btn_', '_btn', 'button', 'tab_', '_tab',
      'nav_', '_nav', 'menu_', '_menu',
      'bg_', '_bg', 'background_small',
    ];
    for (const kw of iconKeywords) {
      if (u.includes(kw)) return true;
    }
    // 排除尺寸明显偏小的图片URL（URL中含明确小尺寸参数）
    if (/_\d{1,2}\.(jpg|png|webp)/i.test(u)) return true;  // 如 _48.jpg _64.png
    if (/resize:\d{1,3}:\d{1,3}/.test(u) && u.includes('resize:')) {
      const m = u.match(/resize:(\d+):/);
      if (m && parseInt(m[1]) < 200) return true;
    }
    return false;
  }

  function scanForImageData(obj, apiUrl, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 10 || !obj || typeof obj !== 'object') return;

    if (obj.creations && Array.isArray(obj.creations)) {
      for (const creation of obj.creations) {
        if (creation.image) {
          const imgObj = creation.image;
          const rawUrl = imgObj.image_ori_raw?.url || imgObj.image_ori?.url || imgObj.image_url || '';
          if (rawUrl && rawUrl.startsWith('http') && !isUiIconUrl(rawUrl)) {
            const cleanUrl = rawUrl.replace(/&amp;/g, '&');
            postToContentScript('IMAGE_URL', { url: cleanUrl, apiUrl: apiUrl.slice(0, 120) });
          }
        }
      }
    }

    if (obj.image && typeof obj.image === 'object') {
      const imgObj = obj.image;
      const rawUrl = imgObj.image_ori_raw?.url || imgObj.image_ori?.url || imgObj.image_url || '';
      if (rawUrl && rawUrl.startsWith('http') && !isUiIconUrl(rawUrl)) {
        const cleanUrl = rawUrl.replace(/&amp;/g, '&');
        postToContentScript('IMAGE_URL', { url: cleanUrl, apiUrl: apiUrl.slice(0, 120) });
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) scanForImageData(item, apiUrl, depth + 1);
    } else {
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') scanForImageData(val, apiUrl, depth + 1);
      }
    }
  }

  function scanCreations(obj, apiUrl, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 8 || !obj || typeof obj !== 'object') return;

    if (obj.video_id || obj.item_id || obj.object_id || obj.vid) {
      const id = obj.video_id || obj.item_id || obj.object_id || obj.vid;
      if (id && String(id).length >= 10) {
        const key = obj.video_id ? 'video_id' : obj.item_id ? 'item_id' : obj.vid ? 'vid' : 'object_id';
        postToContentScript('VIDEO_ID', { key, id: String(id), apiUrl: apiUrl.slice(0, 120) });
      }
    }

    if (obj.creations && Array.isArray(obj.creations)) {
      for (const creation of obj.creations) {
        if (creation.video) {
          const vid = creation.video.video_id || creation.video.item_id || creation.video.vid;
          if (vid && String(vid).length >= 10) {
            postToContentScript('VIDEO_ID', { key: 'creation_video_id', id: String(vid), apiUrl: apiUrl.slice(0, 120) });
          }
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
          // v23: 拦截 cover/poster URL，用于 vid → video 元素精确匹配
          const coverUrl = creation.video.cover?.url ||
                           creation.video.poster_url ||
                           creation.video.cover_image?.url ||
                           creation.video.thumbnail?.url ||
                           creation.video.cover?.origin_url?.url ||
                           '';
          if (vid && coverUrl && String(vid).length >= 10) {
            postToContentScript('VIDEO_COVER_MAP', { vid: String(vid), coverUrl, apiUrl: apiUrl.slice(0, 120) });
          }
        }
      }
    }

    if (Array.isArray(obj)) {
      for (const item of obj) scanCreations(item, apiUrl, depth + 1);
    } else {
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') scanCreations(val, apiUrl, depth + 1);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 扫描即梦 / Dreamina 数据（v5 新增）
  // ═══════════════════════════════════════════════════════════

  /**
   * v29: 拦截 HTMLMediaElement.src 赋值
   * 浏览器在播放 video 前会设置 src（可能在转 blob 之前先设 CDN URL）
   * 我们捕获这个 CDN URL 来精确关联 vid → video 元素
   */
  (function interceptVideoSrc() {
    const origSrcDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src');
    if (!origSrcDesc || !origSrcDesc.set) {
      console.log('[豆包去水印] 无法拦截 HTMLMediaElement.src');
      return;
    }

    const origSrcSet = origSrcDesc.set;
    const origSrcGet = origSrcDesc.get;

    Object.defineProperty(HTMLMediaElement.prototype, 'src', {
      get: origSrcGet,
      set: function(value) {
        const url = String(value || '');
        // 只关心包含已知 CDN 域名的视频 URL
        const isVideoCDN = /douyinvod\.com|vlabvod\.com|bytedance\.com|byteimg\.com|douyinpic\.com/i.test(url);
        const isMp4 = /\.(mp4|webm|mov)(\?|$|#)/i.test(url) || /mime_type=video/i.test(url);

        if (url && (isVideoCDN || isMp4)) {
          // 从 URL 提取 vid
          const vidMatch = url.match(/[\/](v[0-9a-z]{16,})/);
          if (vidMatch) {
            const vid = vidMatch[1];
            // 存储到元素自身
            this.__doubaoCdnVid = vid;
            this.__doubaoCdnUrl = url;
            // v30: 直接设置 data-doubao-vid（从 MAIN world 操作，content script 立即可见）
            try { this.dataset.doubaoVid = vid; } catch (e) {}
            console.log(`[豆包去水印] video.src 拦截: ${vid} → ${url.slice(0, 100)}`);
            postToContentScript('VIDEO_SRC_VID', {
              vid,
              cdnUrl: url,
              timestamp: Date.now()
            });
          }
        }
        return origSrcSet.call(this, value);
      },
      configurable: true
    });

    // 也拦截 currentSrc（虽然通常是只读的，但保险起见）
    console.log('[豆包去水印] HTMLMediaElement.src 拦截已安装');
  })();

  /**
   * 递归扫描即梦 API 响应中的 CDN 资源 URL
   */
  function scanForJimengData(obj, apiUrl, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 15 || !obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) scanForJimengData(item, apiUrl, depth + 1);
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      // 跳过超长文本字段
      if (typeof value === 'string' && value.length > 20000) continue;

      if (typeof value === 'string' && isCDNUrl(value)) {
        handleJimengUrl(value, key, apiUrl);
      } else if (typeof value === 'object' && value !== null) {
        scanForJimengData(value, apiUrl, depth + 1);
      }
    }
  }

  /**
   * 处理发现的 CDN URL，区分图片/视频并做质量筛选
   */
  function handleJimengUrl(url, key, apiUrl) {
    if (!url || !url.startsWith('http')) return;

    const cleanUrl = url.replace(/&amp;/g, '&');

    if (isVideoUrl(cleanUrl)) {
      postToContentScript('JIMENG_VIDEO_URL', {
        url: cleanUrl,
        key: key,
        apiUrl: apiUrl.slice(0, 120)
      });
    } else {
      // 图片质量筛选：过滤低于 720px 的 UI 图标
      const quality = getImageQuality(cleanUrl);
      if (quality >= 720) {
        postToContentScript('JIMENG_IMAGE_URL', {
          url: cleanUrl,
          key: key,
          quality: quality,
          apiUrl: apiUrl.slice(0, 120)
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 初始化日志
  // ═══════════════════════════════════════════════════════════

  const platform = location.hostname.includes('jimeng') || location.hostname.includes('dreamina') || location.hostname.includes('jianying')
    ? '即梦/Dreamina'
    : location.hostname.includes('qwen') ? '通义千问' : '豆包';

  console.log(`[豆包去水印] 网络拦截已注入 v5（${platform}支持）`);
})();
