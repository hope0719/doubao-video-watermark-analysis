if (globalThis.__DOUBAO_TOOLBOX_FORWARDER_LOADED__) {
  console.log("[forwarder.js] 跳过重复注入");
} else {
globalThis.__DOUBAO_TOOLBOX_FORWARDER_LOADED__ = true;

const imageDataMap=new Map,videoButtonMap=new Map;
let domObserverActive=!1,domObserverPending=!1,isVersionValid=!0;

// 显示本地提示
function showActivationModal(message) {
  showToast(message || "插件当前可用", "success");
}

function showToast(message, type = "error") {
  const toast = document.createElement("div");
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: ${type === "success" ? "#10b981" : "#ef4444"};
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 13px;
    z-index: 100001;
    font-family: system-ui;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: fadeInOut 2.5s ease forwards;
  `;
  toast.textContent = type === "success" ? "✓ " + message : "⚠️ " + message;
  document.body.appendChild(toast);
  
  const style = document.createElement("style");
  style.textContent = `
    @keyframes fadeInOut {
      0% { opacity: 0; transform: translateY(10px); }
      15% { opacity: 1; transform: translateY(0); }
      85% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(10px); visibility: hidden; }
    }
  `;
  document.head.appendChild(style);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2500);
}

async function checkActivationAndShowModal() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({type: "CHECK_ACTIVATION"}, (status) => {
      if (status && status.activated) {
        resolve({ allowed: true });
      } else {
        showActivationModal(status?.message || "插件当前可用");
        resolve({ allowed: false, message: status?.message || "插件当前可用" });
      }
    });
  });
}

function extractFileKey(e){if(!e)return null;const t=e.match(/rc_gen_image\/([^?~]+)/);return t?t[1]:null}
function registerImageData(e){const t=extractFileKey(e.watermark_url||e.no_watermark_url);t&&imageDataMap.set(t,e)}
function injectStyles(){if(document.getElementById("doubao-dl-styles"))return;const e=document.createElement("style");e.id="doubao-dl-styles",e.textContent="\n    .doubao-dl-btn {\n      position: absolute;\n      bottom: 10px;\n      right: 10px;\n      z-index: 9999;\n      display: inline-flex;\n      align-items: center;\n      gap: 5px;\n      padding: 6px 12px;\n      background: rgba(0, 0, 0, 0.62);\n      color: #fff;\n      border: none;\n      border-radius: 8px;\n      font-size: 12px;\n      font-weight: 500;\n      cursor: pointer;\n      backdrop-filter: blur(6px);\n      -webkit-backdrop-filter: blur(6px);\n      transition: background 0.2s, transform 0.15s;\n      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;\n      line-height: 1;\n      white-space: nowrap;\n      pointer-events: all;\n      user-select: none;\n      letter-spacing: 0.2px;\n    }\n    .doubao-dl-btn:hover:not(:disabled) {\n      background: rgba(0, 0, 0, 0.82);\n    }\n    .doubao-dl-btn:active:not(:disabled) {\n      transform: scale(0.97);\n    }\n    .doubao-dl-btn:disabled {\n      cursor: not-allowed;\n      opacity: 0.75;\n    }\n    .doubao-dl-btn.doubao-dl-success {\n      background: rgba(16, 185, 129, 0.85);\n    }\n    .doubao-dl-btn.doubao-dl-error {\n      background: rgba(239, 68, 68, 0.82);\n    }\n    .doubao-dl-btn svg {\n      flex-shrink: 0;\n    }\n  ",document.head.appendChild(e)}
const DOWNLOAD_ICON='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

function whenDomReady(callback){
  if(document.body&&document.head){
    callback();
    return;
  }
  const observer=new MutationObserver(()=>{
    if(document.body&&document.head){
      observer.disconnect();
      callback();
    }
  });
  observer.observe(document.documentElement||document,{childList:!0,subtree:!0});
  document.addEventListener("DOMContentLoaded",()=>{
    if(document.body&&document.head){
      observer.disconnect();
      callback();
    }
  },{once:!0});
}

function injectDownloadButton(e,t){
  if(!isVersionValid) return;
  if(e.dataset.doubaoInjected) return;
  e.dataset.doubaoInjected="1";
  let n=e.parentElement;
  for(let e=0;e<6&&n&&n!==document.body;e++){const e=n.getBoundingClientRect();if(e.width>=100&&e.height>=80)break;n=n.parentElement}
  n||(n=e.parentElement),"static"===getComputedStyle(n).position&&(n.style.position="relative");
  const a=document.createElement("button");
  a.className="doubao-dl-btn";
  a.innerHTML=`${DOWNLOAD_ICON} 下载原图`;
  a.addEventListener("click",async (e)=>{
    e.preventDefault(),e.stopPropagation();
    a.disabled=true;
    a.innerHTML="验证中...";
    
    const activationCheck = await checkActivationAndShowModal();
    if (!activationCheck.allowed) {
      a.disabled=false;
      a.innerHTML=`${DOWNLOAD_ICON} 下载原图`;
      return;
    }
    
    a.innerHTML="下载中...";
    const n=(extractFileKey(t.no_watermark_url)||String(Date.now())).replace(/\.(jpeg|jpg|png|webp)$/i,"");
    const s=`doubao${t.width&&t.height?`_${t.width}x${t.height}`:""}_${n.slice(-12)}.png`;
    chrome.runtime.sendMessage({type:"downloadImage",url:t.no_watermark_url,filename:s},e=>{
      if(e?.success){
        a.innerHTML="✓ 已下载",a.classList.add("doubao-dl-success");
        setTimeout(()=>{a.disabled=false,a.innerHTML=`${DOWNLOAD_ICON} 下载原图`,a.classList.remove("doubao-dl-success")},3000)
      } else {
        a.innerHTML="失败，点击重试",a.classList.add("doubao-dl-error");
        a.disabled=false;
        setTimeout(()=>{a.innerHTML=`${DOWNLOAD_ICON} 下载原图`,a.classList.remove("doubao-dl-error")},3000)
      }
    })
  });
  n.appendChild(a)
}

function tryInjectForImg(e){if(!e.src||e.dataset.doubaoInjected)return;const t=extractFileKey(e.src);if(!t)return;const n=imageDataMap.get(t);n&&injectDownloadButton(e,n)}
function findMessageId(e){let t=e;for(let e=0;e<20&&t&&t!==document.body;e++){if(t.dataset){if(t.dataset.messageId)return t.dataset.messageId;if(t.dataset.message_id)return t.dataset.message_id}t=t.parentElement}return null}
function requestVideoRuntimePayload(e){return new Promise(t=>{const n=`doubao_runtime_${Date.now()}_${Math.random().toString(36).slice(2)}`;function a(o){o.data?.type==="doubaoVideoRuntimePayload"&&o.data?.requestId===n&&(window.removeEventListener("message",a),t(o.data?.data||null))}window.addEventListener("message",a),window.postMessage({type:"extractVideoRuntimeByMessageId",messageId:e,requestId:n},"*"),setTimeout(()=>{window.removeEventListener("message",a),t(null)},4000)})}
function showVideoDownloadFailure(e,t){const n=String(t||"点击重试").replace(/\s+/g," ").trim(),a=n?`失败：${n.slice(0,8)}`:"失败，点击重试";e.title=n,e.innerHTML=a,e.classList.add("doubao-dl-error"),e.disabled=false,setTimeout(()=>{e.innerHTML=`${DOWNLOAD_ICON} 下载视频`,e.classList.remove("doubao-dl-error"),e.title=""},4000)}
function injectVideoDownloadButton(e,t){
  if(!isVersionValid) return;
  if(e.dataset.doubaoVideoInjected) return;
  e.dataset.doubaoVideoInjected="1";
  "static"===getComputedStyle(e).position&&(e.style.position="relative");
  const n=document.createElement("button");
  n.className="doubao-dl-btn";
  n.innerHTML=`${DOWNLOAD_ICON} 下载视频`;
  n.addEventListener("click",async (e)=>{
    e.preventDefault(),e.stopPropagation();
    n.disabled=true;
    n.innerHTML="验证中...";
    
    console.log("[forwarder.js] 点击下载视频，开始检查激活");
    const activationCheck = await checkActivationAndShowModal();
    console.log("[forwarder.js] 激活检查结果:", activationCheck);
    
    if (!activationCheck.allowed) {
      n.disabled=false;
      n.innerHTML=`${DOWNLOAD_ICON} 下载视频`;
      return;
    }
    
    n.innerHTML="读取页面数据中...";
    const a=await requestVideoRuntimePayload(t);
    const o=a?.success?a.data:null;
    n.innerHTML="获取链接中...";
    console.log("[forwarder.js] 开始获取新版无水印视频, messageId:", t, "runtime:", o);
    const r=o?{type:"DOWNLOAD_DOUBAO_VIDEO_WITH_RUNTIME_PAYLOAD",payload:o}:{type:"DOWNLOAD_DOUBAO_VIDEO_BY_MESSAGE_ID",messageId:t};
    chrome.runtime.sendMessage(r,e=>{
      if(chrome.runtime.lastError){
        console.error("[forwarder.js] 后台下载失败:",chrome.runtime.lastError);
        showVideoDownloadFailure(n,chrome.runtime.lastError?.message||"扩展后台失败");
        return;
      }
      if(e?.success){
        n.innerHTML="✓ 下载已开始",n.classList.add("doubao-dl-success");
        n.disabled=false;
        setTimeout(()=>{n.innerHTML=`${DOWNLOAD_ICON} 下载视频`,n.classList.remove("doubao-dl-success")},3000);
      } else {
        console.warn("[forwarder.js] 新版无水印下载失败:",e);
        showVideoDownloadFailure(n,e?.error||"点击重试");
      }
    })
  });
  e.appendChild(n)
}
function tryInjectForVideo(e){if(!e.className||"string"!=typeof e.className)return;if(!e.className.includes("block-video"))return;if(e.dataset.doubaoVideoInjected)return;if(!(e.querySelector('[class*="cover-"]')||e.querySelector('[class*="video-player"]')||e.querySelector('[class*="play-icon"]')))return;const t=findMessageId(e);t&&injectVideoDownloadButton(e,t)}
function scanAndInjectVideos(){document.querySelectorAll('[class*="block-video"]').forEach(tryInjectForVideo)}
function scanAndInject(){document.querySelectorAll("img").forEach(tryInjectForImg),scanAndInjectVideos()}
function startDOMObserver(){if(domObserverActive||domObserverPending)return;domObserverPending=!0,whenDomReady(()=>{if(domObserverActive)return;domObserverPending=!1,domObserverActive=!0,injectStyles(),scanAndInject(),new MutationObserver(e=>{let t=!1;for(const n of e){if("childList"===n.type&&n.addedNodes.length>0){for(const e of n.addedNodes)1===e.nodeType&&("IMG"===e.tagName?tryInjectForImg(e):e.querySelectorAll&&e.querySelectorAll("img").forEach(tryInjectForImg),e.classList&&"string"==typeof e.className&&e.className.includes("block-video")&&tryInjectForVideo(e),e.querySelectorAll&&e.querySelectorAll('[class*="block-video"]').forEach(tryInjectForVideo));t=!0}"attributes"===n.type&&"IMG"===n.target.tagName&&tryInjectForImg(n.target)}t&&scanAndInject()}).observe(document.body,{childList:!0,subtree:!0,attributes:!0,attributeFilter:["src"]})})}
function init(){try{chrome.runtime.sendMessage({type:"CHECK_VERSION"},e=>{!1!==e?.valid?(isVersionValid=!0,chrome.runtime.sendMessage({type:"GET_IMAGE_LIST"},e=>{e?.data&&e.data.forEach(registerImageData),startDOMObserver(),window.postMessage({type:"scanInitialMedia"},"*"),setTimeout(()=>{window.postMessage({type:"scanInitialMedia"},"*")},500),setTimeout(()=>{window.postMessage({type:"scanInitialVideos"},"*")},1500)})):isVersionValid=!1})}catch(e){}}

// ========== 添加网页悬浮浮窗（完整面板） ==========
let floatPanel = null;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let panelStartX = 0, panelStartY = 0;

// 更新浮窗内容
async function updateFloatPanel() {
  if (!floatPanel) return;
  
  // 获取激活状态
  const status = await new Promise((resolve) => {
    chrome.runtime.sendMessage({type: "CHECK_ACTIVATION"}, resolve);
  });
  
  // 获取图片/视频数量
  const imageList = await new Promise((resolve) => {
    chrome.runtime.sendMessage({type: "GET_IMAGE_LIST"}, (res) => {
      resolve(res?.data || []);
    });
  });
  
  const versionInfo = await new Promise((resolve) => {
    chrome.runtime.sendMessage({type: "CHECK_VERSION"}, resolve);
  });
  
  const imageCount = imageList.length;
  const videoCount = versionInfo?.videoCount || 0;
  const version = versionInfo?.version || "10.0";
  
  const isActivated = status?.activated || false;
  const remainingCount = status?.remainingCount;
  const expireTime = status?.expireTime;
  
  // 构建状态HTML
  let statusHtml = '';
  if (isActivated) {
    statusHtml = '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;"><span style="background: #10b981; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span><span style="font-size: 13px; font-weight: 500; color: #10b981;">本地版可用</span></div>';
  } else {
    statusHtml = '<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;"><span style="background: #10b981; width: 8px; height: 8px; border-radius: 50%; display: inline-block;"></span><span style="font-size: 13px; font-weight: 500; color: #10b981;">本地版可用</span></div>';
  }
  
  let infoHtml = '';
  if (isActivated) {
    infoHtml = '<div style="background: #eff6ff; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; color: #1e40af; line-height: 1.6;">';
    infoHtml += '状态：可用<br>';
    if (expireTime && expireTime !== "永久有效") {
      infoHtml += '过期时间：' + expireTime + '<br>';
    } else if (expireTime === "永久有效") {
      infoHtml += '过期时间：永久有效<br>';
    }
    if (remainingCount !== undefined && remainingCount !== null) {
      infoHtml += '剩余次数：' + remainingCount + '次';
    }
    infoHtml += '</div>';
  } else {
    infoHtml = '<div style="background: #eff6ff; padding: 10px; border-radius: 8px; margin-bottom: 12px; font-size: 12px; color: #1e40af;">状态：可用</div>';
  }
  
  floatPanel.innerHTML = `
    <div id="float-panel-header" style="
      padding: 12px 16px;
      background: #2563eb;
      color: white;
      border-radius: 12px 12px 0 0;
      cursor: move;
      display: flex;
      align-items: center;
      justify-content: space-between;
      user-select: none;
    ">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">⬇</span>
        <span style="font-weight: 600;">豆包无水印下载</span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="float-minimize-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">−</button>
        <button id="float-close-btn" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">✕</button>
      </div>
    </div>
    <div id="float-panel-body" style="padding: 16px;">
      ${statusHtml}
      ${infoHtml}
      <div style="display: flex; gap: 12px; padding: 12px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; margin-bottom: 12px;">
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: #2563eb;">${imageCount}</div>
          <div style="font-size: 11px; color: #6b7280;">已捕获图片</div>
        </div>
        <div style="width: 1px; background: #e5e7eb;"></div>
        <div style="flex: 1; text-align: center;">
          <div style="font-size: 22px; font-weight: 700; color: #2563eb;">${videoCount}</div>
          <div style="font-size: 11px; color: #6b7280;">已捕获视频</div>
        </div>
      </div>
      <div style="text-align: center; font-size: 11px; color: #9ca3af;">版本 ${version}</div>
    </div>
  `;
  
  // 绑定按钮事件
  const minimizeBtn = floatPanel.querySelector("#float-minimize-btn");
  const closeBtn = floatPanel.querySelector("#float-close-btn");
  const activateBtn = floatPanel.querySelector("#float-activate-btn");
  
  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", () => {
      const body = floatPanel.querySelector("#float-panel-body");
      if (body.style.display === "none") {
        body.style.display = "block";
        minimizeBtn.textContent = "−";
      } else {
        body.style.display = "none";
        minimizeBtn.textContent = "+";
      }
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      floatPanel.style.display = "none";
    });
  }
  
  if (activateBtn) {
    activateBtn.addEventListener("click", () => {
      showActivationModal("插件当前可用");
    });
  }
}

// 创建悬浮浮窗
function createFloatPanel() {
  if (floatPanel) return;
  
  floatPanel = document.createElement("div");
  floatPanel.id = "doubao-float-panel";
  floatPanel.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 280px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    z-index: 99998;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
    overflow: hidden;
    transition: box-shadow 0.2s;
  `;
  
  document.body.appendChild(floatPanel);
  
  // 拖拽功能
  const header = floatPanel.querySelector("#float-panel-header");
  if (header) {
    header.addEventListener("mousedown", startDrag);
  } else {
    // 如果header还没渲染，等待一下
    setTimeout(() => {
      const h = floatPanel.querySelector("#float-panel-header");
      if (h) h.addEventListener("mousedown", startDrag);
    }, 100);
  }
  
  updateFloatPanel();
}

