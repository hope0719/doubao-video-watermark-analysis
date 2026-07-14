/**
 * 豆包图片去水印 - Content Script v4.2
 *
 * 直接在豆包页面给 AI 图片添加「原图」下载按钮
 * 按钮：绿色渐变，fixed 定位在图片右下角
 *
 * 参考 v1.9.0 的成功经验：
 * - 用 rc_gen_image/{32位hex} 精确识别 AI 生成图片
 * - 按钮固定在图片右下角（避免和右上角原生按钮冲突）
 * - fixed 定位 + 滚动/resize 监听更新位置
 * - 拦截 mousedown/pointerdown 防止穿透到原生 UI
 */

(function() {
  'use strict';

  if (window.__imgDlInjected) return;
  window.__imgDlInjected = true;

  // ═══════════════════════════════════════════════════════════
  // 状态
  // ═══════════════════════════════════════════════════════════

  // 拦截到的无水印图片 URL（最新在前）
  const capturedImageUrls = [];
  // img 元素 → 覆盖按钮元素
  const imageDownloadBtns = new Map();
  // 正在下载中的 URL（防重复）
  const downloadingUrls = new Set();

  // ═══════════════════════════════════════════════════════════
  // 工具函数
  // ═════════════════════════════════════════════════════════════

  function isOwnElement(el) {
    if (!el) return false;
    if (el.classList?.contains('dw-img-btn')) return true;
    if (el.getAttribute?.('data-doubao-own') === 'true') return true;
    if (el.closest?.('.dw-img-btn')) return true;
    return false;
  }

  function isUiIconUrl(url) {
    if (!url) return true;
    const u = url.toLowerCase();
    const kws = ['avatar','icon','logo','favicon','emoji','thumb_','_thumb',
      'small','tiny','mini','headimg','profile','face','portrait',
      'btn_','_btn','button','tab_','_tab','nav_','_nav','menu_','_menu',
      'bg_','_bg','background_small'];
    for (const k of kws) if (u.includes(k)) return true;
    if (/_\d{1,2}\.(jpg|png|webp)/i.test(u)) return true;
    return false;
  }

  function showNotification(text, type) {
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

  // ═════════════════════════════════════════════════════════════
  // 接收 inject.js 消息（来自 MAIN world）
  // ═════════════════════════════════════════════════════════════

  window.addEventListener('message', (e) => {
    if (e.data?.source !== 'doubao-image-inject') return;
    const { type, data } = e.data;
    if (!data) return;

    if (type === 'IMAGE_URL') {
      const url = data.url;
      if (url && !isUiIconUrl(url)) {
        if (!capturedImageUrls.find(v => v.url === url)) {
          capturedImageUrls.unshift({ url, timestamp: Date.now() });
          console.log('[豆包去水印] 拦截到图片 URL:', url.slice(0, 80));
        }
      }
    }
  });

  // ═════════════════════════════════════════════════════════════
  // 从页面 HTML 中提取图片 URL（兜底，当 inject.js 没拦截到时）
  // ═════════════════════════════════════════════════════════════

  function extractImageUrlsFromPage() {
    const html = document.documentElement.innerHTML;
    // 匹配 image_ori_raw URL（含 rc_gen_image/{32位hex}）
    const pattern = /image_ori_raw[\s\S]*?url[\s\S]*?(https:\/\/[^\\&\s"]+rc_gen_image\/[a-f0-9]{32}\.[a-z]+[^\\&\s"]*)/gi;
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const url = m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"');
      if (!capturedImageUrls.find(v => v.url === url)) {
        capturedImageUrls.unshift({ url, timestamp: Date.now() });
        console.log('[豆包去水印] 正则提取图片 URL:', url.slice(0, 80));
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 获取页面上所有 AI 生成图片（用 rc_gen_image 精确识别）
  // ═════════════════════════════════════════════════════════════

  function getUnassignedAiImages() {
    const results = [];
    const imgs = document.querySelectorAll('img');

    for (const img of imgs) {
      if (isOwnElement(img)) continue;
      if (imageDownloadBtns.has(img)) continue;

      const src = img.src || img.currentSrc || '';
      if (!src || src.startsWith('data:')) continue;

      // 精确识别 AI 生成图片：URL 中含 rc_gen_image/{32位hex hash}
      const isAiImage = /rc_gen_image\/[a-f0-9]{32}/i.test(src);
      if (!isAiImage) continue;

      // 尺寸筛选（>100px）
      const rect = img.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) continue;

      results.push(img);
    }

    return results;
  }

  // ═════════════════════════════════════════════════════════════
  // 下载图片
  // ═════════════════════════════════════════════════════════════

  async function downloadImage(targetImg, forcedUrl) {
    // 优先级 1：按钮绑定的原图 URL
    let imageUrl = forcedUrl || null;

    // 优先级 2：通过 img 元素匹配拦截到的原图
    if (!imageUrl && targetImg) {
      imageUrl = findImageUrlForElement(targetImg);
    }

    // 优先级 3：最近拦截到的图片 URL
    if (!imageUrl && capturedImageUrls.length > 0) {
      imageUrl = capturedImageUrls[0].url;
    }

    // 兜底：直接用 img.src
    if (!imageUrl && targetImg) {
      imageUrl = targetImg.src || targetImg.currentSrc || null;
    }

    if (!imageUrl) {
      showNotification('❌ 未找到图片地址', 'error');
      return;
    }

    if (downloadingUrls.has(imageUrl)) {
      showNotification('⏳ 该图片正在下载中...', 'info');
      return;
    }
    downloadingUrls.add(imageUrl);

    try {
      const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
      const filename = `doubao_image_${Date.now()}.${ext}`;

      chrome.runtime.sendMessage({
        action: 'download',
        url: imageUrl,
        filename
      });

      const isCleanUrl = imageUrl.includes('byteimg.com') ||
                         imageUrl.includes('image_ori_raw') ||
                         !imageUrl.includes('watermark');
      showNotification(isCleanUrl ? '✅ 无水印原图下载已开始！' : '⚠️ 正在下载图片', 'success');
    } finally {
      setTimeout(() => downloadingUrls.delete(imageUrl), 5000);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 为 img 元素匹配拦截到的原图 URL
  // ═════════════════════════════════════════════════════════════

  function findImageUrlForElement(imgEl) {
    if (!imgEl) return null;
    if (capturedImageUrls.length === 0) return null;

    // 从 data 属性读取已关联的 URL
    if (imgEl.dataset.doubaoImageUrl) {
      return imgEl.dataset.doubaoImageUrl;
    }

    // 按 DOM 顺序匹配
    const allAiImgs = getAllAiImages();
    const imgIndex = allAiImgs.indexOf(imgEl);

    if (imgIndex >= 0 && imgIndex < capturedImageUrls.length) {
      const reversed = [...capturedImageUrls].reverse();
      return reversed[imgIndex]?.url || null;
    }

    // 兜底：返回最新的拦截 URL
    return capturedImageUrls[0]?.url || null;
  }

  function getAllAiImages() {
    const results = [];
    const imgs = document.querySelectorAll('img');
    for (const img of imgs) {
      if (isOwnElement(img)) continue;
      const src = img.src || img.currentSrc || '';
      if (!src || src.startsWith('data:')) continue;
      if (!/rc_gen_image\/[a-f0-9]{32}/i.test(src)) continue;
      const rect = img.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 60) continue;
      results.push(img);
    }
    return results;
  }

  // ═════════════════════════════════════════════════════════════
  // 按钮定位：fixed 定位在图片右下角
  // ═════════════════════════════════════════════════════════════

  function positionOverlayButton(btn, targetEl) {
    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';

    // 图片按钮：右下角
    btn.style.top = (rect.bottom - 32) + 'px';
    btn.style.left = (rect.right - 60) + 'px';
  }

  // ═════════════════════════════════════════════════════════════
  // 添加图片下载按钮
  // ═════════════════════════════════════════════════════════════

  function addImageDownloadButtons() {
    // 如果拦截到的图片 URL 为空，尝试从页面 HTML 中提取
    if (capturedImageUrls.length === 0) {
      extractImageUrlsFromPage();
      if (capturedImageUrls.length === 0) return;
    }

    // 获取所有未分配按钮的 AI 生成图片
    const unassignedImgs = getUnassignedAiImages();
    if (unassignedImgs.length === 0) return;

    // 预计算 reversed URL 数组（最旧在前）
    const reversed = [...capturedImageUrls].reverse();
    const assignedCount = imageDownloadBtns.size;

    let newBtnCount = 0;

    for (let i = 0; i < unassignedImgs.length; i++) {
      const img = unassignedImgs[i];

      // 跳过尺寸过小的图
      const initialImgRect = img.getBoundingClientRect();
      if (initialImgRect.width < 120 || initialImgRect.height < 120) continue;

      // 为每张图分配对应的原图 URL
      const assignedUrl = reversed[assignedCount + i]?.url ||
                          reversed[assignedCount]?.url ||
                          capturedImageUrls[0]?.url || null;

      if (assignedUrl) {
        img.dataset.doubaoImageUrl = assignedUrl;
      }

      // 创建覆盖按钮
      const overlayBtn = document.createElement('div');
      overlayBtn.className = 'dw-img-btn';
      overlayBtn.setAttribute('data-doubao-own', 'true');
      overlayBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>原图</span>
      `;

      // fixed 定位
      overlayBtn.style.position = 'fixed';
      positionOverlayButton(overlayBtn, img);

      const targetImg = img;
      const boundUrl = assignedUrl;

      // 拦截 mousedown/pointerdown/touchstart 防止穿透到原生 UI
      ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(evt => {
        overlayBtn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
      });

      overlayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        downloadImage(targetImg, boundUrl);
      });

      document.body.appendChild(overlayBtn);
      imageDownloadBtns.set(img, overlayBtn);
      newBtnCount++;
    }

    // 清理已移除的图片按钮 + 更新位置
    for (const [img, overlayBtn] of imageDownloadBtns) {
      if (!document.contains(img)) {
        overlayBtn.remove();
        imageDownloadBtns.delete(img);
        continue;
      }
      positionOverlayButton(overlayBtn, img);
    }

    if (newBtnCount > 0) {
      console.log(`[豆包去水印] 已为 ${newBtnCount} 张图片添加下载按钮`);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 滚动/resize 时更新所有按钮位置
  // ═════════════════════════════════════════════════════════════

  function updateAllButtonPositions() {
    for (const [img, btn] of imageDownloadBtns) {
      if (!document.contains(img)) {
        btn.remove();
        imageDownloadBtns.delete(img);
        continue;
      }
      positionOverlayButton(btn, img);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 定时器 + 事件监听
  // ═════════════════════════════════════════════════════════════

  // 定期检查新图片
  setInterval(addImageDownloadButtons, 2000);
  setTimeout(addImageDownloadButtons, 500);
  setTimeout(addImageDownloadButtons, 1500);
  setTimeout(addImageDownloadButtons, 3000);
  setTimeout(addImageDownloadButtons, 6000);

  // 滚动时更新按钮位置
  let scrollTimer = null;
  window.addEventListener('scroll', () => {
    if (scrollTimer) return;
    scrollTimer = setTimeout(() => {
      updateAllButtonPositions();
      scrollTimer = null;
    }, 16); // ~60fps
  }, { passive: true });

  // resize 时更新
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) return;
    resizeTimer = setTimeout(() => {
      updateAllButtonPositions();
      resizeTimer = null;
    }, 100);
  }, { passive: true });

  // MutationObserver 监听 DOM 变化
  const domObserver = new MutationObserver(() => {
    addImageDownloadButtons();
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  console.log('[豆包图片去水印] content.js v4.2 已加载');
})();
