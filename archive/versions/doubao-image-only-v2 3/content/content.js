/**
 * 豆包图片去水印 - Content Script v4.1
 *
 * 不再使用弹出框，直接在豆包页面给图片添加「原图」下载按钮
 * 按钮使用 fixed 定位在图片右上角，跟随滚动
 */

(function() {
  'use strict';

  if (window.__imgDlInjected) return;
  window.__imgDlInjected = true;

  // 存储拦截到的图片 URL
  const imageUrlMap = new Map();
  const processedImages = new Map(); // img -> btn

  // ═══════════════════════════════════════════════════════════
  // 工具函数
  // ═══════════════════════════════════════════════════════════

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

    if (type === 'IMAGE_URL') {
      const url = data.url;
      if (url && !isUiIcon(url)) {
        // 用图片 hash 作为 key
        const hashMatch = url.match(/\/([a-f0-9]{32})\//);
        const key = hashMatch ? hashMatch[1] : url.split('/').pop()?.split('?')[0] || url;
        imageUrlMap.set(key, url);
      }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 下载功能
  // ═══════════════════════════════════════════════════════════

  function downloadUrl(url, prefix) {
    if (!url) {
      showNotif('⚠️ 未找到原图', 'warning');
      return;
    }
    let ext = 'jpg';
    if (url.includes('.png')) ext = 'png';
    else if (url.includes('.webp')) ext = 'webp';
    else if (url.includes('.gif')) ext = 'gif';

    chrome.runtime.sendMessage({
      action: 'download',
      url: url,
      filename: `${prefix}_${Date.now()}.${ext}`
    });
    showNotif('⬇️ 开始下载原图...', 'success');
  }

  // ═══════════════════════════════════════════════════════════
  // 图片下载按钮注入（fixed 定位在图片右上角）
  // ═══════════════════════════════════════════════════════════

  function addImgBtn(img) {
    if (processedImages.has(img)) return;

    const src = img.src || '';
    if (!src.startsWith('http')) return;
    if (isUiIcon(src)) return;
    // 过滤小图标
    if (img.width < 100 || img.height < 100) return;

    // 检查是否是目标图片
    const isTarget = src.includes('doubao') || src.includes('byteimg') ||
                     src.includes('vlabstatic') || src.includes('douyin') ||
                     src.includes('bytedance') || src.includes('flow-imagex') ||
                     src.includes('alicdn') || src.includes('aliyuncs') ||
                     src.includes('oss-cn');
    if (!isTarget) return;

    // 创建下载按钮
    const btn = document.createElement('div');
    btn.className = 'dw-img-btn';
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>原图</span>`;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // 尝试从拦截到的 URL 中获取无水印版本
      let bestUrl = src;
      for (const [key, url] of imageUrlMap) {
        if (src.includes(key) || url.includes(src.split('/').pop()?.split('?')[0] || '')) {
          bestUrl = url;
          break;
        }
      }

      downloadUrl(bestUrl, 'doubao_img');
    });

    document.body.appendChild(btn);
    processedImages.set(img, btn);

    // 更新按钮位置
    updateBtnPosition(img, btn);

    // 监听图片位置变化
    const resizeObs = new ResizeObserver(() => updateBtnPosition(img, btn));
    resizeObs.observe(img);

    // 监听滚动
    window.addEventListener('scroll', () => updateBtnPosition(img, btn), { passive: true });
  }

  function updateBtnPosition(img, btn) {
    if (!img.isConnected) {
      btn.remove();
      processedImages.delete(img);
      return;
    }
    const rect = img.getBoundingClientRect();
    btn.style.top = (rect.top + 8) + 'px';
    btn.style.left = (rect.right - btn.offsetWidth - 8) + 'px';
  }

  // ═══════════════════════════════════════════════════════════
  // 图片扫描
  // ═══════════════════════════════════════════════════════════

  function scanImages() {
    const imgs = document.querySelectorAll('img:not([data-dw-scan])');
    for (const img of imgs) {
      img.dataset.dw-scan = '1';
      addImgBtn(img);
    }
  }

  // 定期检查
  setInterval(scanImages, 2000);
  setTimeout(scanImages, 300);
  setTimeout(scanImages, 1000);
  setTimeout(scanImages, 3000);

  // MutationObserver 监听 DOM 变化
  const domObserver = new MutationObserver(() => scanImages());
  domObserver.observe(document.body, { childList: true, subtree: true });

  console.log('[豆包图片去水印] content.js v4.1 已加载');
})();
