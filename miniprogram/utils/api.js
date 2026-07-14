var api = {
	// 调用 /samantha/media/get_play_info 拿到真正的无水印视频
	// 该接口返回：
	//   data.media_info[0].main_url        -> 720p 无水印 (H.264)
	//   data.original_media_info.main_url  -> 1080p 原片 (H.264, 高码率)
	//   data.poster_url                    -> 封面图
	// 不需要登录/不需要 share_id，仅传 {key: vid}
	doubaoFetchPlayInfo: function (vid, onSuccess, onFail) {
		wx.request({
			url: 'https://www.doubao.com/samantha/media/get_play_info?aid=497858&device_platform=web&language=zh-CN',
			method: 'POST',
			header: {
				'Content-Type': 'application/json',
				'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
				'origin': 'https://www.doubao.com',
				'referer': 'https://www.doubao.com/',
				'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
			},
			data: { key: vid },
			timeout: 15000,
			success: function (response) {
				if (response.statusCode !== 200 || !response.data) {
					onFail('请求失败');
					return;
				}
				var json = response.data;
				if (json.code !== 0 || !json.data) {
					onFail(json.msg || '解析失败');
					return;
				}

				var data = json.data;
				var original = data.original_media_info || {};
				var preview = (data.media_info && data.media_info[0]) || {};

				// 优先 1080p 原片，回退 720p；都没有则失败
				var downurl = original.main_url || preview.main_url || '';
				if (!downurl) {
					onFail('未获取到视频地址');
					return;
				}

				var meta = original.meta || preview.meta || {};
				var duration = parseFloat(meta.duration) || 0;

				onSuccess({
					downurl: downurl,
					cover_url: data.poster_url || '',
					duration: duration,
					width: parseInt(meta.width) || 0,
					height: parseInt(meta.height) || 0,
					definition: meta.definition || ''
				});
			},
			fail: function (err) {
				console.error('[豆包 media/get_play_info] 请求失败:', err);
				onFail('网络错误');
			}
		});
	},

	// 拉取分享元信息（prompt / 作者）。失败可静默回退。
	doubaoFetchShareMeta: function (vid, share_id, onComplete) {
		wx.request({
			url: 'https://www.doubao.com/creativity/share/get_video_share_info?aid=497858&device_platform=web&language=zh-CN',
			method: 'POST',
			header: {
				'Content-Type': 'application/json',
				'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
				'origin': 'https://www.doubao.com',
				'referer': 'https://www.doubao.com/',
				'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
			},
			data: { share_id: share_id || '', vid: vid, creation_id: '' },
			timeout: 10000,
			success: function (response) {
				var meta = { prompt: '', nickname: '' };
				try {
					var json = response.data || {};
					if (json.code === 0 && json.data) {
						meta.prompt = json.data.prompt || '';
						meta.nickname = (json.data.user_info && json.data.user_info.nickname) || '';
					}
				} catch (e) {}
				onComplete(meta);
			},
			fail: function () {
				onComplete({ prompt: '', nickname: '' });
			}
		});
	},

	doubaoAnalysis: function (url, successCallback, failCallback) {
		console.log('=== 豆包视频解析 ===');
		console.log('原始URL:', url);

		if (!url.includes('doubao.com')) {
			failCallback('不是豆包链接');
			return;
		}

		var videoIdMatch = url.match(/video_id=([^&\s]+)/);
		var shareIdMatch = url.match(/share_id=([^&\s]+)/);

		if (!videoIdMatch) {
			var threadIdMatch = url.match(/\/thread\/([a-f0-9]+)/);
			if (threadIdMatch) {
				api.doubaoImageAnalysis(url, successCallback, failCallback);
				return;
			}
			failCallback('链接格式错误');
			return;
		}

		var vid = videoIdMatch[1];
		var share_id = shareIdMatch ? shareIdMatch[1] : '';

		console.log('参数:', { vid: vid, share_id: share_id });

		wx.showLoading({ title: '解析中...' });

		// 主调用：拿无水印 URL；并行拉一次分享元信息，失败不阻塞
		var playInfoResult = null;
		var shareMeta = null;
		var done = false;

		function tryFinish() {
			if (done) return;
			// playInfo 必须就绪；shareMeta 是可选的，如果还没回也接受空值
			if (!playInfoResult) return;
			done = true;
			wx.hideLoading();

			var meta = shareMeta || { prompt: '', nickname: '' };
			console.log('✅ 解析成功，无水印URL已生成');

			successCallback({
				data: {
					code: 0,
					data: {
						type: 'video',
						cover_url: playInfoResult.cover_url,
						downurl: playInfoResult.downurl,
						title: meta.prompt || '',
						nickname: meta.nickname || '',
						images: [],
						duration: playInfoResult.duration,
						width: playInfoResult.width,
						height: playInfoResult.height,
						definition: playInfoResult.definition,
						video_size: 0
					},
					message: '解析成功'
				}
			});
		}

		api.doubaoFetchPlayInfo(vid, function (result) {
			playInfoResult = result;
			// shareMeta 已在路上，给它一个短超时窗口
			if (shareMeta) {
				tryFinish();
			} else {
				setTimeout(function () {
					if (!shareMeta) shareMeta = { prompt: '', nickname: '' };
					tryFinish();
				}, 1500);
			}
		}, function (errMsg) {
			if (done) return;
			done = true;
			wx.hideLoading();
			console.log('豆包解析失败:', errMsg);
			failCallback(errMsg || '解析失败');
		});

		api.doubaoFetchShareMeta(vid, share_id, function (meta) {
			shareMeta = meta;
			if (playInfoResult) tryFinish();
		});
	},

	doubaoImageAnalysis: function (url, successCallback, failCallback) {
		console.log('=== 豆包图集解析（结构化JSON提取）===');
		console.log('原始URL:', url);

		var threadIdMatch = url.match(/\/thread\/([a-f0-9]+)/);
		if (!threadIdMatch) {
			failCallback('无法识别图集ID');
			return;
		}

		var threadId = threadIdMatch[1];
		console.log('Thread ID:', threadId);

		wx.showLoading({ title: '解析图集中...' });

		var headers = {
			'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
		};

		wx.request({
			url: 'https://www.doubao.com/thread/' + threadId,
			method: 'GET',
			header: headers,
			timeout: 20000,
			success: function(response) {
				console.log('页面状态:', response.statusCode);
				wx.hideLoading();

				if (response.statusCode !== 200 || !response.data) {
					failCallback('页面加载失败');
					return;
				}

				try {
					var html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

					var images = [];

					var fnArgsMatch = html.match(/data-script-src="modern-run-router-data-fn"\s+data-fn-args="(.*?)"\s+nonce="/i);
					if (fnArgsMatch && fnArgsMatch[1]) {
						console.log('[结构化] 找到 data-fn-args，使用JSON提取模式');

						var jsonStr = fnArgsMatch[1].replace(/&quot;/g, '"');
						var jsonData = JSON.parse(jsonStr);

						for (var i = 0; i < jsonData.length; i++) {
							var item = jsonData[i];
							if (typeof item === 'object' && item.data && item.data.message_snapshot) {
								var msgList = item.data.message_snapshot.message_list || [];
								for (var j = 0; j < msgList.length; j++) {
									var msg = msgList[j];
									if (!msg.content_block) continue;

									for (var k = 0; k < msg.content_block.length; k++) {
										var block = msg.content_block[k];
										try {
											var contentV2 = JSON.parse(block.content_v2);
											if (contentV2.creation_block && contentV2.creation_block.creations) {
												var creations = contentV2.creation_block.creations;
												for (var c = 0; c < creations.length; c++) {
													var creation = creations[c];
													if (creation.image && creation.image.image_ori_raw) {
														var imgRaw = creation.image.image_ori_raw;
														imgRaw.url = imgRaw.url.replace(/&amp;/g, '&');
														images.push(imgRaw.url);
													}
												}
											}
										} catch(parseErr) {}
									}
								}
							}
						}

						console.log('[结构化] 提取到', images.length, '张图片');
					}

					if (images.length === 0) {
						console.log('[回退] 结构化提取失败，尝试正则回退模式...');
						images = api.extractByRegex(html);
					}

					if (images.length === 0) {
						failCallback('未找到图片');
						return;
					}

					successCallback({
						data: {
							code: 0,
							data: {
								type: 'images',
								cover_url: images[0] || '',
								downurl: '',
								title: '豆包图集 - ' + images.length + '张',
								images: images,
								duration: 0,
								video_size: 0
							},
							message: '解析成功'
						}
					});

				} catch(e) {
					console.error('解析失败:', e);
					failCallback('解析失败');
				}
			},
			fail: function(err) {
				console.error('请求失败:', err);
				wx.hideLoading();
				failCallback('网络错误');
			}
		});
	},

	extractByRegex: function(html) {
		function fullDecode(rawStr) {
			if (!rawStr) return '';
			var decoded = rawStr;
			decoded = decoded.replace(/\\&quot;/g, '"');
			decoded = decoded.replace(/&quot;/g, '"');
			decoded = decoded.replace(/\\u0026/g, '&');
			decoded = decoded.replace(/\\&/g, '&');
			decoded = decoded.replace(/&amp;/g, '&');
			decoded = decoded.replace(/\\\//g, '/');
			decoded = decoded.replace(/^["'\s]+|["'\s]+$/g, '');
			return decoded;
		}

		var results = [];
		var seenHashes = {};

		var patterns = [
			/image_ori_raw[\s\S]*?url[\s\S]*?(https:\/\/[^\\&\s"]+rc_gen_image\/[a-f0-9]{32}\.[a-z]+[^\\&\s"]*)/gi,
			/(https:\/\/p\d+-flow-imagex-sign\.byteimg\.com\/tos-cn-i-[a-z0-9]+\/rc_gen_image\/[a-f0-9]{32}\.[a-z~]+[^\\&\s"'<>]*x-signature=[^\\&\s"'<>]*)/gi
		];

		for (var p = 0; p < patterns.length; p++) {
			var regex = new RegExp(patterns[p].source, patterns[p].flags);
			var m;
			while ((m = regex.exec(html)) !== null) {
				var urlCandidate = m[1] || m[0];
				var cleanUrl = fullDecode(urlCandidate);
				var hashMatch = cleanUrl.match(/rc_gen_image\/([a-f0-9]{32})/);
				if (hashMatch && !seenHashes[hashMatch[1]] && cleanUrl.indexOf('http') === 0) {
					seenHashes[hashMatch[1]] = true;
					results.push(cleanUrl);
				}
			}
		}

		if (results.length === 0) {
			var extendedPattern = /(https:\/\/p\d+-flow-imagex-sign\.byteimg\.com\/[^\\&\s"'<>]+?)\\?&(?:\\?"|\\?'|\s|")/gi;
			var em;
			while ((em = extendedPattern.exec(html)) !== null) {
				var extUrl = fullDecode(em[1]);
				var extHash = extUrl.match(/rc_gen_image\/([a-f0-9]{32})/);
				if (!extHash) continue;
				var alreadyHas = false;
				for (var k = 0; k < results.length; k++) {
					if (results[k].indexOf(extHash[1]) > -1) { alreadyHas = true; break; }
				}
				if (!alreadyHas && extUrl.indexOf('image_raw') > -1) {
					results.push(extUrl);
				}
			}
		}

		return results;
	},

	qwenImageAnalysis: function (url, successCallback, failCallback) {
		console.log('=== 通义千问图片/视频解析 ===');
		console.log('原始URL:', url);

		var isExternalShare = url.includes('qianwen.com') && (url.includes('qwen-external-share') || url.includes('shareId'));
		var chatIdMatch = url.match(/\/chat\/([a-f0-9]+)/);
		var shareIdMatch = url.match(/shareId=([^&\s]+)/);

		if (!isExternalShare && !chatIdMatch) {
			failCallback('无法识别千问链接');
			return;
		}

		var shareId = shareIdMatch ? shareIdMatch[1] : '';
		var imageIndexMatch = url.match(/image_index=(\d+)/);
		var imageIndex = imageIndexMatch ? parseInt(imageIndexMatch[1]) : 0;

		wx.showLoading({ title: '解析千问内容中...' });

		var headers = {
			'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36'
		};

		var targetUrl = '';
		if (isExternalShare && shareId) {
			targetUrl = url.split('?')[0] + '?shareId=' + shareId;
			console.log('[千问] 使用外部分享链接模式, shareId:', shareId);
		} else if (chatIdMatch) {
			targetUrl = 'https://qwen.cn/chat/' + chatIdMatch[1];
			console.log('[千问] 使用聊天链接模式, chatId:', chatIdMatch[1]);
		}

		wx.request({
			url: targetUrl,
			method: 'GET',
			header: headers,
			timeout: 25000,
			success: function(response) {
				console.log('[千问] 页面状态:', response.statusCode);
				wx.hideLoading();

				if (response.statusCode !== 200 || !response.data) {
					failCallback('页面加载失败');
					return;
				}

				try {
					var html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
					var images = [];
					var videoUrl = '';
					var isVideo = false;

					var nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"\s+type="application\/json">(.*?)<\/script>/i);
					if (nextDataMatch && nextDataMatch[1]) {
						console.log('[千问] 找到 __NEXT_DATA__，使用JSON提取模式');

						try {
							var nextData = JSON.parse(nextDataMatch[1]);
							var props = nextData.props || {};
							var pageProps = props.pageProps || {};

							function traverseQwenContent(obj, depth) {
								if (depth > 20 || !obj) return;
								if (typeof obj === 'string') {
									var imgPatterns = [
										/https:\/\/[^"'\s<>]*\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\s<>]*)?/gi,
										/https:\/\/(cdn|image|img|oss|alicdn|aliyuncs)[^"'\s<>]*\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"'\s<>]*)?/gi
									];
									for (var p = 0; p < imgPatterns.length; p++) {
										var regex = new RegExp(imgPatterns[p].source, imgPatterns[p].flags);
										var m;
										while ((m = regex.exec(obj)) !== null) {
											var imgUrl = m[0];
											if (imgUrl.indexOf('avatar') === -1 &&
												imgUrl.indexOf('icon') === -1 &&
												imgUrl.indexOf('logo') === -1 &&
												imgUrl.indexOf('favicon') === -1 &&
												imgUrl.length > 40 &&
												images.indexOf(imgUrl) === -1) {
												images.push(imgUrl);
											}
										}
									}
									var videoPattern = /https:\/\/[^"'\s<>]*\.(?:mp4|mov|avi|webm)(?:\?[^"'\s<>]*)?/gi;
									var vm;
									while ((vm = videoPattern.exec(obj)) !== null) {
										if (!videoUrl) videoUrl = vm[0];
									}
									return;
								}

								if (Array.isArray(obj)) {
									for (var i = 0; i < obj.length; i++) {
										traverseQwenContent(obj[i], depth + 1);
									}
								} else if (typeof obj === 'object') {
									var keys = Object.keys(obj);
									for (var k = 0; k < keys.length; k++) {
										traverseQwenContent(obj[keys[k]], depth + 1);
									}
								}
							}

							traverseQwenContent(pageProps, 0);

						} catch(parseErr) {
							console.error('[千问] JSON解析失败，尝试正则模式', parseErr);
						}
					}

					if (images.length === 0) {
						console.log('[千问回退] 尝试正则提取...');
						var qwenPatterns = [
							/"(?:original_url|url|src|imageUrl|image_url|oss_url|file_url)"\s*:\s*"(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp))"/gi,
							/(https:\/\/[^"'\s<>]*(?:alicdn|aliyuncs|oss-cn|wanx)[^"'\s<>]*\.(?:jpg|jpeg|png|webp))/gi,
							/(https:\/\/[^"'\s<>]*\/(?:image|img|pic|photo|upload)[^"'\s<>]*\.(?:jpg|jpeg|png|webp))/gi
						];

						for (var qp = 0; qp < qwenPatterns.length; qp++) {
							var qRegex = new RegExp(qwenPatterns[qp].source, qwenPatterns[qp].flags);
							var qm;
							while ((qm = qRegex.exec(html)) !== null) {
								var qImgUrl = (qm[1] || qm[0]).replace(/\\"/g, '"').replace(/\\u002F/g, '/');
								if (images.indexOf(qImgUrl) === -1 && qImgUrl.length > 40) {
									images.push(qImgUrl);
								}
							}
						}

						var videoRegex = /"(?:video_url|videoSrc|src)"\s*:\s*"(https:\/\/[^"]+\.(?:mp4|mov|webm))"/gi;
						var vr;
						while ((vr = videoRegex.exec(html)) !== null) {
							videoUrl = vr[1];
						}
					}

					isVideo = videoUrl.length > 0 && images.length === 0;

					console.log('[千问] 提取结果 - 图片:', images.length, ', 视频:', isVideo ? '有' : '无');

					if (isVideo) {
						successCallback({
							data: {
								code: 0,
								data: {
									type: 'video',
									cover_url: '',
									downurl: videoUrl,
									title: '通义千问视频',
									images: [],
									duration: 0,
									video_size: 0
								},
								message: '解析成功'
							}
						});
					} else if (images.length > 0) {
						successCallback({
							data: {
								code: 0,
								data: {
									type: 'images',
									cover_url: images[imageIndex] || images[0] || '',
									downurl: '',
									title: '通义千问图集 - ' + images.length + '张',
									images: images,
									duration: 0,
									video_size: 0
								},
								message: '解析成功'
							}
						});
					} else {
						failCallback('未找到图片或视频');
					}

				} catch(e) {
					console.error('[千问] 解析失败:', e);
					failCallback('解析失败');
				}
			},
			fail: function(err) {
				console.error('[千问] 请求失败:', err);
				wx.hideLoading();
				failCallback('网络错误');
			}
		});
	},

	jimengVideoAnalysis: function (url, successCallback, failCallback) {
		console.log('=== 即梦视频解析 ===');
		console.log('原始URL:', url);

		wx.showLoading({ title: '解析即梦中...' });

		var headers = {
			'content-type': 'application/json',
			'origin': 'https://xiaoyunque.jianying.com',
			'referer': 'https://xiaoyunque.jianying.com/',
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
		};

		function getRedirectUrl(shareUrl, callback) {
			wx.request({
				url: shareUrl,
				method: 'GET',
				header: { 'user-agent': headers['user-agent'] },
				success: function(res) {
					callback(res.header['Location'] || shareUrl);
				},
				fail: function() {
					callback(shareUrl);
				}
			});
		}

		getRedirectUrl(url, function(redirectUrl) {
			var queryIndex = redirectUrl.indexOf('?');
			var queryString = queryIndex > -1 ? redirectUrl.substring(queryIndex + 1) : '';
			var params = {};

			if (queryString) {
				var pairs = queryString.split('&');
				for (var i = 0; i < pairs.length; i++) {
					var pair = pairs[i].split('=');
					if (pair.length === 2) {
						params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
					}
				}
			}

			var share_id = params.share_id || '';
			var share_sec_did = params.share_sec_did || '';
			var share_sec_uid = params.share_sec_uid || '';

			if (!share_id) {
				wx.hideLoading();
				failCallback('无法获取分享ID');
				return;
			}

			console.log('即梦参数:', { share_id: share_id });

			var jsonData = {
				query_params: {
					content_type: 'video',
					home_input_type: 'VIDEO_PART',
					scene: 'agent_tool',
					share_campaign_key: 'pippit_invite_fission',
					share_id: share_id,
					share_sec_did: share_sec_did,
					share_sec_uid: share_sec_uid
				}
			};

			wx.request({
				url: 'https://xiaoyunque.jianying.com/luckycat/cn/jianying/campaign/v1/pippit/share/landing_page',
				method: 'POST',
				header: headers,
				data: jsonData,
				timeout: 20000,
				success: function(response) {
					wx.hideLoading();

					if (response.statusCode !== 200 || !response.data) {
						failCallback('请求失败');
						return;
					}

					try {
						var result = response.data;

						if (!result.data) {
							failCallback('API返回数据异常，可能链接已失效');
							return;
						}

						if (!result.data.page_info) {
							failCallback('无法获取视频播放信息');
							return;
						}

						var pageInfo = result.data.page_info;
						var generatePage = pageInfo.generate_page || {};
						var itemInfo = generatePage.item_info || {};
						var videoInfoList = itemInfo.video_info || [];

						if (videoInfoList.length === 0) {
							failCallback('未找到视频信息');
							return;
						}

						var videoInfo = videoInfoList[0];

						successCallback({
							data: {
								code: 0,
								data: {
									type: 'video',
									cover_url: videoInfo.cover_url || '',
									downurl: videoInfo.video_url || '',
									title: '即梦视频',
									images: [],
									duration: 0,
									video_size: 0
								},
								message: '解析成功'
							}
						});

					} catch(e) {
						console.error('[即梦] 解析失败:', e);
						failCallback('解析失败');
					}
				},
				fail: function(err) {
					console.error('[即梦] 请求失败:', err);
					wx.hideLoading();
					failCallback('网络错误');
				}
			});
		});
	},

	jimengImageAnalysis: function (url, successCallback, failCallback) {
		console.log('=== 即梦图片解析 ===');
		console.log('原始URL:', url);

		wx.showLoading({ title: '解析即梦图中...' });

		var headers = {
			'content-type': 'application/json',
			'origin': 'https://xiaoyunque.jianying.com',
			'referer': 'https://xiaoyunque.jianying.com/',
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
		};

		function getRedirectUrl(shareUrl, callback) {
			wx.request({
				url: shareUrl,
				method: 'GET',
				header: { 'user-agent': headers['user-agent'] },
				success: function(res) {
					callback(res.header['Location'] || shareUrl);
				},
				fail: function() {
					callback(shareUrl);
				}
			});
		}

		getRedirectUrl(url, function(redirectUrl) {
			var queryIndex = redirectUrl.indexOf('?');
			var queryString = queryIndex > -1 ? redirectUrl.substring(queryIndex + 1) : '';
			var params = {};

			if (queryString) {
				var pairs = queryString.split('&');
				for (var i = 0; i < pairs.length; i++) {
					var pair = pairs[i].split('=');
					if (pair.length === 2) {
						params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
					}
				}
			}

			var share_id = params.share_id || '';
			var share_sec_did = params.share_sec_did || '';
			var share_sec_uid = params.share_sec_uid || '';

			if (!share_id) {
				wx.hideLoading();
				failCallback('无法获取分享ID');
				return;
			}

			var jsonData = {
				query_params: {
					content_type: 'image',
					home_input_type: 'IMAGE_PART',
					scene: 'agent_tool',
					share_campaign_key: 'pippit_invite_fission',
					share_id: share_id,
					share_sec_did: share_sec_did,
					share_sec_uid: share_sec_uid
				}
			};

			wx.request({
				url: 'https://xiaoyunque.jianying.com/luckycat/cn/jianying/campaign/v1/pippit/share/landing_page',
				method: 'POST',
				header: headers,
				data: jsonData,
				timeout: 20000,
				success: function(response) {
					wx.hideLoading();

					if (response.statusCode !== 200 || !response.data) {
						failCallback('请求失败');
						return;
					}

					try {
						var result = response.data;
						var images = [];

						if (result.data && result.data.page_info) {
							var pageInfo = result.data.page_info;
							var generatePage = pageInfo.generate_page || {};
							var itemInfo = generatePage.item_info || {};
							var imageInfoList = itemInfo.image_info || [];

							for (var idx = 0; idx < imageInfoList.length; idx++) {
								var imgInfo = imageInfoList[idx];
								if (imgInfo.image_url) {
									images.push(imgInfo.image_url);
								}
							}
						}

						if (images.length === 0) {
							failCallback('未找到图片');
							return;
						}

						successCallback({
							data: {
								code: 0,
								data: {
									type: 'images',
									cover_url: images[0] || '',
									downurl: '',
									title: '即梦图集 - ' + images.length + '张',
									images: images,
									duration: 0,
									video_size: 0
								},
								message: '解析成功'
							}
						});

					} catch(e) {
						console.error('[即梦图片] 解析失败:', e);
						failCallback('解析失败');
					}
				},
				fail: function(err) {
					console.error('[即梦图片] 请求失败:', err);
					wx.hideLoading();
					failCallback('网络错误');
				}
			});
		});
	},

	analysis: function (e, t, i) {
		if (e.includes('doubao.com')) {
			api.doubaoAnalysis(e, t, i);
		} else if (e.includes('qwen.cn') || e.includes('qianwen.com')) {
			api.qwenImageAnalysis(e, t, i);
		} else if (e.includes('jimeng.jianying.com') || e.includes('dreamina.com') || e.includes('xiaoyunque.jianying.com')) {
			api.jimengVideoAnalysis(e, t, i);
		} else {
			i('不支持的链接，仅支持：豆包 / 通义千问 / 即梦(Dreamina)');
		}
	}
};

module.exports = api;
