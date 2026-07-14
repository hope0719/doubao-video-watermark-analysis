# 🍵 豆包无水印VEFAA微信小程序架构设计

> **VEFAA架构**：Video Enhancement & Filtering Automation API
> **目标**：将浏览器插件核心功能封装为微信小程序标准API

---

## 🎯 架构设计思路

### 为什么选择VEFAA架构？

| 传统方法 | VEFAA架构 |
|---------|-----------|
| 直接API调用 | 模块化函数组合 |
| 单一功能 | 多功能集成 |
| 硬编码逻辑 | 配置驱动 |
| 难以复用 | 标准化接口 |

### 🔧 核心模块拆分

```
VEFAA微信小程序
├── 📱 用户接口层 (API)
├── 🔧 核心功能层 (Engine) 
├── 🔐 安全加密层 (Crypto)
└── 🕸️ 网络请求层 (Network)
```

---

## 📱 VEFAA 函数架构设计

### 🌟 核心API设计

```javascript
// pages/api/doubao-vefaa.js
export const VEFAA = {
  
  // 主入口函数 - 视频无水印处理
  async processVideo(input) {
    const {
      videoUrl,           // 豆包分享链接
      duration = 15,      // 视频时长(5/10/15)
      noWatermark = true, // 是否去水印
      callback            // 进度回调
    } = input;
    
    return await this._fullProcess(videoUrl, duration, noWatermark, callback);
  },
  
  // 快速解析 - 仅获取无水印URL
  async parseUrl(shareUrl) {
    // 核心解密逻辑封装
  },
  
  // 批量处理 - 多个视频
  async batchProcess(videoList) {
    // 队列管理和并发控制  
  },
  
  // 配置获取 - 视频详情信息
  async getVideoInfo(videoId) {
    // 返回分辨率、时长等信息
  }
};
```

### 📦 功能模块化设计

#### 1. 网络请求模块 (Network)
```javascript
// utils/network.js
export const Network = {
  
  // 微信API - GET请求
  async wxRequest(url, data = {}, options = {}) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        data: data,
        method: 'GET',
        header: {
          'content-type': 'application/json',
          'User-Agent': this.getUserAgent()
        },
        success: resolve,
        fail: reject
      });
    });
  },
  
  // 豆包专用API请求
  async doubaoApi(endpoint, body, headers = {}) {
    const apiUrl = this.buildApiUrl(endpoint);
    return await this.wxRequest(apiUrl, body, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Agw-Js-Conv': 'str',
        ...headers
      }
    });
  },
  
  // 获取微信环境UserAgent
  getUserAgent() {
    return 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.1(0x18000528) NetType/WIFI Language/zh_CN';
  }
};
```

#### 2. 加密解密模块 (Crypto)  
```javascript
// utils/crypto.js
export const Crypto = {
  
  // AES-CBC解密 (核心算法)
  async decryptAesCbc(encryptedData, key, iv) {
    try {
      const crypto = wx.getCrypto();
      const keyBuffer = this.base64ToBuffer(key);
      const ivBuffer = this.base64ToBuffer(iv);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: ivBuffer },
        keyBuffer,
        encryptedData
      );
      
      return this.bufferToText(decrypted);
    } catch (error) {
      throw new Error(`AES解密失败: ${error.message}`);
    }
  },
  
  // QAAB协议解密 (豆包特有)
  async decryptQaab(token, keySeedText) {
    // 复制浏览器插件的解密逻辑
    const saltBytes = this.hexToBytes(QAAB_SALT_HEX);
    const keySeedBytes = this.base64ToBytes(keySeedText);
    
    // SHA-512密钥派生
    const digest1 = await this.sha512(keySeedBytes);
    const combined = this.concatBytes([digest1, saltBytes]);
    const digest2 = await this.sha512(combined);
    
    const key = digest2.slice(0, 16);
    const iv = digest2.slice(16, 32);
    
    return await this.decryptAesCbc(token, key, iv);
  },
  
  // Base64鲁棒解码 (支持变体)
  base64Decode(text) {
    const variants = [
      text,
      text.replace(/\$/g, '_').replace(/@/g, '/').replace(/#/g, '.'),
      text.replace(/\$/g, '+').replace(/@/g, '/').replace(/#/g, '=')
    ];
    
    for (const variant of variants) {
      try {
        return wx.arrayBufferToBase64(variant);  // 微信API
      } catch (error) {
        continue;
      }
    }
    throw new Error('Base64解码失败');
  }
};
```

