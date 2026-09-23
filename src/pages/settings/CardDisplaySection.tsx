import { useMemo } from 'react';
import Icon from '../../components/icons/Icon';
import ChecklistItem from '../../components/common/ChecklistItem';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import Segmented from '../../components/common/Segmented';
import SettingRow from '../../components/common/SettingRow';
import {
  CARD_FIELDS,
  CARD_PRESETS,
  effectiveCardDisplay,
  hiddenFieldCount,
  matchPreset,
  type CardPresetKey,
} from '../../domain/cardDisplay';
import { useItemStore } from '../../stores/items';
import { useViewStore } from '../../stores/view';

/**
 * 「设置 · 卡片显示字段」（2026-09-16 用户需求；2026-09-23 随设置页重构改形态）。
 *
 * 控制**每张清单卡片里显示哪些字段**。默认口径是"全部显示"（= 引入本功能前的观感），
 * 嫌卡片太高的人可以切「简要」去掉三行长文本，或切「极简」只留名称 ——
 * 「打开就打卡」时一屏能扫到最多条目。
 *
 * ## 为什么拆成"一行 + 一个折叠"
 *
 * 上一版整块收在一个折叠卡里，展开后是 3 个预设行 + 6 个逐项行 + 1 张预览卡 ——
 * 大约 560px，是全页最高的一块。但用户真正高频做的只有**切档位**这一件事。
 * 所以现在：**档位平铺成一行分段控件**（一眼可见、一次点击），
 * **逐项微调与预览收进折叠**（低频，但要保留 —— 见下）。
 *
 * ## 两处设计（未变）
 *
 *   1. **预设与逐项开关是同一份数据**：预设只是"一次设六项"的快捷键。改任意一项后
 *      `matchPreset` 返回 null，分段控件**三档都不高亮**（`value={null}`）——
 *      不会出现"预设说 A、开关说 B"；把"自定义"错显示成某一档，是这个功能最容易误导人的地方。
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
  const preset = CARD_PRESETS.find((p) => p.key === activePreset) ?? null;

  /* 预览挑"信息最全"的那条：只有它才能体现关掉某一项之后卡片变成什么样 */
  const sample = useMemo(
    () => items.find((it) => it.path && it.note && it.gainKind?.length) ?? items[0] ?? null,
    [items],
  );

  return (
    <>
      <SettingRow
        title="卡片显示字段"
        /* 说明随选中档位变化：切到哪一档就说清那一档长什么样，
           比罗列三档的描述省一半高度，也不会出现"描述与当前不符" */
        desc={preset ? preset.desc : `自定义组合 · 已隐藏 ${hidden} 项，逐项开关见下方`}
        control={
          <Segmented<CardPresetKey>
            label="卡片显示字段"
            value={activePreset}
            onChange={(key) => {
              const next = CARD_PRESETS.find((p) => p.key === key);
              if (next) void setCardDisplay(next.value);
            }}
            options={CARD_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          />
        }
      />

      <CollapsibleSection
        title="逐项调整与预览"
        summary={
          preset
            ? `当前「${preset.label}」，可再逐项微调`
            : `当前为自定义组合 · 已隐藏 ${hidden} 项`
        }
      >
                <div className="px-3 py-3">
          <div>
            {CARD_FIELDS.map((f) => {
              const on = card[f.key];
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => void setCardDisplay({ [f.key]: !on })}
                  className="flex w-full cursor-pointer items-center gap-2.5 border-b border-line-faint py-2 text-left last:border-0 transition-colors duration-120 hover:bg-surface-3"
                >
                  <span
                    className={`flex h-4 w-4 flex-none items-center justify-center rounded-sm border ${
                      on ? 'border-line bg-gold-soft text-gold-hi' : 'border-line bg-surface'
                    }`}
                  >
                    {on ? <Icon name="check" size={11} /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block font-serif text-base tracking-card ${on ? 'text-ink' : 'text-ink-3'}`}>
                      {f.label}
                    </span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-ink-3">{f.desc}</span>
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
    </>
  );
}
