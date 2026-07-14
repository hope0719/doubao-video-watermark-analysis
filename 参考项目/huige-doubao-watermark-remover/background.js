/**
 * Background Service Worker
 * 处理下载请求
 */
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.type === 'DOWNLOAD_IMAGE') {
        chrome.downloads.download({
            url: msg.url,
            filename: 'doubao/' + msg.filename,
            saveAs: false,
            conflictAction: 'uniquify'
        }, function(downloadId) {
            if (chrome.runtime.lastError) {
                sendResponse({success: false, error: chrome.runtime.lastError.message});
            } else {
                sendResponse({success: true, downloadId: downloadId});
            }
        });
        return true; // 异步响应
    }
});