#### 3. 核心引擎模块 (Engine)
```javascript
// core/engine.js
export const Engine = {
  
  // 主要流程控制
  async _fullProcess(videoUrl, duration, noWatermark, callback) {
    try {
      // 步骤1: 解析分享链接
      const videoData = await this.parseShareUrl(videoUrl);
      callback && callback(20, '解析分享链接成功');
      
      // 步骤2: 获取无水印URL  
      const noWatermarkUrl = await this.getNoWatermarkUrl(videoData);
      callback && callback(50, '获取无水印链接成功');
      
      // 步骤3: 时长处理
      if (duration !== 'original') {
        const processedUrl = await this.processDuration(noWatermarkUrl, duration);
        callback && callback(80, '视频时长处理完成');
      }
      
      // 步骤4: 下载准备
      const result = {
        success: true,
        videoUrl: noWatermarkUrl,
        filename: this.generateFilename(videoData, duration),
        duration: duration,
        timestamp: Date.now()
      };
      
      callback && callback(100, '处理完成');
      return result;
      
    } catch (error) {
      throw new Error(`视频处理失败: ${error.message}`);
    }
  },
  
  // 解析分享链接
  async parseShareUrl(shareUrl) {
    const messageId = this.extractMessageId(shareUrl);
    
    // 调用豆包分享保存API
    const shareResult = await Network.doubaoApi('/alice/media/bigmusic/share_save', {
      message_id: messageId
    });
    
    // 获取分享快照
    const shareData = await Network.doubaoApi('/im/message/share/get', {
      share_id: shareResult.share_id,
      need_bot_info: true
    });
    
    return this.extractVideoInfo(shareData);
  },
  
  // 获取无水印URL (核心解密逻辑)
  async getNoWatermarkUrl(videoData) {
    
    // 尝试直接获取
    if (this.isNoWatermarkUrl(videoData.downloadUrl)) {
      return videoData.downloadUrl;
    }
    
    // AES-QAAB解密
    if (videoData.encryptedUrl && videoData.keySeed) {
      const decrypted = await Crypto.decryptQaab(
        videoData.encryptedUrl,
        videoData.keySeed
      );
      if (this.isNoWatermarkUrl(decrypted)) {
        return decrypted;
      }
    }
    
    // fplay API组合
    if (videoData.fallbackApi) {
      return await this.tryFplayVariants(videoData.fallbackApi, videoData.keySeed);
    }
    
    throw new Error('无法获取无水印URL');
  },
  
  // fplay参数变异尝试
  async tryFplayVariants(baseUrl, keySeed) {
    const variants = [
      { codecType: '0', logoType: 'unwatermarked' },
      { codecType: '0', logoType: 'no_watermark' },
      { codecType: '0', logoType: '' }
    ];
    
    for (const variant of variants) {
      const variantUrl = this.mutateFplayUrl(baseUrl, variant);
      const fplayData = await Network.wxRequest(variantUrl);
      
      for (const video of fplayData.video_list || []) {
        const decryptedUrl = await Crypto.decryptQaab(video.main_url, keySeed);
        if (this.isNoWatermarkUrl(decryptedUrl)) {
          return decryptedUrl;
        }
      }
    }
    
    throw new Error('所有fplay变体均无效');
  },
  
  // 无水印URL验证
  isNoWatermarkUrl(url) {
    if (!url || !url.includes('doubao.com')) return false;
    
    try {
      const parsed = new URL(url);
      const cs = parsed.searchParams.get('cs') || '';
      const qs = parsed.searchParams.get('qs') || '';
      const lr = parsed.searchParams.get('lr') || '';
      
      return cs === '0' && qs === '13' && 
             (!lr || lr === 'unwatermarked' || lr === 'no_watermark');
    } catch {
      return false;
    }
  }
};
```

