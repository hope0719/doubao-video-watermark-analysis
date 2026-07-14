Page({
	data: {},

	onLoad() {},

	onShow() {},

	onHide() {},

	onUnload() {},

	onPullDownRefresh() {},

	onReachBottom() {},

	onShareAppMessage() {
		return {
			title: '豆包去水印工具',
			path: 'pages/index/index'
		}
	},

	onShareTimeline: function () {
		return {
			title: '豆包去水印工具'
		}
	},

	goToLiveAnalysis: function () {
		wx.navigateTo({
			url: '/pages/doubao-tutorial/doubao-tutorial'
		})
	}
})
