// Popup页面脚本
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshBtn');
  const clearBtn = document.getElementById('clearBtn');
  const requestsDiv = document.getElementById('requests');
  const responsesDiv = document.getElementById('responses');
  const requestCount = document.getElementById('requestCount');
  const responseCount = document.getElementById('responseCount');
  
  // 刷新数据
  refreshBtn.addEventListener('click', () => {
    loadData();
  });
  
  // 清空记录
  clearBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clear' }, (response) => {
      if (response.success) {
        requestsDiv.innerHTML = '<p class="empty">已清空所有记录</p>';
        responsesDiv.innerHTML = '<p class="empty">已清空所有记录</p>';
        requestCount.textContent = '0';
        responseCount.textContent = '0';
      }
    });
  });
  
  // 加载数据
  function loadData() {
    chrome.storage.local.get(['capturedRequests', 'capturedResponses'], (result) => {
      const requests = result.capturedRequests || [];
      const responses = result.capturedResponses || [];
      
      requestCount.textContent = requests.length;
      responseCount.textContent = responses.length;
      
      // 显示请求
      if (requests.length > 0) {
        requestsDiv.innerHTML = requests.map((req, index) => `
          <div class="url-item">
            <strong>#${index + 1}</strong> ${req.method} ${req.type}<br>
            <a href="${req.url}" target="_blank" style="color: #4CAF50;">${truncateUrl(req.url)}</a><br>
            <span style="color: #999; font-size: 11px;">${req.timestamp}</span>
            <button onclick="copyToClipboard('${escapeHtml(req.url)}')" style="margin-top: 5px; padding: 3px 8px; font-size: 11px;">复制URL</button>
          </div>
        `).join('');
      } else {
        requestsDiv.innerHTML = '<p class="empty">暂无捕获的请求</p>';
      }
      
      // 显示响应
      if (responses.length > 0) {
        responsesDiv.innerHTML = responses.map((res, index) => {
          const etag = res.responseHeaders?.find(h => h.name.toLowerCase() === 'etag');
          const contentType = res.responseHeaders?.find(h => h.name.toLowerCase() === 'content-type');
          
          return `
            <div class="url-item">
              <strong>#${index + 1}</strong> HTTP ${res.statusCode}<br>
              <a href="${res.url}" target="_blank" style="color: #4CAF50;">${truncateUrl(res.url)}</a><br>
              ${contentType ? `<div class="etag">Type: ${contentType.value}</div>` : ''}
              ${etag ? `<div class="etag">ETag: ${etag.value}</div>` : ''}
              <span style="color: #999; font-size: 11px;">${res.timestamp}</span>
            </div>
          `;
        }).join('');
      } else {
        responsesDiv.innerHTML = '<p class="empty">暂无捕获的响应</p>';
      }
    });
  }
  
  // 截断URL显示
  function truncateUrl(url) {
    return url.length > 80 ? url.substring(0, 80) + '...' : url;
  }
  
  // 转义HTML
  function escapeHtml(text) {
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
  }
  
  // 初始加载
  loadData();
});

// 复制到剪贴板
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('已复制到剪贴板');
  });
}
