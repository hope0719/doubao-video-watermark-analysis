/**
 * content.js — MAIN world
 * 豆包自由版核心逻辑
 * 
 * 功能：
 *   1. 劫持 JSON.parse → 提取无水印图片URL
 *   2. 劫持 fetch → SSE分流提取视频 + 修改 duration 实现15秒
 *   3. 劫持 XHR → chain/single 提取数据
 *   4. DOM扫描 + MutationObserver → 注入下载按钮
 *   5. 视频URL获取（直接调豆包API）
 * 
 * 注意：本脚本运行在 MAIN world，不能直接调用 chrome.runtime API。
 *       所有需要后台服务的操作（下载、storage）通过 postMessage 交给 forwarder.js。
 */

// ============================================================
//  状态
// ============================================================
let mode15s = false
const imageDb = new Map()
const videoDb = new Map()
const seenUrls = new Set()
const MAX_SEEN = 200

// ============================================================
//  原生函数备份
// ============================================================
const _parse     = JSON.parse.bind(JSON)
const _fetch     = window.fetch.bind(window)
const _xhrOpen   = XMLHttpRequest.prototype.open
const _xhrSend   = XMLHttpRequest.prototype.send
const _pushState = history.pushState.bind(history)

// ============================================================
//  工具
// ============================================================
function extractFileKey(url) {
  if (!url) return null
  const m = url.match(/rc_gen_image\/([^?~]+)/)
  return m ? m[1] : null
}

function walkJSON(obj, visit, depth = 0) {
  if (depth > 20 || obj == null || typeof obj !== 'object') return
  if (Array.isArray(obj)) {
    for (const v of obj) walkJSON(v, visit, depth + 1)
  } else {
    visit(obj)
    for (const v of Object.values(obj)) walkJSON(v, visit, depth + 1)
  }
}

function findVid(obj, depth = 0) {
  if (depth > 10 || !obj) return null
  if (Array.isArray(obj)) {
    for (const v of obj) { const r = findVid(v, depth + 1); if (r) return r }
    return null
  }
  if (typeof obj !== 'object') return null
  const vid = obj.vid || obj.video_id
  if (typeof vid === 'string' && vid.startsWith('v0')) return vid
  for (const v of Object.values(obj)) { const r = findVid(v, depth + 1); if (r) return r }
  return null
}

// 深度修改 duration（15秒模式）
// 豆包请求体中 duration 在 chat_ability.ability_param JSON 字符串内部
function patchDuration(obj, depth = 0) {
  if (depth > 20 || obj == null || typeof obj !== 'object') return false
  let changed = false
  if (Array.isArray(obj)) {
    for (const v of obj) { if (patchDuration(v, depth + 1)) changed = true }
  } else {
    // 关键：找到 chat_ability.ability_type === 17（视频生成）
    // 并将 ability_param 中的 model + duration 修改
    if (obj.chat_ability && Number(obj.chat_ability.ability_type) === 17) {
      const ability = obj.chat_ability
      if (typeof ability.ability_param === 'string') {
        try {
          const param = JSON.parse(ability.ability_param)
          if (param && typeof param === 'object') {
            param.model = 'seedance_v2.0'
            param.duration = 15
            ability.ability_param = JSON.stringify(param)
            changed = true
          }
        } catch (_) {}
      } else if (ability.ability_param && typeof ability.ability_param === 'object') {
        ability.ability_param.model = 'seedance_v2.0'
        ability.ability_param.duration = 15
        changed = true
      }
    }
    for (const [k, v] of Object.entries(obj)) {
      if (k !== 'chat_ability' && patchDuration(v, depth + 1)) changed = true
    }
  }
  return changed
}

// ============================================================
//  提取
// ============================================================

// 已弃用：按钮的 key 现在直接从容器内 DOM 提取，不再按下标顺序配对
// 保留变量声明仅为向后兼容，实际已无引用
let processedImageKeys = new Set()

