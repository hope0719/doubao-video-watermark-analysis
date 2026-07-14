(function () {
  "use strict";

  // ══════════════════════════════════════════════════════════
  // 防止重复注入
  // ══════════════════════════════════════════════════════════

  if (window.__DOUBAO_IMAGE_INJECTED__) return;
  window.__DOUBAO_IMAGE_INJECTED__ = true;

  // ══════════════════════════════════════════════════════════
  // 拦截到的原图 URL 列表（由 inject.js 通过 postMessage 填充）
  // ══════════════════════════════════════════════════════════

  const capturedImageUrls = [];  // { url, timestamp, quality }

  // 已添加按钮的图片
  const imageButtons = new WeakMap();

  // ══════════════════════════════════════════════════════════
  // Service Worker 保活（每 20 秒 ping 一次）
  // ══════════════════════════════════════════════════════════

  if (chrome && chrome.runtime && chrome.runtime.id) {
    try {
      chrome.runtime.sendMessage({ action: "ping" });
    } catch (e) {}
    setInterval(() => {
      try {
        chrome.runtime.sendMessage({ action: "ping" });
      } catch (e) {}
    }, 20000);
  }

  // ══════════════════════════════════════════════════════════
  // 接收 inject.js 发来的拦截 URL（MAIN world → isolated world）
  // ══════════════════════════════════════════════════════════

  window.addEventListener("message", (e) => {
    if (e.data?.source !== "doubao-image-inject") return;
    const { type, data } = e.data;
    if (!data) return;

    if (type === "IMAGE_URL" || type === "JIMENG_IMAGE_URL") {
      const url = data.url;
      if (url && !isUiIconUrl(url)) {
        if (!capturedImageUrls.find((v) => v.url === url)) {
          capturedImageUrls.unshift({ url, timestamp: Date.now(), quality: data.quality || 0 });
          console.log("[豆包去水印] 拦截到图片 URL:", url.slice(0, 100));
          // 有新 URL 时，更新所有待匹配的按钮
          updatePendingButtons();
        }
      }
    }
  });

  // ══════════════════════════════════════════════════════════
  // 从页面 HTML 提取图片 URL（兜底）
  // ══════════════════════════════════════════════════════════

  function extractImageUrlsFromPage() {
    const html = document.documentElement.innerHTML;
    const pattern =
      /image_ori_raw[\s\S]*?url[\s\S]*?(https:\/\/[^\\&\s"]+rc_gen_image\/[a-f0-9]{32}\.[a-z]+[^\\&\s"]*)/gi;
    let m;
    while ((m = pattern.exec(html)) !== null) {
      const url = m[1].replace(/&amp;/g, "&").replace(/&quot;/g, "\"");
      if (!capturedImageUrls.find((v) => v.url === url)) {
        capturedImageUrls.unshift({ url, timestamp: Date.now() });
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // UI 图标 URL 过滤
  // ══════════════════════════════════════════════════════════

  function isUiIconUrl(url) {
    return /icon|avatar|logo|badge|emoji|sticker|thumb/i.test(url || "");
  }

  // ══════════════════════════════════════════════════════════
  // 匹配图片元素 ↔ 原图 URL（点击时重新调用，确保最新）
  // ══════════════════════════════════════════════════════════

  function findCleanUrlForImg(imgEl) {
    if (!imgEl) return null;
    const src = imgEl.src || imgEl.currentSrc || "";
    if (!src) return null;

    // 策略 1：通过 32 位 hex hash 匹配
    const hashMatch = src.match(/rc_gen_image\/([a-f0-9]{32})/i);
    if (hashMatch) {
      const imgHash = hashMatch[1].toLowerCase();
      for (const entry of capturedImageUrls) {
        if (entry.url.toLowerCase().includes(imgHash)) {
          return entry.url;
        }
      }
    }

    // 策略 2：直接 URL 包含匹配
    for (const entry of capturedImageUrls) {
      if (src.includes(entry.url) || entry.url.includes(src)) {
        return entry.url;
      }
    }

    return null;
  }

  // ══════════════════════════════════════════════════════════
  // 判断元素是否由插件自己创建
  // ══════════════════════════════════════════════════════════

  function isOwnElement(el) {
    if (!el) return false;
    return (
      el.closest && (
        el.closest(".dw-img-wrapper") ||
        el.closest("[data-doubao-image-btn]")
      )
    );
  }

  // ══════════════════════════════════════════════════════════
  // 下载原图（通过 background.js 下载，避免 CORS）
  // ══════════════════════════════════════════════════════════

  function downloadDirect(cleanUrl, imgEl) {
    if (!cleanUrl) {
      // 兜底：重新匹配一次
      const latestUrl = findCleanUrlForImg(imgEl);
      if (latestUrl) {
        downloadDirect(latestUrl, imgEl);
        return;
      }
      console.warn("[豆包去水印] 无原图 URL，下载 img.src（可能带水印）");
      cleanUrl = imgEl?.src || imgEl?.currentSrc || "";
      if (!cleanUrl) return;
    }

    const ext = (cleanUrl.match(/\.(jpg|jpeg|png|webp)/i) || ["", "jpg"])[1].replace("jpeg", "jpg");
    const filename = "豆包原图_" + Date.now() + "." + ext;

    console.log("[豆包去水印] 下载:", cleanUrl.slice(0, 80));

    if (chrome && chrome.runtime) {
      chrome.runtime.sendMessage(
        { action: "download", url: cleanUrl, filename },
        (resp) => {
          if (chrome.runtime.lastError) {
            console.warn("[豆包去水印] 下载消息失败:", chrome.runtime.lastError.message);
          }
        }
      );
    }
  }

  // ══════════════════════════════════════════════════════════
  // 为图片创建 wrapper + 下载按钮
  // ══════════════════════════════════════════════════════════

  function createWrapperWithButton(img) {
    const src = img.src || img.currentSrc || "";
    if (!src || src.startsWith("data:")) return null;
    if (img.closest(".dw-img-wrapper")) return null;

    // 查找对应的原图 URL
    const cleanUrl = findCleanUrlForImg(img);

    // 创建 wrapper（relative 定位容器）
    const wrapper = document.createElement("div");
    wrapper.className = "dw-img-wrapper";

    // 将 img 移入 wrapper
    if (img.parentNode) {
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    }

    // 创建下载按钮（absolute 定位在右下角）
    const btn = document.createElement("button");
    btn.className = "dw-img-btn";
    btn.textContent = cleanUrl ? "✓ 原图" : "原图";
    btn.title = cleanUrl ? "点击下载无水印原图" : "正在拦截原图 URL...";

    // 将 URL 存在 wrapper 的 dataset 上（创建时绑定，点击 O(1) 读取）
    wrapper.dataset.cleanUrl = cleanUrl || "";
    if (cleanUrl) {
      img.dataset.doubaoImageUrl = cleanUrl;
    }

    // 事件拦截（阻止冒泡，防止触发页面导航）
    ["mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchend", "contextmenu"].forEach((evt) => {
      btn.addEventListener(
        evt,
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        },
        true
      );
    });

    // 点击下载：优先重新匹配最新 URL，再读 dataset 兜底
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const latestUrl = findCleanUrlForImg(img);
      downloadDirect(latestUrl || wrapper.dataset.cleanUrl || null, img);
    });

    wrapper.appendChild(btn);
    imageButtons.set(img, { wrapper, btn });

    const rect = img.getBoundingClientRect();
    console.log(
      `[豆包去水印] 为图片添加按钮 [${Math.round(rect.width)}×${Math.round(rect.height)}]`,
      cleanUrl ? "✓ 有原图" : "○ 用src"
    );

    return { wrapper, btn };
  }

  // ══════════════════════════════════════════════════════════
  // 更新所有待匹配按钮的原图 URL（拦截到新 URL 时调用）
  // ══════════════════════════════════════════════════════════

  function updatePendingButtons() {
    for (const [img, { wrapper, btn }] of imageButtons) {
      if (!wrapper || !btn) continue;
      const cleanUrl = findCleanUrlForImg(img);
      if (cleanUrl && !wrapper.dataset.cleanUrl) {
        wrapper.dataset.cleanUrl = cleanUrl;
        img.dataset.doubaoImageUrl = cleanUrl;
        btn.textContent = "✓ 原图";
        btn.title = "点击下载无水印原图";
        console.log("[豆包去水印] 更新按钮 URL");
      }
    }
  }

  // ══════════════════════════════════════════════════════════
  // 扫描并添加按钮
  // ══════════════════════════════════════════════════════════

  function scanAndAddButtons() {
    if (capturedImageUrls.length === 0) {
      extractImageUrlsFromPage();
    }

    const imgs = document.querySelectorAll("img");
    let addedCount = 0;

    for (const img of imgs) {
      if (isOwnElement(img)) continue;
      if (imageButtons.has(img)) continue;
      if (img.closest(".dw-img-wrapper")) continue;

      const src = img.src || img.currentSrc || "";
      if (!src || src.startsWith("data:")) continue;
      if (!/rc_gen_image\/[a-f0-9]{32}/i.test(src)) continue;

      const rect = img.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 120) continue;
      if (img.closest("video")) continue;

      const result = createWrapperWithButton(img);
      if (result) addedCount++;
    }

    // 清理已从 DOM 移除的图片
    for (const [img, { wrapper }] of imageButtons) {
      if (!document.contains(img)) {
        wrapper?.remove();
        imageButtons.delete(img);
      }
    }

    if (addedCount > 0) {
      console.log(`[豆包去水印] 本次新增 ${addedCount} 个下载按钮`);
    }
  }

  // ══════════════════════════════════════════════════════════
  // 启动扫描
  // ══════════════════════════════════════════════════════════

  setTimeout(scanAndAddButtons, 300);
  setTimeout(scanAndAddButtons, 800);
  setTimeout(scanAndAddButtons, 1500);
  setTimeout(scanAndAddButtons, 3000);
  setTimeout(scanAndAddButtons, 5000);

  setInterval(scanAndAddButtons, 2000);

  const domObserver = new MutationObserver(() => {
    scanAndAddButtons();
  });
  domObserver.observe(document.body, { childList: true, subtree: true });

  console.log("[豆包去水印] content.js v4.3.2 已加载");
})();