---

## 🎯 微信小程序页面集成

### 主页面结构
```html
<!-- pages/index/index.wxml -->
<view class="container">
  <view class="header">
    <text class="title">豆包无水印工具</text>
    <text class="subtitle">基于VEFAA架构</text>
  </view>
  
  <view class="input-section">
    <input 
      class="url-input" 
      placeholder="请输入豆包视频分享链接"
      value="{{videoUrl}}"
      bindinput="onUrlInput"
    />
    
    <picker 
      mode="selector" 
      range="{{durations}}"
      value="{{selectedDuration}}"
      bindchange="onDurationChange"
    >
      <view class="picker">
        <text>视频时长: {{durations[selectedDuration]}}</text>
      </view>
    </picker>
  </view>
  
  <button 
    class="process-btn"
    loading="{{processing}}"
    bindtap="onProcessVideo"
  >
    {{processing ? '处理中...' : '开始处理'}}
  </button>
  
  <view class="progress-section" wx:if="{{processing}}">
    <progress percent="{{progress}}" show-info />
    <text class="progress-text">{{progressText}}</text>
  </view>
  
  <view class="result-section" wx:if="{{result}}">
    <text class="success-text">✅ 处理成功！</text>
    <button bindtap="onDownload">下载无水印视频</button>
  </view>
</view>
```

### 页面逻辑
```javascript
// pages/index/index.js
import { VEFAA } from '../../core/vefaa';

Page({
  data: {
    videoUrl: '',
    durations: ['原始', '5秒', '10秒', '15秒'],
    selectedDuration: 3,  // 默认15秒
    processing: false,
    progress: 0,
    progressText: '',
    result: null
  },
  
  onUrlInput(e) {
    this.setData({ videoUrl: e.detail.value });
  },
  
  onDurationChange(e) {
    this.setData({ selectedDuration: e.detail.value });
  },
  
  async onProcessVideo() {
    if (!this.data.videoUrl) {
      wx.showToast({ title: '请输入分享链接', icon: 'none' });
      return;
    }
    
    const duration = this.data.durations[this.data.selectedDuration] === '原始' 
      ? 'original' 
      : this.data.durations[this.data.selectedDuration].replace('秒', '');
    
    this.setData({ processing: true, progress: 0 });
    
    try {
      const result = await VEFAA.processVideo({
        videoUrl: this.data.videoUrl,
        duration: duration,
        noWatermark: true,
        callback: (progressValue, text) => {
          this.setData({
            progress: progressValue,
            progressText: text
          });
        }
      });
      
      this.setData({ result: result, processing: false });
      wx.showToast({ title: '处理成功！' });
      
    } catch (error) {
      this.setData({ processing: false });
      wx.showToast({ title: error.message || '处理失败', icon: 'none' });
    }
  },
  
  onDownload() {
    if (this.data.result) {
      wx.downloadFile({
        url: this.data.result.videoUrl,
        success: (res) => {
          wx.saveFile({
            tempFilePath: res.tempFilePath,
            success: (saveRes) => {
              wx.showToast({ title: '保存成功' });
            }
          });
        }
      });
    }
  }
});
```

---

## 🔧 适配层设计

### 微信小程序适配挑战

| 浏览器环境 | 微信小程序环境 | 适配方案 |
|-----------|---------------|---------|
| `window.crypto` | `wx.getCrypto()` | Crypto适配层 |
| `fetch` API | `wx.request` | Network封装 |
| `localStorage` | `wx.setStorage` | Storage适配 |
| `URL`对象 | 字符串处理 | URL工具函数 |

### 核心适配实现
```javascript
// utils/wx-adapter.js
export const WxAdapter = {
  
  // Crypto API适配
  async subtle_decrypt(algorithm, key, data) {
    return new Promise((resolve, reject) => {
      wx.getCrypto().subtle.decrypt(
        algorithm,
        key,
        data,
        {
          success: resolve,
          fail: reject
        }
      );
    });
  },
  
  // Storage适配
  async setStorage(key, value) {
    return new Promise((resolve, reject) => {
      wx.setStorage({
        key: key,
        data: value,
        success: resolve,
        fail: reject
      });
    });
  },
  
  async getStorage(key) {
    return new Promise((resolve, reject) => {
      wx.getStorage({
        key: key,
        success: (res) => resolve(res.data),
        fail: reject
      });
    });
  }
};
```

