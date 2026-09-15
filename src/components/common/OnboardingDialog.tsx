import { useMemo, useState } from 'react';
import { Check, Clock, UserRound } from 'lucide-react';
import { guildTimeTargets } from '../../domain/guildTime';
import { useDevicePrefs } from '../../hooks/useDevicePrefs';
import { useModalFocus } from '../../hooks/useModalFocus';
import { useDeviceStore } from '../../stores/device';
import { useItemStore } from '../../stores/items';
import { useSessionStore } from '../../stores/session';

const STEPS = ['选择档案', '配置寮时间', '开始自查'] as const;

const btnGhost =
  'cursor-pointer rounded-sm border border-line px-3 py-1.5 text-sm text-ink-2 transition-colors duration-120 hover:border-ink-4';
const btnPrimary =
  'cursor-pointer rounded-sm bg-brand px-3 py-1.5 text-sm text-white transition-colors duration-120 hover:bg-brand-deep';

/**
 * 冷启动三步引导（设计文档 §9 S4b-2 / K6）。
 *
 * 触发条件：设备级标记 `yys:onboarded` 缺失 **且** 首屏数据已就绪。
 * 「首日默认只显示高痛感条目」在第三步由**用户自己选**（因为这是对持久偏好的写入，
 * 不能替用户决定）—— 这正是 K6 与「默认门槛」两件事的交点。
 */
export default function OnboardingDialog() {
  const hydrated = useDeviceStore((s) => s.hydrated);
  const onboarded = useDeviceStore((s) => s.onboarded);
  const markOnboarded = useDeviceStore((s) => s.markOnboarded);
  const items = useItemStore((s) => s.items);
  const session = useSessionStore((s) => s.session);
  const profiles = useSessionStore((s) => s.profiles);
  const switchProfile = useSessionStore((s) => s.switchProfile);
  const { guildTime, setGuildTime } = useDevicePrefs();
  const [step, setStep] = useState(0);

  const targets = useMemo(() => guildTimeTargets(items), [items]);
  /* 弹层焦点管理。**不传 onEscape**：按一下 Esc 就静默跳过引导、还写掉 `onboarded` 标记，代价太大。
     `open` 必须显式传 —— 未打开时组件会 `return null`，effect 不会重跑，焦点就永远移不进来 */
  const ref = useModalFocus(hydrated && !onboarded && items.length > 0);

  if (!hydrated || onboarded || !items.length) return null;

  /* 引导只写设备级「已引导」标记。2026-09-15 起痛感只作默认排序键 ——
     原先第三步"首屏显示范围（只看高痛感 / 全部）"的持久偏好写入已移除 */
  const finish = () => markOnboarded();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-6">
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="冷启动引导"
        className="flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
      >
        <header className="flex items-center gap-2 border-b border-line-faint px-4 py-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-sm text-white">
            {step + 1}
          </span>
          <h2 className="flex-1 text-xl font-medium text-ink">{STEPS[step]}</h2>
          <span className="text-sm text-ink-3">
            {step + 1} / {STEPS.length}
          </span>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {step === 0 ? (
            <div>
              <p className="flex items-center gap-1.5 text-sm text-ink-3">
                <UserRound size={13} />
                勾选状态按「游戏档案」隔离 —— 大号和小号各记各的，互不干扰。
              </p>
              <div className="mt-2.5 space-y-1.5">
                {profiles.map((p) => {
                  const active = p.id === session?.profileId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void switchProfile(p.id)}
                      className={`flex w-full cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors duration-120 ${
                        active ? 'border-brand bg-brand-soft' : 'border-line hover:border-ink-4'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-lg text-ink">{p.name}</span>
                      <span className="text-sm text-ink-3">
                        {[p.server, p.channel].filter(Boolean).join(' · ') || '未填区服'}
                      </span>
                      {active ? <Check size={14} className="text-brand" /> : null}
                    </button>
                  );
                })}
              </div>
              {profiles.length <= 1 ? (
                <p className="mt-2 text-sm leading-relaxed text-ink-3">
                  目前只有这一个档案。要加大号 / 小号，去「我的 → 档案」新建即可。
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <p className="flex items-center gap-1.5 text-sm text-ink-3">
                <Clock size={13} />
                这些是集体活动，时间由所在寮决定（写死必然错）。先填你寮的时间，之后可改。
              </p>
              <div className="mt-2.5">
                {targets.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 border-b border-line-faint py-2 last:border-0">
                    <span className="min-w-0 flex-1 truncate text-lg text-ink">{it.name}</span>
                    <span className="flex-none text-sm text-ink-3">参考 {it.time ?? '—'}</span>
                    <input
                      type="time"
                      aria-label={`${it.name} 的寮时间`}
                      value={guildTime[it.id] ?? ''}
                      onChange={(e) => setGuildTime(it.id, e.target.value)}
                      className="w-28 flex-none rounded-sm border border-line bg-surface px-2 py-1 text-lg text-ink focus:border-brand"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-2 text-sm text-ink-3">留空也可以，之后在「我的 → 寮时间」里再配。</p>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <p className="text-base leading-relaxed text-ink-2">
                点条目卡片的<b>任意位置</b>即可勾选；一键日常入口会<b>连带</b>把它覆盖的条目一起勾上，
                再点一次则一并取消。
              </p>
              <p className="mt-2 text-base leading-relaxed text-ink-2">
                清单默认按<b>痛感分</b>排序（越不可重复、越有截止越靠前），
                想自己排顺序就到「我的 → 条目管理」拖动调整。
              </p>
              <div className="mt-3">
                <button type="button" onClick={finish} className={btnPrimary}>
                  开始使用
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="flex items-center gap-2 border-t border-line-faint px-4 py-3">
          <button type="button" onClick={() => markOnboarded()} className={`${btnGhost} mr-auto`}>
            跳过引导
          </button>
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} className={btnGhost}>
              上一步
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => setStep(step + 1)} className={btnPrimary}>
              下一步
            </button>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