function extractImages(creations) {
  if (!Array.isArray(creations)) return
  let newImages = []
  for (const cr of creations) {
    const raw = cr?.image?.image_ori_raw
    if (raw?.url) {
      const key = extractFileKey(raw.url)
      if (key && !imageDb.has(key)) {
        imageDb.set(key, { no_watermark_url: raw.url, width: raw.width, height: raw.height, id: cr.id || key })
        newImages.push({ key, data: imageDb.get(key) })
      }
    }
  }
  // 新图片加入后立即尝试注入按钮
  if (newImages.length) {
    setTimeout(scheduleInjectAllImageButtons, 500)
  }
}

function extractVideos(messages) {
  if (!Array.isArray(messages)) return
  for (const msg of messages) {
    const mid = String(msg?.message_id || '').trim()
    if (!mid || mid === '0') continue
    const vid = findVid(msg)
    if (vid && !videoDb.has(mid)) {
      videoDb.set(mid, vid)
      post({ type: '__DF_videoFound', messageId: mid, vid })
    }
  }
}

function harvest(obj) {
  try {
    walkJSON(obj, node => {
      const creations = node?.content?.creation_block?.creations
      if (creations) extractImages(creations)

      const msgs = node?.downlink_body?.pull_singe_chain_downlink_body?.messages
      if (msgs) {
        extractImagesFromMessages(msgs)
        extractVideos(msgs)
      }

      const ops = node?.patch_op
      if (Array.isArray(ops)) {
        for (const op of ops) {
          const blocks = op?.patch_value?.content_block
          if (Array.isArray(blocks)) {
            for (const blk of blocks) {
              extractImages(blk?.content?.creation_block?.creations)
            }
          }
          const pv = op?.patch_value
          if (pv) {
            const mid = String(pv.message_id || '').trim()
            if (mid && mid !== '0') {
              const vid = findVid(pv)
              if (vid && !videoDb.has(mid)) {
                videoDb.set(mid, vid)
                post({ type: '__DF_videoFound', messageId: mid, vid })
              }
            }
          }
        }
      }
    })
  } catch (_) {}
}

function extractImagesFromMessages(msgs) {
  if (!Array.isArray(msgs)) return
  for (const msg of msgs) {
    const blocks = msg?.content_block
    if (Array.isArray(blocks)) {
      for (const blk of blocks) {
        extractImages(blk?.content?.creation_block?.creations)
      }
    }
  }
}

function post(data) {
  window.postMessage(data, '*')
}

// ============================================================
//  1. Hook JSON.parse
// ============================================================
JSON.parse = function(...args) {
  const r = _parse(...args)
  try { harvest(r) } catch (_) {}
  return r
}

// ============================================================
//  2. Hook fetch
// ============================================================
window.fetch = function(input, init) {
  const reqUrl  = typeof input === 'string' ? input : input?.url
  const reqInit = init || (typeof input === 'object' ? input : undefined)

  // 15秒模式：修改请求体 duration
  if (mode15s && reqInit?.body && typeof reqInit.body === 'string') {
    try {
      const parsed = JSON.parse(reqInit.body)
      if (patchDuration(parsed)) {
        reqInit.body = JSON.stringify(parsed)
      }
    } catch (_) {}
  }

  return _fetch(input, reqInit).then(async resp => {
    if (!resp.ok) return resp
    const ct = resp.headers?.get?.('content-type') || ''
    if (ct.includes('text/event-stream') || ct.includes('application/json')) {
      const body = resp.body
      if (!body) return resp
      const [a, b] = body.tee()
      consumeStream(b, ct)
      return new Response(a, { status: resp.status, statusText: resp.statusText, headers: resp.headers })
    }
    return resp
  }).catch(() => _fetch(input, reqInit))
}

async function consumeStream(stream, ct) {
  if (ct.includes('text/event-stream')) {
    await consumeSSE(stream)
  } else {
    // JSON — 读完整段
    try {
      const reader = stream.getReader()
      const dec = new TextDecoder()
      let text = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        text += dec.decode(value, { stream: true })
      }
      text += dec.decode()
      try { harvest(JSON.parse(text)) } catch(_) {}
    } catch(_) {}
  }
}

