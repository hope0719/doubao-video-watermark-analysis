// 后台脚本 - 拦截所有网络请求
const capturedRequests = [];
const capturedResponses = [];

// 监听请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // 只记录可能包含视频信息的请求
    if (
      details.url.includes('video') ||
      details.url.includes('media') ||
      details.url.includes('play') ||
      details.url.includes('.mp4') ||
      details.url.includes('.m3u8') ||
      details.url.includes('douyinvod.com') ||
      details.url.includes('byteimg.com')
    ) {
      capturedRequests.push({
        url: details.url,
        method: details.method,
        type: details.type,
        timestamp: new Date().toISOString(),
        requestBody: details.requestBody
      });
      
      console.log('[豆包拦截器] 捕获请求:', details.url);
      
      // 保存到storage
      chrome.storage.local.set({ capturedRequests });
    }
    
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// 监听响应头
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (
      details.url.includes('video') ||
      details.url.includes('media') ||
      details.url.includes('play') ||
      details.url.includes('.mp4') ||
      details.url.includes('douyinvod.com')
    ) {
      capturedResponses.push({
        url: details.url,
        statusCode: details.statusCode,
        responseHeaders: details.responseHeaders,
        timestamp: new Date().toISOString()
      });
      
      // 检查ETag
      const etag = details.responseHeaders?.find(h => h.name.toLowerCase() === 'etag');
      if (etag) {
        console.log('[豆包拦截器] ETag:', etag.value);
      }
      
      chrome.storage.local.set({ capturedResponses });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

// 清除记录命令
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clear') {
    capturedRequests.length = 0;
    capturedResponses.length = 0;
    chrome.storage.local.clear();
    sendResponse({ success: true });
  } else if (request.action === 'getCaptures') {
    sendResponse({
      requests: capturedRequests,
      responses: capturedResponses
    });
  }
  return true;
});
