/**
 * 剪贴板写入（S7 备份导出用）。
 *
 * 为什么要有兜底：`navigator.clipboard` **只在安全上下文可用**（https 或 localhost）。
 * 局域网 http 访问（手机连电脑的 `http://192.168.x.x:5173`）时它是 `undefined`，
 * 直接调会抛错 —— 而这正是"在手机上导出备份"最常见的场景，必须能降级。
 */

/** `document.execCommand('copy')` 兜底：老 API，但在非安全上下文里仍可用 */
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    /* 不能 display:none（那样无法选中），挪出视口即可 */
    ta.style.position = 'fixed';
    ta.style.top = '-2000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) {
    console.error('[clipboard] 兜底复制失败', e);
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.error('[clipboard] Clipboard API 不可用，尝试兜底', e);
  }
  return legacyCopy(text);
}
