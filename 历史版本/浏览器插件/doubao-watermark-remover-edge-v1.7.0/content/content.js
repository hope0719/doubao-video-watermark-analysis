/**
 * 豆包去水印 - Content Script v12
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

  // 避免重复注入
  if (document.getElementById('doubao-watermark-btn')) return;

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
      console.log(`[豆包去水印] 网络拦截捕获图片 URL: ${url?.slice(0, 80)}`);
      if (!capturedImageUrls.find(v => v.url === url)) {
        capturedImageUrls.unshift({ url, timestamp: event.data.timestamp });
        if (capturedImageUrls.length > 50) capturedImageUrls.pop();
      }
      // 新图片到来时，尝试添加下载按钮
      setTimeout(addImageDownloadButtons, 200);
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
   * 策略（按优先级）：
   * 1. video.src 是 CDN URL 且包含 vid → 直接匹配，写入 data-doubao-vid
   * 2. video 周围 DOM 中搜索包含 vid 的链接/属性
   * 3. DOM 顺序匹配：第N个无 vid 的 video → 第N个未关联的 vid（按时间排序）
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

    // ─── 策略1：CDN URL 包含 vid → 直接匹配 ───
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

    // ─── 策略2：搜索 video 周围 DOM 中的 vid 引用 ───
    for (const video of videos) {
      if (video.dataset.doubaoVid) continue;

      let container = video;
      for (let i = 0; i < 10 && container; i++) {
        const links = container.querySelectorAll('a[href], [data-src], [data-url]');
        for (const link of links) {
          const href = link.getAttribute('href') || link.getAttribute('data-src') || link.getAttribute('data-url') || '';
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

    // ─── 策略3：DOM 顺序匹配 ───
    const unassignedVideos = [...videos].filter(v => !v.dataset.doubaoVid);
    const unassignedVids = allVids.filter(vid => !associatedVids.has(vid));
    unassignedVids.reverse(); // 最老在前

    for (let i = 0; i < unassignedVideos.length && i < unassignedVids.length; i++) {
      unassignedVideos[i].dataset.doubaoVid = unassignedVids[i];
      associatedVids.add(unassignedVids[i]);
      console.log(`[豆包去水印] 主动关联(策略3-DOM顺序): video[${i}] → vid=${unassignedVids[i]}`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 多视频匹配工具函数
  // ═══════════════════════════════════════════════════════════

  /**
   * 从点击元素出发，找到最近的 video 元素
   */
  function findNearestVideo(element) {
    if (!element) return null;
    if (element.tagName === 'VIDEO') return element;

    const closestVideo = element.closest('video');
    if (closestVideo) return closestVideo;

    let parent = element;
    for (let i = 0; i < 15 && parent; i++) {
      const video = parent.querySelector('video');
      if (video) return video;
      parent = parent.parentElement;
    }

    return null;
  }

  /**
   * 从点击元素出发，找到最近的 img 元素（图片下载用）
   */
  function findNearestImage(element) {
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
   * v10: 优先读 data-doubao-vid（主动关联写入），然后才是各种 fallback
   */
  function findVideoIdForElement(videoEl) {
    if (!videoEl) return getLatestCapturedVideoId();

    // ─── 最优先：直接读 data-doubao-vid 属性 ───
    if (videoEl.dataset.doubaoVid) {
      console.log('[豆包去水印] ✅ 直接命中 data-doubao-vid:', videoEl.dataset.doubaoVid);
      return videoEl.dataset.doubaoVid;
    }

    const src = videoEl.src || videoEl.currentSrc || '';
    console.log('[豆包去水印] vid 匹配 fallback, src =', src.slice(0, 120));

    // ─── Fallback 1：CDN URL 子串匹配 ───
    if (src && !src.startsWith('blob:')) {
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

    // ─── Fallback 3：搜索周围 DOM ───
    let container = videoEl;
    for (let i = 0; i < 10 && container; i++) {
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

    console.log('[豆包去水印] ⚠️ 所有策略均未匹配，使用最近捕获的 vid');
    return getLatestCapturedVideoId();
  }

  /**
   * 找到视口中（最接近视口中心）的视频元素
   */
  function findVideoInViewport() {
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

    const lockKey = targetVideo ? targetVideo.src || targetVideo.currentSrc || String(Date.now()) : String(Date.now());

    if (extractingVideoSrcs.has(lockKey)) {
      showNotification('⏳ 该视频正在下载中...', 'info');
      return;
    }
    extractingVideoSrcs.add(lockKey);

    try {
      const targetVid = findVideoIdForElement(targetVideo);
      console.log('[豆包去水印] chat 页面下载, video src =', videoSrc?.slice(0, 120));
      console.log('[豆包去水印] 匹配到的 vid =', targetVid);
      console.log('[豆包去水印] data-doubao-vid =', targetVideo?.dataset?.doubaoVid);

      // ─── 策略 1：用匹配到的 vid 调 get_play_info API ───
      if (targetVid) {
        showNotification('🔄 正在通过 API 获取无水印视频...', 'info');

        try {
          const res = await fetch(
            'https://www.doubao.com/samantha/media/get_play_info?aid=497858&device_platform=web&language=zh-CN',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8'
              },
              body: JSON.stringify({ key: targetVid })
            }
          );

          const json = await res.json();

          if (json.code === 0 && json.data) {
            const apiUrl = json.data.original_media_info?.main_url ||
                           json.data.media_info?.[0]?.main_url;

            if (apiUrl) {
              chrome.runtime.sendMessage({
                action: 'download',
                url: apiUrl,
                filename: `doubao_${targetVid}.mp4`
              });
              showNotification('✅ 无水印视频下载已开始！', 'success');
              return;
            }
          }

          console.log('[豆包去水印] 策略1 API 未返回有效数据，尝试下一策略');
        } catch (err) {
          console.log('[豆包去水印] 策略1 API 调用失败:', err.message);
        }
      }

      // ─── 策略 2：使用拦截到的无水印 URL（仅单视频兜底） ───
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
      if (imageDownloadBtns.has(img)) continue; // 已分配按钮的跳过
      const src = img.src || img.currentSrc || '';
      if (!src || src.includes('icon') || src.includes('logo') || src.includes('avatar')) continue;

      const rect = img.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 60) continue;

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
    if (el.id === 'doubao-watermark-btn') return true;
    if (el.classList?.contains('dw-nowm-btn')) return true;
    if (el.classList?.contains('dw-img-btn')) return true;
    if (el.classList?.contains('dw-notification')) return true;
    if (el.classList?.contains('dw-jm-fixed-btn')) return true;
    if (el.classList?.contains('dw-jm-all-btn')) return true;
    if (el.closest?.('#doubao-watermark-btn')) return true;
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

    const text = (el.textContent || '').trim().slice(0, 50);
    const title = (el.getAttribute('title') || '').trim();
    const ariaLabel = (el.getAttribute('aria-label') || '').trim();
    const href = el.getAttribute('href') || '';
    const hasDownload = el.hasAttribute('download');
    const tagName = el.tagName.toLowerCase();
    const className = (el.className || '').toString().toLowerCase();
    const dataAction = (el.getAttribute('data-action') || '').toLowerCase();
    const dataTrack = (el.getAttribute('data-track') || '').toLowerCase();

    const isDownloadAction =
      hasDownload ||
      (tagName === 'a' && /\.(mp4|webm|mov)/i.test(href)) ||
      /^(保存|下载|另存为|存本地)$/.test(text) ||
      /下载|保存|另存为|存本地/i.test(text + title + ariaLabel) ||
      /\bsave\b|\bdownload\b/i.test(title + ariaLabel + dataAction + dataTrack) ||
      /download|save-btn|btn-download|btn-save|icon-download|icon-save/i.test(className) ||
      /download|save/i.test(dataAction + dataTrack);

    const isNonDownload =
      /收藏|关注|点赞|评论|分享|转发|举报|取消保存/i.test(text + title + ariaLabel) ||
      /favorite|follow|like|comment|share|report|unsave/i.test(title + ariaLabel);

    return isDownloadAction && !isNonDownload;
  }

  /**
   * 判断元素是否为视频下载图标按钮（⬇️ 图标，无文字）
   */
  function isVideoDownloadIcon(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (isOwnElement(el)) return false;

    const text = (el.textContent || '').trim();
    const className = (el.className || '').toString().toLowerCase();
    const innerHTML = (el.innerHTML || '').toLowerCase();

    if (text.length > 10) return false;

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

    if (isOwnElement(e.target) || isOwnElement(e.target.closest('#doubao-watermark-btn, .dw-nowm-btn, .dw-img-btn, .dw-notification'))) return;

    const candidates = [];
    let el = e.target;
    for (let i = 0; i < 12 && el && el !== document.body; i++) {
      candidates.push(el);
      el = el.parentElement;
    }

    for (const element of candidates) {
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
  // 浮动按钮（手动备用）
  // ═══════════════════════════════════════════════════════════

  const btn = document.createElement('div');
  btn.id = 'doubao-watermark-btn';
  btn.innerHTML = `
    <div class="dw-btn-main" title="一键去水印">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    </div>
    <div class="dw-btn-label">去水印</div>
  `;

  document.body.appendChild(btn);

  btn.addEventListener('click', async () => {
    btn.classList.add('dw-loading');
    try {
      if (isVideoSharingPage()) {
        await downloadVideo();
      } else if (isChatPage()) {
        // 优先判断：如果有拦截到的图片，下载最新图片
        // 如果有视频，下载视口中的视频
        const hasImages = capturedImageUrls.length > 0;
        const hasVideo = document.querySelector('video') !== null;

        if (hasImages && !hasVideo) {
          // 纯图片页面：下载最新的几张图片
          await downloadLatestChatImages();
        } else {
          // 视频页面（或视频+图片混合，以视频为主）
          const targetVideo = findVideoInViewport();
          await downloadVideo(targetVideo);
        }
      } else if (isThreadPage()) {
        await extractThreadImages();
      } else if (isJimengPage()) {
        // 即梦页面：优先下载视频，否则下载图片
        if (jimengVideoUrls.length > 0) {
          downloadJimengVideo();
        } else if (jimengImageUrls.length > 0) {
          downloadAllJimengImages();
        } else {
          showNotification('⏳ 等待拦截资源中，请稍候...', 'info');
        }
      }
    } catch (err) {
      showNotification('❌ ' + (err.message || '提取失败'), 'error');
    } finally {
      btn.classList.remove('dw-loading');
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 视频区域「无水印下载」按钮（支持多视频）
  // ═══════════════════════════════════════════════════════════

  const videoDownloadBtns = new Map(); // video 元素 → 覆盖按钮元素

  function addVideoDownloadButtons() {
    if (!isVideoSharingPage() && !isChatPage()) return;

    // v10: 每次添加按钮时，先尝试关联 vid
    associateVidToVideoElements();

    const videos = document.querySelectorAll('video');
    for (const video of videos) {
      // 已有按钮的跳过
      if (videoDownloadBtns.has(video)) continue;

      const container = video.closest('div') || video.parentElement;
      if (!container) continue;

      const containerStyle = getComputedStyle(container);
      if (containerStyle.position === 'static') {
        container.style.position = 'relative';
      }

      const overlayBtn = document.createElement('div');
      overlayBtn.className = 'dw-nowm-btn';
      overlayBtn.setAttribute('data-doubao-own', 'true');

      const associatedVid = video.dataset.doubaoVid;
      const statusHint = associatedVid ? `✅` : `⏳`;
      overlayBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>${statusHint} 无水印下载</span>
      `;

      const targetVideo = video;
      overlayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        downloadVideo(targetVideo);
      });

      container.appendChild(overlayBtn);
      videoDownloadBtns.set(video, overlayBtn);
    }

    // 更新已有按钮的关联状态 + 清理已移除的
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
    if (!src || src.startsWith('data:') || src.includes('icon') || src.includes('logo') || src.includes('avatar')) return false;

    // 尺寸筛选（需要渲染完成，宽高大于 60px）
    const rect = img.getBoundingClientRect();
    if (rect.width < 60 || rect.height < 60) return false;

    // 字节 CDN 图片域名
    const isDoubaoImg = src.includes('byteimg.com') ||
                        src.includes('lf') ||
                        src.includes('imagex') ||
                        src.includes('doubao') ||
                        src.includes('rc_gen_image');

    return isDoubaoImg;
  }

  function addImageDownloadButtons() {
    if (!isChatPage()) return;
    if (capturedImageUrls.length === 0) return; // 还没有拦截到图片

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

      const container = img.closest('div') || img.parentElement;
      if (!container) continue;

      const containerStyle = getComputedStyle(container);
      if (containerStyle.position === 'static') {
        container.style.position = 'relative';
      }

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

      const targetImg = img;
      const boundUrl = assignedUrl;
      overlayBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        downloadImage(targetImg, boundUrl);
      });

      container.appendChild(overlayBtn);
      imageDownloadBtns.set(img, overlayBtn);
      newBtnCount++;
    }

    // 清理已移除的图片按钮
    for (const [img, overlayBtn] of imageDownloadBtns) {
      if (!document.contains(img)) {
        overlayBtn.remove();
        imageDownloadBtns.delete(img);
      }
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