async function consumeSSE(stream) {
  const reader = stream.getReader()
  const dec = new TextDecoder()
  let buf = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const parts = buf.split('\n\n')
      buf = parts.pop() || ''
      for (const part of parts) {
        const m = part.match(/^data: (.+)$/m)
        if (m) try { harvest(JSON.parse(m[1])) } catch(_) {}
      }
    }
  } catch(_) {}
}

// ============================================================
//  3. Hook XHR
// ============================================================
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  this.__df_url = typeof url === 'string' ? url : String(url)
  return _xhrOpen.call(this, method, url, ...rest)
}
XMLHttpRequest.prototype.send = function(...args) {
  this.addEventListener('load', () => {
    const u = this.__df_url
    if (!u || !u.includes('chain/single')) return
    try { harvest(JSON.parse(this.responseText)) } catch(_) {}
  })
  return _xhrSend.apply(this, args)
}

// ============================================================
//  4. 捕获 SPA 导航
// ============================================================
history.pushState = function(...args) {
  _pushState.apply(this, args)
  setTimeout(scanDOM, 1000)
}

// ============================================================
//  5. 获取无水印视频 URL
// ============================================================
async function resolveVideoUrl(vid) {
  // 方法1：get_play_info
  try {
    const url = 'https://www.doubao.com/samantha/media/get_play_info?aid=497858&device_platform=web&samantha_web=1&use-olympus-account=1&version_code=20800&pkg_type=release_version&web_tab_id=' + crypto.randomUUID()
    const resp = await _fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'origin': location.origin,
        'referer': location.href
      },
      credentials: 'include',
      body: JSON.stringify({ key: vid, type: 'video' })
    })
    const j = await resp.json()
    if (j.code === 0 && j.data) {
      const om = j.data.original_media_info
      if (om?.main_url) {
        return {
          mainUrl: om.main_url.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark'),
          width: om.width,
          height: om.height
        }
      }
      const pi = j.data.play_infos?.[0] || j.data.play_info
      if (pi?.main) {
        return {
          mainUrl: pi.main.replace(/lr=[^&]+/g, 'lr=video_gen_no_watermark'),
          width: pi.width,
          height: pi.height
        }
      }
    }
  } catch (_) {}
  return null
}

// ============================================================
//  6. DOM 注入
// ============================================================

const SVG_DL = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'

function injectStyles() {
  if (document.getElementById('__df_styles')) return
  const s = document.createElement('style')
  s.id = '__df_styles'
  s.textContent = `
.__df-btn{position:absolute!important;bottom:10px!important;right:10px!important;z-index:99999!important;display:inline-flex!important;align-items:center!important;gap:5px!important;padding:6px 12px!important;background:rgba(0,0,0,0.62)!important;color:#fff!important;border:none!important;border-radius:8px!important;font-size:12px!important;font-weight:500!important;cursor:pointer!important;backdrop-filter:blur(6px)!important;-webkit-backdrop-filter:blur(6px)!important;transition:background .2s,transform .15s!important;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',sans-serif!important;line-height:1!important;white-space:nowrap!important;pointer-events:all!important;user-select:none!important}
.__df-btn:hover{background:rgba(0,0,0,0.82)!important}
.__df-btn:active{transform:scale(.97)!important}
.__df-btn.__df-ok{background:rgba(16,185,129,0.85)!important}
.__df-btn.__df-fail{background:rgba(239,68,68,0.82)!important}
`
  document.head.appendChild(s)
}

function findContainer(imgEl) {
  let c = imgEl.closest('[class*="message"]') || imgEl.parentElement
  for (let i = 0; i < 6 && c && c !== document.body; i++) {
    const r = c.getBoundingClientRect()
    if (r.width >= 80 && r.height >= 60) break
    c = c.parentElement
  }
  return c || imgEl.parentElement
}

function ensureRelative(el) {
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
}

// 注入所有图片的下载按钮
let _retryTimer = null

