var t = require('../../utils/api')

Page({
  data: {
    analysisUrl: '',
    videoUrl: '',
    hideResult: true,
    images: [],
    type: '',
    downloading: false,
    downloadProgress: 0,
    showProgressModal: false,
    downloadTask: null,
    currentTab: 0,
    tabs: ['视频/图集', '封面', '文案'],
    selectedImages: [],
    selectAll: false,
    selectedCount: 0,
    autoAnalysis: false,
    autoDownload: false,
    noticeList: [
      '本工具支持豆包视频和图片去水印'
    ]
  },

  checkIsHaveUrl: function (t) {
    var e = /(https?|http|ftp|file):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/g,
      a = t.match(e)
    return a && a.length > 0 ? a[0] : ''
  },

  onLoad: function () {
    this.loadAutoSettings()
  },

  onShow: function () {
    this.loadAutoSettings()
  },

  handleLiveAnalysis: function () {
    wx.navigateTo({
      url: '/pages/doubao-tutorial/doubao-tutorial'
    })
  },

  loadAutoSettings: function () {
    this.setData({
      autoAnalysis: wx.getStorageSync('autoAnalysis') || false,
      autoDownload: wx.getStorageSync('autoDownload') || false
    })
  },

  toggleAutoAnalysis: function () {
    var newValue = !this.data.autoAnalysis
    this.setData({ autoAnalysis: newValue })
    wx.setStorageSync('autoAnalysis', newValue)
  },

  toggleAutoDownload: function () {
    var newValue = !this.data.autoDownload
    this.setData({ autoDownload: newValue })
    wx.setStorageSync('autoDownload', newValue)
  },

  analysisTap: function (o) {
    var a = this
    var url = a.getURLFromString(a.data.analysisUrl)

    if (!url) {
      wx.showToast({ icon: 'none', title: '请先粘贴链接' })
      return
    }

    wx.showLoading({ title: '正在解析', mask: true })

    wx.getNetworkType({
      success: res => {
        if (res.networkType === 'none') {
          wx.hideLoading()
          wx.showToast({ title: '请检查网络连接', icon: 'none' })
          return
        }

        t.analysis(
          url,
          function (result) {
            wx.hideLoading()
            if (result && result.data) {
              if (result.data.code == 200 || result.data.code == 0) {
                a.setData({
                  type: '', images: [], videoPic: '', videoUrl: '', desc: '', down: '',
                  currentTab: 0, selectedImages: [], selectAll: false, selectedCount: 0
                }, () => {
                  const type = result.data.data.type || 'video'
                  const images = type === 'images' ? result.data.data.images || [] : []

                  setTimeout(() => {
                    a.setData({
                      type: type, images: images,
                      videoPic: result.data.data.cover_url,
                      videoUrl: type === 'video' ? result.data.data.downurl : '',
                      desc: result.data.data.title,
                      down: result.data.data.downurl,
                      hideResult: false,
                      selectedImages: type === 'images' ? new Array(images.length).fill(false) : []
                    }, () => {
                      const autoDownload = wx.getStorageSync('autoDownload') || false
                      if (autoDownload && a.data.type === 'video') {
                        setTimeout(() => { a.saveTap() }, 1000)
                      }
                    })
                  }, 100)
                })
              } else {
                let errorMsg = result.data.message || result.data.msg || '解析失败'
                wx.showToast({ title: errorMsg, icon: 'none', duration: 2000 })
              }
            } else {
              wx.showToast({ title: '服务器返回数据异常', icon: 'none', duration: 2000 })
            }
          },
          function (error) {
            console.error('API调用失败:', error)
            wx.hideLoading()
            wx.showModal({
              title: '提示',
              content: '解析失败，可能的原因：\n1. 链接格式不正确\n2. 网络连接问题\n3. 不支持该类型链接',
              confirmText: '我知道了', showCancel: false, confirmColor: '#d4237a'
            })
          }
        )
      }
    })
  },

  inputChange: function (t) {
    this.setData({ analysisUrl: t.detail.value })
  },

  pasteTap: function () {
    var o = this
    wx.getClipboardData({
      success: function (t) {
        var url = o.checkIsHaveUrl(t.data)
        if (url && url.length > 0) {
          o.setData({ analysisUrl: url })
          if (wx.getStorageSync('autoAnalysis')) {
            setTimeout(() => { o.handleAnalysisTap() }, 500)
          }
        } else {
          wx.showToast({ title: '请输入正确链接~', icon: 'none' })
        }
      }
    })
  },

  clearTap: function () {
    this.setData({
      analysisUrl: '', hideResult: true, images: [], videoUrl: '', type: '',
      selectedImages: [], selectAll: false, selectedCount: 0
    })
  },

  saveTap: function () {
    var o = this
    if (!o.data.videoUrl) {
      wx.showToast({ title: '请先提取视频', icon: 'none' })
      return
    }
    o.checkAlbumAuth().then(() => {
      o.smartDownload(o.data.videoUrl)
    }).catch(err => {
      o.showCopyLinkDialog(o.data.videoUrl)
    })
  },

  copyLinkTap: function () {
    wx.setClipboardData({
      data: this.data.videoUrl,
      success: function () { wx.showToast({ icon: 'success', title: '复制成功' }) }
    })
  },

  copyDescTap: function () {
    wx.setClipboardData({
      data: this.data.desc,
      success: function () { wx.showToast({ icon: 'success', title: '复制成功' }) }
    })
  },

  copyCoverLinkTap: function () {
    if (!this.data.videoPic) {
      wx.showToast({ title: '暂无封面链接', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: this.data.videoPic,
      success: function () { wx.showToast({ icon: 'success', title: '复制成功' }) }
    })
  },

  getURLFromString: function (t) {
    var e = /(https?|http|ftp|file):\/\/[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]/g,
      a = t.match(e)
    return a && a.length > 0 ? a[0] : ''
  },

  onShareAppMessage: function () {
    return { title: '豆包去水印工具', path: 'pages/index/index', imageUrl: '../../images/sharp.jpg' }
  },

  onShareTimeline: function () {
    return { title: '豆包去水印工具', imageUrl: '../../images/sharp.jpg' }
  },

  previewImage: function (e) {
    const { url, urls } = e.currentTarget.dataset
    wx.previewImage({ current: url, urls: urls || [url] })
  },

  longPressImage: function (e) {
    const { url, index } = e.currentTarget.dataset
    var o = this
    wx.showActionSheet({
      itemList: ['预览大图', '保存这张图', '选中/取消选中'],
      success: function (res) {
        if (res.tapIndex === 0) o.previewImage(e)
        else if (res.tapIndex === 1) o.saveSingleImage({ currentTarget: { dataset: { url: url } } })
        else if (res.tapIndex === 2) o.toggleImageSelect({ currentTarget: { dataset: { index: index } } })
      }
    })
  },

  saveSingleImage: function (e) {
    const { url } = e.currentTarget.dataset
    if (!url) { wx.showToast({ title: '图片链接无效', icon: 'none' }); return }
    this.checkAlbumAuth().then(() => { this.smartDownloadImage(url) }).catch(function (err) {})
  },

  saveAllImages: function () {
    if (!this.data.images || this.data.images.length === 0) {
      wx.showToast({ title: '没有可保存的图片', icon: 'none' }); return
    }
    var o = this
    o.checkAlbumAuth().then(() => {
      wx.showModal({
        title: '批量保存',
        content: '是否保存全部图片？共' + o.data.images.length + '张',
        success: res => { if (res.confirm) o.batchSmartDownloadImages(o.data.images) }
      })
    })
  },

  handleAnalysisTap() {
    var o = this
    if (!o.data.analysisUrl || o.data.analysisUrl.trim() == '') {
      wx.showToast({ title: '请先输入链接', icon: 'none' }); return
    }
    if (o.getURLFromString(o.data.analysisUrl) == '') {
      wx.showToast({ title: '请输入正确的链接', icon: 'none' }); return
    }
    o.analysisTap()
  },

  switchTab: function (e) {
    this.setData({ currentTab: e.currentTarget.dataset.index })
  },

  toggleImageSelect: function (e) {
    var index = e.currentTarget.dataset.index
    var selectedImages = this.data.selectedImages.slice()
    selectedImages[index] = !selectedImages[index]
    var selectedCount = selectedImages.filter(function(item) { return item }).length
    this.setData({
      selectedImages: selectedImages, selectedCount: selectedCount,
      selectAll: selectedCount === selectedImages.length
    })
  },

  toggleSelectAll: function () {
    var newSelectAll = !this.data.selectAll
    this.setData({
      selectAll: newSelectAll,
      selectedImages: new Array(this.data.images.length).fill(newSelectAll),
      selectedCount: newSelectAll ? this.data.images.length : 0
    })
  },

  saveSelectedImages: function () {
    var selectedUrls = []
    for (var i = 0; i < this.data.selectedImages.length; i++) {
      if (this.data.selectedImages[i]) selectedUrls.push(this.data.images[i])
    }
    if (selectedUrls.length === 0) { wx.showToast({ title: '请先选择图片', icon: 'none' }); return }
    this.checkAlbumAuth().then(() => { this.batchSmartDownloadImages(selectedUrls) })
  },

  previewCover: function () {
    if (!this.data.videoPic) return
    wx.previewImage({ current: this.data.videoPic, urls: [this.data.videoPic] })
  },

  saveCover: function () {
    if (!this.data.videoPic) { wx.showToast({ title: '暂无封面', icon: 'none' }); return }
    this.saveSingleImage({ currentTarget: { dataset: { url: this.data.videoPic } } })
  },

  checkAlbumAuth: function () {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.writePhotosAlbum'] === false) {
            wx.openSetting({
              success: (settingRes) => {
                settingRes.authSetting['scope.writePhotosAlbum'] ? resolve() : reject()
              },
              fail: () => reject()
            })
          } else { resolve() }
        },
        fail: () => reject()
      })
    })
  },

  smartDownload: function (url) {
    var o = this
    o.setData({ downloading: true, showProgressModal: true, downloadProgress: 0 })

    var task = wx.downloadFile({
      url: url,
      success: function (res) {
        if (res.statusCode === 200) {
          wx.saveVideoToPhotosAlbum({
            filePath: res.tempFilePath,
            success: function () { wx.showToast({ title: '保存成功', icon: 'success' }); o.resetDownloadState() },
            fail: function () { wx.showToast({ title: '保存失败', icon: 'none' }); o.resetDownloadState() }
          })
        } else {
          wx.showToast({ title: '下载失败', icon: 'none' }); o.resetDownloadState()
        }
      },
      fail: function (err) {
        o.setData({ downloading: false, showProgressModal: false })
        if (err.errMsg && err.errMsg.includes('url not in domain list')) {
          o.saveUnauthorizedDomain(url)
          o.showCopyLinkDialog(url)
        } else {
          wx.showToast({ title: '下载失败，请重试', icon: 'none' })
        }
      }
    })

    task.onProgressUpdate(function (update) { o.setData({ downloadProgress: update.progress }) })
    o.setData({ downloadTask: task })
  },

  smartDownloadImage: function (url) {
    var o = this
    wx.showLoading({ title: '保存中...' })
    wx.downloadFile({
      url: url,
      success: function (res) {
        wx.hideLoading()
        if (res.statusCode === 200) {
          wx.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: function () { wx.showToast({ title: '保存成功', icon: 'success' }) },
            fail: function () { wx.showToast({ title: '保存失败', icon: 'none' }) }
          })
        } else { wx.showToast({ title: '下载失败', icon: 'none' }) }
      },
      fail: function () { wx.hideLoading(); wx.showToast({ title: '下载失败', icon: 'none' }) }
    })
  },

  batchSmartDownloadImages: function (urls) {
    var o = this
    var total = urls.length
    var completed = 0

    wx.showLoading({ title: '保存中 0/' + total })
    urls.forEach(function (url, index) {
      setTimeout(function () {
        wx.downloadFile({
          url: url,
          success: function (res) {
            if (res.statusCode === 200) {
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: function () { completed++; o.updateBatchProgress(completed, total) },
                fail: function () { completed++; o.updateBatchProgress(completed, total) }
              })
            } else { completed++; o.updateBatchProgress(completed, total) }
          },
          fail: function () { completed++; o.updateBatchProgress(completed, total) }
        })
      }, index * 500)
    })
  },

  updateBatchProgress: function (current, total) {
    if (current >= total) {
      wx.hideLoading()
      wx.showToast({ title: '保存完成', icon: 'success' })
    } else {
      wx.showLoading({ title: '保存中 ' + current + '/' + total })
    }
  },

  resetDownloadState: function () {
    this.setData({ downloading: false, showProgressModal: false, downloadTask: null, downloadProgress: 0 })
  },

  cancelDownload: function () {
    if (this.data.downloadTask) {
      this.data.downloadTask.abort()
      this.setData({ downloading: false, showProgressModal: false, downloadTask: null, downloadProgress: 0 })
      wx.showToast({ title: '已取消下载', icon: 'none' })
    }
  },

  showCopyLinkDialog: function (url) {
    var o = this
    wx.hideLoading()
    setTimeout(() => {
      wx.showModal({
        title: '下载提示',
        content: '无法直接下载，您可以复制链接后在浏览器中打开。',
        confirmText: '复制链接', confirmColor: '#07c160',
        success: function (res) {
          if (res.confirm) {
            wx.setClipboardData({
              data: url,
              success: function () { wx.showToast({ title: '链接已复制', icon: 'success' }) }
            })
          }
        }
      })
    }, 300)
  },

  saveUnauthorizedDomain: function (url) {
    try {
      if (!url) return
      let matches = url.match(/^(https?:\/\/[^\/\n?]+)/i)
      if (!matches || !matches[1]) return
      const domain = matches[1]
      let urlList = wx.getStorageSync('unauthorizedUrls') || []
      if (!urlList.some(item => item.replace(';', '') === domain)) {
        urlList.push(domain + ';')
        wx.setStorageSync('unauthorizedUrls', urlList)
      }
    } catch (error) {}
  },

  handleVideoLoaded: function (e) { this.setData({ isVideoLoaded: true }) },
  handleVideoError: function (e) { console.error('视频加载错误:', e.detail) },
  handleVideoEnded: function () { this.setData({ isVideoPlaying: false }) },
  handleVideoPlay: function () { this.setData({ isVideoPlaying: true }) },
  handleVideoPause: function () { this.setData({ isVideoPlaying: false }) }
})
