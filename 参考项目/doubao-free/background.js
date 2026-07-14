/**
 * background.js — Service Worker
 *
 * 职责：
 *   1. 处理下载请求（chrome.downloads）
 *   2. 转发模式切换通知到所有 tab
 *   3. 响应 popup 的查询
 *   4. 备用视频URL获取
 */

// ============================================================
//  下载
// ============================================================
async function handleDownload(url, filename) {
  try {
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename || 'doubao_' + Date.now() + '.mp4',
      saveAs: false,
      conflictAction: 'uniquify'
    })
    return { success: true, downloadId }
  } catch (e) {
    return { success: false, error: e.message }
  }
}

// ============================================================
//  通知所有 doubao tab 切换模式
// ============================================================
async function broadcastMode(value) {
  await chrome.storage.local.set({ df_mode15s: value })
  const tabs = await chrome.tabs.query({ url: 'https://www.doubao.com/*' })
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: '__DF_modeChanged', value }).catch(() => {})
  }
}

// ============================================================
//  消息监听
// ============================================================
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  // --- 下载 ---
  if (msg.type === '__DF_download') {
    handleDownload(msg.url, msg.filename).then(sendResponse)
    return true
  }

  // --- 切换15秒模式 ---
  if (msg.type === '__DF_setMode') {
    broadcastMode(msg.value).then(() => sendResponse({ success: true }))
    return true
  }

  // --- 查询当前模式 ---
  if (msg.type === '__DF_getMode') {
    chrome.storage.local.get('df_mode15s', function (r) {
      sendResponse({ value: r.df_mode15s === true })
    })
    return true
  }

  // --- 视频发现（仅统计）---
  if (msg.type === '__DF_videoFound') {
    // 暂不处理，留作未来扩展
    sendResponse({ success: true })
    return true
  }

  // --- 检查更新 ---
  if (msg.type === '__DF_CHECK_UPDATE') {
    checkUpdate().then(sendResponse)
    return true
  }

  // --- 获取视频分享URL（备用）---
  if (msg.type === '__DF_getVideoShareUrl') {
    getVideoShareUrl(msg.vid).then(sendResponse)
    return true
  }
})

// ============================================================
//  版本更新检查
// ============================================================
const CURRENT_VERSION = chrome.runtime.getManifest().version
const REPO = 'gosick233-cloud/doubao-free'

async function checkUpdate() {
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
    const data = await resp.json()
    const latest = (data.tag_name || '').replace(/^v/, '')
    if (latest && latest !== CURRENT_VERSION) {
      // 有更新，设置角标
      chrome.action.setBadgeText({ text: 'NEW' })
      chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' })
      await chrome.storage.local.set({
        df_update: { version: latest, url: data.html_url, notes: (data.body || '').slice(0, 300) }
      })
      return { hasUpdate: true, latest, url: data.html_url }
    }
    await chrome.storage.local.set({ df_update: null })
    chrome.action.setBadgeText({ text: '' })
    return { hasUpdate: false }
  } catch {
    return { hasUpdate: false, error: 'check failed' }
  }
}

// 启动和每小时检查一次
checkUpdate()
setInterval(checkUpdate, 3600000)

// ============================================================
//  备用：通过豆包分享API获取视频URL
// ============================================================
async function getVideoShareUrl(vid) {
  try {
    const url = 'https://www.doubao.com/samantha/media/get_play_info?aid=497858&device_platform=web&samantha_web=1&use-olympus-account=1&version_code=20800&pkg_type=release_version&web_tab_id=' + crypto.randomUUID()
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'accept': 'application/json', 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ key: vid, type: 'video' })
    })
    const j = await resp.json()
    if (j.code === 0 && j.data) {
      const om = j.data.original_media_info
      if (om?.main_url) {
        return { mainUrl: om.main_url.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark'), width: om.width, height: om.height }
      }
      const pi = j.data.play_infos?.[0] || j.data.play_info
      if (pi?.main) {
        return { mainUrl: pi.main.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark'), width: pi.width, height: pi.height }
      }
    }
    return null
  } catch (e) {
    return null
  }
}
