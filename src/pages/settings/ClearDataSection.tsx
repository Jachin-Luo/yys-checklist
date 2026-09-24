import { useMemo, useState } from 'react';
import CollapsibleSection from '../../components/common/CollapsibleSection';
import { btn } from '../../components/common/controls';
import { dayKey, idsLoggedOn, LOG_KEEP_DAYS } from '../../domain/checkLog';
import { useCheckStore } from '../../stores/check';
import { useUiStore } from '../../stores/ui';

/**
 * 「清空记录」（2026-09-24 用户要求）：**清空当天 / 清空全部**。
 *
 * ## 清空的范围：只动勾选与日志
 *
 * 这一节**不碰**账号、视图偏好、自建条目、寮时间、寄养计划 —— 它们各有自己的入口
 * （账号的删除在「账号」组、条目库的「恢复默认条目库」、寮时间的「清空配置」）。
 * 把"清空数据"做成一键恢复出厂会很危险，而且那些数据本来就有更精确的归零方式。
 *
 * ## 「清空当天」为什么是拿日志当依据
 *
 * 日志（`log.days['YYYY-MM-DD']`）记的正是"那天勾了什么"，是同一份用户数据的历史面。
 * 所以清空当天 = 把当天日志里的 id 交给 `setMany(ids, null)` ——
 * 该函数在日志侧走的既有规则是「取消勾选按**该条目的周期起点**回退」，
 * 于是本周期之外的历史记录自动保留（昨天那次不会被今天抹掉）。
 * **零新增状态逻辑**：新功能只是既有原语的一次组合。
 *
 * 为什么不去猜 `checked` 里的时间戳窗口：那要重新定义"今天从几点开始"
 * （`resetHour` 与自然日是两个口径），而日志已经把这件事回答过了 —— 别维护第二份真相。
 *
 * ## 两颗按钮为什么都是细描边而不是实心朱红渐变
 *
 * 最危险的动作**不该是全页最抢眼的那一颗**。实心朱红渐变在本项目里是"主行动"的造型
 * （`.btn.pri`），拿它装"清空全部"等于把破坏性动作包装成推荐动作。
 * 所以两颗都用 `btn.danger`（细朱红描边），把权重交给**二次确认弹窗**里的文字 ——
 * 说明白清掉多少项、影响哪些页面，比把按钮画得更红有用。
 *
 * ## 为什么收在折叠区里
 *
 * 用 `CollapsibleSection` + `tone="danger"`：默认收起，避免在设置页滚动时误触；
 * 而朱红边框 + 朱红标题让它在扫描时就能被认出是危险区（这个 `tone` 分支本来就是
 * 为"清空勾选"预留的，见该组件的注释）。
 */
export default function ClearDataSection() {
  const checked = useCheckStore((s) => s.checked);
  const log = useCheckStore((s) => s.log);
  const setMany = useCheckStore((s) => s.setMany);
  const clearAll = useCheckStore((s) => s.clearAll);
  const askConfirm = useUiStore((s) => s.askConfirm);
  const [busy, setBusy] = useState(false);

  const today = dayKey(new Date());
  const todayIds = useMemo(() => idsLoggedOn(log, today), [log, today]);
  /** 当前周期内已完成的条目数（`checked` 只保留本周期，过期项已被 mergeChecked 滤掉） */
  const doneCount = Object.keys(checked).length;
  const logDays = Object.keys(log).length;

  const clearToday = async () => {
    const ok = await askConfirm({
      title: '清空今天的记录',
      body:
        `将把今天勾选的 ${todayIds.length} 项退回未完成，并删掉今天在统计页的日历痕迹` +
        `（近 N 天收益会随之少算这一天）。其它日子与其它周期的记录不受影响。` +
        `此操作不可撤销。`,
      confirmLabel: '清空今天',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await setMany(todayIds, null);
    } finally {
      setBusy(false);
    }
  };

  const clearEverything = async () => {
    const ok = await askConfirm({
      title: '清空全部记录',
      body:
        `将清空当前 ${doneCount} 项勾选，以及最近 ${LOG_KEEP_DAYS} 天的勾选日志` +
        `（统计页的日历与「近 N 天收益」会一并归零）。` +
        `账号、界面偏好、自建条目与寮时间都不受影响。` +
        `此操作不可撤销 —— 建议先在「数据备份」里导出一份。`,
      confirmLabel: '全部清空',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await clearAll();
    } finally {
      setBusy(false);
    }
  };

  return (
    <CollapsibleSection
      title="清空记录"
      tone="danger"
      summary={`今天已记 ${todayIds.length} 项 · 当前完成 ${doneCount} 项 · 日志 ${logDays} 天`}
    >
      <div className="px-3 py-3">
        <p className="text-sm leading-relaxed text-ink-3">
          只作用于<b className="text-ink-2">勾选与日志</b>。账号、偏好、自建条目与寮时间各有自己的
          重置入口，不会跟着一起没。
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !todayIds.length}
            onClick={() => void clearToday()}
            className={`${btn.base} ${btn.sm} ${btn.danger}`}
          >
            清空今天（{todayIds.length} 项）
          </button>
          <button
            type="button"
            disabled={busy || !doneCount}
            onClick={() => void clearEverything()}
            className={`${btn.base} ${btn.sm} ${btn.danger}`}
          >
            清空全部（{doneCount} 项）
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          清空不可撤销。想留底就先在「数据备份」导出一份 —— 那份 JSON 可以把勾选与日志原样带回来。
        </p>
      </div>
    </CollapsibleSection>
  );
}
