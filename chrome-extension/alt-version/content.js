// 内容脚本 - 注入到页面，拦截fetch和XHR
(function() {
  'use strict';
  
  console.log('[豆包拦截器] Content script loaded');
  
  const originalFetch = window.fetch;
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  const videoUrls = new Set();
  
  // 拦截fetch
  window.fetch = async function(...args) {
    const url = args[0]?.url || args[0];
    
    console.log('[豆包拦截器] Fetch:', url);
    
    const response = await originalFetch.apply(this, args);
    
    // Clone响应以便读取
    const clonedResponse = response.clone();
    
    try {
      const contentType = clonedResponse.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const data = await clonedResponse.json();
        
        // 递归查找所有URL
        const urls = findUrls(data);
        urls.forEach(url => {
          if (url.includes('.mp4') || url.includes('video') || url.includes('douyinvod')) {
            videoUrls.add(url);
            console.log('[豆包拦截器] 发现视频URL:', url);
            
            // 显示在页面上
            showUrlNotification(url);
          }
        });
      }
    } catch (e) {
      // 忽略非JSON响应
    }
    
    return response;
  };
  
  // 拦截XHR
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;
    this._method = method;
    console.log('[豆包拦截器] XHR Open:', method, url);
    return originalXHROpen.apply(this, [method, url, ...rest]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      try {
        const contentType = this.getResponseHeader('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          const data = JSON.parse(this.responseText);
          const urls = findUrls(data);
          
          urls.forEach(url => {
            if (url.includes('.mp4') || url.includes('video') || url.includes('douyinvod')) {
              videoUrls.add(url);
              console.log('[豆包拦截器] XHR发现视频URL:', url);
              showUrlNotification(url);
            }
          });
        }
      } catch (e) {
        // 忽略
      }
    });
    
    return originalXHRSend.apply(this, args);
  };
  
  // 递归查找对象中的所有URL
  function findUrls(obj, depth = 0) {
    if (depth > 10) return [];
    
    const urls = [];
    
    if (typeof obj === 'string' && (obj.startsWith('http://') || obj.startsWith('https://'))) {
      urls.push(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          urls.push(...findUrls(obj[key], depth + 1));
        }
      }
    }
    
    return urls;
  }
  
  // 在页面上显示通知
  function showUrlNotification(url) {
    const div = document.createElement('div');
    div.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #4CAF50;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 999999;
      max-width: 400px;
      word-break: break-all;
      font-size: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    div.innerHTML = `
      <strong>捕获到视频URL:</strong><br>
      ${url.substring(0, 100)}...<br>
      <button onclick="this.parentElement.remove()" style="margin-top:5px;padding:5px 10px;background:white;color:#4CAF50;border:none;border-radius:3px;cursor:pointer;">关闭</button>
      <button onclick="navigator.clipboard.writeText('${url}')" style="margin-top:5px;padding:5px 10px;background:white;color:#4CAF50;border:none;border-radius:3px;cursor:pointer;">复制</button>
    `;
    
    document.body.appendChild(div);
    
    setTimeout(() => {
      div.remove();
    }, 10000);
  }
  
  // 监听页面上的video元素
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === 'VIDEO') {
          console.log('[豆包拦截器] 发现VIDEO元素:', node);
          console.log('  src:', node.src);
          console.log('  poster:', node.poster);
          console.log('  currentSrc:', node.currentSrc);
          
          if (node.src) {
            showUrlNotification(node.src);
          }
        }
      });
    });
  });
  
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  
  console.log('[豆包拦截器] 拦截器已激活');
})();
