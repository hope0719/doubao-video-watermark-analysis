/**
 * Bridge — ISOLATED world 脚本
 * 桥接 MAIN world 的 postMessage 到 chrome.runtime API
 * 处理下载请求等需要扩展权限的操作
 */
(function() {
    'use strict';

    // 标记就绪
    document.documentElement.setAttribute('data-hg-bridge-ready', '');
    // 暴露扩展资源URL给 MAIN world
    document.documentElement.setAttribute('data-hg-ext-url', chrome.runtime.getURL('/'));

    // 注入 content.js 到页面 MAIN world（代替 world: "MAIN"）
    var s = document.createElement('script');
    s.src = chrome.runtime.getURL('content.js');
    s.onload = function() { s.remove(); };
    (document.head || document.documentElement).appendChild(s);

    // 监听 MAIN world 的下载请求 (postMessage 兼容跨 world)
    window.addEventListener('message', function(e) {
        if (!e.data || e.data.type !== 'hg-dl-request') return;
        var reqId = e.data.requestId;
        var url = e.data.url;
        var filename = e.data.filename;
        if (!reqId || !url) return;

        chrome.runtime.sendMessage({
            type: 'DOWNLOAD_IMAGE',
            url: url,
            filename: filename,
            requestId: reqId
        }, function(response) {
            var lastErr = chrome.runtime.lastError;
            window.postMessage({
                type: 'hg-dl-response',
                requestId: reqId,
                success: !!(response && response.success),
                error: lastErr ? lastErr.message : (response ? response.error : '')
            }, '*');
        });
    });

    // 转发 popup/background 请求到 MAIN world
    chrome.runtime.onMessage.addListener(function(msg) {
        if (msg && msg.type === 'HG_OPEN_PANEL') {
            window.postMessage({type: 'hg-open-panel'}, '*');
            return false;
        }
        if (msg && msg.type === 'HG_REFRESH_SCAN') {
            window.postMessage({type: 'hg-refresh-scan'}, '*');
            return false;
        }
        if (msg && msg.type === 'HG_GET_STATUS') {
            var ready = document.documentElement.getAttribute('data-hg-bridge-ready') !== null;
            var images = Number(document.documentElement.getAttribute('data-hg-images') || 0);
            var videos = Number(document.documentElement.getAttribute('data-hg-videos') || 0);
            chrome.runtime.sendMessage({type: 'HG_STATUS', ready: ready, images: images, videos: videos});
            return false;
        }
        return false;
    });
})();
