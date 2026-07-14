/**
 * 图片去水印 - Popup 交互逻辑 v3
 *
 * 新增：视频无水印下载支持（千问/即梦）
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

  // 结果面板
  const videoResult = $('videoResult');
  const resultVideo = $('resultVideo');
  const downloadVideoBtn = $('downloadVideoBtn');
  const imagesResult = $('imagesResult');
  const imagesCount = $('imagesCount');
  const imagesGrid = $('imagesGrid');
  const selectAllBtn = $('selectAllBtn');

  // 操作区
  const imageActions = $('imageActions');

  // 状态
  let currentResult = null;
  let selectedImages = new Set();
  let isAllSelected = false;

  // ─── 初始化 ───
  function init() {
    const autoExtract = localStorage.getItem('autoExtract') === 'true';
    autoExtractCb.checked = autoExtract;

    extractBtn.addEventListener('click', handleExtract);
    pasteBtn.addEventListener('click', handlePaste);
    currentBtn.addEventListener('click', handleCurrentPage);
    clearBtn.addEventListener('click', handleClear);
    autoExtractCb.addEventListener('change', () => {
      localStorage.setItem('autoExtract', autoExtractCb.checked);
    });

    urlInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleExtract();
    });

    $('downloadSelectedBtn').addEventListener('click', downloadSelectedImages);
    $('downloadAllBtn').addEventListener('click', downloadAllImages);
    selectAllBtn.addEventListener('click', toggleSelectAll);
    downloadVideoBtn.addEventListener('click', downloadVideo);
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

    if (result.type === 'video') {
      // 视频结果
      videoResult.style.display = 'block';
      imagesResult.style.display = 'none';
      imageActions.style.display = 'none';
      resultVideo.src = result.url;
      resultVideo.poster = result.cover || '';
    } else if (result.type === 'images') {
      // 图片结果
      videoResult.style.display = 'none';
      imagesResult.style.display = 'block';
      imageActions.style.display = 'flex';

      imagesCount.textContent = '共 ' + result.images.length + ' 张';
      selectedImages.clear();
      isAllSelected = false;
      selectAllBtn.classList.remove('active');
      renderImageGrid(result.images);
    }
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

  // ─── 下载 ───
  function downloadVideo() {
    if (!currentResult || !currentResult.url) return;
    const url = currentResult.url;
    const ext = url.includes('.mov') ? 'mov' : url.includes('.webm') ? 'webm' : 'mp4';
    chrome.runtime.sendMessage({
      action: 'download',
      url: url,
      filename: `doubao_video_${Date.now()}.${ext}`
    });
    showToast('开始下载无水印视频');
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
    imageActions.style.display = 'none';
    videoResult.style.display = 'none';
    imagesResult.style.display = 'none';
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
