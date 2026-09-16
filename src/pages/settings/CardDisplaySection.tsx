import { useMemo } from 'react';
import { Check } from 'lucide-react';
import ChecklistItem from '../../components/common/ChecklistItem';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import {
  CARD_FIELDS,
  CARD_PRESETS,
  effectiveCardDisplay,
  hiddenFieldCount,
  matchPreset,
} from '../../domain/cardDisplay';
import { useItemStore } from '../../stores/items';
import { useViewStore } from '../../stores/view';

/**
 * 「我的 · 视图偏好」（2026-09-16 用户需求）。
 *
 * 控制**每张清单卡片里显示哪些字段**。默认口径是"全部显示"（= 引入本功能前的观感），
 * 嫌卡片太高的人可以切「简要」去掉三行长文本，或切「极简」只留名称 ——
 * 「打开就打卡」时一屏能扫到最多条目。
 *
 * 两处设计：
 *
 *   1. **预设与逐项开关是同一份数据**：预设只是"一次设六项"的快捷键。改任意一项后
 *      `matchPreset` 返回 null，UI 就不高亮任何一档 —— 不会出现"预设说 A、开关说 B"；
 *   2. **带真实预览**：用清单里信息最全的那一条渲染一张真卡（`pointer-events-none`，
 *      点不动），所见即所得。光看开关名字很难想象"关掉备注后长什么样"。
 *
 * 名称、勾选框、☆ 置顶不可关 —— 理由见 `domain/cardDisplay` 顶部注释。
 */
export default function CardDisplaySection() {
  const view = useViewStore((s) => s.view);
  const setCardDisplay = useViewStore((s) => s.setCardDisplay);
  const items = useItemStore((s) => s.items);

  const card = effectiveCardDisplay(view.card);
  const activePreset = matchPreset(card);
  const hidden = hiddenFieldCount(card);

  /* 预览挑"信息最全"的那条：只有它才能体现关掉某一项之后卡片变成什么样 */
  const sample = useMemo(
    () => items.find((it) => it.path && it.note && it.gainKind?.length) ?? items[0] ?? null,
    [items],
  );

  return (
    <CollapsibleSection
      title="视图偏好"
      summary={
        hidden
          ? `已隐藏 ${hidden} 项 · ${activePreset ? CARD_PRESETS.find((p) => p.key === activePreset)?.label : '自定义'}`
          : '卡片显示全部信息 · 可精简为只管打卡'
      }
    >
      <div className="bg-surface-3 px-3 py-3">
        <p className="text-sm leading-relaxed text-ink-3">
          决定清单里每张卡片显示哪些内容。关掉<b className="text-ink-2">入口 / 条件 / 备注</b>
          三行长文本后，卡片会矮一大截 —— 只想打个卡时一屏能多看几条。
          条目<b className="text-ink-2">名称</b>与勾选框始终保留。
        </p>
      </div>

      <div className="px-3 py-3">
        <p className="text-sm text-ink-2">预设</p>
        <div className="mt-1.5 space-y-1">
          {CARD_PRESETS.map((p) => {
            const on = activePreset === p.key;
            return (
              <button
                key={p.key}
                type="button"
                aria-pressed={on}
                onClick={() => void setCardDisplay(p.value)}
                className={`flex w-full cursor-pointer items-start gap-2.5 rounded-sm border px-2 py-2 text-left transition-colors duration-120 ${
                  on ? 'border-brand-line bg-brand-soft/50' : 'border-line-faint hover:border-line'
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border ${
                    on ? 'border-brand bg-brand text-white' : 'border-line bg-surface'
                  }`}
                >
                  {on ? <Check size={11} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg text-ink">{p.label}</span>
                  <span className="block text-sm leading-relaxed text-ink-3">{p.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="mt-3.5 text-sm text-ink-2">
          逐项开关{activePreset ? null : <span className="text-ink-3"> · 当前为自定义组合</span>}
        </p>
        <div className="mt-1.5">
          {CARD_FIELDS.map((f) => {
            const on = card[f.key];
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={on}
                onClick={() => void setCardDisplay({ [f.key]: !on })}
                className="flex w-full cursor-pointer items-center gap-2.5 border-b border-line-faint px-1 py-2 text-left last:border-0 transition-colors duration-120 hover:bg-surface-3"
              >
                <span
                  className={`flex h-4 w-4 flex-none items-center justify-center rounded-sm border ${
                    on ? 'border-brand bg-brand text-white' : 'border-line bg-surface'
                  }`}
                >
                  {on ? <Check size={11} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-lg ${on ? 'text-ink' : 'text-ink-3'}`}>{f.label}</span>
                  <span className="block text-sm leading-relaxed text-ink-3">{f.desc}</span>
                </span>
                <span className="flex-none text-sm text-ink-3">{on ? '显示' : '隐藏'}</span>
              </button>
            );
          })}
        </div>

        {sample ? (
          <div className="mt-3.5">
            <p className="text-sm text-ink-2">效果预览（示例条目，点不动）</p>
            {/* `pointer-events-none`：预览用真实卡片组件，但它不该能被勾选 / 置顶 ——
                设置页里点一下就把某条标成已完成，是最让人意外的一类副作用 */}
            <div className="pointer-events-none mt-1.5" aria-hidden="true">
              <ChecklistItem item={sample} onToggle={() => undefined} />
            </div>
          </div>
        ) : null}
      </div>
    </CollapsibleSection>
  );
}
