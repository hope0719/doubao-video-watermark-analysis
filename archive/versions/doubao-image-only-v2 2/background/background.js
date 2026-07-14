/**
 * 豆包图片去水印 - Background Service Worker v3
 * 处理下载请求和右键菜单
 */

// 下载处理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename || `doubao_${Date.now()}.jpg`,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[豆包去水印] 下载失败:', chrome.runtime.lastError.message);
      }
    });
  }
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

console.log('[豆包图片去水印] background.js v3 已加载');
