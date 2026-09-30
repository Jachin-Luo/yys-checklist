import { useMemo, useState } from 'react';
import Icon from '../../components/icons/Icon';
import ChecklistItem from '../../components/common/ChecklistItem';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import Segmented from '../../components/common/Segmented';
import SettingRow from '../../components/common/SettingRow';
import { tx } from '../../components/common/controls';
import {
  CARD_FIELDS,
  CARD_PRESETS,
  CARD_SCOPES,
  hiddenFieldCount,
  matchPreset,
  type CardPresetKey,
} from '../../domain/cardDisplay';
import type { Cycle } from '../../domain/enums';
import { useCardDisplay, type CardScope } from '../../hooks/useCardDisplay';
import { useItemStore } from '../../stores/items';
import { useViewStore } from '../../stores/view';

/**
 * 「设置 · 卡片显示字段」（2026-09-16 用户需求；2026-09-23 随设置页重构改形态；
 * **2026-09-30 起按页面四套**）。
 *
 * 控制**每张清单卡片里显示哪些字段**。默认口径是"全部显示"（= 引入本功能前的观感），
 * 嫌卡片太高的人可以切「简要」去掉三行长文本，或切「极简」只留名称 ——
 * 「打开就打卡」时一屏能扫到最多条目。
 *
 * ## 为什么按页面分开设（2026-09-30 用户需求）
 *
 * 原话："今日 / 本周 / 本月 / 限时分别设置，有时候会出现每日想简要看、限时活动详细看的情况。"
 * 一个开关管四页，等于逼用户为最啰嗦的那一页设一个全局值 —— 而四页的读法本来就不同：
 * 今日是"打卡流水"（扫得快最重要），限时是"这批活动还剩几天、条件是什么"（越全越好）。
 *
 * ## 版面：**一张卡 + 一个折叠**（页签与档位必须同处一卡）
 *
 * 拆页面维度时我一度把它做成了**两张卡**（上卡放页签、下卡放档位），用户当即指出"太分离"——
 * 对：**预设只是"一次设六项"的快捷键，不是独立模式**（见 `domain/cardDisplay` 顶部），
 * 而"改哪一页"与"这一页要多详细"更是同一件事的两层限定。拆成两张卡会让人以为它们是两件
 * 可以各自为政的事。现在的落点是：
 *
 *   1. `SettingRow` 的右侧控件位 —— **三档预设**（高频动作，回到它原来的位置）；
 *   2. 同一张卡的 `children`（行下方）—— **页面页签**，带一个"作用页面"小标签。
 *      `SettingRow` 的 `children` 本来就是给"与标题同属一个信息单元"的附属内容准备的
 *      （原始用例是「数据版本」的键值明细）；
 *   3. 低频的逐项微调与预览仍收在折叠里（展开约 560px）。
 *
 * 两处控件都读**同一份** `card`（`useCardDisplay(scope)`），所以档位、逐项开关、预览
 * 三者不可能对不上；切页签时三处一起换，这也正是把页签留在卡内的原因。
 *
 * ## 一条不变的设计
 *
 * **预设与逐项开关是同一份数据**：改任意一项后 `matchPreset` 返回 null，分段控件
 * **三档都不高亮**（`value={null}`）—— 不会出现"预设说 A、开关说 B"；
 * 把"自定义"错显示成某一档，是这个功能最容易误导人的地方。
 *
 * **预览用真实卡片**（`pointer-events-none`，点不动）：光看开关名字很难想象"关掉备注后
 * 长什么样"。它必须显式传 `cardScope` —— 这时导航停在"设置"页，不传就会拿到今日页那一套。
 *
 * 名称、勾选框、☆ 置顶不可关 —— 理由见 `domain/cardDisplay` 顶部注释。
 */
const SCOPE_LABEL = new Map(CARD_SCOPES.map((s) => [s.key, s.label] as const));

/** 每个清单页对应哪个周期 —— 预览要找"这一页真的会出现"的条目 */
const SCOPE_CYCLE: Record<CardScope, Cycle> = {
  today: 'daily',
  week: 'weekly',
  month: 'monthly',
  limited: 'limited',
};

