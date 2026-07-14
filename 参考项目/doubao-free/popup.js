/**
 * popup.js — 弹窗逻辑
 */

document.addEventListener('DOMContentLoaded', function () {
  const modeSwitch = document.getElementById('modeSwitch')
  const statusDot  = document.getElementById('statusDot')
  const statusText = document.getElementById('statusText')
  const imgCount   = document.getElementById('imgCount')
  const vidCount   = document.getElementById('vidCount')

  // ============================================================
  //  读取当前模式
  // ============================================================
  chrome.runtime.sendMessage({ type: '__DF_getMode' }, function (res) {
    if (res) {
      modeSwitch.checked = res.value === true
      updateStatus(res.value === true)
    }
  })

  // ============================================================
  //  切换模式
  // ============================================================
  modeSwitch.addEventListener('change', function () {
    const val = this.checked
    chrome.runtime.sendMessage({ type: '__DF_setMode', value: val }, function () {
      updateStatus(val)
    })
  })

  function updateStatus(on) {
    if (on) {
      statusDot.className = 'status-dot on'
      statusText.textContent = '15秒模式 · 已启用'
    } else {
      statusDot.className = 'status-dot off'
      statusText.textContent = '普通模式'
    }
  }

  // ============================================================
  //  检查当前 tab 是否为 doubao
  // ============================================================
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    const tab = tabs[0]
    if (tab && tab.url && tab.url.includes('doubao.com')) {
      // 已连接
    } else {
      statusDot.className = 'status-dot off'
      statusText.textContent = '请打开 doubao.com 使用'
    }
  })

  // ============================================================
  //  版本更新检查
  // ============================================================
  chrome.storage.local.get('df_update', function (r) {
    const update = r.df_update
    if (update && update.version) {
      const notice = document.getElementById('updateNotice')
      const link = document.getElementById('updateLink')
      const text = document.getElementById('updateText')
      if (notice && link && text) {
        text.textContent = 'v' + update.version + ' 可用 — 点击下载'
        link.href = update.url
        notice.style.display = 'block'
      }
    }
  })
})
