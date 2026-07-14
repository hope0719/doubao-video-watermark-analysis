Page({
  data: {},

  previewImage: function (e) {
    var url = e.currentTarget.dataset.url
    wx.previewImage({
      current: url,
      urls: [url]
    })
  },

  goBack: function () {
    wx.navigateBack({
      delta: 1
    })
  }
})