function startDrag(e) {
  if (e.target.tagName === "BUTTON") return;
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  const rect = floatPanel.getBoundingClientRect();
  panelStartX = rect.left;
  panelStartY = rect.top;
  
  document.addEventListener("mousemove", onDrag);
  document.addEventListener("mouseup", stopDrag);
  floatPanel.style.transition = "none";
}

function onDrag(e) {
  if (!isDragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  let newLeft = panelStartX + dx;
  let newTop = panelStartY + dy;
  
  // 边界限制
  const maxX = window.innerWidth - floatPanel.offsetWidth;
  const maxY = window.innerHeight - floatPanel.offsetHeight;
  newLeft = Math.max(0, Math.min(newLeft, maxX));
  newTop = Math.max(0, Math.min(newTop, maxY));
  
  floatPanel.style.left = newLeft + "px";
  floatPanel.style.top = newTop + "px";
  floatPanel.style.right = "auto";
  floatPanel.style.bottom = "auto";
}

function stopDrag() {
  isDragging = false;
  document.removeEventListener("mousemove", onDrag);
  document.removeEventListener("mouseup", stopDrag);
  floatPanel.style.transition = "";
}

// 初始化浮窗
function initFloatPanel() {
  if (document.body) {
    createFloatPanel();
    // 定期更新浮窗
    setInterval(() => {
      if (floatPanel && floatPanel.style.display !== "none") {
        updateFloatPanel();
      }
    }, 5000);
  } else {
    setTimeout(initFloatPanel, 100);
  }
}

// 网页右下角统计浮窗已关闭；保留扩展图标 popup 和页面下载按钮。

window.addEventListener("message",e=>{const t=e.data;if(t){if("imageDataExtracted"===t.type){const e=t.data||[];try{chrome?.runtime?.sendMessage&&chrome.runtime.sendMessage({type:"imageDataExtracted",data:e})}catch(e){e.message?.includes("Extension context invalidated")}e.forEach(registerImageData),setTimeout(scanAndInject,300),setTimeout(scanAndInject,1e3),setTimeout(scanAndInject,2500)}if("videoDownloadResult"===t.type){const e=t.data,n=e?.messageId,a=n?videoButtonMap.get(n):null;a&&(e?.success?(a.innerHTML="✓ 下载已开始",a.classList.add("doubao-dl-success"),setTimeout(()=>{a.disabled=!1,a.innerHTML=`${DOWNLOAD_ICON} 下载视频`,a.classList.remove("doubao-dl-success")},3e3)):(a.innerHTML="失败，点击重试",a.classList.add("doubao-dl-error"),a.disabled=!1,setTimeout(()=>{a.innerHTML=`${DOWNLOAD_ICON} 下载视频`,a.classList.remove("doubao-dl-error")},3e3)),videoButtonMap.delete(n));try{chrome?.runtime?.sendMessage&&chrome.runtime.sendMessage({type:"videoDownloadResult",data:e})}catch(e){e.message?.includes("Extension context invalidated")}}if("videoDataExtracted"===t.type){const e=t.data||[];try{chrome?.runtime?.sendMessage&&chrome.runtime.sendMessage({type:"videoDataExtracted",data:e})}catch(e){e.message?.includes("Extension context invalidated")}setTimeout(scanAndInjectVideos,300),setTimeout(scanAndInjectVideos,1e3),setTimeout(scanAndInjectVideos,2500)}if("doubaoShareSave"===t.type)try{chrome.runtime.sendMessage({type:"doubaoShareSave",messageId:t.messageId},e=>{window.postMessage({type:"doubaoShareSaveResult",data:e},"*")})}catch(e){window.postMessage({type:"doubaoShareSaveResult",data:null},"*")}}});
chrome.runtime.onMessage.addListener((e,t,n)=>"newImageData"===e.type?((e.data||[]).forEach(registerImageData),setTimeout(scanAndInject,300),n({success:!0}),!0):"startVideoDownload"===e.type?(window.postMessage({type:"startVideoDownload"},"*"),n({success:!0}),!0):void 0);
init();

}