function injectAllImageButtons() {
  if (!document.body) return

  // 找所有带 signature 的 source，取容器
  const containers = []
  document.querySelectorAll('source[srcset*="signature"]').forEach(el => {
    let c = el.parentElement
    for (let i = 0; i < 3 && c && c !== document.body; i++) {
      if (c.offsetWidth < 80 || c.offsetHeight < 80 || c.offsetWidth > 600) { c = c.parentElement; continue }
      if (containers.includes(c)) break
      // 检查容器内的实际 img（排除 avatar/icon）
      const img = c.querySelector('img:not([src*="avatar"]):not([src*="doubao_avatar"]):not([src*="intro."])')
      if (!img || img.offsetWidth < 50) { c = c.parentElement; continue }
      containers.push(c)
      break
    }
  })

  if (!containers.length) return

  // 关键修复：按钮的 key 直接从容器内部 DOM 提取，不再按下标顺序配对
  // 这样多轮生图 + 刷新后，按钮与图片仍然一一对应
  for (const c of containers) {
    if (!c || !c.style) continue

    // 从容器内 <source srcset> 或 <img src> 提取 fileKey
    const sourceEl = c.querySelector('source[srcset*="rc_gen_image"]')
    const imgEl    = c.querySelector('img[src*="rc_gen_image"]')
    const url      = (sourceEl && sourceEl.srcset) || (imgEl && imgEl.src) || ''
    const key      = extractFileKey(url)
    if (!key) continue

    // 校验已有按钮：若 data-key 与当前 DOM 不符，说明配错了，删掉重建
    const existing = c.querySelector('.__df-btn[data-key]')
    if (existing) {
      if (existing.getAttribute('data-key') === key) continue  // 已正确绑定
      existing.remove()                                        // 错位，重建
    }

    const data = imageDb.get(key)
    if (!data) continue   // 数据还没到，等下一轮重试

    if (getComputedStyle(c).position === 'static') c.style.position = 'relative'
    addDownloadBtn(c, data, key)
  }
}

// 持续重试直到所有图片容器都有按钮
function scheduleInjectAllImageButtons() {
  if (_retryTimer) clearTimeout(_retryTimer)
  
  const doTry = (attempt) => {
    injectAllImageButtons()
    // 检查是否所有 source 都有按钮了
    const total = document.querySelectorAll('source[srcset*="signature"]').length
    const buttoned = document.querySelectorAll('.__df-btn[data-key]').length
    if (total > buttoned && attempt < 30) {
      _retryTimer = setTimeout(() => doTry(attempt + 1), 1000)
    }
  }
  doTry(0)
}



// 添加下载按钮到容器
function addDownloadBtn(container, data, key) {
  if (!container || !container.querySelector) return
  if (container.querySelector(`.__df-btn[data-key="${CSS.escape(key)}"]`)) return
  const btn = document.createElement('button')
  btn.className = '__df-btn'
  btn.setAttribute('data-key', key)
  btn.innerHTML = SVG_DL + ' 下载原图'
  btn.onclick = e => {
    e.stopPropagation()
    btn.disabled = true; btn.textContent = '下载中…'
    const fn = 'doubao_img_' + (data.width && data.height ? data.width + 'x' + data.height + '_' : '') + Date.now() + '.png'
    post({ type: '__DF_download', url: data.no_watermark_url, filename: fn, __cbId: Date.now() + '_' + Math.random().toString(36).slice(2, 6) })
    setTimeout(() => { btn.disabled = false; btn.innerHTML = SVG_DL + ' 下载原图' }, 3000)
  }
  container.appendChild(btn)
}

// 浮动下载按钮（兜底）
// 图片下载按钮（旧的，保留兼容）
function tryInjectImage(imgEl) {
  if (imgEl.__df_img) return
  imgEl.__df_img = true
  const key = extractFileKey(imgEl.src)
  if (!key) return
  const data = imageDb.get(key)
  if (!data) return

  const container = findContainer(imgEl)
  ensureRelative(container)
  addDownloadBtn(container, data, key)
}

