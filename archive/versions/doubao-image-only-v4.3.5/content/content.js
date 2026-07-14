(function () {
  "use strict";

  if (window.__DOUBAO_IMAGE_INJECTED__) return;
  window.__DOUBAO_IMAGE_INJECTED__ = true;

  // ═══════════════════════════════════════════════════════════════
  // 全局状态（对齐 v1.9.0）
  // ═══════════════════════════════════════════════════════════════

  const capturedImageUrls = []; // { url, timestamp } — 拦截/提取到的无水印原图 URL (最新在前)
  const imageDownloadBtns = new Map(); // img 元素 → 覆盖按钮元素

  // ═══════════════════════════════════════════════════════════════
  // Service Worker 保活
  // ═══════════════════════════════════════════════════════════════

  function ping() {
    try { chrome.runtime.sendMessage({ action: "ping" }); } catch (e) {}
  }
  ping();
  setInterval(ping, 20000);

  // ═══════════════════════════════════════════════════════════════
  // 接收 inject.js 发的拦截 URL
  // ═══════════════════════════════════════════════════════════════

  window.addEventListener("message", (e) => {
    if (e.data?.source !== "doubao-image-inject") return;
    const { type, data } = e.data;
    if (!data) return;
    if (type === "IMAGE_URL" || type === "JIMENG_IMAGE_URL") {
      const url = data.url;
      if (url && !/icon|avatar|logo|badge|emoji|sticker|thumb|headimg|profile/i.test(url)) {
        if (!capturedImageUrls.find((v) => v.url === url)) {
          capturedImageUrls.unshift({ url, timestamp: Date.now() });
          console.log("[豆包去水印] 拦截:", url.slice(0, 80));
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // v23: 从页面 HTML 提取图片 URL（兜底方案，与 v1.9.0 对齐）
  // 优先解析结构化 JSON，失败则用正则
  // ═══════════════════════════════════════════════════════════════

  function extractImageUrlsFromPage() {
    // 方法 1: 解析 data-fn-args 中的结构化 JSON（v23 新增）
    const fnArgsEls = document.querySelectorAll('[data-script-src="modern-run-router-data-fn"][data-fn-args]');
    for (const el of fnArgsEls) {
      try {
        const jsonStr = el.getAttribute("data-fn-args").replace(/&quot;/g, '"');
        const jsonData = JSON.parse(jsonStr);
        for (const item of jsonData) {
          if (typeof item === "object" && item.data && item.data.message_snapshot) {
            const msgList = item.data.message_snapshot.message_list || [];
            for (const msg of msgList) {
              if (!msg.content_block) continue;
              for (const block of msg.content_block) {
                try {
                  const contentV2 = JSON.parse(block.content_v2);
                  if (contentV2.creation_block?.creations) {
                    for (const creation of contentV2.creation_block.creations) {
                      const rawUrl = creation.image?.image_ori_raw?.url ||
                                     creation.image?.image_ori?.url || "";
                      if (rawUrl && /^https?:/.test(rawUrl) && /rc_gen_image\/[a-f0-9]{32}/i.test(rawUrl)) {
                        const cleanUrl = rawUrl.replace(/&amp;/g, "&");
                        if (!capturedImageUrls.find((v) => v.url === cleanUrl)) {
                          capturedImageUrls.unshift({ url: cleanUrl, timestamp: Date.now() });
                          console.log("[豆包去水印] JSON提取:", cleanUrl.slice(0, 80));
                        }
                      }
                    }
                  }
                } catch (e) { /* skip */ }
              }
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    // 方法 2: 正则匹配 HTML（v13 兜底）
    if (capturedImageUrls.length === 0) {
      const html = document.documentElement.innerHTML;
      const regex = /(https:\/\/[^&\s"'<>]+rc_gen_image\/[a-f0-9]{32}[^&\s"'<>]*)/gi;
      const seen = new Set();
      let match;
      while ((match = regex.exec(html)) !== null) {
        const url = match[1].replace(/&amp;/g, "&");
        const hashMatch = url.match(/rc_gen_image\/([a-f0-9]{32})/i);
        if (hashMatch && !seen.has(hashMatch[1])) {
          seen.add(hashMatch[1]);
          if (!capturedImageUrls.find((v) => v.url === url)) {
            capturedImageUrls.unshift({ url, timestamp: Date.now() });
            console.log("[豆包去水印] 正则提取:", url.slice(0, 80));
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UI 判断辅助
  // ═══════════════════════════════════════════════════════════════

  function isOwnElement(el) {
    if (!el) return false;
    return el.closest && (el.closest("[data-doubao-own]") || el.closest(".dw-img-float-btn"));
  }

  function isActivePage() {
    return /doubao\.com\/(chat|\/)$/.test(location.href);
  }

  function isJimengPage() {
    return /jimeng\.jianying\.com|dreamina\.capcut\.com/.test(location.href);
  }

  // ═══════════════════════════════════════════════════════════════
  // 下载图片（对齐 v1.9.0 downloadImage 逻辑）
  // ═══════════════════════════════════════════════════════════════

  async function downloadImage(targetImg, forcedUrl) {
    let imageUrl = forcedUrl || null;

    if (!imageUrl && targetImg) {
      imageUrl = findImageUrlForElement(targetImg);
    }

    if (!imageUrl && capturedImageUrls.length > 0) {
      imageUrl = capturedImageUrls[0].url;
    }

    if (!imageUrl && targetImg) {
      imageUrl = targetImg.src || targetImg.currentSrc || null;
    }

    if (!imageUrl) return;

    const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const filename = `豆包原图_${Date.now()}.${ext}`;

    chrome.runtime.sendMessage({ action: "download", url: imageUrl, filename });
  }

  function findImageUrlForElement(imgEl) {
    if (!imgEl) return null;
    if (capturedImageUrls.length === 0) return null;

    if (imgEl.dataset.doubaoImageUrl) {
      return imgEl.dataset.doubaoImageUrl;
    }

    const allAiImgs = getAiGeneratedImages();
    const imgIndex = allAiImgs.indexOf(imgEl);
    if (imgIndex >= 0 && imgIndex < capturedImageUrls.length) {
      const reversed = [...capturedImageUrls].reverse();
      return reversed[imgIndex]?.url || null;
    }

    return capturedImageUrls[0]?.url || null;
  }

  function getAiGeneratedImages() {
    const results = [];
    const imgs = document.querySelectorAll("img");
    for (const img of imgs) {
      if (isOwnElement(img)) continue;
      const src = img.src || img.currentSrc || "";
      if (!src || src.startsWith("data:")) continue;
      const u = src.toLowerCase();
      if (u.includes("icon") || u.includes("logo") || u.includes("avatar") ||
          u.includes("favicon") || u.includes("badge") || u.includes("sticker") ||
          u.includes("emoji") || u.includes("headimg") || u.includes("profile")) continue;
      const rect = img.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 60) continue;
      results.push(img);
    }
    return results;
  }

  function getUnassignedAiImages() {
    const results = [];
    const imgs = document.querySelectorAll("img");
    for (const img of imgs) {
      if (isOwnElement(img)) continue;
      if (imageDownloadBtns.has(img)) continue;
      const src = img.src || img.currentSrc || "";
      if (!src || src.startsWith("data:")) continue;
      const u = src.toLowerCase();
      if (u.includes("icon") || u.includes("logo") || u.includes("avatar")) continue;
      const rect = img.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) continue;
      results.push(img);
    }
    return results;
  }

  // ═══════════════════════════════════════════════════════════════
  // 按钮位置更新（对齐 v1.9.0 positionOverlayButton）
  // ═══════════════════════════════════════════════════════════════

  function positionOverlayButton(btn, targetEl) {
    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      btn.style.display = "none";
      return;
    }
    btn.style.display = "";
    btn.style.top = (rect.bottom - 32) + "px";
    btn.style.left = (rect.right - 60) + "px";
  }

  // ═══════════════════════════════════════════════════════════════
  // 添加图片下载按钮（对齐 v1.9.0 addImageDownloadButtons）
  // ═══════════════════════════════════════════════════════════════

  function addImageDownloadButtons() {
    if (!isActivePage()) return;

    if (capturedImageUrls.length === 0) {
      extractImageUrlsFromPage();
      if (capturedImageUrls.length === 0) return;
    }

    const unassignedImgs = getUnassignedAiImages();
    if (unassignedImgs.length === 0) return;

    const reversed = [...capturedImageUrls].reverse();
    const assignedCount = imageDownloadBtns.size;
    let newBtnCount = 0;

    for (let i = 0; i < unassignedImgs.length; i++) {
      const img = unassignedImgs[i];
      const initialRect = img.getBoundingClientRect();
      if (initialRect.width < 120 || initialRect.height < 120) continue;

      // 按 DOM 顺序分配 URL：reversed 最旧在前，索引对齐
      const assignedUrl = reversed[assignedCount + i]?.url ||
                          reversed[assignedCount]?.url ||
                          capturedImageUrls[0]?.url || null;

      if (assignedUrl) {
        img.dataset.doubaoImageUrl = assignedUrl;
      }

      const overlayBtn = document.createElement("div");
      overlayBtn.className = "dw-img-float-btn";
      overlayBtn.setAttribute("data-doubao-own", "true");
      overlayBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>原图</span>
      `;

      // fixed 定位 + 附加到 body（对齐 v1.9.0）
      overlayBtn.style.position = "fixed";
      positionOverlayButton(overlayBtn, img);

      const targetImg = img;
      const boundUrl = assignedUrl;

      // 拦截底层事件（对齐 v1.9.0：只拦截 mousedown/pointerdown/touchstart）
      ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend"].forEach((evt) => {
        overlayBtn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
      });

      overlayBtn.addEventListener("click", (e) => {
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
    for (const [img, btn] of imageDownloadBtns) {
      if (!document.contains(img)) {
        btn.remove();
        imageDownloadBtns.delete(img);
        continue;
      }
      positionOverlayButton(btn, img);
    }

    if (newBtnCount > 0) {
      console.log(`[豆包去水印] 新增 ${newBtnCount} 个图片下载按钮`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 滚动/resize 时更新按钮位置
  // ═══════════════════════════════════════════════════════════════

  let scrollRaf = null;
  function onScrollResize() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null;
      for (const [img, btn] of imageDownloadBtns) {
        if (document.contains(img)) {
          positionOverlayButton(btn, img);
        }
      }
    });
  }
  window.addEventListener("scroll", onScrollResize, { passive: true });
  window.addEventListener("resize", onScrollResize);

  // ═══════════════════════════════════════════════════════════════
  // 启动扫描（对齐 v1.9.0）
  // ═══════════════════════════════════════════════════════════════

  [300, 800, 1500, 3000, 5000].forEach((t) => setTimeout(addImageDownloadButtons, t));
  setInterval(addImageDownloadButtons, 2000);

  const domObserver = new MutationObserver(() => {
    addImageDownloadButtons();
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  console.log("[豆包去水印] v4.3.5 已加载");
})();
