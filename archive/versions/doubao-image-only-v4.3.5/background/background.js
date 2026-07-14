/**
 * 豆包图片去水印 - Background Service Worker v4.3.1
 * 性能优化：ping 保活 + conflictAction 避免弹窗
 */

// 下载处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 兼容 action 和 type 两种消息格式
  const act = (message.action || message.type || '').toLowerCase();

  if (act === 'ping') {
    // 保活 ping，不做任何事，仅保持 Service Worker 活跃
    return;
  }

  if (act.includes('download')) {
    const downloadOptions = {
      url: message.url,
      filename: message.filename || `doubao_${Date.now()}.jpg`,
      saveAs: false,
      conflictAction: 'uniquify'   // 文件已存在时自动重命名，不弹确认框
    };

    chrome.downloads.download(downloadOptions, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[豆包去水印] 下载失败:', chrome.runtime.lastError.message);
      } else {
        console.log(`[豆包去水印] 下载已开始: downloadId=${downloadId}`);
      }
    });
  }

  // 保持消息通道开放（for async response）
  return true;
});

// 右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'extractPage',
    title: '🫧 提取本页图片/视频',
    contexts: ['page']
  });

  chrome.contextMenus.create({
    id: 'extractLink',
    title: '🫧 提取链接内容',
    contexts: ['link']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'extractPage') {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const url = window.location.href;
        chrome.runtime.sendMessage({ action: 'extract', url: url });
      }
    });
  } else if (info.menuItemId === 'extractLink' && info.linkUrl) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (linkUrl) => {
        chrome.runtime.sendMessage({ action: 'extract', url: linkUrl });
      },
      args: [info.linkUrl]
    });
  }
});

console.log('[豆包去水印] background.js v4.3.1 已加载 (ping保活+conflictAction)');
