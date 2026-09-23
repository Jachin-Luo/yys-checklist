import Icon from '../icons/Icon';
import { useCheckStore } from '../../stores/check';
import { useDeviceStore } from '../../stores/device';
import { useGuildTimeStore } from '../../stores/guildTime';
import { useItemStore } from '../../stores/items';
import { useNurtureStore } from '../../stores/nurture';
import { useViewStore } from '../../stores/view';

export default function SaveErrorNotice() {
  const checkError = useCheckStore((s) => s.error);
  const deviceError = useDeviceStore((s) => s.error);
  const guildTimeError = useGuildTimeStore((s) => s.error);
  const itemError = useItemStore((s) => s.error);
  const nurtureError = useNurtureStore((s) => s.error);
  const viewError = useViewStore((s) => s.error);
  const error =
    checkError ?? deviceError ?? guildTimeError ?? itemError ?? nurtureError ?? viewError;
  if (!error) return null;

  const dismiss = () => {
    useCheckStore.setState({ error: null });
    useDeviceStore.setState({ error: null });
    useGuildTimeStore.setState({ error: null });
    useItemStore.setState({ error: null });
    useNurtureStore.setState({ error: null });
    useViewStore.setState({ error: null });
  };

  return (
    <div
      role="alert"
      className="fixed inset-x-3 bottom-24 z-50 flex items-start gap-2 rounded-md border border-crimson-soft bg-crimson-faint px-3 py-2 text-sm text-crimson shadow-panel md:inset-x-auto md:bottom-4 md:right-4 md:max-w-md"
    >
      <span className="min-w-0 flex-1 break-words">
        {'\u4fdd\u5b58\u5931\u8d25\uff1a'}{error.message}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label={'\u5173\u95ed\u4fdd\u5b58\u9519\u8bef\u63d0\u793a'}
        title={'\u5173\u95ed\u63d0\u793a'}
        className="flex h-6 w-6 flex-none items-center justify-center rounded-sm hover:bg-surface"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
