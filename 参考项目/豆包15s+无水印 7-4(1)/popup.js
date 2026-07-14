document.addEventListener("DOMContentLoaded", function() {
  var activationPanel = document.getElementById("activationPanel");
  var activatingPanel = document.getElementById("activatingPanel");
  var activatedPanel = document.getElementById("activatedPanel");
  var repairBtn = document.getElementById("repairBtn");
  var refreshBtn = document.getElementById("refreshBtn");
  var imageCountEl = document.getElementById("imageCount");
  var videoCountEl = document.getElementById("videoCount");
  var versionTextEl = document.getElementById("versionText");
  var activationInfo = document.getElementById("activationInfo");
  
  function checkActivationAndShowUI() {
    console.log("[Popup] 检查激活状态");
    chrome.runtime.sendMessage({type: "CHECK_ACTIVATION"}, function(status) {
      console.log("[Popup] 激活状态响应:", status);
      if (status && status.activated) {
        showActivatedPanel(status);
      } else {
        showActivationPanel();
      }
    });
  }
  
  function showActivationPanel() {
    if (activationPanel) activationPanel.classList.add("hidden");
    if (activatingPanel) activatingPanel.classList.add("hidden");
    activatedPanel.classList.add("hidden");
  }
  
  function showActivatingPanel() {
    if (activationPanel) activationPanel.classList.add("hidden");
    if (activatingPanel) activatingPanel.classList.add("hidden");
    activatedPanel.classList.add("hidden");
  }
  
  function showActivatedPanel(activationInfoData) {
    if (activationPanel) activationPanel.classList.add("hidden");
    if (activatingPanel) activatingPanel.classList.add("hidden");
    activatedPanel.classList.remove("hidden");
    
    var infoText = "状态：可用";
    if (activationInfoData.expireTime && activationInfoData.expireTime !== "永久有效") {
      infoText = infoText + "\n过期时间：" + activationInfoData.expireTime;
    } else if (activationInfoData.expireTime === "永久有效") {
      infoText = infoText + "\n过期时间：永久有效";
    }
    if (activationInfoData.remainingCount !== undefined && activationInfoData.remainingCount !== null) {
      infoText = infoText + "\n剩余次数：" + activationInfoData.remainingCount + "次";
    }
    if (activationInfo) activationInfo.textContent = infoText;
    
    loadStats();
  }
  
  function loadStats() {
    // 重新获取激活状态获取最新剩余次数
    chrome.runtime.sendMessage({type: "CHECK_ACTIVATION"}, function(status) {
      if (status && status.activated) {
        var infoText = "状态：可用";
        if (status.expireTime && status.expireTime !== "永久有效") {
          infoText = infoText + "\n过期时间：" + status.expireTime;
        } else if (status.expireTime === "永久有效") {
          infoText = infoText + "\n过期时间：永久有效";
        }
        if (status.remainingCount !== undefined && status.remainingCount !== null) {
          infoText = infoText + "\n剩余次数：" + status.remainingCount + "次";
        }
        if (activationInfo) activationInfo.textContent = infoText;
      }
    });
    
    chrome.runtime.sendMessage({type: "GET_IMAGE_LIST"}, function(response) {
      if (response && response.success && imageCountEl) {
        imageCountEl.textContent = (response.data && response.data.length) || 0;
      }
    });
    
    chrome.runtime.sendMessage({type: "CHECK_VERSION"}, function(response) {
      if (response && response.videoCount !== undefined && videoCountEl) {
        videoCountEl.textContent = response.videoCount || 0;
      }
    });
  }
  
  function checkVersion() {
    chrome.runtime.sendMessage({type: "CHECK_VERSION"}, function(response) {
      if (!chrome.runtime.lastError && response && versionTextEl) {
        versionTextEl.textContent = response.version || "1.0";
      }
    });
  }
  
  function repairCurrentTab() {
    if (!repairBtn) return;
    repairBtn.disabled = true;
    repairBtn.textContent = "修复中...";
    chrome.runtime.sendMessage({type: "REPAIR_CURRENT_TAB"}, function(response) {
      if (chrome.runtime.lastError) {
        repairBtn.disabled = false;
        repairBtn.textContent = "修复当前页面";
        if (activationInfo) activationInfo.textContent = "修复失败：" + chrome.runtime.lastError.message;
        return;
      }

      if (!response || !response.success) {
        repairBtn.disabled = false;
        repairBtn.textContent = "修复当前页面";
        if (activationInfo) activationInfo.textContent = "修复失败：" + ((response && response.error) || "未知错误");
        return;
      }

      if (activationInfo) activationInfo.textContent = "已开始修复，当前页面会自动刷新。";
      window.close();
    });
  }

  chrome.runtime.sendMessage({type: "ENSURE_CURRENT_TAB_READY"}, function() {});

  if (repairBtn) {
    repairBtn.addEventListener("click", function() {
      repairCurrentTab();
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", function() {
      loadStats();
    });
  }
  
  checkActivationAndShowUI();
  checkVersion();
});
