/**
 * 豆包去水印 - Content Script v10
 *
 * 支持页面：video-sharing / thread / chat
 *
 * 核心逻辑（与小程序教程一致）：
 * - video-sharing 页面：用 URL 中的 video_id 调 API (get_play_info) 获取无水印视频 URL
 * - chat 页面：从 /im/chain/single API 拦截 vid → 调 get_play_info API 获取无水印 URL
 *
 * chat 页面策略：
 *   策略1：网络拦截到的 vid → 调 /samantha/media/get_play_info API 获取
 *   策略2：网络拦截到的无水印 URL → 直接下载
 *   兜底：直接下载 <video> src → 明确提示仍有水印
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

  function isActivePage() {
    return isVideoSharingPage() || isChatPage() || isThreadPage();
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
  // 存储拦截到的无水印 URL
  const capturedCleanUrls = [];
  // 存储 vid → download_url 映射（多视频匹配用）
  const videoSrcMap = [];

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
      console.log(`[豆包去水印] 网络拦截捕获 ${key}: ${url?.slice(0, 80)}`);
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
  });

  /**
   * 获取最近拦截到的 video_id
   */
  function getLatestCapturedVideoId() {
    return capturedVideoIds.length > 0 ? capturedVideoIds[0].id : null;
  }

  /**
   * 获取最近拦截到的无水印 URL
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
    // capturedVideoIds 按时间倒序（最新在前），videoSrcMap 同理
    // 合并两个来源的 vid
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

      // 向上遍历10层父元素，搜索包含 vid 的链接/属性
      let container = video;
      for (let i = 0; i < 10 && container; i++) {
        // 检查所有 a 标签和有 href/data-src 的元素
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
    // 第N个未关联的 video → 第N个未关联的 vid（按时间正序：最老的vid对应最早出现的视频）
    const unassignedVideos = [...videos].filter(v => !v.dataset.doubaoVid);
    const unassignedVids = allVids.filter(vid => !associatedVids.has(vid));
    // vid 列表是倒序的（最新在前），需要反转为正序（最老在前）来匹配 DOM 顺序
    unassignedVids.reverse();

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
   * 为指定的 video 元素获取已关联的 vid
   * v10: 优先读 data-doubao-vid（主动关联写入），然后才是各种 fallback
   */
  function findVideoIdForElement(videoEl) {
    if (!videoEl) return getLatestCapturedVideoId();

    // ─── 最优先：直接读 data-doubao-vid 属性 ───
    // 这是 v10 主动关联的结果，最可靠
    if (videoEl.dataset.doubaoVid) {
      console.log('[豆包去水印] ✅ 直接命中 data-doubao-vid:', videoEl.dataset.doubaoVid);
      return videoEl.dataset.doubaoVid;
    }

    const src = videoEl.src || videoEl.currentSrc || '';
    console.log('[豆包去水印] vid 匹配 fallback, src =', src.slice(0, 120));
    console.log('[豆包去水印] 已捕获 vid 列表:', capturedVideoIds.map(v => v.id));
    console.log('[豆包去水印] 已捕获 vid→URL 映射:', videoSrcMap.map(v => v.vid));

    // ─── Fallback 1：CDN URL 子串匹配 ───
    if (src && !src.startsWith('blob:')) {
      for (const entry of capturedVideoIds) {
        if (entry.id && src.includes(entry.id)) {
          console.log('[豆包去水印] Fallback1 匹配成功（vid在src中）: vid =', entry.id);
          // 顺便写入 data 属性，下次直接命中
          videoEl.dataset.doubaoVid = entry.id;
          return entry.id;
        }
      }
      for (const mapping of videoSrcMap) {
        if (mapping.vid && src.includes(mapping.vid)) {
          console.log('[豆包去水印] Fallback1b 匹配成功: vid =', mapping.vid);
          videoEl.dataset.doubaoVid = mapping.vid;
          return mapping.vid;
        }
      }
    }

    // ─── Fallback 2：正则提取 vid ───
    if (src && !src.startsWith('blob:')) {
      const vidMatch = src.match(/\/(v[0-9a-z]{16,})/);
      if (vidMatch) {
        const candidateVid = vidMatch[1];
        console.log('[豆包去水印] Fallback2 提取到候选 vid:', candidateVid);
        videoEl.dataset.doubaoVid = candidateVid;
        return candidateVid;
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
            console.log('[豆包去水印] Fallback3 匹配成功（周围DOM）: vid =', entry.id);
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
      // 已关联的 video 排除后，按 DOM 顺序分配 vid
      const assignedVids = new Set(
        allVideos.filter(v => v.dataset.doubaoVid).map(v => v.dataset.doubaoVid)
      );
      const allVids = capturedVideoIds.map(v => v.id).filter(id => !assignedVids.has(id));
      allVids.reverse(); // 最老在前
      // 计算这个 video 是第几个未关联的
      let unassignedIndex = 0;
      for (let i = 0; i < videoIndex; i++) {
        if (!allVideos[i].dataset.doubaoVid) unassignedIndex++;
      }
      if (unassignedIndex < allVids.length) {
        const vid = allVids[unassignedIndex];
        console.log('[豆包去水印] Fallback4 匹配成功（DOM顺序）: vid =', vid);
        videoEl.dataset.doubaoVid = vid;
        return vid;
      }
    }

    // ─── 最终兜底 ───
    console.log('[豆包去水印] ⚠️ 所有策略均未匹配，使用最近捕获的 vid（可能下载错误视频）');
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

    // 用 video 元素本身作为锁的 key（而非 URL，因为多个 blob URL 可能不同但指向同一视频）
    const lockKey = targetVideo ? targetVideo.src || targetVideo.currentSrc || String(Date.now()) : String(Date.now());

    // 防止同一视频重复下载（不同视频可并发）
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
      console.log('[豆包去水印] 已捕获 video_id 数量:', capturedVideoIds.length);
      console.log('[豆包去水印] 已捕获 vid→URL 映射数量:', videoSrcMap.length);

      // ─── 策略 1：用匹配到的 vid 调 get_play_info API ───
      if (targetVid) {
        console.log('[豆包去水印] 策略1: 用匹配的 vid 调 API, id =', targetVid);
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
          console.log('[豆包去水印] API 响应:', JSON.stringify(json).slice(0, 300));

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
        console.log('[豆包去水印] 策略2: 使用拦截到的无水印 URL');
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
  // 下载按钮检测工具函数
  // ═══════════════════════════════════════════════════════════

  /**
   * 判断元素是否为我们自己创建的通知/按钮元素
   */
  function isOwnElement(el) {
    if (!el) return false;
    if (el.id === 'doubao-watermark-btn') return true;
    if (el.classList?.contains('dw-nowm-btn')) return true;
    if (el.classList?.contains('dw-notification')) return true;
    if (el.closest?.('#doubao-watermark-btn')) return true;
    if (el.closest?.('.dw-nowm-btn')) return true;
    if (el.closest?.('.dw-notification')) return true;
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

    if (isOwnElement(e.target) || isOwnElement(e.target.closest('#doubao-watermark-btn, .dw-nowm-btn, .dw-notification'))) return;

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
        const targetVideo = findVideoInViewport();
        await downloadVideo(targetVideo);
      } else if (isThreadPage()) {
        await extractThreadImages();
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

      // v10: 按钮上显示关联状态
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

      // 闭包捕获目标视频元素
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

    // v10: 更新已有按钮的关联状态
    for (const [video, overlayBtn] of videoDownloadBtns) {
      if (!document.contains(video)) {
        overlayBtn.remove();
        videoDownloadBtns.delete(video);
        continue;
      }
      // 更新按钮显示的关联状态
      const span = overlayBtn.querySelector('span');
      if (span) {
        const associatedVid = video.dataset.doubaoVid;
        const statusHint = associatedVid ? '✅' : '⏳';
        const newText = `${statusHint} 无水印下载`;
        if (span.textContent !== newText) {
          span.textContent = newText;
        }
      }
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
  }

  // ═══════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════

  if (isActivePage()) {
    showNotification('🫧 去水印自动拦截已开启', 'info');
    setTimeout(addVideoDownloadButtons, 1000);
    setTimeout(addVideoDownloadButtons, 3000);
    // v10: 持续检测新视频 + 重新关联 vid
    setInterval(() => {
      associateVidToVideoElements();
      addVideoDownloadButtons();
    }, 5000);
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
      // v10: 优先通过 interceptedUrl 中的 vid 匹配 video 元素
      let targetVideo = null;
      if (message.interceptedUrl) {
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
          // 先检查 data-doubao-vid
          if (video.dataset.doubaoVid && message.interceptedUrl.includes(video.dataset.doubaoVid)) {
            targetVideo = video;
            break;
          }
          // 再检查 src
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
