/**
 * 生成 PWA 图标（PNG）—— `npm run icons`。
 *
 * ## 为什么要有这个脚本
 *
 * 站点图标只有一枚 `public/favicon.svg`。PWA 要求 PNG：manifest 的 192 / 512、
 * 安卓的 maskable、iOS 的 `apple-touch-icon` —— 四张图**不该手工做**（改一次 favicon
 * 就要重新裁四遍、还会漂），所以把"从 SVG 到四张 PNG"固化成脚本，随时可复算。
 *
 * ## 四张图各自的口径（改动前先读这里）
 *
 *   - `pwa-192` / `pwa-512`（清单图标）—— **ratio = 1**：原样渲染，四角保留 SVG 自带的
 *     圆角与透明。理由：它们要与站点 favicon 长得**一模一样**，一致性优先于"让系统去补角"。
 *   - `pwa-maskable-512` —— **ratio = 0.64**：安卓会把 maskable 图标按厂商形状裁切
 *     （圆 / 方 / 水滴），关键内容必须落在**中心 80% 直径的圆**内。0.64 × 512 ≈ 328px，
 *     其外接圆直径 ≈ 464px；剪掉的是四角那圈**同色底**，图形本身（三行条居中）无损。
 *   - `apple-touch-icon`（180）—— **ratio = 0.78** + 满幅不透明底：iOS **不支持透明**，
 *     透明区会变黑；且 iOS 自己会加 ~22% 圆角，所以图形要往里收一圈才不被啃到。
 *
 * 底色的两个用途（满幅底 / maskable 底）都取 favicon 的品牌色，与
 * `tailwind.config.ts` 的 `brand` 同值 —— 三处必须一致，见该文件的注释。
 *
 * ## 为什么用 sharp
 *
 * 它是唯一能在本机把 SVG 栅格化的现成工具（无需开浏览器）。`density` 必须显式给：
 * 默认 72 DPI 下 64pt 的 viewBox 只有 64px，放大到 512 会糊成一片。
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SRC = path.join(PUBLIC, 'favicon.svg');

/** 品牌色（= favicon 的底 / `tailwind.config.ts` 的 `brand`） */
const BRAND = '#534AB7';
/** SVG 栅格化密度：64pt viewBox × 600/72 ≈ 533px，够 512 档 */
const DENSITY = 600;

/** `ratio = 1` 直接渲染；`< 1` 先缩到 `size × ratio` 再居中叠到满幅纯色底上 */
async function render(svg, size, ratio) {
  const inner = Math.round(size * ratio);
  const art = await sharp(svg, { density: DENSITY })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  if (inner === size) return art;
  return sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toBuffer();
}

const TARGETS = [
  { file: 'pwa-192.png', size: 192, ratio: 1, note: '清单图标' },
  { file: 'pwa-512.png', size: 512, ratio: 1, note: '清单图标（大）' },
  { file: 'pwa-maskable-512.png', size: 512, ratio: 0.64, note: 'maskable：满幅底 + 安全区缩进' },
  { file: 'apple-touch-icon.png', size: 180, ratio: 0.78, note: 'iOS 主屏（不可透明）' },
];

const svg = await readFile(SRC);
for (const t of TARGETS) {
  const out = path.join(PUBLIC, t.file);
  await writeFile(out, await render(svg, t.size, t.ratio));
  const { size } = await stat(out);
  console.log(`✓ ${t.file}  ${t.size}×${t.size}  ratio=${t.ratio}  ${(size / 1024).toFixed(1)} KB  —— ${t.note}`);
}
console.log('\n图标已生成到 public/；改 favicon.svg 后重跑 `npm run icons`。');
