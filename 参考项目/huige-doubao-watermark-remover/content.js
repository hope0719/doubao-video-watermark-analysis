/**
 * HG 水印消失术 — MAIN world 脚本
 * 直接注入豆包页面，拦截API提取无水印原图/视频
 * 架构参考: 水印消失术 v1.0.9
 */
(function() {
    'use strict';

    const DEBUG = false;
    const log = DEBUG ? console.log.bind(console, '[HG]') : () => {};
    const warn = console.warn.bind(console, '[HG]');
    const err = console.error.bind(console, '[HG]');

    // ── 状态 ──
    let images = [];       // 图片数组
    let videos = [];       // 视频数组
    let currentTab = 'image';
    let selectedIndices = new Set();
    let lastRoute = '';
    let panelOpen = false;
    let launcherEl = null;
    let panelEl = null;
    let gridEl = null;
    let previewEl = null;

    // ── SVG 图标 ──
    const ICON_DOWNLOAD = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14m0 0-5-5m5 5 5-5"/><path d="M4 18v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
    const ICON_CHECK = '<svg viewBox="0 0 24 24" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>';
    const ICON_WAND = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 4l-2 2 2 2M15 4l2 2-2 2"/><path d="M8 9l-3 3 3 3M8 9l3 3-3 3M8 9V7M8 15v2"/><path d="M15 10l1.5 1.5L15 13"/><path d="M9 18l1.5 1.5L9 21"/><path d="M12 2v2"/><path d="M5 5l2 2"/></svg>';
    const ICON_PIC = '<svg viewBox="0 0 24 24" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    const ICON_VID = '<svg viewBox="0 0 24 24" width="14" height="14"><polygon points="3 4 21 12 3 20 3 4" fill="currentColor"/></svg>';
    const ICON_CLOSE = '&#x2715;';

    // ── 路由检测 ──
    function getRoute() {
        return location.hostname + location.pathname + location.search;
    }

    function isSameRoute(r) {
        return !r || r === lastRoute;
    }

    let routeTimer = null;

    function checkRoute(source) {
        var cur = getRoute();
        if (cur !== lastRoute) {
            log('路由变化:', lastRoute, '->', cur, source);
            lastRoute = cur;
            images = [];
            videos = [];
            selectedIndices.clear();
            updateUI();
            // 多阶段延时扫描 (SPA 数据加载需要时间)
            clearTimeout(routeTimer);
            routeTimer = setTimeout(function() {
                scanExistingMedia();
                // 二次扫描 (等数据的异步加载完成)
                setTimeout(scanExistingMedia, 1200);
                setTimeout(scanExistingMedia, 2500);
            }, 400);
        }
    }

    // Hook SPA 导航
    var _pushState = history.pushState;
    history.pushState = function() { _pushState.apply(this, arguments); setTimeout(() => checkRoute('pushState'), 50); };
    var _replaceState = history.replaceState;
    history.replaceState = function() { _replaceState.apply(this, arguments); setTimeout(() => checkRoute('replaceState'), 50); };
    window.addEventListener('popstate', () => setTimeout(() => checkRoute('popstate'), 50));

    // URL 轮询
    setInterval(() => checkRoute('poll'), 1000);

    // ── XHR 拦截 ──
    var _xhrOpen = XMLHttpRequest.prototype.open;
    var _xhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(m, u) {
        this._hgUrl = typeof u === 'string' ? u : '';
        return _xhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function() {
        var url = this._hgUrl;
        if (url && url.includes('/im/chain/single')) {
            this.addEventListener('load', function() {
                try {
                    var data = JSON.parse(this.responseText);
                    var msgs = data?.downlink_body?.pull_singe_chain_downlink_body?.messages;
                    if (!Array.isArray(msgs)) return;
                    for (var i = 0; i < msgs.length; i++) {
                        var blocks = msgs[i].content_block;
                        if (Array.isArray(blocks)) extractFromBlocks(blocks);
                    }
                } catch (e) { warn('XHR chain parse fail:', e); }
            });
        }
        return _xhrSend.apply(this, arguments);
    };

    // ── Fetch 拦截 ──
    var _fetch = window.fetch;
    window.fetch = function(input, init) {
        var url = typeof input === 'string' ? input : (input?.url || '');
        var route = lastRoute;

        // /chat/completion → SSE 流
        if (url.includes('/chat/completion')) {
            return _fetch.apply(this, arguments).then(function(resp) {
                var clone = resp.clone();
                processSSEStream(clone, route);
                return resp;
            });
        }
        return _fetch.apply(this, arguments);
    };

    async function processSSEStream(resp, route) {
        try {
            var reader = resp.body?.getReader();
            if (!reader) return;
            var decoder = new TextDecoder();
            var buf = '';
            while (true) {
                var {done, value} = await reader.read();
                if (done) break;
                buf += decoder.decode(value, {stream: true});
                var lines = buf.split('\n');
                buf = lines.pop() || '';
                for (var j = 0; j < lines.length; j++) {
                    var line = lines[j].trim();
                    if (!line.startsWith('data: ')) continue;
                    try {
                        var p = JSON.parse(line.slice(6));
                        var ev = typeof p.event_data === 'string' ? JSON.parse(p.event_data) : p.event_data;
                        if (p.event_type !== 2001 || !ev?.message) continue;
                        var content = typeof ev.message.content === 'string' ? JSON.parse(ev.message.content) : ev.message.content;
                        if (!content.creations) continue;
                        for (var k = 0; k < content.creations.length; k++) {
                            var c = content.creations[k];
                            if (c.image && c.image.status === 2 && c.image.image_ori_raw?.url) {
                                addImage(c.image, ev.conversation_id, ev.message_id);
                            }
                            if (c.video && c.video.vid) {
                                resolveVideo(c.video.vid, c.video, ev.conversation_id, ev.message_id);
                            }
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}
    }

    // ── 图片提取 ──
    function addImage(img, convId, msgId) {
        var url = decodeUrl(img.image_ori_raw?.url || '');
        if (!url || images.some(function(i) { return i.url === url; })) return;
        images.push({
            id: (msgId || 'img') + '-' + images.length,
            url: url,
            thumbUrl: decodeUrl(img.image_thumb?.url || img.image_preview?.url || url),
            width: img.image_ori_raw?.width || img.placeholder?.width || 0,
            height: img.image_ori_raw?.height || img.placeholder?.height || 0,
            prompt: img.gen_params?.prompt || '',
            ratio: img.gen_params?.ratio || '',
            type: 'image'
        });
        updateUI();
    }

    // ── 视频提取 ──
    async function resolveVideo(vid, videoData, convId, msgId) {
        if (!vid || videos.some(function(v) { return v.vid === vid; })) return;
        try {
            var info = await getPlayInfo(vid);
            if (!info || !info.url) {
                warn('视频获取失败(无URL):', vid);
                return;
            }
            videos.push({
                id: (msgId || 'vid') + '-' + videos.length,
                vid: vid,
                url: info.url,
                thumbUrl: info.poster_url || '',
                posterUrl: info.poster_url || '',
                width: info.width || 0,
                height: info.height || 0,
                duration: info.duration || 0,
                prompt: videoData?.gen_params?.prompt || '',
                ratio: videoData?.gen_params?.ratio || '',
                type: 'video'
            });
            log('视频获取成功:', vid, info.url.slice(0, 60));
            updateUI();
        } catch (e) {
            warn('视频解析失败:', vid, e);
        }
    }

    async function getPlayInfo(vid) {
        var params = new URLSearchParams({
            version_code: '20800', language: 'zh-CN', device_platform: 'web',
            aid: '497858', real_aid: '497858', pkg_type: 'release_version',
            device_id: '', pc_version: '2.51.7', region: '', sys_region: '',
            samantha_web: '1', 'use-olympus-account': '1', web_tab_id: ''
        });
        var res = await fetch('https://www.doubao.com/samantha/media/get_play_info?' + params.toString(), {
            method: 'POST', credentials: 'include',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({key: vid})
        });
        var data = await res.json();
        if (!data?.data) return null;
        var media = data.data.original_media_info || {};
        var meta = media.meta || {};
        return {
            url: media.main_url || '',
            poster_url: data.data.poster_url || '',
            width: meta.width || 0,
            height: meta.height || 0,
            duration: meta.duration || 0,
            definition: meta.definition || ''
        };
    }

    function decodeUrl(url) {
        if (!url) return '';
        return url.replace(/\\u0026/g, '&');
    }

    // ── 从 content_block 中提取 ──
    function extractFromBlocks(blocks) {
        if (!Array.isArray(blocks)) return;
        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];
            if (b.block_type !== 2074) continue;
            var creations = b.content?.creation_block?.creations;
            if (!Array.isArray(creations)) continue;
            for (var j = 0; j < creations.length; j++) {
                var c = creations[j];
                if (c.image && c.image.status === 2 && c.image.image_ori_raw?.url) {
                    addImage(c.image, '', '');
                }
                if (c.video && c.video.vid) {
                    resolveVideo(c.video.vid, c.video, '', '');
                }
            }
        }
    }

    // ── 扫描历史素材 (1.0.9 方式: 从 script 标签提取) ──
    function scanExistingMedia() {
        try {
            // 方式1: 1.0.9 的 script 标签提取
            var script = document.querySelector('script[data-script-src="modern-run-router-data-fn"]');
            if (script) {
                var args = script.getAttribute('data-fn-args');
                if (args) {
                    var data = JSON.parse(args.replace(/&quot;/g, '"'));
                    for (var si = 0; si < data.length; si++) {
                        if (typeof data[si] === 'object' && data[si]?.data?.message_snapshot?.message_list) {
                            var msgs = data[si].data.message_snapshot.message_list;
                            for (var mi = 0; mi < msgs.length; mi++) {
                                var blocks = msgs[mi].content_block;
                                if (Array.isArray(blocks)) extractFromBlocks(blocks);
                            }
                        }
                    }
                    return;
                }
            }
            // 方式2: _ROUTER_DATA
            var rd = window._ROUTER_DATA;
            if (rd) {
                var cells = rd?.loaderData?.chat_layout?.trimmedChainRecentConvCells;
                if (Array.isArray(cells)) {
                    for (var ci = 0; ci < cells.length; ci++) {
                        var conv = cells[ci]?.conversation;
                        if (!conv?.messages) continue;
                        for (var cj = 0; cj < conv.messages.length; cj++) {
                            var blocks = conv.messages[cj].content_block;
                            if (Array.isArray(blocks)) extractFromBlocks(blocks);
                        }
                    }
                    return;
                }
            }
        } catch (e) { warn('扫描历史素材失败:', e); }
    }

    function clearMedia() {
        images = [];
        videos = [];
        selectedIndices.clear();
        updateUI();
    }

    // ═══════════════════════════════════════
    //  UI
    // ═══════════════════════════════════════

    var STYLE_ID = 'hg-magic-style';

    function injectCSS() {
        if (document.getElementById(STYLE_ID)) return;
        var s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
/* ── Reset ── */
#hg-magic-launcher, #hg-magic-panel, #hg-magic-preview {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* ── Animations ── */
@keyframes hg-pulse { 0% { box-shadow: 0 0 0 0 rgba(217,105,0,0.5); } 70% { box-shadow: 0 0 0 14px rgba(217,105,0,0); } 100% { box-shadow: 0 0 0 0 rgba(217,105,0,0); } }
@keyframes hg-slideIn { from { transform: translateY(30px) scale(0.96); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
@keyframes hg-fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes hg-cardIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
@keyframes hg-spin { to { transform: rotate(360deg); } }

/* ── Launcher (旋转渐变边框) ── */
#hg-magic-launcher {
    position: fixed !important;
    right: 20px !important;
    bottom: 90px !important;
    z-index: 2147483646 !important;
    width: 48px !important;
    height: 48px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #0D0D0D !important;
    border-radius: 50% !important;
    box-shadow: 0 4px 24px rgba(217,105,0,0.3) !important;
    color: #D96900 !important;
    cursor: pointer !important;
    transition: transform 0.2s !important;
    line-height: 1 !important;
}
/* 旋转渐变边框环 */
#hg-magic-launcher::before {
    content: ''; position: absolute;
    top: -3px; left: -3px; right: -3px; bottom: -3px;
    border-radius: 50%;
    background: conic-gradient(#D96900, #FF8C2E, #D96900, #B85A00, #D96900, #FF8C2E, #D96900);
    z-index: -1;
    animation: hg-rotate-border 2s linear infinite;
    mask: radial-gradient(circle, transparent 88%, #000 90%);
    -webkit-mask: radial-gradient(circle, transparent 88%, #000 90%);
}
@keyframes hg-rotate-border { to { transform: rotate(360deg); } }
/* 悬浮: 光晕扩散 */
#hg-magic-launcher::after {
    content: ''; position: absolute;
    top: -8px; left: -8px; right: -8px; bottom: -8px;
    border-radius: 50%;
    opacity: 0; transition: opacity 0.25s;
    box-shadow: 0 0 0 4px rgba(217,105,0,0.12), 0 0 0 10px rgba(217,105,0,0.05);
    pointer-events: none;
}
#hg-magic-launcher:hover { transform: scale(1.08) !important; }
#hg-magic-launcher:hover::after { opacity: 1; }
#hg-magic-launcher:active { transform: scale(0.92) !important; }
#hg-magic-launcher .icon { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; color: #D96900; }
#hg-magic-launcher .badge {
    position: absolute; top: -5px; right: -5px; z-index: 1;
    min-width: 20px; height: 20px; padding: 0 5px;
    background: #D96900; color: #fff; border-radius: 999px;
    font-size: 11px; font-weight: 700;
    display: none; align-items: center; justify-content: center;
    box-sizing: border-box;
    box-shadow: 0 0 0 2px #0D0D0D;
}

/* ── Panel ── */
#hg-magic-panel {
    position: fixed !important; inset: 0 !important; width: 100vw !important; height: 100vh !important;
    z-index: 2147483647 !important; display: none !important;
    background: rgba(0,0,0,0.35) !important;
}
#hg-magic-panel.show { display: block !important; }
#hg-magic-panel .modal {
    position: fixed !important;
    right: 10px !important;
    top: 10px !important;
    bottom: 10px !important;
    pointer-events: auto !important;
    width: 580px; max-width: calc(100vw - 24px);
    max-height: min(680px, calc(100vh - 20px));
    background: #13141A; border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.07);
    box-shadow: 0 24px 80px rgba(0,0,0,0.5);
    display: flex; flex-direction: column;
    animation: hg-slideIn 0.28s cubic-bezier(0.22,1,0.36,1);
}
/* ── 星空背景 ── */
.hg-stars {
    position: absolute; inset: 0; z-index: 0;
    overflow: hidden; border-radius: 20px; pointer-events: none;
    animation: hg-twinkle 4s ease-in-out infinite alternate;
}
@keyframes hg-twinkle {
    0% { opacity: 0.65; }
    50% { opacity: 0.85; }
    100% { opacity: 1; }
}
.hg-stars::before {
    content: ''; position: absolute; inset: 0;
    background-image:
        radial-gradient(2px 2px at 12% 8%, rgba(255,255,255,0.6), transparent),
        radial-gradient(1.5px 1.5px at 25% 35%, rgba(255,255,255,0.35), transparent),
        radial-gradient(2.5px 2.5px at 43% 12%, rgba(255,255,255,0.5), transparent),
        radial-gradient(1.5px 1.5px at 58% 42%, rgba(255,255,255,0.3), transparent),
        radial-gradient(2px 2px at 70% 18%, rgba(255,255,255,0.4), transparent),
        radial-gradient(2.5px 2.5px at 82% 55%, rgba(255,255,255,0.35), transparent),
        radial-gradient(1.5px 1.5px at 90% 28%, rgba(255,255,255,0.25), transparent),
        radial-gradient(2px 2px at 35% 65%, rgba(255,255,255,0.3), transparent),
        radial-gradient(1.5px 1.5px at 48% 78%, rgba(255,255,255,0.25), transparent),
        radial-gradient(2px 2px at 63% 88%, rgba(255,255,255,0.3), transparent),
        radial-gradient(1.5px 1.5px at 18% 50%, rgba(255,255,255,0.2), transparent),
        radial-gradient(2px 2px at 75% 70%, rgba(255,255,255,0.2), transparent),
        radial-gradient(2px 2px at 55% 25%, rgba(255,255,255,0.3), transparent),
        radial-gradient(1.5px 1.5px at 5% 90%, rgba(255,255,255,0.2), transparent),
        /* 额外星星 */
        radial-gradient(2.5px 2.5px at 15% 45%, rgba(255,255,255,0.25), transparent),
        radial-gradient(1.5px 1.5px at 38% 22%, rgba(255,255,255,0.2), transparent),
        radial-gradient(2px 2px at 50% 60%, rgba(255,255,255,0.25), transparent),
        radial-gradient(2px 2px at 65% 40%, rgba(255,255,255,0.2), transparent),
        radial-gradient(1.5px 1.5px at 78% 8%, rgba(255,255,255,0.25), transparent),
        radial-gradient(2px 2px at 88% 72%, rgba(255,255,255,0.15), transparent),
        radial-gradient(1.5px 1.5px at 95% 45%, rgba(255,255,255,0.2), transparent),
        radial-gradient(2px 2px at 8% 72%, rgba(255,255,255,0.15), transparent),
        radial-gradient(2px 2px at 30% 88%, rgba(255,255,255,0.15), transparent),
        radial-gradient(1.5px 1.5px at 42% 50%, rgba(255,255,255,0.12), transparent),
        radial-gradient(2px 2px at 60% 15%, rgba(255,255,255,0.2), transparent),
        radial-gradient(1.5px 1.5px at 72% 65%, rgba(255,255,255,0.12), transparent),
        radial-gradient(2px 2px at 85% 35%, rgba(255,255,255,0.15), transparent),
        radial-gradient(1.5px 1.5px at 96% 85%, rgba(255,255,255,0.1), transparent);
}
/* ── 流星 ── */
.hg-shooting-star {
    position: absolute; z-index: 0; pointer-events: none; opacity: 0;
}
.hg-shooting-star::before {
    content: ''; display: block;
    width: 50px; height: 2px;
    background: linear-gradient(to right, rgba(255,255,255,0.7), rgba(255,255,255,0.2), transparent);
    border-radius: 1px;
    transform: rotate(-35deg);
    filter: blur(0.5px);
}
.hg-ss1 { top: 6%; right: 20%; animation: shoot1 4s ease-out infinite; }
.hg-ss2 { top: 15%; right: 50%; animation: shoot2 6s ease-out infinite; animation-delay: 2.5s; }
.hg-ss3 { top: 8%; right: 70%; animation: shoot1 5s ease-out infinite; animation-delay: 5.5s; }
.hg-ss4 { top: 20%; right: 35%; animation: shoot2 7s ease-out infinite; animation-delay: 8s; }
@keyframes shoot1 {
    0% { transform: translate(0, 0); opacity: 0; }
    3% { opacity: 1; }
    6% { opacity: 0.8; }
    8% { opacity: 0; }
    100% { transform: translate(-360px, 250px); opacity: 0; }
}
@keyframes shoot2 {
    0% { transform: translate(0, 0); opacity: 0; }
    3% { opacity: 1; }
    6% { opacity: 0.7; }
    8% { opacity: 0; }
    100% { transform: translate(-400px, 280px); opacity: 0; }
}
/* 内容层在星空之上 */
.hg-scroll { position: relative; z-index: 1; }

/* ── Header ── */
.hg-header { flex: none; }
.hg-accent {
    height: 3px; background: linear-gradient(90deg, #D96900, #FF8C2E, #D96900);
    flex: none;
}
.hg-header-top {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px 4px;
}
.hg-header-top h3 {
    margin: 0; font-size: 14px; font-weight: 700; color: #e8e8e8;
    letter-spacing: 0.2px;
}
.hg-brand {
    display: inline-flex; align-items: center; justify-content: center;
    width: 24px; height: 24px; margin-right: 10px; border-radius: 7px;
    background: linear-gradient(135deg, #D96900, #B85A00);
    color: #fff; font-size: 12px; font-weight: 800;
}
.hg-close {
    width: 28px; height: 28px; background: rgba(255,255,255,0.06); border: none;
    color: rgba(255,255,255,0.4); font-size: 14px; cursor: pointer; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; transition: all 0.16s;
}
.hg-close:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
.hg-contact-btn {
    height: 26px; padding: 0 10px; border: 1px solid rgba(217,105,0,0.3);
    border-radius: 6px; background: transparent; color: #D96900;
    font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.16s;
    font-family: inherit; white-space: nowrap;
}
.hg-contact-btn:hover { background: rgba(217,105,0,0.1); border-color: #D96900; }

/* ── Tabs + Actions bar (合并为一栏) ── */
.hg-bar {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px 12px;
}
.hg-tabs {
    display: flex; gap: 3px; background: rgba(255,255,255,0.04);
    padding: 3px; border-radius: 10px;
}
.hg-tab {
    height: 28px; padding: 0 12px; border: none; border-radius: 8px;
    background: transparent; color: rgba(255,255,255,0.4);
    font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    font-family: inherit; white-space: nowrap;
}
.hg-tab:hover { color: rgba(255,255,255,0.7); }
.hg-tab.active { color: #fff; background: #D96900; box-shadow: 0 2px 8px rgba(217,105,0,0.3); }
.hg-tab.active:hover { background: #CC5F00; box-shadow: 0 4px 16px rgba(217,105,0,0.4); }
.hg-tab:hover { transform: translateY(-1px); }
.hg-tab .tab-num { margin-left: 3px; opacity: 0.7; }
.hg-tab.active .tab-num { opacity: 0.9; }

.hg-spacer { flex: 1; }

.hg-btn {
    height: 28px; padding: 0 10px; border: 1px solid rgba(255,255,255,0.07);
    border-radius: 8px; background: transparent; color: rgba(255,255,255,0.5);
    font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;
    font-family: inherit; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;
}
.hg-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); box-shadow: 0 2px 12px rgba(0,0,0,0.2); }
.hg-btn:active { transform: scale(0.97); }
.hg-btn.primary { background: #D96900; color: #fff; border-color: #D96900; }
.hg-btn.primary:hover { background: #CC5F00; border-color: #CC5F00; box-shadow: 0 4px 16px rgba(217,105,0,0.35); transform: translateY(-1px); }
.hg-btn.primary:active { transform: scale(0.97) translateY(0); }

/* ── Selection summary ── */
.hg-sel-summary {
    color: rgba(255,255,255,0.3); font-size: 11px; font-weight: 500;
    min-width: 40px; text-align: center;
}

/* ── 滚动容器 ── */
.hg-scroll {
    flex: 1; display: flex; flex-direction: column;
    overflow-y: auto;
}
/* ── Grid ── */
.hg-grid {
    padding: 0 14px 12px;
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;
    align-content: start;
}
.hg-grid:empty { min-height: 200px; }
@media (max-width: 560px) { .hg-grid { grid-template-columns: repeat(2, 1fr); } }
.hg-grid::-webkit-scrollbar { width: 5px; }
.hg-grid::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }

/* ── Card ── */
.hg-card {
    position: relative; border-radius: 12px; overflow: hidden;
    background: #141414; border: 1px solid rgba(255,255,255,0.06);
    cursor: pointer; transition: all 0.2s; animation: hg-cardIn 0.3s both;
}
.hg-card:hover { border-color: rgba(217,105,0,0.35); box-shadow: 0 4px 20px rgba(0,0,0,0.4); transform: translateY(-2px); }
.hg-card video, .hg-card img { width: 100%; height: 130px; object-fit: cover; display: block; background: #000; }
.hg-card video { object-fit: contain; }

/* ── Card top bar (type badge + duration) ── */
.hg-card-top {
    position: absolute; top: 0; left: 0; right: 0; z-index: 2;
    display: flex; align-items: flex-start; gap: 3px;
    padding: 6px; pointer-events: none;
}
.hg-card-type {
    width: 22px; height: 22px; border-radius: 6px;
    background: rgba(0,0,0,0.6); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; backdrop-filter: blur(4px);
}
/* ── Card checkbox ── */
.hg-cb { position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer; width: 20px; height: 20px; pointer-events: auto; }
.hg-cb input { position: absolute; opacity: 0; width: 0; height: 0; }
.hg-cb-mark {
    width: 16px; height: 16px; border-radius: 4px;
    border: 2px solid rgba(217,105,0,0.8);
    background: rgba(255,255,255,0.95);
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    transition: all 0.15s;
    display: flex; align-items: center; justify-content: center;
}
.hg-cb input:checked + .hg-cb-mark { background: #D96900; border-color: #D96900; }
.hg-cb input:checked + .hg-cb-mark::after { content: ''; width: 5px; height: 8px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); margin-top: -2px; }
.hg-cb:hover .hg-cb-mark { border-color: rgba(255,255,255,0.6); }
.hg-card.selected { border-color: rgba(217,105,0,0.5); box-shadow: 0 0 0 1px rgba(217,105,0,0.2), inset 0 0 0 1px rgba(217,105,0,0.15); }
.hg-card-dur {
    padding: 2px 6px; border-radius: 4px;
    background: rgba(0,0,0,0.65); color: #fff;
    font-size: 10px; font-family: monospace; font-weight: 600;
    backdrop-filter: blur(4px);
}
.hg-card-play {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s; background: rgba(0,0,0,0.1); z-index: 1; pointer-events: none;
}
.hg-card:hover .hg-card-play { opacity: 1; }
.hg-card-play svg { width: 32px; height: 32px; color: rgba(255,255,255,0.75); filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)); }

/* ── Card overlay (bottom info) ── */
.hg-card-overlay {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 22px 7px 7px;
    background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%);
    display: flex; align-items: flex-end; justify-content: space-between;
    opacity: 0; transition: opacity 0.2s; pointer-events: none;
}
.hg-card:hover .hg-card-overlay { opacity: 1; }
.hg-card-info { flex: 1; min-width: 0; margin-right: 4px; }
.hg-card-size { font-size: 9px; color: rgba(255,255,255,0.7); font-weight: 500; line-height: 1.3; }
.hg-card-dl {
    width: 26px; height: 26px; border-radius: 50%;
    background: rgba(217,105,0,0.85); color: #fff; border: none;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    transition: all 0.15s; pointer-events: auto; flex: none;
}
.hg-card-dl:hover { background: #B85A00; transform: scale(1.12); }
.hg-card-dl svg { width: 12px; height: 12px; }

/* ── Empty ── */
.hg-empty {
    grid-column: 1 / -1; text-align: center; padding: 40px 20px;
    color: rgba(255,255,255,0.3); font-size: 12px;
}
.hg-empty-icon { font-size: 32px; margin-bottom: 8px; }
.hg-empty-sub { margin-top: 4px; font-size: 11px; opacity: 0.5; }

/* ── Preview ── */
#hg-magic-preview {
    position: fixed !important; inset: 0 !important; z-index: 2147483647 !important;
    display: none !important; align-items: center !important; justify-content: center !important;
    background: rgba(0,0,0,0.82) !important; backdrop-filter: blur(10px) !important;
    cursor: default !important; padding: 24px !important;
    animation: hg-fadeIn 0.2s;
}
#hg-magic-preview.show { display: flex !important; }
#hg-magic-preview video, #hg-magic-preview img { max-width: 90vw; max-height: 75vh; border-radius: 12px; cursor: default; background: #000; }
#hg-magic-preview video { max-height: 70vh; }
.hg-preview-info {
    color: rgba(255,255,255,0.7); font-size: 13px; text-align: center;
    max-width: 600px; line-height: 1.5; margin-top: 16px;
}
.hg-preview-info .hg-btn { margin-top: 10px; height: 32px; padding: 0 16px; font-size: 12px; }

/* ── Loading overlay on card ── */
.hg-loading {
    position: absolute; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 3;
}
.hg-spinner { width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #D96900; border-radius: 50%; animation: hg-spin 0.6s linear infinite; }
.hg-done {
    position: absolute; inset: 0; background: rgba(16,185,129,0.3);
    display: flex; align-items: center; justify-content: center; z-index: 3;
}
.hg-done svg { width: 32px; height: 32px; stroke: #fff; stroke-width: 2.5; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3)); }

/* ── Footer ── */
.hg-footer {
    flex: none; padding: 7px 14px; border-top: 1px solid rgba(255,255,255,0.04);
    font-size: 10px; color: rgba(255,255,255,0.4); text-align: center;
    letter-spacing: 0.3px;
}
`;
        document.head.appendChild(s);
    }

    // ── 创建 UI ──
    function createUI() {
        if (document.getElementById('hg-magic-launcher')) return;
        injectCSS();

        // Launcher
        var l = document.createElement('div');
        l.id = 'hg-magic-launcher';
        l.innerHTML = '<span class="icon">' + ICON_WAND + '</span><span class="badge" id="hg-badge">0</span>';
        l.title = '水印消失术';
        l.addEventListener('click', togglePanel);
        document.body.appendChild(l);
        launcherEl = l;

        // Panel
        var p = document.createElement('div');
        p.id = 'hg-magic-panel';
        p.innerHTML =
            '<div class="modal">' +
                '<div class="hg-stars"></div>' +
                '<div class="hg-shooting-star hg-ss1"></div>' +
                '<div class="hg-shooting-star hg-ss2"></div>' +
                '<div class="hg-shooting-star hg-ss3"></div>' +
                '<div class="hg-shooting-star hg-ss4"></div>' +
                '<div class="hg-scroll">' +
                    '<div class="hg-header">' +
                        '<div class="hg-accent"></div>' +
                        '<div class="hg-header-top">' +
                            '<div><span class="hg-brand">HG</span><span style="font-size:14px;font-weight:700;color:#e8e8e8;letter-spacing:0.2px">水印消失术</span></div>' +
                            '<div style="display:flex;align-items:center;gap:6px">' +
                                '<button class="hg-contact-btn" id="hg-contact">联系辉哥</button>' +
                                '<button class="hg-close" id="hg-close">' + ICON_CLOSE + '</button>' +
                            '</div>' +
                        '</div>' +
                        '<div class="hg-bar">' +
                            '<div class="hg-tabs">' +
                                '<button class="hg-tab active" data-tab="image" id="hg-tab-img"><span class="tab-num">图片</span><span class="tab-num" id="hg-img-count">0</span></button>' +
                                '<button class="hg-tab" data-tab="video" id="hg-tab-vid"><span class="tab-num">视频</span><span class="tab-num" id="hg-vid-count">0</span></button>' +
                            '</div>' +
                            '<div class="hg-spacer"></div>' +
                            '<span class="hg-sel-summary" id="hg-sel-summary">未选择</span>' +
                            '<button class="hg-btn" id="hg-sel-all">全选</button>' +
                            '<button class="hg-btn" id="hg-clear">清空</button>' +
                            '<button class="hg-btn primary" id="hg-dlall">' + ICON_DOWNLOAD + ' 下载</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="hg-grid" id="hg-grid"></div>' +
                    '<div class="hg-footer">点击预览 · 下载无水印原图/视频</div>' +
                '</div>' +
            '</div>';
        p.addEventListener('click', function(e) { if (e.target === p) closePanel(); });
        document.body.appendChild(p);
        panelEl = p;
        gridEl = document.getElementById('hg-grid');

        // Preview
        var prv = document.createElement('div');
        prv.id = 'hg-magic-preview';
        prv.addEventListener('click', function(e) { if (e.target === prv) closePreview(); });
        document.body.appendChild(prv);
        previewEl = prv;

        // Events
        document.getElementById('hg-close').addEventListener('click', closePanel);
        // 联系辉哥 — 新标签打开二维码
        document.getElementById('hg-contact').addEventListener('click', function() {
            var extUrl = document.documentElement.getAttribute('data-hg-ext-url') || '';
            window.open(extUrl + 'qr-code.png', '_blank');
        });
        document.getElementById('hg-clear').addEventListener('click', function() { clearMedia(); });
        document.getElementById('hg-sel-all').addEventListener('click', selectAll);
        document.getElementById('hg-dlall').addEventListener('click', downloadAll);
        document.getElementById('hg-tab-img').addEventListener('click', function() { switchTab('image'); });
        document.getElementById('hg-tab-vid').addEventListener('click', function() { switchTab('video'); });
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') { closePreview(); closePanel(); }
        });

        // 检测launcher是否存在，用MutationObserver保活
        var mo = new MutationObserver(function() {
            if (!document.getElementById('hg-magic-launcher')) {
                var l2 = document.createElement('div');
                l2.id = 'hg-magic-launcher';
                l2.innerHTML = '<span class="icon">' + ICON_WAND + '</span><span class="badge" id="hg-badge">0</span>';
                l2.title = '水印消失术';
                l2.addEventListener('click', togglePanel);
                document.body.appendChild(l2);
                launcherEl = l2;
            }
        });
        mo.observe(document.documentElement, {childList: true, subtree: true});
    }

    function togglePanel() {
        if (panelOpen) closePanel(); else openPanel();
    }
    function openPanel() {
        if (!panelEl) return;
        panelEl.classList.add('show');
        panelOpen = true;
        renderGrid();
        // 确保滚动容器正确约束
        setTimeout(function() {
            var scr = document.querySelector('.hg-scroll');
            if (scr) {
                scr.style.setProperty('overflow-y', 'auto', 'important');
            }
        }, 100);
    }
    function closePanel() {
        if (!panelEl) return;
        panelEl.classList.remove('show');
        panelOpen = false;
    }
    function closePreview() {
        if (previewEl) previewEl.classList.remove('show');
    }

    function selectAll() {
        var items = currentTab === 'image' ? images : videos;
        if (selectedIndices.size === items.length) {
            selectedIndices.clear();  // 已全选则取消全选
        } else {
            selectedIndices = new Set(items.map(function(_, i) { return currentTab + '-' + i; }));
        }
        renderGrid();
    }

    function updateSelectionSummary() {
        var el = document.getElementById('hg-sel-summary');
        if (!el) return;
        var count = selectedIndices.size;
        el.textContent = count > 0 ? '已选 ' + count : '未选择';
    }

    function switchTab(tab) {
        if (tab === currentTab) return;
        currentTab = tab;
        selectedIndices.clear();  // 切Tab清空选中
        document.querySelectorAll('.hg-tab').forEach(function(t) { t.classList.remove('active'); });
        var tabEl = tab === 'image' ? document.getElementById('hg-tab-img') : document.getElementById('hg-tab-vid');
        if (tabEl) tabEl.classList.add('active');
        updateSelectionSummary();
        renderGrid();
    }

    // ── 渲染 ──
    function renderGrid() {
        if (!gridEl || !panelOpen) return;
        var items = currentTab === 'image' ? images : videos;
        if (items.length === 0) {
            gridEl.innerHTML = '<div class="hg-empty"><div class="hg-empty-icon">' + (currentTab === 'image' ? '&#x1F5BC;' : '&#x1F3AC;') + '</div><div>' + (currentTab === 'image' ? '暂无图片' : '暂无视频') + '</div><div class="hg-empty-sub">在豆包中生成素材后自动出现</div></div>';
            return;
        }
        var selectedKey = currentTab + '-';
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var t = items[i];
            var isVid = t.type === 'video';
            var sz = t.width ? t.width + '&#x00D7;' + t.height : '';
            var dur = t.duration ? ' &#x23F1; ' + Math.floor(t.duration / 60) + ':' + String(Math.floor(t.duration % 60)).padStart(2, '0') : '';
            var poster = isVid ? (t.thumbUrl || t.posterUrl || '') : '';
            var imgSrc = isVid ? '' : (t.thumbUrl || t.url || '');
            var videoSrc = isVid ? (t.url || '') : '';
            var hasUrl = !isVid || videoSrc;
            var selKey = selectedKey + i;
            var checked = selectedIndices.has(selKey);
            html += '<div class="hg-card' + (checked ? ' selected' : '') + '" data-type="' + t.type + '" data-idx="' + i + '">' +
                '<div class="hg-card-top">' +
                    '<label class="hg-cb" data-idx="' + i + '"><input type="checkbox" ' + (checked ? 'checked' : '') + '><span class="hg-cb-mark"></span></label>' +
                    '<span class="hg-card-type">' + (isVid ? ICON_VID : ICON_PIC) + '</span>' +
                    (dur ? '<span class="hg-card-dur">' + dur.trim() + '</span>' : '') +
                '</div>' +
                (isVid ? '<div class="hg-card-play">' + ICON_VID + '</div>' : '') +
                (isVid ? (hasUrl ? '<video src="' + videoSrc + '" poster="' + poster + '" playsinline preload="metadata"></video>' : '<div style="width:100%;height:130px;background:#1A1A1A;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:11px">加载中...</div>') : '<img src="' + imgSrc + '" loading="lazy">') +
                '<div class="hg-card-overlay">' +
                    '<div class="hg-card-info">' +
                        '<div class="hg-card-size">' + sz + dur + '</div>' +
                    '</div>' +
                    '<button class="hg-card-dl" data-idx="' + i + '">' + ICON_DOWNLOAD + '</button>' +
                '</div>' +
            '</div>';
        }
        gridEl.innerHTML = html;

        // 复选框事件
        gridEl.querySelectorAll('.hg-cb input').forEach(function(inp) {
            inp.addEventListener('change', function(e) {
                e.stopPropagation();
                var cb = inp.closest('.hg-cb');
                if (!cb) return;
                var idx = parseInt(cb.dataset.idx, 10);
                var key = selectedKey + idx;
                if (inp.checked) selectedIndices.add(key);
                else selectedIndices.delete(key);
                updateSelectionSummary();
            });
        });

        // 点击卡片打开预览 (图片和视频统一)
        gridEl.querySelectorAll('.hg-card').forEach(function(card) {
            card.addEventListener('click', function(e) {
                if (e.target.closest('.hg-cb') || e.target.closest('.hg-card-dl')) return;
                var idx = parseInt(card.dataset.idx, 10);
                var items2 = currentTab === 'image' ? images : videos;
                if (items2[idx]) showPreview(items2[idx]);
            });
        });

        // 下载按钮
        gridEl.querySelectorAll('.hg-card-dl').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(btn.dataset.idx, 10);
                var items2 = currentTab === 'image' ? images : videos;
                var item = items2[idx];
                if (item) downloadItem(item, btn);
            });
        });

        updateBadge();
    }

    function showPreview(item) {
        if (!previewEl) return;
        var isVid = item.type === 'video';
        var sz = item.width ? item.width + '&#x00D7;' + item.height : '';
        var dur = item.duration ? ' &#x23F1; ' + Math.floor(item.duration / 60) + ':' + String(Math.floor(item.duration % 60)).padStart(2, '0') : '';
        var src = item.url || '';
        var btnText = isVid ? '下载视频' : '下载原图';
        var mediaHtml = isVid
            ? '<video src="' + src + '" controls autoplay style="max-width:90vw;max-height:75vh;border-radius:12px;background:#000" id="hg-preview-media"></video>'
            : '<img src="' + src + '" style="max-width:90vw;max-height:80vh;border-radius:12px" id="hg-preview-media">';
        previewEl.innerHTML =
            '<div style="position:relative;display:flex;flex-direction:column;align-items:center">' +
                '<button id="hg-preview-close" style="position:absolute;top:0;right:0;z-index:10;width:36px;height:36px;background:rgba(0,0,0,0.5);border:none;border-radius:50%;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s">' + ICON_CLOSE + '</button>' +
                mediaHtml +
                '<div class="hg-preview-info">' +
                    '<div>' + sz + dur + '</div>' +
                    '<button class="hg-btn primary" id="hg-preview-dl" style="margin-top:10px;height:32px;padding:0 16px;font-size:12px">' + ICON_DOWNLOAD + ' ' + btnText + '</button>' +
                '</div>' +
            '</div>';
        previewEl.classList.add('show');

        // 关闭按钮
        document.getElementById('hg-preview-close').addEventListener('click', closePreview);
        // 下载按钮
        document.getElementById('hg-preview-dl').addEventListener('click', function() { downloadItem(item); closePreview(); });
    }

    // ── 下载 ──
    function downloadItem(item, btnEl) {
        if (btnEl) {
            btnEl.disabled = true;
            btnEl.innerHTML = '<div class="hg-spinner" style="width:14px;height:14px;border-width:2px;margin:0"></div>';
        }
        var isVid = item.type === 'video';
        var ext = isVid ? '.mp4' : '.png';
        var now = new Date();
        var ts = String(now.getFullYear()) + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + String(now.getSeconds()).padStart(2,'0');
        var filename = 'doubao_' + ts + '_' + (item.id ? item.id.slice(-6) : '0') + ext;

        // 通过 custom event 桥接到 extension API
        var reqId = 'dl_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        var pmHandler = function(e) {
            if (!e.data || e.data.type !== 'hg-dl-response' || e.data.requestId !== reqId) return;
            window.removeEventListener('message', pmHandler);
            if (btnEl) {
                if (e.data.success) {
                    btnEl.innerHTML = ICON_CHECK;
                    btnEl.style.background = 'rgba(16,185,129,0.85)';
                    setTimeout(function() {
                        btnEl.innerHTML = ICON_DOWNLOAD;
                        btnEl.style.background = '';
                        btnEl.disabled = false;
                    }, 1500);
                } else {
                    btnEl.innerHTML = ICON_DOWNLOAD;
                    btnEl.disabled = false;
                }
            }
        };
        window.addEventListener('message', pmHandler);
        // 超时清理
        setTimeout(function() {
            window.removeEventListener('message', pmHandler);
            if (btnEl) { btnEl.innerHTML = ICON_DOWNLOAD; btnEl.disabled = false; }
        }, 15000);

        window.postMessage({type: 'hg-dl-request', requestId: reqId, url: item.url || item.downloadUrl || '', filename: filename}, '*');
    }

    function downloadAll() {
        var btn = document.getElementById('hg-dlall');
        var items = currentTab === 'image' ? images : videos;
        if (items.length === 0) return;
        var selectedKey = currentTab + '-';
        var toDownload = [];

        // 检查当前Tab是否有选中项
        var hasSelectionInTab = false;
        if (selectedIndices.size > 0) {
            selectedIndices.forEach(function(key) {
                if (key.startsWith(selectedKey)) {
                    var idx = parseInt(key.slice(selectedKey.length), 10);
                    if (items[idx]) { toDownload.push(items[idx]); hasSelectionInTab = true; }
                }
            });
        }
        // 如当前Tab无选中项，下载全部
        if (!hasSelectionInTab) toDownload = items.slice();
        if (toDownload.length === 0) return;

        // 按钮反馈
        if (btn) { btn.textContent = '下载中 ' + toDownload.length + '个'; btn.disabled = true; }

        var completed = 0;
        for (var i = 0; i < toDownload.length; i++) {
            downloadItem(toDownload[i]);
            completed++;
        }
        if (btn) {
            btn.textContent = '已发送 ' + completed + ' 个';
            setTimeout(function() {
                btn.innerHTML = ICON_DOWNLOAD + ' 下载';
                btn.disabled = false;
            }, 2000);
        }
    }

    function updateBadge() {
        var total = images.length + videos.length;
        var badge = document.getElementById('hg-badge');
        if (badge) {
            if (total > 0) { badge.textContent = String(total); badge.style.display = 'flex'; }
            else { badge.style.display = 'none'; }
        }
        // 更新 tab 计数
        var imgCount = document.getElementById('hg-img-count');
        var vidCount = document.getElementById('hg-vid-count');
        if (imgCount) imgCount.textContent = String(images.length);
        if (vidCount) vidCount.textContent = String(videos.length);
    }

    function updateUI() {
        updateBadge();
        updateSelectionSummary();
        renderGrid();
        // 更新状态属性 (bridge.js 读取)
        document.documentElement.setAttribute('data-hg-images', String(images.length));
        document.documentElement.setAttribute('data-hg-videos', String(videos.length));
    }

    // ═══════════════════════════════════════
    //  初始化
    // ═══════════════════════════════════════

    function init() {
        log('脚本加载完成');

        // 设置初始路由
        lastRoute = getRoute();

        // 创建UI
        createUI();

        // 扫描已有素材
        setTimeout(scanExistingMedia, 800);

        // 响应外部 open 请求 (来自popup)
        window.addEventListener('hg-open-panel', function() { openPanel(); });
        window.addEventListener('hg-refresh-scan', function() { scanExistingMedia(); updateUI(); });

        log('初始化完成');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
