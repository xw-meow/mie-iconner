import './ImagePlaceholder.css'

type Props = {
  /** 占位内容标签,如「应用主界面截图」 */
  title: string
  /** 给设计师的具体描述:画面内容、氛围、用途 */
  description: string
  /** 建议尺寸,如「1600 × 1000 PNG」 */
  size?: string
  /** 宽高比,如 '16 / 10'、'1 / 1' */
  ratio?: string
}

/**
 * 图片占位块:设计稿交付前先占住版面。
 * 每个占位都写清楚「画什么、多大、用在哪」,方便后续替换。
 */
export default function ImagePlaceholder({ title, description, size, ratio = '16 / 10' }: Props) {
  return (
    <figure className="img-placeholder" style={{ aspectRatio: ratio }}>
      <span className="img-placeholder-badge">配图占位</span>
      <span className="img-placeholder-icon" aria-hidden>
        🐑
      </span>
      <figcaption>
        <strong>{title}</strong>
        <span className="img-placeholder-desc">{description}</span>
        {size && <span className="img-placeholder-size">建议尺寸 {size}</span>}
      </figcaption>
    </figure>
  )
}
