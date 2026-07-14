/**
 * 豆包去水印 - Background Service Worker (V21)
 *
 * 架构（基于 V20，回归稳定结构）：
 *  - video-sharing 页面：下载拦截 → 调用 get_play_info API 替换为无水印版本
 *  - chat 页面视频：由 content script 经 inject.js 的 fallback_api 机制获取真·无水印视频
 *                      （详见 content/inject.js），background 只负责下发下载
 *  - chat 页面图片：由 content script 经 inject.js 提取 image_ori_raw 原图
 *  - 即梦 / 通义千问：由 content script (inject.js) 处理
 *
 * 注意：V21 不再使用 chrome.debugger，避免其拦截流式 /im/chain/single 响应
 *       导致对话流式传输被破坏。所有提取逻辑都在 MAIN world 的 inject.js 完成。
 */

// ═══════════════════════════════════════════════════════════════
// video-sharing 标签页追踪 + 下载拦截
// ═══════════════════════════════════════════════════════════════

const doubaoVideoTabs = new Map(); // { tabId → { videoId, shareId, url } }
const extensionDownloadUrls = new Set(); // 防止循环拦截

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

chrome.tabs.onRemoved.addListener((tabId) => {
  doubaoVideoTabs.delete(tabId);
});

// 下载拦截：来自豆包视频页面的视频下载 → 自动替换为无水印版本
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

  const fromDoubaoVideoSharing = referrer.includes('doubao.com/video-sharing');
  const fromDoubaoChat = referrer.includes('doubao.com/chat');

  if (!fromDoubaoVideoSharing && !fromDoubaoChat) return;

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
    if (!videoId) return;

    console.log(`[豆包去水印] video-sharing 拦截: videoId=${videoId}`);
    try { await chrome.downloads.cancel(item.id); } catch (e) {}
    try { await chrome.downloads.erase({ id: item.id }); } catch (e) {}

    try {
      const cleanUrl = await fetchNoWatermarkUrl(videoId);
      if (cleanUrl) {
        extensionDownloadUrls.add(cleanUrl);
        chrome.downloads.download({ url: cleanUrl, filename: `doubao_${videoId}.mp4`, saveAs: false });
        notifyTab('✅ 已自动替换为无水印视频下载', 'success');
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

// ═══════════════════════════════════════════════════════════════
// 右键菜单
// ═══════════════════════════════════════════════════════════════

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

  chrome.tabs.sendMessage(tab.id, {
    action: 'showNotification',
    message: '❌ 当前页面不是豆包视频页面',
    type: 'error'
  }).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════
// 消息处理（来自 popup / content script / 面板）
// ═══════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return;

  // V20：popup 下载请求
  if (message.action === 'download') {
    handleDownload(message.url, message.filename);
    sendResponse({ ok: true });
  }

  // V20：popup 页面提取
  if (message.action === 'extractFromPage') {
    handlePageExtract(message.url).then(result => {
      sendResponse({ ok: true, data: result });
    }).catch(err => {
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  // V20：视频右键点击通知
  if (message.action === 'videoRightClick') {
    console.log(`[豆包去水印] 用户在视频元素上右键`);
    sendResponse({ ok: true });
  }

  // content script：下载媒体（无水印视频/原图）
  if (message.type === 'DOWNLOAD_MEDIA' && isHttpUrl(message.url)) {
    handleDownload(message.url, message.filename);
    sendResponse({ ok: true });
  }
});

function handleDownload(url, filename) {
  if (!url) return;

  extensionDownloadUrls.add(url);
  setTimeout(() => extensionDownloadUrls.delete(url), 30000);

  chrome.downloads.download({
    url: url,
    filename: filename || defaultNameFromUrl(url),
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

function defaultNameFromUrl(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean).pop() || 'doubao_media';
    if (/\.(mp4|webm|mov|png|jpg|jpeg|webp|gif)$/i.test(seg)) return seg;
  } catch {}
  return 'doubao_media';
}

async function handlePageExtract(url) {
  return { url };
}

function isHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}
