/**
 * 图片去水印 - Content Script v3
 *
 * 支持：豆包 / 即梦 / 通义千问
 * 功能：给页面中 AI 生成的图片添加「原图下载」按钮
 *       给无水印视频（千问/即梦）添加「无水印下载」按钮
 *
 * v3 新增：
 *   - 接收 inject.js 传过来的 QWEN_VIDEO_URL 消息
 *   - 接收 JIMENG_VIDEO_URL 消息
 *   - 为视频元素添加「无水印下载」浮动按钮
 */

(function() {
  'use strict';

  if (window.__imgDlInjected) return;
  window.__imgDlInjected = true;

  // 存储拦截到的图片和视频 URL
  const jimengImages = [];   // { url, quality }
  const allImages = new Map();  // url → quality
  const qwenVideoUrls = [];
  const jimengVideoUrls = [];

  // ═══════════════════════════════════════════════════════════
  // 工具函数
  // ═══════════════════════════════════════════════════════════

  function isJimengPage() {
    const h = location.hostname;
    return h.includes('jimeng.jianying.com') || h.includes('dreamina.capcut.com');
  }

  function isQwenPage() {
    const h = location.hostname;
    return h.includes('qwen.cn') || h.includes('qwenhub.com');
  }

  function isUiIcon(url) {
    if (!url) return true;
    const u = url.toLowerCase();
    const kws = ['avatar','icon','logo','favicon','emoji','thumb_','_thumb',
      'small','tiny','mini','headimg','profile','face','portrait',
      'btn_','_btn','button','tab_','_tab','nav_','_nav','menu_','_menu','bg_','_bg'];
    for (const k of kws) if (u.includes(k)) return true;
    return /\.svg(\?|$|#)/i.test(u);
  }

  function showNotif(text, type) {
    let n = document.querySelector('.dw-notif');
    if (n) n.remove();
    n = document.createElement('div');
    n.className = `dw-notif dw-${type || 'info'}`;
    n.textContent = text;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('dw-show'), 10);
    setTimeout(() => {
      n.classList.remove('dw-show');
      setTimeout(() => n.remove(), 300);
    }, 2500);
  }

  // ═══════════════════════════════════════════════════════════
  // 接收 inject.js 消息
  // ═══════════════════════════════════════════════════════════

  window.addEventListener('message', (e) => {
    if (e.data?.source !== 'doubao-image-inject') return;
    const { type, data } = e.data;
    if (!data) return;

    switch (type) {
      case 'IMAGE_URL': {
        const url = data.url;
        if (url && !isUiIcon(url)) {
          const m = url.match(/^(https?:\/\/[^/]+\/[^/?]+)/);
          const key = m ? m[1] : url;
          allImages.set(key, url);
        }
        break;
      }

      case 'JIMENG_IMAGE_URL': {
        const { url, quality } = data;
        if (url && !isUiIcon(url) && !jimengImages.find(v => v.url === url)) {
          const entry = { url, quality: quality || 0 };
          const idx = jimengImages.findIndex(v => v.quality < entry.quality);
          if (idx === -1) jimengImages.push(entry);
          else jimengImages.splice(idx, 0, entry);
          if (jimengImages.length > 30) jimengImages.pop();
        }
        break;
      }

      case 'QWEN_VIDEO_URL': {
        const url = data.url;
        if (url && !qwenVideoUrls.includes(url)) {
          qwenVideoUrls.push(url);
        }
        break;
      }

      case 'JIMENG_VIDEO_URL': {
        const { url, quality } = data;
        if (url && !jimengVideoUrls.find(v => v.url === url)) {
          jimengVideoUrls.push({ url, quality: quality || 0 });
          jimengVideoUrls.sort((a, b) => b.quality - a.quality);
        }
        break;
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 下载功能
  // ═══════════════════════════════════════════════════════════

  function downloadUrl(url, prefix) {
    if (!url) {
      showNotif('⚠️ 未找到图片', 'warning');
      return;
    }
    let ext = 'jpg';
    if (url.includes('.png')) ext = 'png';
    else if (url.includes('.webp')) ext = 'webp';
    else if (url.includes('.gif')) ext = 'gif';
    else if (url.includes('.mp4')) ext = 'mp4';
    else if (url.includes('.mov')) ext = 'mov';

    chrome.runtime.sendMessage({
      action: 'download',
      url: url,
      filename: `${prefix}_${Date.now()}.${ext}`
    });
    showNotif('⬇️ 开始下载...', 'success');
  }

  // ═══════════════════════════════════════════════════════════
  // 图片下载按钮注入
  // ═══════════════════════════════════════════════════════════

  function addImgBtn(img) {
    if (img.__dwBtn) return;
    img.__dwBtn = true;

    function getBestUrl() {
      if (isJimengPage() && jimengImages.length > 0) {
        const src = img.src || '';
        const idMatch = src.match(/\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//i)
                     || src.match(/\/([a-f0-9]{16,})\//i);
        if (idMatch) {
          const found = jimengImages.find(v => v.url.includes(idMatch[1]));
          if (found) return found.url;
        }
        return jimengImages[0]?.url || img.src;
      }

      if (allImages.size > 0) {
        const src = img.src || '';
        for (const [key, url] of allImages) {
          if (src.includes(key) || url.includes(src.split('/').pop()?.split('?')[0] || '')) {
            return url;
          }
        }
      }
      return img.src;
    }

    const btn = document.createElement('div');
    btn.className = 'dw-img-btn';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>原图</span>`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = getBestUrl();
      downloadUrl(url, 'img');
    });

    const obs = new MutationObserver(() => {
      if (!img.isConnected) {
        btn.remove();
        obs.disconnect();
      }
    });
    if (img.parentElement) {
      obs.observe(img.parentElement, { childList: true, subtree: false });
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 视频下载按钮注入（千问/即梦页面）
  // ═══════════════════════════════════════════════════════════

  function addVideoBtn(video) {
    if (video.__dwVideoBtn) return;
    video.__dwVideoBtn = true;

    const btn = document.createElement('div');
    btn.className = 'dw-video-btn';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>无水印下载</span>`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      let videoUrl = '';
      if (isQwenPage() && qwenVideoUrls.length > 0) {
        videoUrl = qwenVideoUrls[0];
      } else if (isJimengPage() && jimengVideoUrls.length > 0) {
        videoUrl = jimengVideoUrls[0].url;
      } else if (video.src && video.src.startsWith('http')) {
        videoUrl = video.src;
      }

      if (videoUrl) {
        downloadUrl(videoUrl, 'video');
      } else {
        showNotif('⚠️ 未找到无水印视频', 'warning');
      }
    });

    document.body.appendChild(btn);
  }

  // ═══════════════════════════════════════════════════════════
  // 图片/视频扫描
  // ═══════════════════════════════════════════════════════════

  function isTargetMedia(el) {
    const src = el.src || el.poster || '';
    if (!src.startsWith('http')) return false;

    if (isJimengPage()) {
      return (src.includes('byteimg') || src.includes('vlabstatic') ||
              src.includes('douyin') || src.includes('bytedance') ||
              src.includes('capcut') || src.includes('dreamina-sign') ||
              src.includes('flow-imagex')) && !isUiIcon(src);
    }

    if (isQwenPage()) {
      return /\.(jpg|jpeg|webp|mp4|mov)(\?|$|#)/i.test(src) &&
             !isUiIcon(src) && !src.includes('qwen.cn/favicon');
    }

    return (src.includes('doubao') || src.includes('byteimg') ||
            src.includes('vlabstatic') || src.includes('douyin') ||
            src.includes('bytedance')) && !isUiIcon(src);
  }

  function isTargetVideo(video) {
    if (!video || !video.src) return false;
    if (video.offsetWidth < 200 || video.offsetHeight < 200) return false;
    const src = video.src || '';
    const poster = video.poster || '';

    if (isQwenPage()) {
      return /\.mp4(\?|$|#)/i.test(src) || /\.mp4(\?|$|#)/i.test(poster) ||
             src.includes('aliyuncs') || src.includes('oss-cn');
    }

    if (isJimengPage()) {
      return /\.mp4(\?|$|#)/i.test(src) || /\.mp4(\?|$|#)/i.test(poster) ||
             src.includes('vlabvod') || src.includes('byteimg');
    }

    return false;
  }

  function scanAll() {
    // 扫描图片
    const imgs = document.querySelectorAll('img:not([data-dw-scan])');
    for (const img of imgs) {
      img.dataset.dw-scan = '1';
      if (isTargetMedia(img)) {
        addImgBtn(img);
      }
    }

    // 扫描视频
    const videos = document.querySelectorAll('video:not([data-dw-video-scan])');
    for (const video of videos) {
      video.dataset.dwVideoScan = '1';
      if (isTargetVideo(video)) {
        addVideoBtn(video);
      }
    }
  }

  // 定期检查
  setInterval(scanAll, 3000);
  setTimeout(scanAll, 500);
  setTimeout(scanAll, 2000);
  setTimeout(scanAll, 5000);

  // MutationObserver 监听 DOM 变化
  const domObserver = new MutationObserver(() => scanAll());
  domObserver.observe(document.body, { childList: true, subtree: true });

  console.log('[豆包图片去水印] content.js v3 已加载');
})();
