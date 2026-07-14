/**
 * 豆包去水印 - Content Script v23
 *
 * 支持页面：video-sharing / thread / chat / 即梦 / Dreamina
 *
 * v12 新增（即梦支持）：
 *   - 拦截即梦/Dreamina 页面的 API 响应（JIMENG_VIDEO_URL / JIMENG_IMAGE_URL）
 *   - 即梦页面注入「下载视频」和「下载图片」按钮
 *   - 直接使用拦截到的 CDN URL 下载（无需额外 API）
 *
 * v11 图片去水印：
 * - video-sharing 页面：用 URL 中的 video_id 调 API (get_play_info) 获取无水印视频 URL
 * - chat 页面视频：从 /im/chain/single API 拦截 vid → 调 get_play_info API 获取无水印 URL
 * - chat 页面图片：从 API 拦截到的 image_ori_raw.url → 直接下载（已是无水印原图）
 * - thread 页面图集：从页面 data-fn-args 提取 image_ori_raw.url
 *
 * v11 新增图片去水印：
 *   - inject.js 拦截图片 API 响应，发送 IMAGE_URL 消息
 *   - chat 页面图片区域注入「无水印下载」按钮
 *   - 点击图片下载按钮时，优先使用拦截到的 image_ori_raw URL（真正无水印原图）
 *   - 兜底：直接下载页面中的 <img> 元素 src（可能是带水印缩略图）
 *
 * v10 多视频彻底修复（架构重构）：
 *   根因：chat 页面 video.src 是 blob URL（blob:https://www.doubao.com/xxx），
 *         不包含 vid 信息，所以 src.includes(vid) 永远匹配不上
 *   方案：主动关联替代被动匹配
 *   - 拦截到 vid 时，主动扫描 DOM 把 vid 写到 video 元素的 data-doubao-vid 属性
 *   - 下载时直接读 video.dataset.doubaoVid，无需 URL 匹配
 *   - DOM 顺序匹配作为补充（第N个视频 → 第N个vid）
 *   - 按 video 元素独立锁，允许多视频并发下载
 *   - 每5秒持续检测新视频并关联 vid + 添加下载按钮
 *
 * ⚠️ 重要：URL 参数清洗（去掉 lr=watermark）返回 403，不可用！
 *    正确方法只有调用 get_play_info API，获取 videoweb.doubao.com 域名的无水印 URL
 *
 * 拦截机制：
 * 1. 全局点击捕获（capture 阶段）→ 拦截下载/保存按钮
 * 2. MutationObserver → 检测并劫持页面上动态出现的下载按钮
 * 3. 右键菜单拦截 → video 元素右键另存为
 *
 * + 浮动「去水印」按钮（手动备用）
 * + 每个视频区域醒目「无水印下载」按钮
 * + 每个图片区域「无水印下载」按钮（v11 新增）
 */

