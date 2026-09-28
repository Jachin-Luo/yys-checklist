import { useState } from 'react';
import Icon from '../icons/Icon';
import SettingRow from '../common/SettingRow';
import { btn, tx } from '../common/controls';
import { copyText } from '../../services/clipboard';

/**
 * 「设置 · 关于」下的「联系方式」卡片（2026-09-28 用户要求新增）。
 * 组名「关于」保持两字节奏、卡名另起「联系方式」—— 组名与卡名说同一句话是这一页最容易犯的重复。
 *
 * 两条联系路径：**GitHub 仓库**（提 issue / 看源码 / 追更新）与 **QQ**（当面反馈）。
 * 都做成"一次动作就能用"：
 *   - 链接 `target="_blank"` + `rel="noreferrer noopener"`（外链带 `noopener` 是硬规矩：
 *     不加的话新页面能通过 `window.opener` 反操作本页）；
 *   - QQ 号给一颗**复制**按钮，同时号码本身留在页面上可手动选中（`select-all`）——
 *     复制只是省事，不是唯一出路（剪贴板在非安全上下文要靠服务里的兜底，见 `services/clipboard`）。
 *
 * **平铺不折叠**：两行静态信息，收起来只会多一次点击；也与设置页
 * "能一行说完的平铺、需要展开看的才收"的口径一致。
 */
const REPO_URL = 'https://github.com/Jachin-Luo/yys-checklist';
const REPO_LABEL = 'Jachin-Luo/yys-checklist';
const QQ = '407994173';

export default function AboutSection() {
  const [copied, setCopied] = useState(false);

  const copyQQ = async () => {
    /* 复制失败就什么都不说 —— 不能报一个假的"已复制" */
    if (!(await copyText(QQ))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <SettingRow
      title="联系方式"
      desc="条目纠错、功能建议、发现 bug，都可以走这两条路"
      control={<span className={`${tx.note} text-ink-3`}>作者</span>}
    >
      {/* 与「数据版本」同一套只读键值表（`.dlist`）：键定宽在左、值在右 */}
      <dl>
        <div className="flex items-center gap-3.5 border-b border-line-faint py-2">
          <dt className={`w-32 flex-none ${tx.label} text-ink-2`}>GitHub 仓库</dt>
          <dd className="min-w-0 flex-1">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              title="在新标签页打开仓库"
              className={`inline-flex max-w-full items-center gap-1 ${tx.mono} text-ticket transition-colors duration-120 hover:text-gold-hi`}
            >
              <span className="truncate">{REPO_LABEL}</span>
              {/* `go` = "跳去别的页"（与 chevron 的"展开"分工不同，见 sprite 注释） */}
              <Icon name="go" size={11} className="flex-none" />
            </a>
          </dd>
        </div>

        <div className="flex items-center gap-3.5 py-2">
          <dt className={`w-32 flex-none ${tx.label} text-ink-2`}>联系 QQ</dt>
          <dd className="flex min-w-0 flex-1 items-center gap-2">
            <span className={`select-all ${tx.mono} text-ink-2`}>{QQ}</span>
            <button
              type="button"
              onClick={() => void copyQQ()}
              title="复制 QQ 号"
              className={`${btn.base} ${btn.sm} ${btn.out}`}
            >
              {copied ? '已复制' : '复制'}
            </button>
          </dd>
        </div>
      </dl>
    </SettingRow>
  );
}