export default function CardDisplaySection() {
  const setCardDisplay = useViewStore((s) => s.setCardDisplay);
  const items = useItemStore((s) => s.items);
  const [scope, setScope] = useState<CardScope>('today');

  /* 当前页签那一套配置 —— 档位、逐项开关、预览三处都读它，不可能对不上 */
  const card = useCardDisplay(scope);
  const activePreset = matchPreset(card);
  const hidden = hiddenFieldCount(card);
  const preset = CARD_PRESETS.find((p) => p.key === activePreset) ?? null;
  const scopeLabel = SCOPE_LABEL.get(scope) ?? '';

  /* 预览挑"该页信息最全"的那条：只有它才能体现关掉某一项之后卡片变成什么样 */
  const sample = useMemo(() => {
    const cycle = SCOPE_CYCLE[scope];
    const inScope = items.filter((it) => it.cycle === cycle);
    return inScope.find((it) => it.path && it.note && it.gainKind?.length) ?? inScope[0] ?? null;
  }, [items, scope]);

  return (
    <>
      <SettingRow
        title="卡片显示字段"
        /* 说明先说"当前在改哪一页"，再说这一页现在长什么样 ——
           把四页的现状都罗列出来反而看不清自己正在改哪一套 */
        desc={`${scopeLabel}页 · ${
          preset ? preset.desc : `自定义组合 · 已隐藏 ${hidden} 项，逐项开关见下方`
        }`}
        control={
          <Segmented<CardPresetKey>
            label={`${scopeLabel}页的卡片详细程度`}
            value={activePreset}
            onChange={(key) => {
              const next = CARD_PRESETS.find((p) => p.key === key);
              if (next) void setCardDisplay(scope, next.value);
            }}
            options={CARD_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
          />
        }
      >
        {/* 作用页面：与档位同处一卡，说明"上面那组开关在改哪一页" */}
        <div className="flex items-center gap-2.5">
          <span className={`flex-none ${tx.note} text-ink-3`}>作用页面</span>
          <Segmented<CardScope>
            label="卡片显示字段的作用页面"
            value={scope}
            onChange={setScope}
            options={CARD_SCOPES.map((s) => ({ value: s.key, label: s.label }))}
          />
        </div>
      </SettingRow>

      <CollapsibleSection
        title={`逐项调整与预览（${scopeLabel}）`}
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
                  onClick={() => void setCardDisplay(scope, { [f.key]: !on })}
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
                    {/* 字段名与「条目管理 / 账号 / 一键日常」的行名同一档（`tx.rowName`）——
                        此前它是衬线 13px，是设置页里唯一一处衬线行名（2026-09-28 收口） */}
                    <span className={`block ${tx.rowName} ${on ? 'text-ink' : 'text-ink-3'}`}>
                      {f.label}
                    </span>
                    <span className={`mt-0.5 block ${tx.note} text-ink-3`}>{f.desc}</span>
                  </span>
                  <span className={`flex-none ${tx.note} text-ink-3`}>{on ? '显示' : '隐藏'}</span>
                </button>
              );
            })}
          </div>

          {sample ? (
            <div className="mt-3.5">
              <p className={`${tx.label} text-ink-2`}>
                效果预览（{scopeLabel}页的示例条目，点不动）
              </p>
              {/* `pointer-events-none`：预览用真实卡片组件，但它不该能被勾选 / 置顶 ——
                  设置页里点一下就把某条标成已完成，是最让人意外的一类副作用 */}
              <div className="pointer-events-none mt-1.5" aria-hidden="true">
                <ChecklistItem item={sample} cardScope={scope} onToggle={() => undefined} />
              </div>
            </div>
          ) : (
            <p className={`mt-3.5 ${tx.note} text-ink-3`}>
              {scopeLabel}页暂时没有可用来预览的条目。
            </p>
          )}
        </div>
      </CollapsibleSection>
    </>
  );
}