// 视频下载按钮
function tryInjectVideo(el) {
  if (el.__df_video) return
  el.__df_video = true

  // 查找 messageId
  let cur = el
  for (let i = 0; i < 20 && cur && cur !== document.body; i++) {
    if (cur.dataset?.messageId) break
    if (cur.dataset?.message_id) break
    cur = cur.parentElement
  }
  const mid = cur?.dataset?.messageId || cur?.dataset?.message_id
  if (!mid) return

  // 如果还没拿到vid，标记等待
  if (!videoDb.has(mid)) {
    el.__df_waitMid = mid
    return
  }

  ensureRelative(el)

  const btn = document.createElement('button')
  btn.className = '__df-btn'
  btn.innerHTML = SVG_DL + ' 下载视频'

  let downloading = false
  btn.onclick = async e => {
    e.stopPropagation()
    if (downloading) return
    downloading = true
    btn.disabled = true; btn.textContent = '获取链接…'

    const vid = videoDb.get(mid)
    if (!vid) { btn.disabled = false; btn.textContent = '无视频'; downloading = false; return }

    const result = await resolveVideoUrl(vid)
    if (!result?.mainUrl) {
      btn.disabled = false; btn.innerHTML = SVG_DL + ' 下载视频'
      showToast('获取视频链接失败', 'fail')
      downloading = false
      return
    }

    const fn = 'doubao_video_' + (result.width && result.height ? result.width + 'x' + result.height + '_' : '') + Date.now() + '.mp4'
    post({ type: '__DF_download', url: result.mainUrl, filename: fn, __cbId: 'v_' + Date.now() })
    // 结果由消息监听处理
    downloading = false
    btn.disabled = false
    btn.innerHTML = '✓ 已发送下载'
    btn.classList.add('__df-ok')
    setTimeout(() => { btn.innerHTML = SVG_DL + ' 下载视频'; btn.classList.remove('__df-ok') }, 2500)
  }

  el.appendChild(btn)
}

function showToast(msg, type) {
  if (!document.body) return
  const t = document.createElement('div')
  t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:' + (type === 'ok' ? '#10b981' : '#ef4444') + ';color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;z-index:100001;font-family:system-ui;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:__df_fade 2.5s ease forwards'
  t.textContent = (type === 'ok' ? '✓ ' : '⚠️ ') + msg
  document.body.appendChild(t)
  if (!document.getElementById('__df_toast_style')) {
    const s = document.createElement('style')
    s.id = '__df_toast_style'
    s.textContent = '@keyframes __df_fade{0%{opacity:0;transform:translateY(10px)}15%{opacity:1;transform:translateY(0)}85%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(10px);visibility:hidden}}'
    document.head.appendChild(s)
  }
  setTimeout(() => { if (t.parentNode) t.remove() }, 2600)
}

// ============================================================
//  DOM 扫描
// ============================================================
function scanDOM() {
  try {
    // 所有未处理的图片
    scheduleInjectAllImageButtons()
    // 已弃用：tryInjectImage 通过 findContainer 向上冒泡找容器，
    // 会错误匹配到消息级 wrapper，导致按钮浮到对话右下角。
    // 改由 scheduleInjectAllImageButtons() 统一通过 source[srcset*="signature"] 精确注入。
    // document.querySelectorAll('img[src*="rc_gen_image"]').forEach(tryInjectImage)
    document.querySelectorAll('[class*="block-video"]').forEach(tryInjectVideo)
    document.querySelectorAll('[class*="block-video"]').forEach(el => {
      if (el.__df_video) return
      if (el.__df_waitMid && videoDb.has(el.__df_waitMid)) {
        tryInjectVideo(el)
      }
    })
  } catch (_) {}
}

function startObserver() {
  injectStyles()
  setTimeout(scanDOM, 500)

  const obs = new MutationObserver(() => setTimeout(scanDOM, 200))
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] })

  setInterval(scanDOM, 3000)
}

// ============================================================
//  消息监听
// ============================================================
window.addEventListener('message', e => {
  const d = e.data
  if (!d) return
  switch (d.type) {
    case '__DF_modeChanged':
      mode15s = d.value
      showToast(d.value ? '15秒模式已开启' : '15秒模式已关闭', 'ok')
      break
    case '__DF_downloadResult':
      // 下载结果通知（来自 forwarder）
      break
  }
})

// ============================================================
//  启动
// ============================================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserver)
} else {
  startObserver()
}
