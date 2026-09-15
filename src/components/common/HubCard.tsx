import type { Item } from '../../api/types';
import { useAutoDaily } from '../../hooks/useAutoDaily';
import { useCheckStore } from '../../stores/check';
import { useUiStore } from '../../stores/ui';
import CheckBox from './CheckBox';
import { FieldIcon } from './ItemField';

/**
 * 一键日常入口卡 —— 紫色高亮、恒排第 0 位（**仅在未完成时**出现；
 * 完成后由今日页放进「已完成」分区，不再常驻顶部）。
 *
 * 排序侧由 `domain/sort.ts` 的**前置特判**保证（不参与痛感分比较，D1）；
 * 勾选侧是**双向级联**：勾选即勾选全部被覆盖项，取消即一并取消（`useAutoDaily.toggleHub`）。
 * 点击整张卡即勾选。
 *
 * 右侧按钮**不再重复勾选动作**（2026-09-15 用户要求）：原文案「去完成」与"点整张卡"效果完全一样，
 * 等于白占一个按钮位 —— 而这一屏真正缺的入口是"改覆盖集合"。现在文案为「去设置」，
 * 点击跳到「我的 · 一键日常覆盖」并自动展开该分区（见 `stores/ui.requestSection`）。
 *
 * 2026-09-11：说明行改用与清单卡片**同一套图标语言**（`ItemField`）——
 * 入口用 📍 蓝、备注用 🗒 灰。同一屏两张卡各用一套符号系统，是上一版最刺眼的不一致。
 * 这边的底色是品牌浅紫（#EEEDFA）而不是卡片白，所以备注值取深一档的 `ink-2`，
 * 保证在彩底上同样满足 AA 正文（`ink-3` 在紫底上只有约 4.47:1，差一点点）。
 */
export default function HubCard({ item }: { item: Item }) {
  const checked = useCheckStore((s) => s.checked[item.id] !== undefined);
  const { toggleHub, coveredCount } = useAutoDaily();
  const requestNav = useUiStore((s) => s.requestNav);
  const label = `${checked ? '取消完成' : '标记完成'}：${item.name}（同时${checked ? '取消' : '勾选'}被覆盖的 ${coveredCount} 项）`;

  return (
    /* `mx-3.5` + 内部 `px-3.5`：与清单卡片的左边界严格对齐（清单容器 px-3.5 + 卡片 px-3.5） */
    <article
      onClick={toggleHub}
      className={`mx-3.5 mt-2.5 flex cursor-pointer items-start gap-2.5 rounded-md border border-brand/30 bg-brand-soft px-3.5 py-3 transition-colors duration-120 hover:border-brand/60 ${
        checked ? 'opacity-45' : ''
      }`}
    >
      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-brand text-white">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
        </svg>
      </span>

      <div className="min-w-0 flex-1">
        <h3 className={`break-words text-lg font-medium text-ink ${checked ? 'line-through' : ''}`}>
          {item.name}
        </h3>

        <p className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
          {item.path ? <FieldIcon kind="path" /> : null}
          <span className="min-w-0 flex-1 break-words text-ink-2">
            {item.path ? <span className="text-ticket">{item.path}</span> : null}
            {item.path ? ' · ' : ''}
            已配置覆盖 {coveredCount} 项
          </span>
        </p>

        {item.note ? (
          <p className="mt-1 flex items-start gap-2 text-sm leading-relaxed">
            <FieldIcon kind="note" />
            <span className="min-w-0 flex-1 break-words text-ink-2">{item.note}</span>
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={(e) => {
          /* 按钮在可点击的 article 内部：必须阻止冒泡，否则会连带触发整卡的勾选 */
          e.stopPropagation();
          requestNav({ nav: 'me', section: 'autoDaily' });
        }}
        title="去「我的」配置被一键日常覆盖的条目"
        className="mt-0.5 flex-none cursor-pointer rounded-sm bg-brand px-2 py-1 text-sm text-white transition-colors duration-120 hover:bg-brand-deep"
      >
        去设置
      </button>

      <CheckBox checked={checked} onToggle={toggleHub} label={label} />
    </article>
  );
}
