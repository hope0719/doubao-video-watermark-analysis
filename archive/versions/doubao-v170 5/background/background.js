/**
 * 豆包去水印 - Background Service Worker v4
 *
 * 处理：
 * 1. 下载拦截 — video-sharing 页面用 API 替换，chat 页面通知 content script 处理
 * 2. 视频元素右键菜单"去水印下载"
 * 3. 右键菜单提取
 * 4. 消息中转（popup / content script 下载请求）
 */

// ═══════════════════════════════════════════════════════════
// 豆包视频页面标签页追踪（需要 tabs 权限）
// ═══════════════════════════════════════════════════════════

const doubaoVideoTabs = new Map(); // { tabId → { videoId, shareId, url } }
const extensionDownloadUrls = new Set(); // 防止循环拦截

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    const url = tab.url || changeInfo.url || '';
    const m = url.match(/doubao\.com\/video-sharing.*[?&]video_id=([^&]+)/);
    if (m) {
      let shareId = '';
      try { shareId = new URL(url).searchParams.get('share_id') || ''; } catch {}
      doubaoVideoTabs.set(tabId, { videoId: m[1], shareId, url });
      console.log(`[豆包去水印] 追踪标签页 ${tabId}: videoId=${m[1]}`);
    } else if (!url.includes('doubao.com/video-sharing')) {
      if (doubaoVideoTabs.has(tabId)) {
        doubaoVideoTabs.delete(tabId);
      }
    }
  }
});

// 标签页关闭时清理
chrome.tabs.onRemoved.addListener((tabId) => {
  doubaoVideoTabs.delete(tabId);
});

// ═══════════════════════════════════════════════════════════
// 下载拦截：来自豆包视频页面的视频下载 → 自动替换为无水印版本
// ═══════════════════════════════════════════════════════════

chrome.downloads.onCreated.addListener(async (item) => {
  const url = item.url || '';
  const referrer = item.referrer || '';
  const mime = item.mime || '';
  const filename = item.filename || '';

  // 跳过插件自己发起的下载
  if (extensionDownloadUrls.has(url)) {
    extensionDownloadUrls.delete(url);
    return;
  }

  // ─── 判断是否来自豆包页面 ───
  const fromDoubaoVideoSharing = referrer.includes('doubao.com/video-sharing');
  const fromDoubaoChat = referrer.includes('doubao.com/chat');

  if (!fromDoubaoVideoSharing && !fromDoubaoChat) return;

  // 判断是否为视频/媒体文件
  const isVideo = mime.startsWith('video/') ||
                  /\.(mp4|webm|mov|avi|mkv|flv)/i.test(url) ||
                  /\.(mp4|webm|mov|avi|mkv|flv)/i.test(filename);

  const fromCdn = url.includes('douyinvod.com') ||
                  url.includes('vlabvod.com') ||
                  url.includes('bytedance.com') ||
                  url.includes('byteimg.com') ||
                  url.includes('douyinpic.com') ||
                  url.includes('feiliao.com') ||
                  url.includes('tiktokcdn.com') ||
                  url.includes('ibytedtos.com') ||
                  url.includes('doubao.com');

  if (!isVideo && !fromCdn) return;

  const originalUrl = url;

  // ─── video-sharing 页面：用 API 获取无水印视频 ───
  if (fromDoubaoVideoSharing) {
    let videoId = null;
    let shareId = '';

    const refMatch = referrer.match(/doubao\.com\/video-sharing.*[?&]video_id=([^&]+)/);
    if (refMatch) {
      videoId = refMatch[1];
      try { shareId = new URL(referrer).searchParams.get('share_id') || ''; } catch {}
    }

    if (!videoId && item.tabId && doubaoVideoTabs.has(item.tabId)) {
      const info = doubaoVideoTabs.get(item.tabId);
      videoId = info.videoId;
      shareId = info.shareId;
    }

    if (!videoId) {
      for (const [, info] of doubaoVideoTabs) {
        videoId = info.videoId;
        shareId = info.shareId;
        break;
      }
    }

    if (!videoId) return; // 没有匹配到 videoId，放行

    console.log(`[豆包去水印] video-sharing 拦截: videoId=${videoId}, url=${url.slice(0, 80)}...`);

    // 取消原始下载
    try { await chrome.downloads.cancel(item.id); } catch (e) {}
    try { await chrome.downloads.erase({ id: item.id }); } catch (e) {}

    try {
      const cleanUrl = await fetchNoWatermarkUrl(videoId);
      if (cleanUrl) {
        extensionDownloadUrls.add(cleanUrl);
        chrome.downloads.download({ url: cleanUrl, filename: `doubao_${videoId}.mp4`, saveAs: false });
        notifyTab('✅ 已自动替换为无水印视频下载', 'success');
        console.log(`[豆包去水印] 无水印下载已开始: ${cleanUrl.slice(0, 80)}...`);
      } else {
        extensionDownloadUrls.add(originalUrl);
        chrome.downloads.download({ url: originalUrl, saveAs: false });
        notifyTab('⚠️ 未获取到无水印地址，已恢复原始下载', 'warning');
      }
    } catch (err) {
      console.error('[豆包去水印] 去水印失败:', err);
      extensionDownloadUrls.add(originalUrl);
      chrome.downloads.download({ url: originalUrl, saveAs: false });
      notifyTab('❌ 去水印失败，已恢复原始下载', 'error');
    }

    setTimeout(() => extensionDownloadUrls.delete(originalUrl), 30000);
    return;
  }

  // ─── chat 页面：取消原始下载，通知 content script 用多策略获取无水印视频 ───
  if (fromDoubaoChat) {
    console.log(`[豆包去水印] chat 页面下载拦截: url=${url.slice(0, 80)}...`);

    // 取消原始（带水印）下载
    try { await chrome.downloads.cancel(item.id); } catch (e) {}
    try { await chrome.downloads.erase({ id: item.id }); } catch (e) {}

    // 通知 content script 用多策略获取无水印视频
    if (item.tabId) {
      chrome.tabs.sendMessage(item.tabId, {
        action: 'chatDownloadIntercepted',
        interceptedUrl: url
      }).catch(() => {});
    }

    notifyTab('🔄 正在获取无水印视频...', 'info');
    setTimeout(() => extensionDownloadUrls.delete(originalUrl), 30000);
  }
});