---

## 🎯 安全设计

### 权限控制
```javascript
// 安全验证中间件
export const Security = {
  
  // API密钥验证
  validateApiKey(apiKey) {
    const validKeys = wx.getStorageSync('validApiKeys') || [];
    return validKeys.includes(apiKey);
  },
  
  // 频率限制
  async checkRateLimit(userId) {
    const now = Date.now();
    const userRecord = await WxAdapter.getStorage(`rate_limit_${userId}`) || {
      count: 0,
      resetTime: now
    };
    
    if (now > userRecord.resetTime) {
      userRecord.count = 0;
      userRecord.resetTime = now + 3600000; // 1小时重置
    }
    
    if (userRecord.count >= 10) { // 每小时10次限制
      throw new Error('请求频率超限，请稍后再试');
    }
    
    userRecord.count++;
    await WxAdapter.setStorage(`rate_limit_${userId}`, userRecord);
  },
  
  // 域名白名单
  validateDomain(url) {
    const allowedDomains = ['doubao.com', 'api-normal.doubao.com'];
    return allowedDomains.some(domain => url.includes(domain));
  }
};
```

---

## 📦 包结构和部署

### 小程序目录结构
```
miniapp-doubao-vefaa/
├── pages/
│   ├── index/           # 主页面
│   ├── api/             # API页面
│   └── settings/        # 设置页面
├── core/
│   ├── vefaa.js         # VEFAA主入口
│   ├── engine.js        # 核心引擎
│   └── adapter.js       # 适配层
├── utils/
│   ├── crypto.js        # 加密模块
│   ├── network.js       # 网络模块
│   └── wx-adapter.js    # 微信适配
├── app.js
├── app.json
└── project.config.json
```

### app.json配置
```json
{
  "pages": [
    "pages/index/index",
    "pages/api/api", 
    "pages/settings/settings"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#fff",
    "navigationBarTitleText": "豆包无水印工具",
    "navigationBarTextStyle": "black"
  },
  "permission": {
    "scope.userLocation": {
      "desc": "需要获取您的位置信息"
    }
  },
  "networkTimeout": {
    "request": 15000,
    "downloadFile": 30000
  }
}
```

---

## 🚀 性能和优化

### 内存管理
```javascript
// 大文件分块处理
export const MemoryOptimizer = {
  
  // 分块解密大文件
  async decryptChunked(data, chunkSize = 1024 * 1024) {
    const chunks = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const decrypted = await this.decryptChunk(chunk);
      chunks.push(decrypted);
    }
    return this.mergeChunks(chunks);
  },
  
  // 缓存管理
  manageCache() {
    const cache = wx.getStorageSync('vefaa_cache') || {};
    const now = Date.now();
    
    // 清理过期缓存（24小时）
    Object.keys(cache).forEach(key => {
      if (now - cache[key].timestamp > 86400000) {
        delete cache[key];
      }
    });
    
    // 限制缓存大小（最多100条）
    const keys = Object.keys(cache);
    if (keys.length > 100) {
      keys.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
      keys.slice(0, keys.length - 100).forEach(key => {
        delete cache[key];
      });
    }
    
    wx.setStorageSync('vefaa_cache', cache);
  }
};
```

### 错误处理和重试
```javascript
// utils/retry-manager.js
export const RetryManager = {
  
  async retry(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          await this.sleep(delay * attempt); // 指数退避
        }
      }
    }
    
    throw new Error(`操作失败（重试${maxRetries}次）: ${lastError.message}`);
  },
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
```

---

这份VEFAA微信小程序架构设计完整地将浏览器插件的核心功能转化为小程序可用的API接口，保持了原有的AES解密、URL变异等核心技术，同时适配微信环境。您觉得这个设计如何？需要我对某个模块进行详细实现吗？