(function () {
  'use strict';

  // 避免重复注入（v23: 浮动按钮已删除，改用标记位判重）
  if (window.__doubaoContentInjected) return;
  window.__doubaoContentInjected = true;

// ═══════════════════════════════════════════════════════════
// v13 修复：多视频 vid 匹配错误 + 下载按钮覆盖登录/UI 元素
// ═══════════════════════════════════════════════════════════
//
// Bug 1: 多视频 vid 匹配错误
// - associateVidToVideoElements() 策略1 (CDN URL匹配) 仅在非 chat 页面执行
// - findVideoIdForElement() 移除不可靠 fallback，最终返回 null
// - scanAndHookButtons() chat 页面跳过 video 祖先循环
//
// Bug 2: 下载按钮覆盖登录按钮和 UI
// - isDownloadButton() 添加黑名单选择器 + 祖先检查 + 文本排除
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// 页面类型检测
// ═══════════════════════════════════════════════════════════

  function isVideoSharingPage() {
    return location.href.includes('/video-sharing') && !!getVideoIdFromUrl();
  }

  function isThreadPage() {
    return location.href.includes('/thread/');
  }

  function isChatPage() {
    return location.href.includes('/chat/');
  }

  function isJimengPage() {
    const host = location.hostname;
    return host.includes('jimeng.jianying.com') ||
           host.includes('dreamina.capcut.com') ||
           host.includes('jianying.com') ||
           host.includes('dreamina');
  }

  function isActivePage() {
    return isVideoSharingPage() || isChatPage() || isThreadPage() || isJimengPage();
  }

  // ═══════════════════════════════════════════════════════════
  // videoId 提取（仅 video-sharing 页面有效）
  // ═══════════════════════════════════════════════════════════

  function getVideoIdFromUrl() {
    try {
      return new URL(location.href).searchParams.get('video_id') || '';
    } catch {
      const m = location.href.match(/[?&]video_id=([^&]+)/);
      return m ? m[1] : '';
    }
  }

  function getShareIdFromUrl() {
    try {
      return new URL(location.href).searchParams.get('share_id') || '';
    } catch {
      const m = location.href.match(/[?&]share_id=([^&]+)/);
      return m ? m[1] : '';
    }
  }

  /**
   * 获取视频的 URL
   * @param {HTMLVideoElement|null} targetVideo - 指定视频元素，null 则取第一个
   */
  function getVideoSrcFromPage(targetVideo) {
    if (targetVideo) {
      const src = targetVideo.src || targetVideo.currentSrc;
      if (src && src.startsWith('http')) return src;
      const sources = targetVideo.querySelectorAll('source');
      for (const s of sources) {
        if (s.src && s.src.startsWith('http')) return s.src;
      }
      // blob URL 也接受（兜底下载用）
      if (src && src.startsWith('blob:')) return src;
      return null;
    }
    const videos = document.querySelectorAll('video');
    for (const v of videos) {
      const src = v.src || v.currentSrc;
      if (src && src.startsWith('http')) return src;
      const sources = v.querySelectorAll('source');
      for (const s of sources) {
        if (s.src && s.src.startsWith('http')) return s.src;
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // 网络拦截数据接收（来自 inject.js）
  // ═══════════════════════════════════════════════════════════

  // 存储拦截到的 video_id（最新的在前面）
  const capturedVideoIds = [];
  // 存储拦截到的无水印视频 URL
  const capturedCleanUrls = [];
  // 存储 vid → download_url 映射（多视频匹配用）
  const videoSrcMap = [];
  // v11: 存储拦截到的无水印图片 URL（最新的在前）
  const capturedImageUrls = [];

  // v12: 即梦/ Dreamina 专用存储
  const jimengVideoUrls = [];   // 拦截到的无水印视频 URL
  const jimengImageUrls = [];    // 拦截到的无水印图片 URL（按质量降序）

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'doubao-inject') return;

    if (event.data.type === 'VIDEO_ID') {
      const { key, id, apiUrl } = event.data.data;
      console.log(`[豆包去水印] 网络拦截捕获 ${key}: ${id}, 来源: ${apiUrl?.slice(0, 60)}`);
      // 避免重复
      if (!capturedVideoIds.find(v => v.id === id)) {
        capturedVideoIds.unshift({ id, key, timestamp: event.data.timestamp });
        if (capturedVideoIds.length > 20) capturedVideoIds.pop();
      }
      // v10: 拦截到 vid 后，主动关联到 DOM 中的 video 元素
      associateVidToVideoElements();
    }

    if (event.data.type === 'VIDEO_URL') {
      const { key, url, apiUrl } = event.data.data;
      console.log(`[豆包去水印] 网络拦截捕获视频 ${key}: ${url?.slice(0, 80)}`);
      if (!capturedCleanUrls.find(v => v.url === url)) {
        capturedCleanUrls.unshift({ url, key, timestamp: event.data.timestamp });
        if (capturedCleanUrls.length > 10) capturedCleanUrls.pop();
      }
    }

    if (event.data.type === 'VIDEO_MAP') {
      const { vid, downloadUrl } = event.data.data;
      console.log(`[豆包去水印] 捕获 vid→URL 映射: ${vid} → ${downloadUrl?.slice(0, 80)}`);
      if (!videoSrcMap.find(v => v.vid === vid)) {
        videoSrcMap.unshift({ vid, downloadUrl, timestamp: event.data.timestamp });
        if (videoSrcMap.length > 20) videoSrcMap.pop();
      }
      // v10: 拦截到 vid→URL 映射后，也主动关联
      associateVidToVideoElements();
    }

    // v11: 接收图片 URL
    if (event.data.type === 'IMAGE_URL') {
      const { url, apiUrl } = event.data.data;
      // v13: 过滤掉头像/logo/图标类 URL
      const u = (url || '').toLowerCase();
      const isIcon = u.includes('avatar') || u.includes('icon') || u.includes('logo') ||
                    u.includes('favicon') || u.includes('badge') || u.includes('sticker') ||
                    u.includes('emoji') || /_\d{1,2}\.(jpg|png|webp)/i.test(u);
      if (isIcon) {
        console.log(`[豆包去水印] 跳过图标类 URL: ${url?.slice(0, 60)}`);
      } else {
        console.log(`[豆包去水印] 网络拦截捕获图片 URL: ${url?.slice(0, 80)}`);
        if (!capturedImageUrls.find(v => v.url === url)) {
          capturedImageUrls.unshift({ url, timestamp: event.data.timestamp });
          if (capturedImageUrls.length > 50) capturedImageUrls.pop();
        }
        // 新图片到来时，尝试添加下载按钮
        setTimeout(addImageDownloadButtons, 200);
      }
    }

    // v12: 即梦视频 URL
    if (event.data.type === 'JIMENG_VIDEO_URL') {
      const { url, apiUrl } = event.data.data;
      console.log(`[豆包去水印] 即梦拦截视频 URL: ${url?.slice(0, 80)}`);
      if (!jimengVideoUrls.find(v => v.url === url)) {
        jimengVideoUrls.unshift({ url, timestamp: event.data.timestamp });
        if (jimengVideoUrls.length > 20) jimengVideoUrls.pop();
      }
      // 立刻添加即梦下载按钮
      setTimeout(() => {
        addJimengDownloadButtons();
        showNotification('✅ 检测到视频，开始下载...', 'success');
      }, 500);
    }

    // v12: 即梦图片 URL
    if (event.data.type === 'JIMENG_IMAGE_URL') {
      const { url, quality, apiUrl } = event.data.data;
      console.log(`[豆包去水印] 即梦拦截图片 URL: ${url?.slice(0, 80)} (quality=${quality})`);
      if (!jimengImageUrls.find(v => v.url === url)) {
        // 按质量降序插入
        const entry = { url, quality, timestamp: event.data.timestamp };
        const idx = jimengImageUrls.findIndex(v => v.quality < quality);
        if (idx === -1) jimengImageUrls.push(entry);
        else jimengImageUrls.splice(idx, 0, entry);
        if (jimengImageUrls.length > 50) jimengImageUrls.pop();
      }
      setTimeout(() => addJimengDownloadButtons(), 500);
    }
  });

  /**
   * 获取最近拦截到的 video_id
   */
  function getLatestCapturedVideoId() {
    return capturedVideoIds.length > 0 ? capturedVideoIds[0].id : null;
  }

  /**
   * 获取最近拦截到的无水印视频 URL
   */
  function getLatestCapturedCleanUrl() {
    return capturedCleanUrls.length > 0 ? capturedCleanUrls[0].url : null;
  }

  // ═══════════════════════════════════════════════════════════
  // v10 核心：主动关联 vid → video 元素
  // ═══════════════════════════════════════════════════════════

  /**
   * 主动把拦截到的 vid 关联到 DOM 中的 video 元素
   *
   * v13 修复：移除不可靠的 DOM 搜索策略，改用严格的 DOM 顺序匹配
   *
   * 策略（按优先级）：
   * 1. video.src 是 CDN URL 且包含 vid → 直接匹配，写入 data-doubao-vid
   * 2. DOM 顺序匹配：chat 页视频按生成顺序（ oldest first ）排列，
   *    与 reversed capturedVideoIds 一一对应
   *
   * ⚠️ 已关联的视频元素不会被重新关联（防止时序错乱）
   */
  function associateVidToVideoElements() {
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return;

    // 收集所有已知的 vid（去重）
    const allVids = [];
    const seenIds = new Set();
    for (const entry of capturedVideoIds) {
      if (entry.id && !seenIds.has(entry.id)) {
        seenIds.add(entry.id);
        allVids.push(entry.id);
      }
    }
    for (const mapping of videoSrcMap) {
      if (mapping.vid && !seenIds.has(mapping.vid)) {
        seenIds.add(mapping.vid);
        allVids.push(mapping.vid);
      }
    }

    if (allVids.length === 0) return;

    // 已关联的 vid 集合（防止重复关联）
    const associatedVids = new Set();

    // ─── 策略1：CDN URL 包含 vid → 直接匹配（仅非 chat 页面适用）───
    if (!isChatPage()) {
      for (const video of videos) {
        if (video.dataset.doubaoVid) continue; // 已关联
        const src = video.src || video.currentSrc || '';
        // blob URL 跳过
        if (!src || src.startsWith('blob:')) continue;

        for (const vid of allVids) {
          if (associatedVids.has(vid)) continue;
          if (src.includes(vid)) {
            video.dataset.doubaoVid = vid;
            associatedVids.add(vid);
            console.log(`[豆包去水印] 主动关联(策略1-CDN URL): video → vid=${vid}`);
            break;
          }
        }
      }
    }

    // v21: 策略2：搜索 video 周围 DOM 中的 vid 引用
    //    chat 页面跳过（10 层搜索会跨到其他视频卡片，导致全部关联到同一个 vid）
    //    非 chat 页面限制 3 层 + 只检查直接子元素的属性（不用 querySelectorAll 搜整个子树）
    if (!isChatPage()) {
      for (const video of videos) {
        if (video.dataset.doubaoVid) continue;

        let container = video;
        for (let i = 0; i < 3 && container; i++) {
          // v21: 只检查容器自身的属性和直接子元素的属性，不用 querySelectorAll（避免搜到远房子树中的其他视频卡片）
          const candidates = [container, ...container.children];
          for (const el of candidates) {
            const href = el.getAttribute?.('href') || el.getAttribute?.('data-src') || el.getAttribute?.('data-url') || '';
            if (!href) continue;
            for (const vid of allVids) {
              if (associatedVids.has(vid)) continue;
              if (href.includes(vid)) {
                video.dataset.doubaoVid = vid;
                associatedVids.add(vid);
                console.log(`[豆包去水印] 主动关联(策略2-周围DOM): video → vid=${vid}`);
                break;
              }
            }
            if (video.dataset.doubaoVid) break;
          }
          if (video.dataset.doubaoVid) break;
          container = container.parentElement;
        }
      }
    }

    // v21: 策略3：DOM 顺序匹配（chat 页面的主要关联策略）
    //    capturedVideoIds 用 unshift 存储即最新在前，reverse() 后最老在前
    //    DOM 中最老的视频在最上面，所以 oldest vid → oldest video
    const unassignedVideos = [...videos].filter(v => !v.dataset.doubaoVid);
    const unassignedVids = allVids.filter(vid => !associatedVids.has(vid));
    unassignedVids.reverse(); // 最老在前

    console.log(`[豆包去水印] 策略3 DOM顺序匹配: ${unassignedVideos.length} 个未关联视频, ${unassignedVids.length} 个未分配 vid`);
    console.log(`[豆包去水印]   vid 列表(最老→最新): ${unassignedVids.join(', ')}`);

    for (let i = 0; i < unassignedVideos.length && i < unassignedVids.length; i++) {
      unassignedVideos[i].dataset.doubaoVid = unassignedVids[i];
      associatedVids.add(unassignedVids[i]);
      console.log(`[豆包去水印] 主动关联(策略3-DOM顺序): video[${i}] → vid=${unassignedVids[i]}`);
    }

    // v21: 打印最终关联结果汇总
    console.log('[豆包去水印] === vid 关联结果汇总 ===');
    videos.forEach((v, i) => {
      console.log(`[豆包去水印]   video[${i}]: vid=${v.dataset.doubaoVid || '(未关联)'}, src=${(v.src || v.currentSrc || '').slice(0, 60)}`);
    });
  }  // ═══════════════════════════════════════════════════════════
  // 多视频匹配工具函数
  // ═══════════════════════════════════════════════════════════

  /**
   * 从点击元素出发，找到最近的 video 元素
   * v13: 改用 proximity-based 匹配，在祖先链中找包含 video 最近的一层，
   *       然后在兄弟节点中找最近的 video（避免跨容器误匹配）
   */
  function findNearestVideo(element) {
    if (!element) return null;
    if (element.tagName === 'VIDEO') return element;

    // 1) closest('video') 优先（最近祖先）
    const closestVideo = element.closest('video');
    if (closestVideo) {
      // 验证这个 video 是 element 真正的"祖先"，不是兄弟节点的 video
      // 简单验证：closest 出来的 video 一定包含 element 或 element 在它子树内
      // 实际上 closest 找到的就是最近的祖先 video，理论正确
      return closestVideo;
    }

    // 2) 检查 element 自身的祖先链（最多 4 层），看有没有 video 容器
    //    注意：不再向上找祖先的祖先，限定"element 自己的祖先链"
    let parent = element.parentElement;
    for (let i = 0; i < 4 && parent; i++) {
      // 直接子级 video（不是兄弟节点的 video）
      const directChildVideo = Array.from(parent.children).find(
        c => c.tagName === 'VIDEO'
      );
      if (directChildVideo) return directChildVideo;
      parent = parent.parentElement;
    }

    // 3) 视口可见的视频（兜底，避免找到已滚出视口的历史视频）
    const allVideos = [...document.querySelectorAll('video')];
    const visibleVideos = allVideos.filter(v => {
      const r = v.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
    });
    if (visibleVideos.length === 1) return visibleVideos[0];
    if (visibleVideos.length > 1) {
      // 多个可见视频时，按视口中心距离最近的
      const cx = element.getBoundingClientRect ? (() => {
        const r = element.getBoundingClientRect();
        return (r.left + r.right) / 2;
      })() : window.innerWidth / 2;
      visibleVideos.sort((a, b) => {
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const ca = (ra.left + ra.right) / 2;
        const cb = (rb.left + rb.right) / 2;
        return Math.abs(ca - cx) - Math.abs(cb - cx);
      });
      return visibleVideos[0];
    }

    // 4) 完全没有可见视频时退回到第一个非空 video（最后兜底）
    return allVideos[0] || null;
  }  function findNearestImage(element) {
    if (!element) return null;
    if (element.tagName === 'IMG') return element;

    const closestImg = element.closest('img');
    if (closestImg) return closestImg;

    // 向上找包含 img 的容器
    let parent = element;
    for (let i = 0; i < 10 && parent; i++) {
      const img = parent.querySelector('img');
      if (img && img.src && img.src.startsWith('http') && !img.src.includes('icon') && !img.src.includes('logo')) return img;
      parent = parent.parentElement;
    }

    return null;
  }

  /**
   * 为指定的 video 元素获取已关联的 vid
   * v13: 简化策略，移除不可靠的 fallback，优先 DOM 顺序匹配
   */
  function findVideoIdForElement(videoEl) {
    // v21: null 入参也返回 null，保持兜底行为一致
    if (!videoEl) return null;

    // ─── 最优先：直接读 data-doubao-vid 属性 ───
    if (videoEl.dataset.doubaoVid) {
      console.log('[豆包去水印] ✅ 直接命中 data-doubao-vid:', videoEl.dataset.doubaoVid);
      return videoEl.dataset.doubaoVid;
    }

    const src = videoEl.src || videoEl.currentSrc || '';
    console.log('[豆包去水印] vid 匹配 fallback, src =', src.slice(0, 120));

    // ─── Fallback 1：CDN URL 子串匹配（仅非 chat 页面）───
    if (!isChatPage() && src && !src.startsWith('blob:')) {
      for (const entry of capturedVideoIds) {
        if (entry.id && src.includes(entry.id)) {
          videoEl.dataset.doubaoVid = entry.id;
          return entry.id;
        }
      }
      for (const mapping of videoSrcMap) {
        if (mapping.vid && src.includes(mapping.vid)) {
          videoEl.dataset.doubaoVid = mapping.vid;
          return mapping.vid;
        }
      }
    }

    // ─── Fallback 2：正则提取 vid ───
    if (src && !src.startsWith('blob:')) {
      const vidMatch = src.match(/\/(v[0-9a-z]{16,})/);
      if (vidMatch) {
        videoEl.dataset.doubaoVid = vidMatch[1];
        return vidMatch[1];
      }
    }

    // v21: Fallback 3：搜索周围 DOM（限制 3 层，避免跨到其他视频卡片）
    let container = videoEl;
    for (let i = 0; i < 3 && container; i++) {
      const links = container.querySelectorAll('a[href], [data-src], [data-url]');
      for (const link of links) {
        const href = link.getAttribute('href') || link.getAttribute('data-src') || link.getAttribute('data-url') || '';
        for (const entry of capturedVideoIds) {
          if (entry.id && href.includes(entry.id)) {
            videoEl.dataset.doubaoVid = entry.id;
            return entry.id;
          }
        }
      }
      container = container.parentElement;
    }

    // ─── Fallback 4：DOM 顺序匹配 ───
    const allVideos = [...document.querySelectorAll('video')];
    const videoIndex = allVideos.indexOf(videoEl);
    if (videoIndex >= 0) {
      const assignedVids = new Set(
        allVideos.filter(v => v.dataset.doubaoVid).map(v => v.dataset.doubaoVid)
      );
      const allVids = capturedVideoIds.map(v => v.id).filter(id => !assignedVids.has(id));
      allVids.reverse();
      let unassignedIndex = 0;
      for (let i = 0; i < videoIndex; i++) {
        if (!allVideos[i].dataset.doubaoVid) unassignedIndex++;
      }
      if (unassignedIndex < allVids.length) {
        const vid = allVids[unassignedIndex];
        videoEl.dataset.doubaoVid = vid;
        return vid;
      }
    }

    console.log('[豆包去水印] ⚠️ 所有策略均未匹配该视频的 vid，返回 null');
    return null;
  }  function findVideoInViewport() {
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];

    const viewportCenterY = window.innerHeight / 2;
    let closestVideo = null;
    let closestDistance = Infinity;

    for (const video of videos) {
      const rect = video.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const videoCenterY = rect.top + rect.height / 2;
      const distance = Math.abs(videoCenterY - viewportCenterY);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestVideo = video;
      }
    }

    return closestVideo || videos[0];
  }

  // ═══════════════════════════════════════════════════════════
  // 动态页面检测（SPA 安全）
  // ═══════════════════════════════════════════════════════════

  let lastUrl = location.href;

  function onUrlChange() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      onPageChanged();
    }
  }

  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    setTimeout(onUrlChange, 100);
  };
  history.replaceState = function () {
    origReplaceState.apply(this, arguments);
    setTimeout(onUrlChange, 100);
  };
  window.addEventListener('popstate', () => setTimeout(onUrlChange, 100));
  setInterval(onUrlChange, 2000);

  // ═══════════════════════════════════════════════════════════
  // 视频下载核心函数
  // ═══════════════════════════════════════════════════════════

  // 按视频独立锁，允许多视频并发下载
  const extractingVideoSrcs = new Set();

  /**
   * video-sharing 页面：通过 API 获取无水印视频
   */
  async function extractVideoViaApi(videoId) {
    if (extractingVideoSrcs.has(videoId)) {
      showNotification('⏳ 该视频正在下载中...', 'info');
      return;
    }
    extractingVideoSrcs.add(videoId);
    showNotification('🔄 正在通过 API 获取无水印视频...', 'info');
    console.log('[豆包去水印] API 模式, videoId =', videoId);

    try {
      const res = await fetch(
        'https://www.doubao.com/samantha/media/get_play_info?aid=497858&device_platform=web&language=zh-CN',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
          },
          body: JSON.stringify({ key: videoId })
        }
      );

      const json = await res.json();
      console.log('[豆包去水印] API 响应:', JSON.stringify(json).slice(0, 300));

      if (json.code !== 0 || !json.data) {
        throw new Error(json.msg || 'API 返回异常');
      }

      const videoUrl = json.data.original_media_info?.main_url ||
                       json.data.media_info?.[0]?.main_url;

      if (!videoUrl) throw new Error('未获取到视频地址');

      chrome.runtime.sendMessage({
        action: 'download',
        url: videoUrl,
        filename: `doubao_${videoId}.mp4`
      });
      showNotification('✅ 无水印视频下载已开始！', 'success');
    } catch (err) {
      showNotification('❌ ' + (err.message || '获取失败'), 'error');
    } finally {
      extractingVideoSrcs.delete(videoId);
    }
  }

  /**
   * chat 页面：获取无水印视频（支持多视频）
   *
   * @param {HTMLVideoElement|null} targetVideo - 目标视频元素
   */
  async function extractVideoChatPage(targetVideo) {
    // 如果没有指定目标视频，尝试找视口中的
    if (!targetVideo) {
      targetVideo = findVideoInViewport();
    }

    // 获取视频 URL（可能是 CDN URL 或 blob URL）
    const videoSrc = getVideoSrcFromPage(targetVideo);

    // v21: 用元素对象作为 lock key，加 60 秒超时自动清理避免内存泄漏
    const lockKey = targetVideo || `__no_target__${Date.now()}`;

    if (extractingVideoSrcs.has(lockKey)) {
      showNotification('⏳ 该视频正在下载中...', 'info');
      return;
    }
    extractingVideoSrcs.add(lockKey);
    // 60 秒后自动清理锁，避免 fetch 异常导致锁永不释放
    setTimeout(() => extractingVideoSrcs.delete(lockKey), 60000);

    try {
      // v23: 不再依赖可能错误的预关联 vid
      // 改为：收集所有已知 vid，逐个调 API，哪个返回的 URL 和当前 video 的 src 匹配就用哪个
      const videoSrc = getVideoSrcFromPage(targetVideo);
      
      // 收集所有已知 vid（去重）
      const allKnownVids = [];
      const seenVidSet = new Set();
      for (const entry of capturedVideoIds) {
        if (entry.id && !seenVidSet.has(entry.id)) {
          seenVidSet.add(entry.id);
          allKnownVids.push(entry.id);
        }
      }
      
      // 如果有关联的 vid，优先尝试它
      const associatedVid = targetVideo?.dataset?.doubaoVid;
      if (associatedVid && !allKnownVids.includes(associatedVid)) {
        allKnownVids.unshift(associatedVid);
      }
      
      console.log('[豆包去水印] chat 页面下载, video src =', videoSrc?.slice(0, 120));
      console.log('[豆包去水印] 已知 vid 列表:', allKnownVids);
      
      // ─── 策略 1：逐个尝试所有 vid 调 get_play_info API ───
      if (allKnownVids.length > 0) {
        showNotification('🔄 正在通过 API 获取无水印视频...', 'info');
        
        for (const tryVid of allKnownVids) {
          try {
            console.log('[豆包去水印] 尝试 vid:', tryVid);
            const res = await fetch(
              'https://www.doubao.com/samantha/media/get_play_info?aid=497858&device_platform=web&language=zh-CN',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
                },
                body: JSON.stringify({ key: tryVid })
              }
            );

            const json = await res.json();

            if (json.code === 0 && json.data) {
              const apiUrl = json.data.original_media_info?.main_url ||
                             json.data.media_info?.[0]?.main_url;

              if (apiUrl) {
                // v23: 成功拿到 URL，确认关联并下载
                if (targetVideo) {
                  targetVideo.dataset.doubaoVid = tryVid;
                  console.log('[豆包去水印] ✅ vid 匹配成功:', tryVid);
                }
                chrome.runtime.sendMessage({
                  action: 'download',
                  url: apiUrl,
                  filename: `doubao_${tryVid}.mp4`
                });
                showNotification('✅ 无水印视频下载已开始！', 'success');
                return;
              }
            }
          } catch (err) {
            console.log('[豆包去水印] vid', tryVid, 'API 调用失败:', err.message);
          }
        }
        console.log('[豆包去水印] 所有 vid 的 API 均未返回有效数据');
      }

      // v21: 策略 2：使用拦截到的无水印 URL（仅单视频时安全使用）
      //    多视频场景下 getLatestCapturedCleanUrl 可能属于其他视频，跳过
      const pageVideoCount = document.querySelectorAll('video').length;
      if (pageVideoCount <= 1) {
        const cleanUrl = getLatestCapturedCleanUrl();
        if (cleanUrl) {
          showNotification('🔄 正在下载无水印视频（策略2）...', 'info');
          chrome.runtime.sendMessage({
            action: 'download',
            url: cleanUrl,
            filename: `doubao_clean_${Date.now()}.mp4`
          });
          showNotification('✅ 无水印视频下载已开始！', 'success');
          return;
        }
      }

      // ─── 兜底：直接下载 <video> src ───
      if (videoSrc) {
        console.log('[豆包去水印] 兜底: 直接下载 video src，此版本含水印');
        const timestamp = Date.now();
        chrome.runtime.sendMessage({
          action: 'download',
          url: videoSrc,
          filename: `doubao_raw_${timestamp}.mp4`
        });
        showNotification('⚠️ 未能获取无水印版本，已下载原始视频（含水印）', 'warning');
      } else {
        showNotification('❌ 未找到视频地址', 'error');
      }

    } catch (err) {
      showNotification('❌ ' + (err.message || '获取失败'), 'error');
    } finally {
      extractingVideoSrcs.delete(lockKey);
    }
  }

  /**
   * 统一入口：根据页面类型自动选择下载方式
   * @param {HTMLVideoElement|null} targetVideo - 目标视频元素（多视频场景用）
   */
  async function downloadVideo(targetVideo) {
    if (isVideoSharingPage()) {
      const videoId = getVideoIdFromUrl();
      await extractVideoViaApi(videoId);
    } else if (isChatPage()) {
      await extractVideoChatPage(targetVideo);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // v21: 视频选择面板（多视频时让用户自行选择）
  // ═══════════════════════════════════════════════════════════

  /**
   * v19: 获取页面中所有有意义的视频（包括不可见的）
   * 排除规则：尺寸太小（< 80px）、隐藏元素（display:none）、被 CSS 隐藏
   * 返回 [{ video, index, rect, vid, posterUrl, visible }]
   */
  function getDownloadableVideos() {
    const allVideos = [...document.querySelectorAll('video')];
    // v21: 视频数量上限 10 个，超出提示联系开发者
    if (allVideos.length > 10) {
      showNotification('⚠️ 页面视频超过 10 个，请联系开发者：18124221616', 'error', 8000);
    }
    const results = [];
    const vh = window.innerHeight;
    const seenVids = new Set();  // v21: 按 vid 去重，避免同一视频的多个 DOM 元素重复出现
    for (let i = 0; i < allVideos.length; i++) {
      const v = allVideos[i];
      // 排除隐藏元素
      const style = window.getComputedStyle(v);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const r = v.getBoundingClientRect();
      if (r.width < 80 || r.height < 60) continue;
      const vid = v.dataset.doubaoVid || '';
      const posterUrl = v.poster || '';
      const visible = r.bottom > 0 && r.top < vh;

      // v21: 如果已有相同 vid 的视频，跳过（同一视频可能有多个 DOM 元素：播放器+缩略图）
      if (vid && seenVids.has(vid)) {
        console.log(`[豆包去水印] 跳过重复 vid 的视频元素: video[${i}], vid=${vid}`);
        continue;
      }
      if (vid) seenVids.add(vid);

      results.push({ video: v, index: i, rect: r, vid, posterUrl, visible });
    }
    console.log(`[豆包去水印] getDownloadableVideos: ${allVideos.length} 个 video 元素 → 去重后 ${results.length} 个`);
    return results;
  }

  /**
   * 从 video 元素截取当前帧作为缩略图
   */
  function captureVideoThumbnail(video) {
    try {
      const canvas = document.createElement('canvas');
      const w = Math.min(video.videoWidth || 320, 320);
      const h = Math.min(video.videoHeight || 180, 180);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.7);
    } catch (e) {
      return null;
    }
  }

  /**
   * v23: 弹出视频选择面板（简化版，无批量下载）
   */
  function showVideoSelector() {
    // 关闭已有的面板
    const existing = document.getElementById('dw-video-selector');
    if (existing) existing.remove();

    const videos = getDownloadableVideos();
    if (videos.length === 0) {
      showNotification('❌ 页面上没有可下载的视频', 'error');
      return;
    }

    // 创建遮罩
    const overlay = document.createElement('div');
    overlay.id = 'dw-video-selector';
    overlay.setAttribute('data-doubao-own', 'true');
    overlay.className = 'dw-selector-overlay';

    // 面板
    const panel = document.createElement('div');
    panel.className = 'dw-selector-panel';

    // 标题栏
    const header = document.createElement('div');
    header.className = 'dw-selector-header';
    header.innerHTML = `
      <span class="dw-selector-title">🎬 选择要下载的视频（共 ${videos.length} 个）</span>
      <button class="dw-selector-close" title="关闭">✕</button>
    `;

    // 视频列表
    const list = document.createElement('div');
    list.className = 'dw-selector-list';

    for (let i = 0; i < videos.length; i++) {
      const item = videos[i];
      const card = document.createElement('div');
      card.className = 'dw-selector-card';
      if (!item.visible) card.classList.add('dw-selector-card-hidden');

      // 缩略图：优先 poster，其次截取当前帧
      let thumbUrl = item.posterUrl;
      if (!thumbUrl) {
        const captured = captureVideoThumbnail(item.video);
        if (captured) thumbUrl = captured;
      }

      const vidStatus = item.vid ? '✅ 已识别' : '⏳ 识别中…';
      const vidShort = item.vid ? item.vid.slice(0, 16) + '…' : '—';
      const sizeText = `${Math.round(item.rect.width)}×${Math.round(item.rect.height)}`;
      const visHint = item.visible ? '' : '<span class="dw-selector-vis-hint">滚出视口</span>';

      card.innerHTML = `
        <div class="dw-selector-thumb">
          ${thumbUrl ? `<img src="${thumbUrl}" alt="视频${i + 1}" />` : '<div class="dw-selector-nothumb">🎬</div>'}
        </div>
        <div class="dw-selector-info">
          <div class="dw-selector-name">视频 ${i + 1} ${visHint}</div>
          <div class="dw-selector-meta">
            <span class="dw-selector-vid">${vidStatus}</span>
            <span class="dw-selector-size">${sizeText}</span>
          </div>
          <div class="dw-selector-vid-id" title="${item.vid || ''}">${vidShort}</div>
        </div>
        <button class="dw-selector-dl-btn" data-vid-index="${i}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          下载
        </button>
      `;

      // 单个下载按钮
      const dlBtn = card.querySelector('.dw-selector-dl-btn');
      dlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        overlay.remove();
        downloadVideo(item.video);
      });

      // 点击卡片其他区域 → 滚动到视频
      card.addEventListener('click', (e) => {
        if (e.target.closest('.dw-selector-dl-btn')) return;
        item.video.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });

      list.appendChild(card);
    }

    panel.appendChild(header);
    panel.appendChild(list);
    overlay.appendChild(panel);

    // 关闭按钮
    header.querySelector('.dw-selector-close').addEventListener('click', () => overlay.remove());
    // 点击遮罩关闭
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
    // ESC 关闭
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    document.body.appendChild(overlay);
  }

  // ═══════════════════════════════════════════════════════════
  // v11 图片去水印核心函数
  // ═══════════════════════════════════════════════════════════

  // 图片下载锁（防重复）
  const extractingImageUrls = new Set();

  /**
   * 下载图片（优先使用 API 拦截到的 image_ori_raw URL）
   *
   * @param {HTMLImageElement|null} targetImg - 点击时关联的 img 元素（用于 DOM 顺序匹配）
   * @param {string|null} forcedUrl - 强制指定的下载 URL（覆盖按钮绑定用）
   */
  async function downloadImage(targetImg, forcedUrl) {
    // 优先级 1：按钮绑定的原图 URL（来自 API 拦截）
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

    if (extractingImageUrls.has(imageUrl)) {
      showNotification('⏳ 该图片正在下载中...', 'info');
      return;
    }
    extractingImageUrls.add(imageUrl);

    try {
      // 判断是否为带水印的图（域名特征）
      const isCleanUrl = imageUrl.includes('byteimg.com') ||
                         imageUrl.includes('lf') ||
                         imageUrl.includes('image_ori_raw') ||
                         !imageUrl.includes('watermark');

      const ext = imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
      const filename = `doubao_image_${Date.now()}.${ext}`;

      chrome.runtime.sendMessage({
        action: 'download',
        url: imageUrl,
        filename
      });
      showNotification(isCleanUrl ? '✅ 无水印图片下载已开始！' : '⚠️ 正在下载图片（可能含水印）', 'success');
    } finally {
      setTimeout(() => extractingImageUrls.delete(imageUrl), 5000);
    }
  }

  /**
   * 为指定的 img 元素匹配拦截到的原图 URL
   * 策略：优先按 DOM 顺序（第N张图对应第N个拦截 URL）
   */
  function findImageUrlForElement(imgEl) {
    if (!imgEl) return null;
    if (capturedImageUrls.length === 0) return null;

    // 从 data 属性读取已关联的 URL
    if (imgEl.dataset.doubaoImageUrl) {
      return imgEl.dataset.doubaoImageUrl;
    }

    // 按 DOM 顺序匹配：找到页面上所有 AI 生成图片的 img，按顺序与拦截 URL 对应
    const allAiImgs = getAiGeneratedImages();
    const imgIndex = allAiImgs.indexOf(imgEl);

    if (imgIndex >= 0 && imgIndex < capturedImageUrls.length) {
      // capturedImageUrls 最新在前，反转后按 DOM 顺序对应
      const reversed = [...capturedImageUrls].reverse();
      return reversed[imgIndex]?.url || null;
    }

    // 兜底：返回最新的拦截 URL
    return capturedImageUrls[0]?.url || null;
  }

  /**
   * 获取页面上所有 AI 生成图片的 img 元素
   * 通过类名/尺寸/父容器特征识别
   */
  function getAiGeneratedImages() {
    const results = [];
    const imgs = document.querySelectorAll('img');

    for (const img of imgs) {
      if (isOwnElement(img)) continue;
      const src = img.src || img.currentSrc || '';
      if (!src || src.includes('icon') || src.includes('logo') || src.includes('avatar')) continue;

      // 图片尺寸太小的跳过（小于 100px 通常是 UI 图标）
      const rect = img.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 60) continue;

      results.push(img);
    }

    return results;
  }

  /**
   * 获取页面上所有 AI 生成图片的 img 元素（仅未分配按钮的）
   * 用于给新图片分配 URL 时计算偏移量
   */
  function getUnassignedAiImages() {
    const results = [];
    const imgs = document.querySelectorAll('img');

    for (const img of imgs) {
      if (isOwnElement(img)) continue;
      if (imageDownloadBtns.has(img)) continue;
      const src = img.src || img.currentSrc || '';
      if (!src || src.startsWith('data:')) continue;

      // v23: 严格识别 AI 生成图片——必须含 rc_gen_image/{32位hex hash}
      // 这是最精确的识别标志：视频预览图、头像、UI 图标都不会有这个路径
      const isAiImage = /rc_gen_image\/[a-f0-9]{32}/i.test(src);
      if (!isAiImage) continue;

      // 尺寸筛选（>100px）
      const rect = img.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) continue;

      results.push(img);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // 提取图集（thread 页面）
  // ═══════════════════════════════════════════════════════════

  async function extractThreadImages() {
    showNotification('🔄 正在提取图集...', 'info');

    let images = [];

    const fnArgsEl = document.querySelector('[data-script-src="modern-run-router-data-fn"][data-fn-args]');
    if (fnArgsEl) {
      const jsonStr = fnArgsEl.getAttribute('data-fn-args').replace(/&quot;/g, '"');
      try {
        const jsonData = JSON.parse(jsonStr);
        for (const item of jsonData) {
          if (typeof item === 'object' && item.data && item.data.message_snapshot) {
            const msgList = item.data.message_snapshot.message_list || [];
            for (const msg of msgList) {
              if (!msg.content_block) continue;
              for (const block of msg.content_block) {
                try {
                  const contentV2 = JSON.parse(block.content_v2);
                  if (contentV2.creation_block?.creations) {
                    for (const creation of contentV2.creation_block.creations) {
                      if (creation.image?.image_ori_raw?.url) {
                        images.push(creation.image.image_ori_raw.url.replace(/&amp;/g, '&'));
                      }
                    }
                  }
                } catch (e) { /* skip */ }
              }
            }
          }
        }
      } catch (e) { /* fallback */ }
    }

    if (images.length === 0) {
      showNotification('❌ 未找到图片，请尝试在弹窗中解析', 'error');
      return;
    }

    images.forEach((imgUrl, i) => {
      const ext = imgUrl.match(/\.(jpg|jpeg|png|webp)/)?.[1] || 'jpg';
      chrome.runtime.sendMessage({
        action: 'download',
        url: imgUrl,
        filename: `doubao_image_${i + 1}.${ext}`
      });
    });

    showNotification(`✅ 开始下载 ${images.length} 张图片！`, 'success');
  }

  // ═══════════════════════════════════════════════════════════
  // v12 即梦 / Dreamina 按钮管理器（fixed 定位，避免 overflow 裁剪）
  // ═══════════════════════════════════════════════════════════

  const jimengBtnManager = {
    videoBtns: new Map(), // videoEl -> btnEl
    imageBtns: new Map(), // imgEl -> btnEl
    allBtn: null,         // 「下载全部」按钮

    // 清理已不存在的元素对应的按钮
    cleanup() {
      for (const [el, btn] of this.videoBtns) {
        if (!document.body.contains(el)) {
          btn.remove();
          this.videoBtns.delete(el);
        }
      }
      for (const [el, btn] of this.imageBtns) {
        if (!document.body.contains(el)) {
          btn.remove();
          this.imageBtns.delete(el);
        }
      }
    },

    // 更新所有按钮位置
    updatePositions() {
      this.cleanup();

      for (const [el, btn] of this.videoBtns) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
          btn.style.display = 'none';
          continue;
        }
        btn.style.display = 'flex';
        btn.style.left = (rect.right - btn.offsetWidth - 10) + 'px';
        btn.style.top = (rect.top + 10) + 'px';
      }

      for (const [el, btn] of this.imageBtns) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom < 0 || rect.top > window.innerHeight) {
          btn.style.display = 'none';
          continue;
        }
        btn.style.display = 'flex';
        // 左下角，避免和原生右上角按钮重叠
        btn.style.left = (rect.left + 10) + 'px';
        btn.style.top = (rect.bottom - btn.offsetHeight - 10) + 'px';
      }
    },

    // 移除所有按钮
    clear() {
      for (const [el, btn] of this.videoBtns) btn.remove();
      this.videoBtns.clear();
      for (const [el, btn] of this.imageBtns) btn.remove();
      this.imageBtns.clear();
      if (this.allBtn) {
        this.allBtn.remove();
        this.allBtn = null;
      }
    }
  };

  // ═══════════════════════════════════════════════════════════
  // v12 即梦 / Dreamina 下载逻辑
  // ═══════════════════════════════════════════════════════════

  // 即梦下载锁
  const jimengDownloadLocks = new Set();

  /**
   * 根据 item_id 从拦截 URL 列表中找到对应的视频 URL
   */
  function findJimengVideoUrlByItemId(itemId) {
    if (!itemId || jimengVideoUrls.length === 0) return null;
    // 优先精确匹配
    const exact = jimengVideoUrls.find(v => v.url.includes(itemId));
    if (exact) return exact.url;
    // 次优：包含共同短 ID（前16位）
    const shortId = itemId.slice(0, 16);
    const short = jimengVideoUrls.find(v => v.url.includes(shortId));
    return short ? short.url : null;
  }

  /**
   * 根据 item_id 从拦截 URL 列表中找到对应的图片 URL（精确匹配）
   */
  function findJimengImageUrlByItemId(itemId) {
    if (!itemId || jimengImageUrls.length === 0) return null;
    const match = jimengImageUrls.find(v => v.url.includes(itemId));
    return match ? match.url : null;
  }

  /**
   * 从视频元素找到即梦 item_id（来自 video src URL）
   */
  function getJimengItemIdFromVideo(videoEl) {
    if (!videoEl) return null;
    const src = videoEl.src || videoEl.currentSrc || '';
    // 匹配 ?item_id=xxx 或 &item_id=xxx
    const m = src.match(/[?&]item_id=([^&]+)/);
    return m ? m[1] : null;
  }

  /**
   * 从图片元素找到即梦 item_id（来自 img src URL）
   */
  function getJimengItemIdFromImage(imgEl) {
    if (!imgEl) return null;
    const src = imgEl.src || imgEl.currentSrc || '';
    const m = src.match(/[?&]item_id=([^&]+)/);
    return m ? m[1] : null;
  }

  /**
   * 下载即梦视频：优先通过 item_id 精准匹配，其次 fallback 最近拦截
   */
  function downloadJimengVideo(clickedVideoEl) {
    if (jimengVideoUrls.length === 0) {
      showNotification('❌ 未拦截到视频，请确保已打开作品详情页', 'error');
      return;
    }
    // 精准匹配：从点击的视频 src 中提取 item_id，对应拦截 URL
    const itemId = getJimengItemIdFromVideo(clickedVideoEl);
    let url = null;
    if (itemId) {
      url = findJimengVideoUrlByItemId(itemId);
      console.log(`[豆包去水印] 即梦视频 item_id=${itemId} → 匹配到: ${url?.slice(0, 80) || '未匹配'}`);
    }
    // fallback：全局最近拦截（兜底）
    if (!url) {
      url = jimengVideoUrls[0].url;
      console.log(`[豆包去水印] 即梦视频未匹配 item_id，使用最近拦截: ${url?.slice(0, 80)}`);
    }
    const lockKey = 'video_' + url.slice(0, 50);
    if (jimengDownloadLocks.has(lockKey)) {
      showNotification('⏳ 视频正在下载中...', 'info');
      return;
    }
    jimengDownloadLocks.add(lockKey);
    showNotification('🔄 正在下载视频...', 'info');
    const ext = url.match(/\.(mp4|webm|mov)/i)?.[1] || 'mp4';
    chrome.runtime.sendMessage({
      action: 'download',
      url: url,
      filename: `jimeng_video_${Date.now()}.${ext}`
    });
    setTimeout(() => jimengDownloadLocks.delete(lockKey), 5000);
    showNotification('✅ 视频下载已开始！', 'success');
  }

  /**
   * 下载即梦图片：优先通过 item_id 精准匹配，其次取最高质量
   */
  function downloadJimengImage(targetImg) {
    if (jimengImageUrls.length === 0) {
      showNotification('❌ 未拦截到图片，请确保已打开作品详情页', 'error');
      return;
    }
    // 精准匹配：从点击的图片 src 中提取 item_id
    const itemId = getJimengItemIdFromImage(targetImg);
    let url = null;
    if (itemId) {
      url = findJimengImageUrlByItemId(itemId);
      console.log(`[豆包去水印] 即梦图片 item_id=${itemId} → 匹配到: ${url?.slice(0, 80) || '未匹配'}`);
    }
    // fallback：按钮上绑定的 data 属性（上次注入时关联的）
    if (!url) {
      url = targetImg?.dataset?.jimengImgUrl || jimengImageUrls[0]?.url;
    }
    const lockKey = 'img_' + url.slice(0, 50);
    if (jimengDownloadLocks.has(lockKey)) {
      showNotification('⏳ 图片正在下载中...', 'info');
      return;
    }
    jimengDownloadLocks.add(lockKey);
    showNotification('🔄 正在下载图片...', 'info');
    const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
    chrome.runtime.sendMessage({
      action: 'download',
      url: url,
      filename: `jimeng_image_${Date.now()}.${ext}`
    });
    setTimeout(() => jimengDownloadLocks.delete(lockKey), 5000);
    showNotification('✅ 图片下载已开始！', 'success');
  }

  /**
   * 下载即梦全部图片（按质量降序）
   */
  function downloadAllJimengImages() {
    if (jimengImageUrls.length === 0) {
      showNotification('❌ 未拦截到图片', 'error');
      return;
    }
    showNotification(`🔄 正在下载 ${jimengImageUrls.length} 张图片...`, 'info');
    jimengImageUrls.forEach(({ url }, i) => {
      const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
      chrome.runtime.sendMessage({
        action: 'download',
        url: url,
        filename: `jimeng_image_${i + 1}.${ext}`
      });
    });
    showNotification(`✅ 开始下载 ${jimengImageUrls.length} 张图片！`, 'success');
  }

  /**
   * 即梦页面：为 video 和 img 元素添加下载按钮（fixed 定位，避免 overflow 裁剪）
   */
  function addJimengDownloadButtons() {
    if (!isJimengPage()) return;

    // ─── 视频下载按钮 ───
    if (jimengVideoUrls.length > 0) {
      const videos = document.querySelectorAll('video');
      for (const video of videos) {
        if (jimengBtnManager.videoBtns.has(video)) continue;

        const rect = video.getBoundingClientRect();
        // 只给足够大的视频加按钮（排除小预览/缩略图）
        if (rect.width < 150 || rect.height < 100) continue;

        const btn = document.createElement('div');
        btn.className = 'dw-jm-fixed-btn dw-jm-video-fixed-btn';
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>下载视频</span>
        `;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadJimengVideo(video);  // 传入被点击按钮对应的 video 元素
        });

        document.body.appendChild(btn);
        jimengBtnManager.videoBtns.set(video, btn);
      }
    }

    // ─── 图片下载按钮 ───
    if (jimengImageUrls.length > 0) {
      const imgs = document.querySelectorAll('img');
      for (const img of imgs) {
        if (isOwnElement(img)) continue;
        if (jimengBtnManager.imageBtns.has(img)) continue;

        const src = img.src || img.currentSrc || '';
        if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue;

        const rect = img.getBoundingClientRect();
        // 严格的尺寸过滤：只给大图加按钮（排除图标/头像/缩略图）
        if (rect.width < 200 || rect.height < 200) continue;

        // 排除 UI 图标（更严格的过滤）
        const lowerSrc = src.toLowerCase();
        const excludeKeywords = [
          'icon', 'logo', 'avatar', 'thumbnail', 'badge', 'button',
          'arrow', 'close', 'menu', 'nav', 'loading', 'spinner',
          'placeholder', 'empty', 'default', 'sprite', 'svg',
          'emoji', 'face', 'profile', 'user', 'header'
        ];
        if (excludeKeywords.some(k => lowerSrc.includes(k))) continue;

        // 关联图片 URL
        const bestImg = jimengImageUrls[0];
        if (bestImg) img.dataset.jimengImgUrl = bestImg.url;

        const btn = document.createElement('div');
        btn.className = 'dw-jm-fixed-btn dw-jm-img-fixed-btn';
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>原图</span>
        `;
        const targetImg = img;
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          downloadJimengImage(targetImg);
        });

        document.body.appendChild(btn);
        jimengBtnManager.imageBtns.set(img, btn);
      }

      // 「下载全部图片」按钮（显示去重后的数量）
      const uniqueCount = new Set(jimengImageUrls.map(v => v.url)).size;
      if (!jimengBtnManager.allBtn) {
        const allBtn = document.createElement('div');
        allBtn.className = 'dw-jm-all-btn';
        allBtn.style.cssText = `
          position: fixed;
          bottom: 80px;
          right: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 10px 18px;
          border-radius: 24px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          z-index: 999999;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          display: flex;
          align-items: center;
          gap: 6px;
        `;
        allBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>下载全部图片 (${uniqueCount})</span>
        `;
        allBtn.addEventListener('click', downloadAllJimengImages);
        document.body.appendChild(allBtn);
        jimengBtnManager.allBtn = allBtn;
      } else {
        const span = jimengBtnManager.allBtn.querySelector('span');
        if (span) span.textContent = `下载全部图片 (${uniqueCount})`;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 下载按钮检测工具函数
  // ═══════════════════════════════════════════════════════════

  /**
   * 判断元素是否为我们自己创建的通知/按钮元素
   */
  function isOwnElement(el) {
    if (!el) return false;
    if (el.classList?.contains('dw-nowm-btn')) return true;
    if (el.classList?.contains('dw-img-btn')) return true;
    if (el.classList?.contains('dw-notification')) return true;
    if (el.classList?.contains('dw-jm-fixed-btn')) return true;
    if (el.classList?.contains('dw-jm-all-btn')) return true;
    if (el.closest?.('.dw-nowm-btn')) return true;
    if (el.closest?.('.dw-img-btn')) return true;
    if (el.closest?.('.dw-notification')) return true;
    if (el.closest?.('.dw-jm-fixed-btn')) return true;
    if (el.closest?.('.dw-jm-all-btn')) return true;
    return false;
  }

  function isDownloadButton(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (isOwnElement(el)) return false;

    // v13: 黑名单 — 避免劫持登录、导航、输入等元素
    const BLACKLISTED_SELECTORS = [
      '[class*="login"]', '[class*="Login"]',
      'input', 'textarea', 'select',
      '[aria-label*="登录"]',
      '[class*="menu"]', '[class*="header"]',
      '[class*="sidebar"]', '[class*="footer"]',
      '[class*="nav"]', '[class*="toolbar"]',
      '[class*="input"]', '[class*="form"]',
      // v21: 排除关闭/全屏等工具栏按钮
      '[aria-label*="关闭"]', '[aria-label*="close" i]', '[aria-label*="关闭" i]',
      '[class*="close"]', '[class*="Close"]', '[class*="fullscreen"]', '[class*="expand"]',
      '[class*="preview"]', '[class*="lightbox"]',
      // 排除右上角固定的"工具栏"容器内的按钮（如预览/全屏/关闭）
      '[class*="preview-toolbar"]', '[class*="action-bar"]',
      '[class*="video-toolbar"]', '[class*="player-toolbar"]',
      // v21: 排除 X 关闭按钮
      '[class*="dismiss"]', '[class*="Dismiss"]',
      '[class*="icon-close"]', '[class*="iconClose"]',
      'svg[class*="close" i]',
    ];
    for (const sel of BLACKLISTED_SELECTORS) {
      try {
        if (el.matches && el.matches(sel)) return false;
      } catch (e) {}
    }

    // v21: 检查祖先是否在登录/导航/工具栏区域（扩大到 8 层，覆盖 chat 页面工具栏）
    let p = el;
    for (let i = 0; i < 8 && p; i++) {
      const cls = (p.className || '').toString().toLowerCase();
      if (/login|nav|menu|header|sidebar|toolbar|modal|dialog|preview|lightbox|chat-/.test(cls)) return false;
      p = p.parentElement;
    }

    // 排除明确的功能按钮
    const tc = (el.textContent || '').trim();
    if (tc && tc.length < 20) {
      const BLACKLISTED_TEXT = ['登录', '注册', '发送', '提交', '取消', '复制', '分享', '关闭', '全屏', '退出全屏', '删除', '更多', '收起', '编辑', '清空'];
      if (BLACKLISTED_TEXT.includes(tc)) return false;
    }

    const text = (el.textContent || '').trim().slice(0, 50);
    const title = (el.getAttribute('title') || '').trim();
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    const href = el.getAttribute('href') || '';
    const hasDownload = el.hasAttribute('download');
    const tagName = el.tagName.toLowerCase();
    const className = (el.className || '').toString().toLowerCase();
    const dataAction = (el.getAttribute('data-action') || '').toLowerCase();
    const dataTrack = (el.getAttribute('data-track') || '').toLowerCase();

    // v21: 用直接子节点的纯文本（不含深层后代），避免父级容器继承"保存"二字
    // textContent 包含所有后代 → 误判。改用 firstChild / 直接 text node
    const ownText = Array.from(el.childNodes || [])
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => (n.textContent || '').trim())
      .join(' ')
      .trim();

    // 检查父级 1-2 层的"保存/下载"语义（保留必要场景），但排除明显是工具栏/容器的元素
    const isContainer = (n) => {
      const t = (n.tagName || '').toLowerCase();
      return t === 'div' || t === 'section' || t === 'header' || t === 'footer' || t === 'main' || t === 'aside';
    };

    // v21: X 关闭按钮的常见 SVG 路径识别
    const isCloseIcon = (() => {
      const html = (el.innerHTML || '').toLowerCase();
      // Material / Feishin / 通用 X 图标：M6 6L18 18、M6 18L18 6 等
      return /m6[^0-9]*6[^a-z]*l?1?[28][^0-9]*1?[28]|m6[^0-9]*1?[28][^a-z]*l?1?[28][^0-9]*6|x-?close|icon-?close|close-?icon|class="[^"]*close/i.test(html);
    })();

    const isDownloadAction =
      hasDownload ||
      (tagName === 'a' && /\.(mp4|webm|mov)/i.test(href)) ||
      // 完全匹配下载/保存动词（自身或父按钮容器的直接文本）
      /^(保存|下载|另存为|存本地|save|download)$/i.test(ownText) ||
      /^(保存|下载|另存为|存本地|save|download)$/i.test(text) ||
      // 严格的"直接包含"：避免父级容器 textContent 误判，要求 title/aria-label 必须**完整等于**某个下载词
      /^(保存|下载|另存为|存本地|save|download)$/i.test(title) ||
      /^(保存|下载|另存为|存本地|save|download)$/i.test(ariaLabel) ||
      /\bsave\b|\bdownload\b/i.test(title + ' ' + ariaLabel + ' ' + dataAction + ' ' + dataTrack) ||
      /download|save-btn|btn-download|btn-save|icon-download|icon-save/i.test(className) ||
      /download|save/i.test(dataAction + ' ' + dataTrack);

    const isNonDownload =
      // 包含明确的非下载动词（自文本或 title/aria-label）
      /收藏|关注|点赞|评论|分享|转发|报告|取消保存|关闭|全屏|退出全屏|复制|删除|编辑|更多|收起/i.test(ownText + title + ariaLabel) ||
      /收藏|关注|点赞|评论|分享|转发|报告|取消保存|关闭|全屏|退出全屏|复制|删除|编辑|更多|收起/i.test(text) ||
      /favorite|follow|like|comment|share|report|unsave|close|fullscreen|copy|delete|remove|edit|more/i.test(title + ' ' + ariaLabel) ||
      // v21: X 关闭图标直接拒绝
      isCloseIcon ||
      // v21: 容器元素（div/section/header）如果只通过 className 间接匹配，不当作按钮劫持（容器不应被劫持 click）
      (isContainer(el) && !hasDownload && !/(btn|button)/i.test(className));

    return isDownloadAction && !isNonDownload;
  }

  /**
   * 判断元素是否为视频下载图标按钮（⬇️ 图标，无文字）
   */
  function isVideoDownloadIcon(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (isOwnElement(el)) return false;

    // v21: 排除关闭/工具栏按钮
    const elAriaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
    const elCls = (el.className || '').toString().toLowerCase();
    if (elAriaLabel.includes('关闭') || elAriaLabel.includes('close') ||
        /\bclose\b|fullscreen|expand|preview-/.test(elCls)) return false;

    const text = (el.textContent || '').trim();
    const className = (el.className || '').toString().toLowerCase();
    const innerHTML = (el.innerHTML || '').toLowerCase();

    if (text.length > 10) return false;
    if (text === '关闭' || text === '全屏' || text === '退出全屏') return false;

    const hasDownloadIcon =
      innerHTML.includes('<svg') && (
        innerHTML.includes('m21 15v4') ||
        innerHTML.includes('m4 17v2') ||
        innerHTML.includes('m12 15v3') ||
        innerHTML.includes('polyline points="7 10 12 15 17 10"') ||
        innerHTML.includes('arrow-down') ||
        innerHTML.includes('download') ||
        innerHTML.includes('⬇') ||
        innerHTML.includes('↓')
      );

    const hasDownloadClass = /download|save/i.test(className);

    let nearVideo = false;
    if (el.tagName === 'VIDEO' || el.closest('video')) {
      nearVideo = true;
    } else {
      let parent = el;
      for (let i = 0; i < 8 && parent; i++) {
        if (parent.querySelector('video')) {
          nearVideo = true;
          break;
        }
        parent = parent.parentElement;
      }
    }

    return (hasDownloadIcon || hasDownloadClass) && nearVideo;
  }

  // ═══════════════════════════════════════════════════════════
  // 拦截机制 1：全局点击捕获（capture 阶段）
  // ═══════════════════════════════════════════════════════════

  document.addEventListener('click', (e) => {
    if (!isActivePage()) return;

    if (isOwnElement(e.target) || isOwnElement(e.target.closest('.dw-nowm-btn, .dw-img-btn, .dw-notification'))) return;

    const candidates = [];
    let el = e.target;
    for (let i = 0; i < 12 && el && el !== document.body; i++) {
      candidates.push(el);
      el = el.parentElement;
    }

    for (const element of candidates) {
      // v21: 跳过关闭/X 按钮、toolbar 工具按钮
      const elAriaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
      const elCls = (element.className || '').toString().toLowerCase();
      const elInnerHtml = (element.innerHTML || '').toLowerCase();
      // aria-label / class 包含 close/全屏
      if (elAriaLabel.includes('关闭') || elAriaLabel.includes('close') ||
          /\bclose\b|fullscreen|expand|preview-/.test(elCls) ||
          // v21: X 关闭图标 SVG 路径识别（Material/Feishin/通用 X 形态）
          /m6[^0-9]*6[^a-z]*l?1?[28][^0-9]*1?[28]|m6[^0-9]*1?[28][^a-z]*l?1?[28][^0-9]*6|icon-?close|iconClose|class="[^"]*close|x-?icon/i.test(elInnerHtml) ||
          // v21: 含 dismiss/close-icon 等样式
          /dismiss|icon-?close|close-?icon|close-?btn/i.test(elCls)) {
        return; // 不拦截这个事件，让原生处理
      }
      const elText = (element.textContent || '').trim();
      if (['关闭', '全屏', '退出全屏', '删除', '更多', '收起', '编辑', '清空'].includes(elText)) return;

      if (isDownloadButton(element)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const targetVideo = findNearestVideo(element);
        console.log('[豆包去水印] 拦截按钮:', element.textContent?.trim()?.slice(0, 20) || 'icon', targetVideo ? '→ 已定位视频' : '→ 未定位视频');
        downloadVideo(targetVideo);
        return;
      }

      if (isVideoDownloadIcon(element)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const targetVideo = findNearestVideo(element);
        console.log('[豆包去水印] 拦截视频下载图标', targetVideo ? '→ 已定位视频' : '→ 未定位视频');
        downloadVideo(targetVideo);
        return;
      }
    }
  }, true);

  // ═══════════════════════════════════════════════════════════
  // 拦截机制 2：MutationObserver 检测下载按钮
  // ═══════════════════════════════════════════════════════════

  const hookedButtons = new WeakSet();

  function hookDownloadButton(el) {
    if (hookedButtons.has(el)) return;
    if (isOwnElement(el)) return;

    hookedButtons.add(el);

    const handler = (e) => {
      if (!isActivePage()) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const targetVideo = findNearestVideo(el);
      downloadVideo(targetVideo);
    };

    el.addEventListener('click', handler, false);
    el.addEventListener('click', handler, true);

    console.log('[豆包去水印] 已劫持按钮:', el.textContent?.trim()?.slice(0, 20) || 'icon');
  }

  function scanAndHookButtons() {
    if (!isActivePage()) return;

    const selectors = [
      'a[download]',
      '[class*="download" i]',
      '[class*="save" i]',
      '[aria-label*="下载" i]',
      '[aria-label*="保存" i]',
      '[title*="下载" i]',
      '[title*="保存" i]',
      '[data-action*="download" i]',
      '[data-action*="save" i]',
      'button',
      '[role="button"]',
      'a[href]'
    ];

    // v13: chat 页面跳过 video 祖先循环，仅使用全局选择器扫描
    if (!isChatPage()) {
      const videoElements = document.querySelectorAll('video');
      for (const video of videoElements) {
        let container = video;
        for (let i = 0; i < 5 && container; i++) {
          container = container.parentElement;
          if (!container) break;
          const btns = container.querySelectorAll('button, [role="button"], div, span, a');
          for (const btn of btns) {
            if ((isDownloadButton(btn) || isVideoDownloadIcon(btn)) && !hookedButtons.has(btn)) {
              hookDownloadButton(btn);
            }
          }
        }
      }
    }

    for (const sel of selectors) {
      try {
        const elements = document.querySelectorAll(sel);
        for (const el of elements) {
          if ((isDownloadButton(el) || isVideoDownloadIcon(el)) && !hookedButtons.has(el)) {
            hookDownloadButton(el);
          }
        }
      } catch (e) { /* 无效选择器 */ }
    }
  }

  // MutationObserver
  const observer = new MutationObserver((mutations) => {
    if (!isActivePage()) return;

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (isOwnElement(node)) continue;

        if ((isDownloadButton(node) || isVideoDownloadIcon(node)) && !hookedButtons.has(node)) {
          hookDownloadButton(node);
        }

        const btns = node.querySelectorAll?.('button, [role="button"], a[download], [class*="save" i], [class*="download" i]');
        if (btns) {
          for (const btn of btns) {
            if ((isDownloadButton(btn) || isVideoDownloadIcon(btn)) && !hookedButtons.has(btn)) {
              hookDownloadButton(btn);
            }
          }
        }

        // v10: 新增 video 元素时，立刻尝试关联 vid
        const videos = node.querySelectorAll?.('video');
        if (videos && videos.length > 0) {
          associateVidToVideoElements();
          addVideoDownloadButtons();
        }

        // video 容器扫描
        if (videos) {
          for (const video of videos) {
            let container = video;
            for (let i = 0; i < 5 && container; i++) {
              container = container.parentElement;
              if (!container) break;
              const smallBtns = container.querySelectorAll('button, [role="button"], div, span, a');
              for (const btn of smallBtns) {
                if ((isDownloadButton(btn) || isVideoDownloadIcon(btn)) && !hookedButtons.has(btn)) {
                  hookDownloadButton(btn);
                }
              }
            }
          }
        }

        // v11: 新增 img 时，检查是否需要添加图片下载按钮
        const imgs = node.querySelectorAll?.('img');
        if (imgs && imgs.length > 0) {
          setTimeout(addImageDownloadButtons, 300);
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(scanAndHookButtons, 1000);
  setTimeout(scanAndHookButtons, 3000);
  setTimeout(scanAndHookButtons, 6000);

  // ═══════════════════════════════════════════════════════════
  // 拦截机制 3：右键菜单拦截 video 元素
  // ═══════════════════════════════════════════════════════════

  document.addEventListener('contextmenu', (e) => {
    if (!isActivePage()) return;
    if (e.target.tagName === 'VIDEO' || e.target.closest('video')) {
      chrome.runtime.sendMessage({
        action: 'videoRightClick',
        pageType: isChatPage() ? 'chat' : 'video-sharing',
        videoId: getVideoIdFromUrl() || null,
        videoSrc: getVideoSrcFromPage(e.target.tagName === 'VIDEO' ? e.target : e.target.closest('video'))
      });
    }
  }, true);

  // ═══════════════════════════════════════════════════════════
  // 视频区域「无水印下载」按钮（支持多视频）
  // v21: 改用 fixed 定位 + appendChild 到 body，避免污染视频容器 DOM
  //      修复：视频区域内的原生按钮（保存/关闭等）被误拦截问题
  // ═══════════════════════════════════════════════════════════

  const videoDownloadBtns = new Map(); // video 元素 → 覆盖按钮元素

  function addVideoDownloadButtons() {
    if (!isVideoSharingPage() && !isChatPage()) return;

    // v10: 每次添加按钮时，先尝试关联 vid
    associateVidToVideoElements();

    // v23: 放宽门槛，确保所有有意义的视频都加按钮
    const allVideos = document.querySelectorAll('video');
    const videos = [...allVideos].filter(v => {
      const r = v.getBoundingClientRect();
      // 排除隐藏元素
      const style = window.getComputedStyle(v);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      // 尺寸门槛 100×80（从 200×150 放宽）
      if (r.width < 100 || r.height < 80) return false;
      // 不再限制视口可见，滚出视口的也加按钮（fixed 定位会跟随）
      return true;
    });
    for (const video of videos) {
      // 已有按钮的跳过
      if (videoDownloadBtns.has(video)) continue;

      // v23: 尺寸门槛和过滤保持一致
      const initialRect = video.getBoundingClientRect();
      if (initialRect.width < 100 || initialRect.height < 80) continue;

      const overlayBtn = document.createElement('div');
      overlayBtn.className = 'dw-nowm-btn';
      overlayBtn.setAttribute('data-doubao-own', 'true');

      const associatedVid = video.dataset.doubaoVid;
      const statusHint = associatedVid ? `✅` : `⏳`;
      const tooltip = associatedVid
        ? `点击下载无水印视频（vid: ${associatedVid.slice(0, 12)}…）`
        : '点击下载当前视频（首次会拦截网络请求获取无水印 URL，可能需要 1-2 秒）';
      overlayBtn.title = tooltip;
      overlayBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>${statusHint} 无水印下载</span>
      `;

      // v21: 改用 fixed 定位 — 初始位置基于 video 的 rect
      overlayBtn.style.position = 'fixed';
      positionOverlayButton(overlayBtn, video);

      const targetVideo = video;
      const onClick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        // v21: 只在 vid 未建立时才尝试关联，不清空已有的（清空会导致重新匹配到错的 vid）
        if (!targetVideo.dataset.doubaoVid) {
          try {
            const newVid = findVideoIdForElement(targetVideo);
            if (newVid) {
              targetVideo.dataset.doubaoVid = newVid;
              console.log('[豆包去水印] ✅ 覆盖按钮点击时关联 vid:', newVid);
            } else {
              console.log('[豆包去水印] ⚠️ 覆盖按钮点击时未能关联 vid，将走兜底下载');
            }
          } catch (err) {
            console.log('[豆包去水印] vid 关联失败:', err.message);
          }
        }
        await downloadVideo(targetVideo);
      };
      // v21: 只拦截 mousedown/pointerdown/touchstart，避免穿透到原生 UI；
      //    click 事件让 onClick 处理（之前 stopImmediatePropagation 把 click 也拦截了，导致 onClick 永远不触发）
      ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach(evt => {
        overlayBtn.addEventListener(evt, (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }, true);
      });
      overlayBtn.addEventListener('click', onClick);

      // v21: 附加到 body（不再 appendChild 到视频容器，避免污染 DOM）
      document.body.appendChild(overlayBtn);
      videoDownloadBtns.set(video, overlayBtn);
    }

    // 更新已有按钮的关联状态 + 位置 + 清理已移除的
    for (const [video, overlayBtn] of videoDownloadBtns) {
      if (!document.contains(video)) {
        overlayBtn.remove();
        videoDownloadBtns.delete(video);
        continue;
      }
      const span = overlayBtn.querySelector('span');
      if (span) {
        const associatedVid = video.dataset.doubaoVid;
        const statusHint = associatedVid ? '✅' : '⏳';
        const newText = `${statusHint} 无水印下载`;
        if (span.textContent !== newText) span.textContent = newText;
      }
    // v23: 更新按钮位置（video 可能滚动/调整大小）
    positionOverlayButton(overlayBtn, video);
    }
  }

  /**
   * v14: 根据目标元素的视口位置定位 fixed 按钮
   *   - 视频：右上角
   *   - 图片：右下角（避免和右上角原生按钮冲突）
   */
  function positionOverlayButton(btn, targetEl) {
    const rect = targetEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';

    if (btn.classList.contains('dw-img-btn')) {
      // 图片按钮：右下角
      btn.style.top = (rect.bottom - 32) + 'px';
      btn.style.left = (rect.right - 60) + 'px';
    } else {
      // 视频按钮：右上角
      btn.style.top = (rect.top + 12) + 'px';
      btn.style.left = (rect.right - 130) + 'px';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // v11 图片区域「无水印下载」按钮
  // ═══════════════════════════════════════════════════════════

  const imageDownloadBtns = new Map(); // img 元素 → 覆盖按钮元素

  /**
   * 下载 chat 页面最新的一批无水印图片
   * 只下载最近拦截到的3张，避免下载大量历史图片
   */
  async function downloadLatestChatImages() {
    if (capturedImageUrls.length === 0) {
      showNotification('❌ 未捕获到图片，请等待页面加载完成', 'error');
      return;
    }

    // 只下载最近拦截到的图片（最多3张），避免下载大量历史图片
    const latestImages = capturedImageUrls.slice(0, 3);
    const count = latestImages.length;
    showNotification(`🔄 正在下载最新的 ${count} 张无水印图片...`, 'info');
    latestImages.forEach(({ url }, i) => {
      const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || 'jpg';
      chrome.runtime.sendMessage({
        action: 'download',
        url,
        filename: `doubao_image_${i + 1}.${ext}`
      });
    });
    showNotification(`✅ 开始下载 ${count} 张图片！`, 'success');
  }

  /**
   * 判断一个 img 是否为 AI 生成的图片（非 UI 图标）
   */
  function isAiGeneratedImg(img) {
    if (!img || img.tagName !== 'IMG') return false;
    if (isOwnElement(img)) return false;

    const src = img.src || img.currentSrc || '';
    if (!src || src.startsWith('data:')) return false;

    // v13: 更严格的图标过滤
    const u = src.toLowerCase();
    if (u.includes('icon') || u.includes('logo') || u.includes('avatar') ||
        u.includes('favicon') || u.includes('badge') || u.includes('sticker') ||
        u.includes('emoji') || u.includes('headimg') || u.includes('profile')) return false;

    // 尺寸筛选（需要渲染完成，宽高大于 100px，更严格）
    const rect = img.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) return false;

    // 字节 CDN 图片域名（更严格的匹配）
    const isDoubaoImg = src.includes('byteimg.com') ||
                        src.includes('rc_gen_image') ||
                        /lf[\d]-.*\.(jpg|jpeg|png|webp)/i.test(src) ||
                        src.includes('imagex-sign') ||
                        src.includes('tos-cn');

    return isDoubaoImg;
  }

  /**
   * v23: 从页面 HTML 的 <script data-fn-args> 中提取 AI 图片 URL
   * 作为网络拦截的兜底方案
   */
  function extractImageUrlsFromPage() {
    const fnArgsEls = document.querySelectorAll('[data-script-src="modern-run-router-data-fn"][data-fn-args]');
    for (const el of fnArgsEls) {
      try {
        const jsonStr = el.getAttribute('data-fn-args').replace(/&quot;/g, '"');
        const jsonData = JSON.parse(jsonStr);
        for (const item of jsonData) {
          if (typeof item === 'object' && item.data && item.data.message_snapshot) {
            const msgList = item.data.message_snapshot.message_list || [];
            for (const msg of msgList) {
              if (!msg.content_block) continue;
              for (const block of msg.content_block) {
                try {
                  const contentV2 = JSON.parse(block.content_v2);
                  if (contentV2.creation_block?.creations) {
                    for (const creation of contentV2.creation_block.creations) {
                      const rawUrl = creation.image?.image_ori_raw?.url ||
                                     creation.image?.image_ori?.url || '';
                      if (rawUrl && rawUrl.startsWith('http') && /rc_gen_image\/[a-f0-9]{32}/i.test(rawUrl)) {
                        const cleanUrl = rawUrl.replace(/&amp;/g, '&');
                        if (!capturedImageUrls.find(v => v.url === cleanUrl)) {
                          capturedImageUrls.unshift({ url: cleanUrl, timestamp: Date.now() });
                          console.log('[豆包去水印] 从 HTML 提取图片 URL:', cleanUrl.slice(0, 80));
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
    
    // 如果结构化提取失败，尝试正则匹配
    if (capturedImageUrls.length === 0) {
      const html = document.documentElement.innerHTML;
      const regex = /(https:\/\/[^"&\s"']+rc_gen_image\/[a-f0-9]{32}[^"&\s"']*)/gi;
      const seen = new Set();
      let match;
      while ((match = regex.exec(html)) !== null) {
        const url = match[1].replace(/&amp;/g, '&');
        // 按 rc_gen_image/ 后的 hash 去重
        const hashMatch = url.match(/rc_gen_image\/([a-f0-9]{32})/i);
        if (hashMatch && !seen.has(hashMatch[1])) {
          seen.add(hashMatch[1]);
          if (!capturedImageUrls.find(v => v.url === url)) {
            capturedImageUrls.unshift({ url, timestamp: Date.now() });
            console.log('[豆包去水印] 正则提取图片 URL:', url.slice(0, 80));
          }
        }
      }
    }
  }

  function addImageDownloadButtons() {
    if (!isChatPage()) return;
    
    // v23: 如果拦截到的图片 URL 为空，尝试从页面 HTML 中提取
    if (capturedImageUrls.length === 0) {
      extractImageUrlsFromPage();
      if (capturedImageUrls.length === 0) return; // 仍然没有就放弃
    }

    // 获取所有 AI 生成图片，然后只处理未分配按钮的
    const unassignedImgs = getUnassignedAiImages();
    if (unassignedImgs.length === 0) return;

    // 预计算 reversed URL 数组（最旧在前）
    const reversed = [...capturedImageUrls].reverse();
    // 已分配按钮数 = 下一张新图片在 reversed 中的索引
    const assignedCount = imageDownloadBtns.size;

    let newBtnCount = 0;

    for (let i = 0; i < unassignedImgs.length; i++) {
      const img = unassignedImgs[i];

      // v21: 跳过尺寸过小的图
      const initialImgRect = img.getBoundingClientRect();
      if (initialImgRect.width < 120 || initialImgRect.height < 120) continue;

      // 为每张图分配对应的原图 URL
      // 策略：reversed 最旧在前（index 0 = DOM 中最靠前的图应匹配的 URL）
      //       assignedCount = 已分配按钮数，即 reversed 中下一个可用索引
      //       currentIndex = 当前循环中的第几个新图片
      const assignedUrl = reversed[assignedCount + i]?.url ||
                          reversed[assignedCount]?.url ||
                          capturedImageUrls[0]?.url || null;

      if (assignedUrl) {
        img.dataset.doubaoImageUrl = assignedUrl;
      }

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

      // v21: 改用 fixed 定位 + 附加到 body
      overlayBtn.style.position = 'fixed';
      positionOverlayButton(overlayBtn, img);

      const targetImg = img;
      const boundUrl = assignedUrl;
      // v21: 只拦截 mousedown/pointerdown/touchstart，避免穿透到原生 UI；
      //    click 事件让下面的 onClick 处理（之前 stopImmediatePropagation 把 click 也拦截了）
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
      // v21: 更新按钮位置（图片可能滚动/调整大小）
      positionOverlayButton(overlayBtn, img);
    }

    if (newBtnCount > 0) {
      console.log(`[豆包去水印] 已为 ${newBtnCount} 张图片添加下载按钮`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 页面切换处理
  // ═══════════════════════════════════════════════════════════

  function onPageChanged() {
    setTimeout(scanAndHookButtons, 500);
    setTimeout(scanAndHookButtons, 2000);
    setTimeout(addVideoDownloadButtons, 500);
    setTimeout(addVideoDownloadButtons, 2000);
    // v10: 页面切换后重新关联
    setTimeout(associateVidToVideoElements, 1000);
    setTimeout(associateVidToVideoElements, 3000);

    if (isActivePage()) {
      showNotification('🫧 去水印自动拦截已开启', 'info');
    }
    if (isJimengPage()) {
      setTimeout(addJimengDownloadButtons, 500);
      setTimeout(addJimengDownloadButtons, 2000);
    } else {
      // 离开即梦页面时清理所有即梦按钮
      jimengBtnManager.clear();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  if (isActivePage()) {
    showNotification('🫧 去水印自动拦截已开启', 'info');
    setTimeout(addVideoDownloadButtons, 1000);
    setTimeout(addVideoDownloadButtons, 3000);
    // 持续检测新视频 + 重新关联 vid + 检测图片 + 即梦下载按钮
    setInterval(() => {
      associateVidToVideoElements();
      addVideoDownloadButtons();
      addImageDownloadButtons();
      if (isJimengPage()) addJimengDownloadButtons();
    }, 5000);
    // 即梦按钮位置更新（fixed 定位需要跟随滚动）
    // 无条件启动：不在即梦页面时 cleanup 会自动移除按钮
    setInterval(() => jimengBtnManager.updatePositions(), 200);

    // v21: 豆包视频/图片按钮位置更新（fixed 定位需要跟随滚动/resize）
    setInterval(() => {
      for (const [video, btn] of videoDownloadBtns) {
        if (!document.contains(video)) continue;
        positionOverlayButton(btn, video);
      }
      for (const [img, btn] of imageDownloadBtns) {
        if (!document.contains(img)) continue;
        positionOverlayButton(btn, img);
      }
    }, 200);
    // 滚动/resize 时也立即更新
    const onScrollOrResize = () => {
      for (const [video, btn] of videoDownloadBtns) {
        if (!document.contains(video)) continue;
        positionOverlayButton(btn, video);
      }
      for (const [img, btn] of imageDownloadBtns) {
        if (!document.contains(img)) continue;
        positionOverlayButton(btn, img);
      }
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
  }

  // ═══════════════════════════════════════════════════════════
  // 接收后台通知
  // ═══════════════════════════════════════════════════════════

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'showNotification') {
      showNotification(message.message, message.type || 'info');
      sendResponse({ ok: true });
    }

    if (message.action === 'chatDownloadIntercepted') {
      console.log('[豆包去水印] 收到 chat 下载拦截通知, URL =', message.interceptedUrl?.slice(0, 80));
      let targetVideo = null;
      if (message.interceptedUrl) {
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
          if (video.dataset.doubaoVid && message.interceptedUrl.includes(video.dataset.doubaoVid)) {
            targetVideo = video;
            break;
          }
          const src = video.src || video.currentSrc || '';
          if (src && !src.startsWith('blob:') && message.interceptedUrl.includes(extractPathFromUrl(src).split('/')[1] || '')) {
            targetVideo = video;
            break;
          }
        }
      }
      if (!targetVideo) {
        targetVideo = findVideoInViewport();
      }
      extractVideoChatPage(targetVideo);
      sendResponse({ ok: true });
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 工具函数
  // ═══════════════════════════════════════════════════════════

  function extractPathFromUrl(url) {
    try {
      const u = new URL(url);
      return u.pathname;
    } catch {
      return url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 页面内通知
  // ═══════════════════════════════════════════════════════════

  function showNotification(message, type) {
    document.querySelectorAll('.dw-notification').forEach(el => el.remove());

    const notification = document.createElement('div');
    notification.className = `dw-notification dw-notification-${type}`;
    notification.textContent = message;
    notification.setAttribute('data-doubao-own', 'true');
    document.body.appendChild(notification);

    requestAnimationFrame(() => notification.classList.add('dw-show'));

    setTimeout(() => {
      notification.classList.remove('dw-show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
})();
