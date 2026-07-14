/**
 * 豆包图片去水印 - Page Context Injection (MAIN world) v3
 *
 * 运行在页面上下文中，可以访问页面的 fetch / XMLHttpRequest / DOM
 * 支持平台：豆包 / 即梦(Dreamina) / 通义千问
 *
 * v3 新增：
 *   - 千问：__NEXT_DATA__ SSR JSON 深度遍历提取（递归20层）
 *   - 千问：正则回退（alicdn/aliyuncs/oss-cn 阿里云CDN域名）
 *   - 即梦：get_item_info API 拦截 + 视频清晰度降级链
 *   - 即梦：HTML SSR 提取（vlabvod.com / byteimg.com CDN）
 *   - 即梦：短链重定向解析
 */

(function () {
  'use strict';

  if (window.__doubaoImageInjectLoaded) return;
  window.__doubaoImageInjectLoaded = true;

  // CDN 域名白名单
  const CDN_PATTERNS = [
    'byteimg.com', 'vlabstatic.com', 'byted-static.net', 'pstatp.com',
    'ixigua.com', 'ibytedtos.com', 'lf3-capsule.vlabstatic.com',
    'lf6-capsule.vlabstatic.com', 'douyin.com',
  ];

  // 阿里云 CDN 域名（千问）
  const ALIYUN_CDN = ['alicdn.com', 'aliyuncs.com', 'oss-cn-', 'wanx.aliyuncs.com', 'dashscope.oss-cn-'];

  function isCDNUrl(url) {
    if (!url || typeof url !== 'string') return false;
    for (const p of CDN_PATTERNS) {
      if (url.includes(p)) return true;
    }
    if (/\/(obj|image|img|media|asset|tos-cn|thumb|bucket|cover|preview)\//i.test(url)) return true;
    if (url.includes('~tplv') || url.includes('~cbpeditor')) return true;
    if (/\?.*(?:lk3s|x-expires|x-signature|a_bogus)/.test(url)) return true;
    return false;
  }

  function isAliyunCDN(url) {
    if (!url || typeof url !== 'string') return false;
    for (const p of ALIYUN_CDN) {
      if (url.includes(p)) return true;
    }
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

  function isUiIconUrl(url) {
    if (!url || typeof url !== 'string') return true;
    const u = url.toLowerCase();
    const kws = ['avatar', 'icon', 'logo', 'favicon', 'emoji', 'thumb_', '_thumb',
      'small', 'tiny', 'mini', 'headimg', 'profile', 'face', 'portrait',
      'btn_', '_btn', 'button', 'tab_', '_tab', 'nav_', '_nav', 'menu_', '_menu', 'bg_', '_bg'];
    for (const kw of kws) {
      if (u.includes(kw)) return true;
    }
    if (/\.(svg)(\?|$|#)/i.test(u)) return true;
    return false;
  }

  function isVideoUrl(url) {
    return /\.(mp4|mov|webm|avi)(\?|$|#)/i.test(url || '');
  }

  function isImageUrl(url) {
    return /\.(jpg|jpeg|png|webp|gif)(\?|$|#)/i.test(url || '');
  }

  function postToContentScript(type, data) {
    window.postMessage({
      source: 'doubao-image-inject',
      type: type,
      data: data,
      timestamp: Date.now()
    }, '*');
  }

  // ═══════════════════════════════════════════════════════════
  // 深度遍历提取器（用于 __NEXT_DATA__ SSR JSON）
  // ═══════════════════════════════════════════════════════════

  function traverseExtract(obj, images, videoCallback, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 20 || !obj) return;

    if (typeof obj === 'string') {
      // 提取图片 URL
      const imgPattern = /https?:\/\/[^"'\s<>]*\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\s<>]*)?/gi;
      let match;
      while ((match = imgPattern.exec(obj)) !== null) {
        const url = match[0];
        if (!isUiIconUrl(url) && (isAliyunCDN(url) || isCDNUrl(url))) {
          images.push(url);
        }
      }
      // 提取视频 URL
      const videoPattern = /https?:\/\/[^"'\s<>]*\.(?:mp4|mov|avi|webm)(?:\?[^"'\s<>]*)?/gi;
      while ((match = videoPattern.exec(obj)) !== null) {
        if (videoCallback) videoCallback(match[0]);
      }
      return;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        traverseExtract(item, images, videoCallback, depth + 1);
      }
    } else if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        traverseExtract(obj[key], images, videoCallback, depth + 1);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 千问 __NEXT_DATA__ 提取
  // ═══════════════════════════════════════════════════════════

  function extractQwenNextData() {
    const scripts = document.querySelectorAll('script[id="__NEXT_DATA__"]');
    for (const script of scripts) {
      try {
        const nextData = JSON.parse(script.textContent);
        const pageProps = nextData.props?.pageProps || {};
        const images = [];
        let videoUrl = '';

        traverseExtract(pageProps, images, (url) => { videoUrl = url; });

        // 去重
        const uniqueImages = [...new Set(images)];

        if (videoUrl) {
          postToContentScript('QWEN_VIDEO_URL', { url: videoUrl });
        }
        if (uniqueImages.length > 0) {
          for (const url of uniqueImages) {
            postToContentScript('IMAGE_URL', { url, quality: 100 });
          }
        }
      } catch (e) {}
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 千问 HTML 正则回退提取
  // ═══════════════════════════════════════════════════════════

  function extractQwenHtmlFallback() {
    const html = document.documentElement.innerHTML;
    const images = [];

    // 方式1: JSON 字段匹配
    const jsonImgPattern = /"(?:original_url|url|image_url|src)"\s*:\s*"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi;
    let match;
    while ((match = jsonImgPattern.exec(html)) !== null) {
      const url = match[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
      if (isAliyunCDN(url) && !isUiIconUrl(url)) {
        images.push(url);
      }
    }

    // 方式2: 阿里云 CDN 域名直接匹配
    const cdnPattern = /(https?:\/\/[^"'\s<>]*(?:alicdn|aliyuncs|oss-cn|wanx)[^"'\s<>]*\.(?:jpg|jpeg|png|webp))/gi;
    while ((match = cdnPattern.exec(html)) !== null) {
      const url = match[1].replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
      if (!isUiIconUrl(url)) {
        images.push(url);
      }
    }

    // 去重并发送
    const uniqueImages = [...new Set(images)];
    for (const url of uniqueImages) {
      postToContentScript('IMAGE_URL', { url, quality: 100 });
    }

    // 视频提取
    const videoMatch = html.match(/"(?:video_url|videoSrc|src)"\s*:\s*"(https?:\/\/[^"]+\.(?:mp4|mov|webm))"/i);
    if (videoMatch) {
      postToContentScript('QWEN_VIDEO_URL', { url: videoMatch[1].replace(/&amp;/g, '&') });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 即梦 HTML SSR 提取
  // ═══════════════════════════════════════════════════════════

  function extractJimengFromHtml(html) {
    const images = [];

    // 策略1: vlabvod.com CDN（即梦视频专用）
    const vlabvodPattern = /(["'\s])(https?:\/\/[^"'\s<>]*?vlabvod\.com\/[^"'\s<>]*?)(["'\s<>])/gi;
    let match;
    while ((match = vlabvodPattern.exec(html)) !== null) {
      const url = match[2].replace(/&amp;/g, '&');
      if (isVideoUrl(url)) {
        postToContentScript('JIMENG_VIDEO_URL', { url, quality: 9999 });
      }
    }

    // 策略2: JSON 中的 image_url 字段（32位hex 哈希过滤）
    const imageUrlPattern = /"image_url"\s*:\s*"(https?:\/\/[^"]+)"/gi;
    while ((match = imageUrlPattern.exec(html)) !== null) {
      const url = match[1].replace(/&amp;/g, '&');
      if (isImageUrl(url) && !isUiIconUrl(url)) {
        // 过滤：只保留含 32位hex 哈希的内容图片
        const hashMatch = url.match(/\/([a-f0-9]{32})\//i);
        if (hashMatch) {
          const quality = getImageQuality(url);
          postToContentScript('JIMENG_IMAGE_URL', { url, quality });
        }
      }
    }

    // 策略3: dreamina-sign / byteimg / flow-imagex CDN
    const cdnImgPattern = /(https?:\/\/[^"'\s<>]*(?:dreamina-sign|byteimg|flow-imagex|vlabstatic)[^"'\s<>]*\.(?:jpg|jpeg|png|webp))/gi;
    while ((match = cdnImgPattern.exec(html)) !== null) {
      const url = match[1].replace(/&amp;/g, '&');
      if (isImageUrl(url) && !isUiIconUrl(url)) {
        const quality = getImageQuality(url);
        postToContentScript('JIMENG_IMAGE_URL', { url, quality });
      }
    }

    // 策略4: __NEXT_DATA__ SSR 数据兜底
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const ssrImages = [];
        traverseExtract(nextData, ssrImages, (url) => {
          postToContentScript('JIMENG_VIDEO_URL', { url, quality: 9999 });
        });
        for (const url of ssrImages) {
          if (isImageUrl(url) && !isUiIconUrl(url)) {
            postToContentScript('JIMENG_IMAGE_URL', { url, quality: getImageQuality(url) });
          }
        }
      } catch (e) {}
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 即梦 get_item_info API 解析
  // ═══════════════════════════════════════════════════════════

  function parseJimengItemInfo(data) {
    const d = data?.data || data;
    if (!d) return;

    // 提取视频（清晰度降级：origin > 720p > 480p > 360p）
    if (d.video) {
      const tv = d.video.transcoded_video || {};
      const qualityChain = ['origin', '720p', '480p', '360p'];
      for (const quality of qualityChain) {
        const entry = tv[quality];
        if (entry && entry.video_url) {
          postToContentScript('JIMENG_VIDEO_URL', {
            url: entry.video_url,
            quality: quality === 'origin' ? 9999 : parseInt(quality)
          });
          break;
        }
      }
      // 兜底：原始上传视频源
      if (d.video.origin_video?.video_url) {
        postToContentScript('JIMENG_VIDEO_URL', {
          url: d.video.origin_video.video_url,
          quality: 100
        });
      }
    }

    // 提取图片（large_images 原图）
    if (d.image) {
      const imgs = d.image.large_images || d.image.images || [];
      for (const img of imgs) {
        const url = img.image_url || img.url;
        if (url && isImageUrl(url) && !isUiIconUrl(url)) {
          postToContentScript('JIMENG_IMAGE_URL', {
            url,
            quality: getImageQuality(url)
          });
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 拦截 fetch
  // ═══════════════════════════════════════════════════════════

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await origFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');

      // 豆包平台
      if (url.includes('doubao.com') || url.includes('samantha') || url.includes('volcengine')) {
        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            scanDoubaoImage(data, url);
          } catch (e) {}
        }).catch(() => {});
      }

      // 即梦 / Dreamina / 剪映
      if (url.includes('jianying.com') || url.includes('capcut.com') || url.includes('dreamina')) {
        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            // 即梦 get_item_info API
            if (url.includes('get_item_info') || url.includes('mweb/v1')) {
              parseJimengItemInfo(data);
            } else {
              scanJimengImage(data, url);
            }
          } catch (e) {}
        }).catch(() => {});
      }

      // 通义千问
      if (url.includes('qwen.cn') || url.includes('qwenhub.com')) {
        const cloned = response.clone();
        cloned.text().then(text => {
          try {
            const data = JSON.parse(text);
            scanQwenImage(data, url);
          } catch (e) {}
        }).catch(() => {});
      }
    } catch (e) {}

    return response;
  };

  // 拦截 XHR
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

        if (url.includes('doubao.com') || url.includes('samantha') || url.includes('volcengine')) {
          const json = JSON.parse(this.responseText);
          scanDoubaoImage(json, url);
        }

        if (url.includes('jianying.com') || url.includes('capcut.com') || url.includes('dreamina')) {
          const json = JSON.parse(this.responseText);
          if (url.includes('get_item_info') || url.includes('mweb/v1')) {
            parseJimengItemInfo(json);
          } else {
            scanJimengImage(json, url);
          }
        }

        if (url.includes('qwen.cn') || url.includes('qwenhub.com')) {
          const json = JSON.parse(this.responseText);
          scanQwenImage(json, url);
        }
      } catch (e) {}
    });
    return origXhrSend.apply(this, args);
  };

  // ═══════════════════════════════════════════════════════════
  // 平台特定扫描函数
  // ═══════════════════════════════════════════════════════════

  function scanDoubaoImage(obj, apiUrl, depth) {
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
      for (const item of obj) scanDoubaoImage(item, apiUrl, depth + 1);
    } else {
      for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') scanDoubaoImage(val, apiUrl, depth + 1);
      }
    }
  }

  function scanJimengImage(obj, apiUrl, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 15 || !obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) scanJimengImage(item, apiUrl, depth + 1);
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.length > 20000) continue;

      if (typeof value === 'string' && isCDNUrl(value)) {
        const cleanUrl = value.replace(/&amp;/g, '&');
        if (isImageUrl(cleanUrl)) {
          const quality = getImageQuality(cleanUrl);
          if (quality >= 720) {
            postToContentScript('JIMENG_IMAGE_URL', {
              url: cleanUrl, key, quality, apiUrl: apiUrl.slice(0, 120)
            });
          }
        }
      } else if (typeof value === 'object' && value !== null) {
        scanJimengImage(value, apiUrl, depth + 1);
      }
    }
  }

  function scanQwenImage(obj, apiUrl, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 10 || !obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
      for (const item of obj) scanQwenImage(item, apiUrl, depth + 1);
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('http') && isImageUrl(value) && !isUiIconUrl(value)) {
        postToContentScript('IMAGE_URL', { url: value, apiUrl: apiUrl.slice(0, 120) });
      } else if (typeof value === 'object' && value !== null) {
        scanQwenImage(value, apiUrl, depth + 1);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 页面加载完成后提取 SSR 数据
  // ═══════════════════════════════════════════════════════════

  function onPageReady() {
    const hostname = location.hostname;

    // 千问页面：提取 __NEXT_DATA__
    if (hostname.includes('qwen.cn') || hostname.includes('qwenhub.com')) {
      extractQwenNextData();
      // 延迟回退提取
      setTimeout(() => extractQwenHtmlFallback(), 2000);
    }

    // 即梦页面：提取 HTML SSR 数据
    if (hostname.includes('jimeng.jianying.com') || hostname.includes('dreamina.capcut.com')) {
      const html = document.documentElement.innerHTML;
      extractJimengFromHtml(html);
    }
  }

  // 监听页面加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onPageReady);
  } else {
    onPageReady();
  }

  // 延迟再执行一次（SPA 异步渲染）
  setTimeout(onPageReady, 3000);
  setTimeout(onPageReady, 6000);

  console.log('[豆包图片去水印] v3 已注入 - 支持豆包/即梦/通义千问');
})();
