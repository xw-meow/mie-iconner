import { useEffect } from 'react'
import './App.css'

const GITHUB_URL = 'https://github.com/xw-meow/mie-iconner'
const RELEASES_URL = `${GITHUB_URL}/releases`

const features = [
  {
    icon: '/stickers/paint.png',
    title: '贴纸库',
    desc: '100 多张内置贴纸随取随用;也可以把自己的图片拖进来,建成自己的分类。',
  },
  {
    icon: '/stickers/inspect.png',
    title: '桌面式浏览',
    desc: '右侧就是你的桌面:双击进入文件夹,输入路径可以直接跳转,还有自动补全。',
  },
  {
    icon: '/stickers/wink.png',
    title: '一键应用 / 还原',
    desc: '选中贴纸和文件夹,点一下「应用」就贴好了;看腻了,点「还原」随时换回来。',
  },
  {
    icon: '/stickers/serious.png',
    title: '与桌面同步',
    desc: '你看到的就是桌面上的样子:图标状态和 Finder 实时一致,刷新一下立刻对齐。',
  },
]

const steps = [
  { title: '选择贴纸', desc: '在内置或自定义分类中浏览,选中一张图标。' },
  { title: '选择文件夹', desc: '在右侧浏览器中定位目标文件夹,支持路径输入与自动补全。' },
  { title: '应用图标', desc: '点击「应用」即刻生效;点击「还原」恢复系统默认图标。' },
]

const marqueeStickers = [
  'hello', 'wow', 'happy', 'wink', 'wave', 'inspect', 'paint', 'serious',
  'proud', 'joy', 'dance', 'coffee', 'listen', 'flower', 'surprise', 'good',
]

export default function App() {
  // 滚动进入视口时,为所有 .reveal 元素添加 .in 触发过渡动画
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('in')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.15 },
    )
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="page">
      <header className="nav">
        <a className="nav-brand" href="#top">
          <img src="/icon.png" alt="小羊贴纸铺图标" className="nav-logo" />
          <span className="nav-name">小羊贴纸铺</span>
        </a>
        <nav className="nav-links">
          <a href="#features">特性</a>
          <a href="#how">使用方式</a>
          <a href="#packs">自定义贴纸</a>
          <a href="#download">下载</a>
        </nav>
        <a className="btn btn-ghost nav-github" href={GITHUB_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
      </header>

      <main id="top">
        {/* ================= Hero ================= */}
        <section className="hero">
          <img className="hero-sticker hero-sticker-1" src="/stickers/wave.png" alt="" aria-hidden />
          <img className="hero-sticker hero-sticker-2" src="/stickers/happy.png" alt="" aria-hidden />
          <img className="hero-sticker hero-sticker-3" src="/stickers/wow.png" alt="" aria-hidden />

          <span className="hero-badge">macOS 14+ · SwiftUI · 免费开源</span>
          <h1>给文件夹贴上贴纸</h1>
          <p className="hero-sub">
            挑一张喜欢的贴纸,贴到文件夹上——就像逛贴纸铺一样简单。
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href={RELEASES_URL} target="_blank" rel="noreferrer">
              免费下载
            </a>
            <a className="btn btn-ghost" href={GITHUB_URL} target="_blank" rel="noreferrer">
              在 GitHub 查看
            </a>
          </div>

          <div className="hero-shot reveal">
            <img
              className="shot"
              src="/shower/a1.png"
              alt="小羊贴纸铺主界面:左侧贴纸库,右侧文件夹浏览器"
            />
          </div>
        </section>

        {/* ================= 贴纸走马灯 ================= */}
        <div className="marquee" aria-hidden>
          <div className="marquee-track">
            {[...marqueeStickers, ...marqueeStickers].map((name, i) => (
              <img key={i} src={`/stickers/${name}.png`} alt="" loading="lazy" />
            ))}
          </div>
        </div>

        {/* ================= 特性 ================= */}
        <section className="section" id="features">
          <h2 className="section-title reveal">功能特性</h2>
          <div className="feature-grid">
            {features.map((f, i) => (
              <article
                className="card feature-card reveal"
                key={f.title}
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <span className="feature-icon">
                  <img src={f.icon} alt="" />
                </span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ================= 使用方式 ================= */}
        <section className="section" id="how">
          <h2 className="section-title reveal">使用方式</h2>
          <ol className="steps">
            {steps.map((s, i) => (
              <li
                className="card step-card reveal"
                key={s.title}
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                <span className="step-num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </li>
            ))}
          </ol>
          <div className="reveal">
            <img
              className="shot"
              src="/shower/a2.png"
              alt="选中贴纸和文件夹后点击「应用」,桌面上的文件夹图标即时更换"
            />
          </div>
        </section>

        {/* ================= 自定义贴纸 ================= */}
        <section className="section" id="packs">
          <h2 className="section-title reveal">做自己的贴纸</h2>
          <p className="section-sub reveal">
            任何 PNG 图片拖进贴纸库,就是一张新贴纸。
          </p>
          <div className="packs-layout">
            <div className="card sticker-grid-card reveal">
              <div className="sticker-grid">
                {marqueeStickers.map((name) => (
                  <img key={name} src={`/stickers/${name}.png`} alt={`内置贴纸 ${name}`} loading="lazy" />
                ))}
              </div>
              <p className="sticker-grid-caption">铺子里的部分贴纸</p>
            </div>
            <div className="reveal" style={{ transitionDelay: '90ms' }}>
              <img
                className="shot"
                src="/shower/custom-import.png"
                alt="「自定义」分类支持导入自己的图片作为贴纸"
              />
            </div>
          </div>
        </section>

        {/* ================= 下载 ================= */}
        <section className="section" id="download">
          <div className="card download-card reveal">
            <img src="/icon.png" alt="" className="download-icon" />
            <h2 className="section-title">下载</h2>
            <p className="section-sub">
              免费开源 · 支持 macOS 14 Sonoma 及以上 · Apple Silicon 与 Intel 通用
            </p>
            <a className="btn btn-primary btn-lg" href={RELEASES_URL} target="_blank" rel="noreferrer">
              下载 DMG
            </a>
          </div>
          <div className="card open-help reveal" style={{ transitionDelay: '90ms' }}>
            <h3>首次打开:请右键点按「打开」</h3>
            <p>
              小羊贴纸铺是一款免费开源的小工具,而 Apple 开发者认证每年需要 99
              美元,对这样一个小工具来说并不划算,所以我们没有做公证。首次打开时系统可能提示「无法验证开发者」,这属于正常现象,按下面的步骤操作一次即可。
            </p>
            <ol className="open-help-steps">
              <li>双击下载好的 DMG 安装包,把 小羊贴纸铺 拖进「应用程序」文件夹;</li>
              <li>打开「访达」,点按左侧边栏中的「应用程序」;</li>
              <li>找到 小羊贴纸铺,按住 Control 点按它的图标(或直接右键点按),选择「打开」;</li>
              <li>在弹出的窗口中再点一次「打开」。</li>
            </ol>
            <p className="open-help-note">
              只需这一次,之后双击即可正常打开。如果系统提示「已损坏,无法打开」,请前往「系统设置 →
              隐私与安全性」,点按页面下方的「仍要打开」。
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          <strong>小羊贴纸铺</strong> — 让每个文件夹都与众不同
        </p>
        <p className="footer-links">
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span>·</span>
          <a href={RELEASES_URL} target="_blank" rel="noreferrer">
            发布页
          </a>
          <span>·</span>
          <a href={`${GITHUB_URL}/issues`} target="_blank" rel="noreferrer">
            反馈问题
          </a>
        </p>
      </footer>
    </div>
  )
}