// 调用无水印API（仅 video-sharing 页面使用）
async function fetchNoWatermarkUrl(videoId) {
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
  if (json.code !== 0 || !json.data) {
    throw new Error(json.msg || 'API返回异常');
  }

  return json.data.original_media_info?.main_url ||
         json.data.media_info?.[0]?.main_url ||
         null;
}

// 通知当前活跃的豆包标签页
function notifyTab(message, type) {
  chrome.tabs.query({ url: '*://www.doubao.com/*' }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'showNotification',
        message,
        type
      }).catch(() => {});
    }
  });
}

// ═══════════════════════════════════════════════════════════
// 右键菜单
// ═══════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'doubao-extract',
    title: '🫧 豆包去水印 - 提取当前页面',
    contexts: ['page'],
    documentUrlPatterns: [
      'https://www.doubao.com/*',
      'https://qwen.cn/*',
      'https://qianwen.com/*',
      'https://xiaoyunque.jianying.com/*',
      'https://jimeng.jianying.com/*',
      'https://dreamina.com/*'
    ]
  });

  chrome.contextMenus.create({
    id: 'doubao-extract-link',
    title: '🫧 豆包去水印 - 提取此链接',
    contexts: ['link'],
    targetUrlPatterns: [
      'https://www.doubao.com/video-sharing*',
      'https://www.doubao.com/thread/*',
      'https://qwen.cn/*',
      'https://qianwen.com/*',
      'https://xiaoyunque.jianying.com/*',
      'https://jimeng.jianying.com/*',
      'https://dreamina.com/*'
    ]
  });

  chrome.contextMenus.create({
    id: 'doubao-video-save',
    title: '🫧 豆包去水印 - 无水印下载视频',
    contexts: ['video'],
    documentUrlPatterns: ['https://www.doubao.com/*']
  });
});

// 右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  let url = '';

  if (info.menuItemId === 'doubao-extract') {
    url = tab.url;
  } else if (info.menuItemId === 'doubao-extract-link') {
    url = info.linkUrl;
  } else if (info.menuItemId === 'doubao-video-save') {
    handleVideoContextMenu(tab);
    return;
  }

  if (url) {
    chrome.runtime.sendMessage({
      action: 'autoExtract',
      url: url
    }).catch(() => {
      chrome.action.openPopup();
    });
  }
});

// 处理视频元素右键菜单
async function handleVideoContextMenu(tab) {
  const url = tab.url || '';

  // video-sharing 页面 → 用 API
  const m = url.match(/doubao\.com\/video-sharing.*[?&]video_id=([^&]+)/);
  if (m) {
    const videoId = m[1];
    try {
      const cleanUrl = await fetchNoWatermarkUrl(videoId);
      if (cleanUrl) {
        extensionDownloadUrls.add(cleanUrl);
        chrome.downloads.download({ url: cleanUrl, filename: `doubao_${videoId}.mp4`, saveAs: false });
        notifyTab('✅ 无水印视频下载已开始！', 'success');
      } else {
        notifyTab('❌ 未获取到无水印视频地址', 'error');
      }
    } catch (err) {
      notifyTab('❌ ' + (err.message || '获取失败'), 'error');
    }
    return;
  }

  // chat 页面 → 通知 content script 用多策略处理
  if (url.includes('doubao.com/chat')) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'chatDownloadIntercepted'
    }).catch(() => {});
    return;
  }

  // 其他页面
  chrome.tabs.sendMessage(tab.id, {
    action: 'showNotification',
    message: '❌ 当前页面不是豆包视频页面',
    type: 'error'
  }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════
// 消息处理（来自 popup / content script）
// ═══════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    handleDownload(message.url, message.filename);
    sendResponse({ ok: true });
  }

  if (message.action === 'extractFromPage') {
    handlePageExtract(message.url).then(result => {
      sendResponse({ ok: true, data: result });
    }).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  // 视频右键点击通知
  if (message.action === 'videoRightClick') {
    console.log(`[豆包去水印] 用户在视频元素上右键, pageType=${message.pageType}`);
    sendResponse({ ok: true });
  }
});

// 下载文件
function handleDownload(url, filename) {
  if (!url) return;

  extensionDownloadUrls.add(url);
  setTimeout(() => extensionDownloadUrls.delete(url), 30000);

  chrome.downloads.download({
    url: url,
    filename: filename || 'download',
    saveAs: false
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      extensionDownloadUrls.delete(url);
      console.error('下载失败:', chrome.runtime.lastError.message);
    } else {
      console.log('下载已开始, ID:', downloadId);
    }
  });
}

// 页面提取
async function handlePageExtract(url) {
  return { url };
}
