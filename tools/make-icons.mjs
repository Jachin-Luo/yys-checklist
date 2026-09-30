/**
 * 生成 PWA 图标（PNG）—— `npm run icons`。
 *
 * ## 图样 = 品牌朱印（2026-09-30 换图）
 *
 * 初版用的是站点 favicon（靛紫底 + 三行勾选框）。用户在安卓真机上装过之后要求换成
 * **页面左上角那枚品牌朱印**（`components/ornament` 的 `Sigil`：朱红径向渐变 + 米白衬线「囤」）——
 * 主屏上那枚图标就是应用门面，该与应用内的品牌一致。
 *
 * ⚠️ 所以这里**不再读 `favicon.svg`**：朱印在页面里是"CSS 径向渐变 + 字体汉字"，从来不是一张图。
 * 本脚本按 `theme.css` 的 `.genso-sigil` 与 `Sigil` 组件的参数**重建**等价 SVG ——
 * 改样式时对着那两处改，别在这里另发明一套：
 *   - 底：径向渐变，圆心 32% 18%，`--c-seal-hi #A82127` → `--c-seal #C1272D`（62% 处停）；
 *   - 字：「囤」，衬线粗体（`Songti SC` / `SimSun`），`--c-on-crimson #FDF3EE`；
 *   - 圆角按 `rounded-sm` 折成 12/64。
 *
 * ## 四张图各自的口径
 *
 *   - `pwa-192` / `pwa-512`（清单图标）—— **ratio = 1**：印即图，满幅带圆角；
 *   - `pwa-maskable-512` —— **ratio = 0.72**：安卓按厂商形状裁切（圆 / 方 / 水滴），
 *     关键内容须落在**中心 80% 直径的圆**内，故把整枚印缩小居中、四边补 `--c-seal` 底；
 *   - `apple-touch-icon`（180）—— **ratio = 0.86** + 满幅不透明底：iOS 不支持透明（会变黑），
 *     且它自己加 ~22% 圆角，印要往里收一圈才不被啃到。
 *
 * ## 依赖系统字体，所以带自检
 *
 * 汉字靠系统衬线字体栅格化。渲染后脚本会**量一遍每张图里"字"的包围盒**并打印 ——
 * 判断"居没居中、有没有越界"不靠肉眼看图（这正是本项目的纪律：视觉结论要有可复算的依据）。
 * 若字体缺失（只剩一片红底）、或字偏出安全区，这里会直接暴露。
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');

/** 品牌印的底色（= `--c-seal`，maskable / apple 的满幅底与四边补色都用它） */
const SEAL = '#C1272D';
/** SVG 栅格化密度：64pt viewBox × 600/72 ≈ 533px，够 512 档 */
const DENSITY = 600;

/** 与 `Sigil` + `.genso-sigil` 等价的图样（见文件头：改样式时对着那两处改） */
const SIGIL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="seal" cx="32%" cy="18%" r="120%">
      <stop offset="0%" stop-color="#A82127"/>
      <stop offset="62%" stop-color="${SEAL}"/>
    </radialGradient>
  </defs>
  <rect width="64" height="64" rx="12" fill="url(#seal)"/>
  <text x="32" y="32" text-anchor="middle" dominant-baseline="central"
        font-family="'Songti SC','SimSun','Noto Serif SC',serif"
        font-size="40" font-weight="700" fill="#FDF3EE">囤</text>
</svg>`;

/** `ratio = 1` 直接渲染；`< 1` 先缩到 `size × ratio` 再居中叠到满幅纯色底上 */
async function render(svg, size, ratio) {
  const inner = Math.round(size * ratio);
  const art = await sharp(Buffer.from(svg), { density: DENSITY })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  if (inner === size) return art;
  return sharp({
    create: { width: size, height: size, channels: 4, background: SEAL },
  })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toBuffer();
}

/**
 * 量出"字色像素"（米白，三通道均 > 200）的包围盒 —— 底色是朱红，不会误判。
 * 返回画布占比，用于判断居中与安全区，不靠看图。
 */
async function glyphBox(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const cx = (minX + maxX) / 2 / width;
  const cy = (minY + maxY) / 2 / height;
  return {
    /** 字形外接框占画布的边长比 */
    cover: Math.max((maxX - minX) / width, (maxY - minY) / height),
    /** 字形中心相对画布中心的偏移（0 = 正中） */
    offX: cx - 0.5,
    offY: cy - 0.5,
  };
}

const TARGETS = [
  { file: 'pwa-192.png', size: 192, ratio: 1, note: '清单图标' },
  { file: 'pwa-512.png', size: 512, ratio: 1, note: '清单图标（大）' },
  { file: 'pwa-maskable-512.png', size: 512, ratio: 0.72, note: 'maskable：满幅朱底 + 印缩进安全区' },
  { file: 'apple-touch-icon.png', size: 180, ratio: 0.86, note: 'iOS 主屏（不可透明）' },
];

for (const t of TARGETS) {
  const out = path.join(PUBLIC, t.file);
  const png = await render(SIGIL_SVG, t.size, t.ratio);
  await writeFile(out, png);
  const { size } = await stat(out);
  const box = await glyphBox(png);
  const shape = box
    ? `字形 ${(box.cover * 100).toFixed(0)}% · 偏移 ${(box.offX * 100).toFixed(1)}% / ${(box.offY * 100).toFixed(1)}%`
    : '⚠️ 没找到字形（字体缺失？）';
  console.log(
    `✓ ${t.file.padEnd(22)} ${t.size}×${t.size}  ratio=${t.ratio}  ${(size / 1024).toFixed(1)} KB  ${shape}  —— ${t.note}`,
  );
}
console.log('\n图标已生成到 public/。图样是品牌朱印，改样式请改 `Sigil` / `.genso-sigil` 后重跑。');
