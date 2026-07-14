/**
 * 豆包视频去水印 - Popup 交互逻辑
 */

(function () {
  'use strict';

  // DOM 引用
  const $ = id => document.getElementById(id);

  const urlInput = $('urlInput');
  const extractBtn = $('extractBtn');
  const pasteBtn = $('pasteBtn');
  const currentBtn = $('currentBtn');
  const clearBtn = $('clearBtn');
  const autoExtractCb = $('autoExtract');
  const loadingSection = $('loadingSection');
  const loadingText = $('loadingText');
  const resultSection = $('resultSection');
  const errorSection = $('errorSection');
  const errorText = $('errorText');

  // 标签页
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // 结果面板
  const videoPanel = $('videoPanel');
  const imagesPanel = $('imagesPanel');
  const videoPlayer = $('videoPlayer');
  const videoMeta = $('videoMeta');
  const imagesCount = $('imagesCount');
  const imagesGrid = $('imagesGrid');
  const selectAllBtn = $('selectAllBtn');
  const coverImage = $('coverImage');
  const descText = $('descText');

  // 操作区
  const videoActions = $('videoActions');
  const imageActions = $('imageActions');
  const coverActions = $('coverActions');
  const descActions = $('descActions');

  // 状态
  let currentResult = null;
  let selectedImages = new Set();
  let isAllSelected = false;

  // ─── 初始化 ───
  function init() {
    // 加载设置
    const autoExtract = localStorage.getItem('autoExtract') === 'true';
    autoExtractCb.checked = autoExtract;

    // 绑定事件
    extractBtn.addEventListener('click', handleExtract);
    pasteBtn.addEventListener('click', handlePaste);
    currentBtn.addEventListener('click', handleCurrentPage);
    clearBtn.addEventListener('click', handleClear);
    autoExtractCb.addEventListener('change', () => {
      localStorage.setItem('autoExtract', autoExtractCb.checked);
    });

    // 回车提取
    urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleExtract();
    });

    // 标签切换
    tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // 操作按钮
    $('downloadBtn').addEventListener('click', () => downloadFile(currentResult.downurl, 'doubao_video.mp4'));
    $('copyLinkBtn').addEventListener('click', () => copyToClipboard(currentResult.downurl, '链接已复制'));
    $('downloadSelectedBtn').addEventListener('click', downloadSelectedImages);
    $('downloadAllImagesBtn').addEventListener('click', downloadAllImages);
    $('downloadCoverBtn').addEventListener('click', () => downloadFile(currentResult.cover_url, 'cover.jpg'));
    $('copyDescBtn').addEventListener('click', () => copyToClipboard(currentResult.title, '文案已复制'));
    selectAllBtn.addEventListener('click', toggleSelectAll);
  }

  // ─── 提取逻辑 ───
  async function handleExtract() {
    const raw = urlInput.value.trim();
    if (!raw) {
      showToast('请先粘贴链接');
      return;
    }

    const url = DoubaoApi.extractUrl(raw);
    if (!url) {
      showToast('请输入正确的链接');
      return;
    }

    await doExtract(url);
  }

  async function doExtract(url) {
    hideError();
    hideResult();
    showLoading('正在解析...');

    extractBtn.disabled = true;

    try {
      const result = await DoubaoApi.analysis(url);
      currentResult = result;
      hideLoading();
      showResult(result);
    } catch (err) {
      hideLoading();
      showError(err.message || '解析失败');
    } finally {
      extractBtn.disabled = false;
    }
  }

  // ─── 粘贴 ───
  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      const url = DoubaoApi.extractUrl(text);
      if (url) {
        urlInput.value = url;
        if (autoExtractCb.checked) {
          await doExtract(url);
        }
      } else {
        showToast('剪贴板中没有链接');
      }
    } catch {
      showToast('无法读取剪贴板');
    }
  }

  // ─── 获取当前页面 ───
  async function handleCurrentPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        urlInput.value = tab.url;
        if (autoExtractCb.checked) {
          await doExtract(tab.url);
        }
      }
    } catch {
      showToast('无法获取当前页面');
    }
  }

  // ─── 清空 ───
  function handleClear() {
    urlInput.value = '';
    currentResult = null;
    selectedImages.clear();
    isAllSelected = false;
    hideResult();
    hideError();
  }

  // ─── 展示结果 ───
  function showResult(result) {
    resultSection.style.display = 'block';

    // 更新标签文字
    $('tabContent').textContent = result.type === 'video' ? '视频' : '图集';

    // 视频面板
    if (result.type === 'video') {
      videoPanel.style.display = 'block';
      imagesPanel.style.display = 'none';
      videoPlayer.src = result.downurl;
      const meta = [];
      if (result.definition) meta.push(result.definition);
      if (result.width && result.height) meta.push(result.width + 'x' + result.height);
      if (result.duration) meta.push(result.duration + '秒');
      videoMeta.textContent = meta.join(' · ');
    }

    // 图集面板
    if (result.type === 'images') {
      videoPanel.style.display = 'none';
      imagesPanel.style.display = 'block';
      imagesCount.textContent = '共 ' + result.images.length + ' 张';
      selectedImages.clear();
      isAllSelected = false;
      selectAllBtn.classList.remove('active');
      renderImageGrid(result.images);
    }

    // 封面
    if (result.cover_url) {
      coverImage.src = result.cover_url;
    }

    // 文案
    descText.textContent = result.title || '暂无文案';

    // 默认显示第一个标签
    switchTab('content');
  }

  function renderImageGrid(images) {
    imagesGrid.innerHTML = '';
    images.forEach((url, index) => {
      const item = document.createElement('div');
      item.className = 'image-item';
      item.dataset.index = index;
      item.innerHTML = `
        <img src="${url}" alt="图片${index + 1}" loading="lazy">
        <div class="select-dot"></div>
      `;
      item.addEventListener('click', () => toggleImageSelect(item, index));
      imagesGrid.appendChild(item);
    });
  }

  // ─── 图片选择 ───
  function toggleImageSelect(item, index) {
    if (selectedImages.has(index)) {
      selectedImages.delete(index);
      item.classList.remove('selected');
    } else {
      selectedImages.add(index);
      item.classList.add('selected');
    }
    updateSelectAllState();
    $('downloadSelectedBtn').textContent = '⬇ 下载选中 (' + selectedImages.size + ')';
  }

  function toggleSelectAll() {
    const images = currentResult?.images || [];
    if (isAllSelected) {
      selectedImages.clear();
      document.querySelectorAll('.image-item').forEach(el => el.classList.remove('selected'));
      selectAllBtn.classList.remove('active');
    } else {
      images.forEach((_, i) => selectedImages.add(i));
      document.querySelectorAll('.image-item').forEach(el => el.classList.add('selected'));
      selectAllBtn.classList.add('active');
    }
    isAllSelected = !isAllSelected;
    $('downloadSelectedBtn').textContent = '⬇ 下载选中 (' + selectedImages.size + ')';
  }

  function updateSelectAllState() {
    const total = currentResult?.images?.length || 0;
    isAllSelected = selectedImages.size === total && total > 0;
    selectAllBtn.classList.toggle('active', isAllSelected);
  }

  // ─── 标签切换 ───
  function switchTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    tabContents.forEach(tc => tc.classList.remove('active'));

    const panelMap = { content: 'contentPanel', cover: 'coverPanel', desc: 'descPanel' };
    const actionMap = {
      content: currentResult?.type === 'video' ? videoActions : imageActions,
      cover: coverActions,
      desc: descActions
    };

    // 隐藏所有操作区
    [videoActions, imageActions, coverActions, descActions].forEach(el => el.style.display = 'none');

    // 显示对应面板
    const panel = $(panelMap[tabName]);
    if (panel) panel.classList.add('active');

    // 显示对应操作区
    if (actionMap[tabName]) actionMap[tabName].style.display = 'flex';
  }

  // ─── 下载 ───
  function downloadFile(url, filename) {
    if (!url) {
      showToast('没有可下载的链接');
      return;
    }
    chrome.runtime.sendMessage({ action: 'download', url, filename });
    showToast('开始下载');
  }

  function downloadSelectedImages() {
    if (selectedImages.size === 0) {
      showToast('请先选择图片');
      return;
    }
    const images = currentResult.images;
    selectedImages.forEach(index => {
      const ext = images[index].match(/\.(jpg|jpeg|png|webp)/)?.[1] || 'jpg';
      chrome.runtime.sendMessage({
        action: 'download',
        url: images[index],
        filename: `doubao_image_${index + 1}.${ext}`
      });
    });
    showToast('开始下载 ' + selectedImages.size + ' 张图片');
  }

  function downloadAllImages() {
    const images = currentResult?.images || [];
    if (images.length === 0) return;
    images.forEach((url, index) => {
      const ext = url.match(/\.(jpg|jpeg|png|webp)/)?.[1] || 'jpg';
      chrome.runtime.sendMessage({
        action: 'download',
        url,
        filename: `doubao_image_${index + 1}.${ext}`
      });
    });
    showToast('开始下载全部 ' + images.length + ' 张图片');
  }

  // ─── 复制 ───
  async function copyToClipboard(text, successMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg || '已复制');
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(successMsg || '已复制');
    }
  }

  // ─── UI 工具 ───
  function showLoading(text) {
    loadingSection.style.display = 'flex';
    loadingText.textContent = text || '正在解析...';
  }

  function hideLoading() {
    loadingSection.style.display = 'none';
  }

  function showError(msg) {
    errorSection.style.display = 'flex';
    errorText.textContent = msg;
  }

  function hideError() {
    errorSection.style.display = 'none';
  }

  function hideResult() {
    resultSection.style.display = 'none';
    videoPlayer.src = '';
    videoPanel.style.display = 'none';
    imagesPanel.style.display = 'none';
    [videoActions, imageActions, coverActions, descActions].forEach(el => el.style.display = 'none');
  }

  function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1600);
  }

  // ─── 启动 ───
  init();
})();
