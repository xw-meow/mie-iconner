<div align="center">

<br />

# 小羊贴纸铺 · mie-iconner

**Dress up your macOS folders with stickers.**

挑一张贴纸,贴到文件夹上——就像逛贴纸铺一样简单。

[![macOS](https://img.shields.io/badge/macOS-14%2B-000000?style=flat-square&logo=apple&logoColor=white)](https://www.apple.com/macos/)
[![Swift](https://img.shields.io/badge/Swift-5.9-F05138?style=flat-square&logo=swift&logoColor=white)](https://www.swift.org)
[![SPM](https://img.shields.io/badge/SPM-Compatible-34C759?style=flat-square)](https://www.swift.org/package-manager/)

<<::图片占位 应用主界面全景:左侧贴纸库 + 右侧文件夹浏览器::>>

</div>

<br />

## ✨ 特性

<table>
  <tr>
    <td width="50%">
      <h3>🗂 贴纸库</h3>
      <p>系统预置图标包开箱即用,自定义分类随建随加;拖放即导入,每个分类可用 <code>config.json</code> 配置排序优先级、作者署名和品牌徽标。</p>
    </td>
    <td width="50%">
      <h3>🖥 桌面式浏览</h3>
      <p>右侧就是你的桌面:双击进入文件夹,地址栏支持返回上级、输入直达,还有 Chrome 风格的下拉路径建议。</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>⚡️ 一键应用 / 还原</h3>
      <p>选中贴纸 + 文件夹,点「应用」即刻生效(两步写入 + 全尺寸原图);点「还原」恢复系统默认图标。</p>
    </td>
    <td width="50%">
      <h3>🔄 与桌面严格同步</h3>
      <p>图标显示直接读磁盘,和 Finder 看同一份数据,拒绝缓存幻觉;刷新按钮重扫目录并重启 Finder 强刷。</p>
    </td>
  </tr>
</table>

<<::图片占位 应用流程演示:选中贴纸 → 选中文件夹 → 点击应用 → 桌面即时生效::>>

<br />

## 🚀 快速开始

```bash
git clone git@github.com:xw-meow/mie-iconner.git
cd mie-iconner
swift run mie-iconner
```

> 需要 Xcode 15+ / Swift 5.9+,macOS 14 Sonoma 及以上。

<br />

## 📦 自定义图标包

把你的 PNG(建议 512×512)放进任意分类,或为分类编写 `config.json`:

```json
{
  "priority": 10,
  "author": "美少女壮士a",
  "author_url": "https://www.iconfont.cn/...",
  "brandName": "三方授权",
  "brandColor": "#0958d9",
  "defaultExpanded": false
}
```

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `priority` | 排序优先级,越大分类越靠前 | `0` |
| `author` | 作者名称,展开分类时首行展示 | 无 |
| `author_url` | 作者主页,名称变为可点链接 | 无 |
| `brandName` | 分类名后的徽标文字 | 无 |
| `brandColor` | 徽标背景色 | `#0958d9` |
| `defaultExpanded` | 是否默认展开 | `false` |

<<::图片占位 图标库细节:分类徽标 + 作者链接 + 贴纸卡片选中态::>>

<br />

## 🛠 技术要点

- **SwiftUI + SwiftPM** 双 target:UI 壳(`mie-iconner`)+ 纯逻辑库(`MieIconnerCore`),58 个单元测试
- **两步写入**:应用图标先 `setIcon(nil)` 再 `setIcon(image)`,绕过 Finder 覆盖写不刷新的顽疾
- **磁盘直读**:解析 `Icon\r` 资源叉取 icns 最大变体,应用内显示与桌面永远一致
- **暖纸贴纸册主题**:米白纸底、纯白卡片、柿子橙点缀,设计 token 统一驱动
- **系统语言跟随**:内嵌 `Info.plist`,菜单栏与系统面板自动使用系统语言

```
Sources/
├── mie-iconner/        # SwiftUI 界面(视图、设计 token、资源)
└── MieIconnerCore/     # 无 UI 依赖的核心:图标读写、路径、图标库
Tests/
└── MieIconnerCoreTests/
```

<br />

<div align="center">

**小羊贴纸铺** — 让每个文件夹都有自己的表情 🐑

</div>
