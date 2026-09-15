/**
 * 契约层：`ApiClient` + `DataScope`（设计文档 §5）。
 *
 * **这是整个应用唯一的边界。** Mock 与后期的 Http Adapter 都实现同一接口；
 * 业务代码只依赖本文件的类型，因此「换后端」的改动面 = 1 个文件（`api/index.ts`）。
 *
 * 铁律：本文件只定义形状，**不含任何实现**。
 */
import type { Cycle, GainKind } from '../domain/enums';
import type {
  BountyDb,
  BootstrapPayload,
  CheckLog,
  CheckState,
  Item,
  ItemDraft,
  ItemOverrides,
  Meta,
  Profile,
  ProfileDraft,
  Session,
  SoulsDb,
  User,
  UserDataBundle,
  ViewPrefs,
  YuhunDb,
} from './types';

/**
 * 数据作用域：因为「用户」与「游戏档案」是两层，
 * 所有用户数据接口都需要**两个**寻址参数。
 *
 * 为什么显式带 `userId` 而不是只传 `profileId`：Http Adapter 虽能从 token 解出 userId，
 * 但显式传参让 Mock 与 Http 行为完全一致，且服务端可直接校验越权。
 * **现在看着冗余，等接登录时它就是必需品 —— 现在传，是为了以后不改调用点。**
 */
export interface DataScope {
  userId: string;
  profileId: string;
}

export interface ApiClient {
  /* ── 系统 ── */
  getMeta(): Promise<Meta>;
  /** 首屏唯一入口：一次拿全「今日」渲染所需（§3.3） */
  getBootstrap(scope: DataScope): Promise<BootstrapPayload>;

  /* ── 条目（主数据，只读）── */
  listItems(q?: { cycle?: Cycle; kind?: GainKind; dow?: number }): Promise<Item[]>;
  getItem(id: string): Promise<Item | null>;

  /* ── 工具模块（懒加载，S6）── */
  getYuhun(): Promise<YuhunDb>;
  getBounty(): Promise<BountyDb>;
  getSouls(): Promise<SoulsDb>;

  /* ── 用户与鉴权 ── */
  getSession(): Promise<Session>;
  updateUser(id: string, patch: Partial<User>): Promise<User>;

  /* ── 游戏档案（大号 / 小号）── */
  /** 返回该用户**全部**档案（含已归档，按 sort 升序）；「归档不出现」是 UI 层的过滤规则 */
  listProfiles(userId: string): Promise<Profile[]>;
  createProfile(userId: string, input: ProfileDraft): Promise<Profile>;
  updateProfile(id: string, patch: Partial<Profile>): Promise<Profile>;
  /** 连带删除该档案全部用户数据；带 scope 供服务端校验越权（E-04） */
  deleteProfile(scope: DataScope, id: string): Promise<void>;
  /** 只换档案，不涉及登录 */
  switchProfile(profileId: string): Promise<Session>;

  /* ── 用户数据（全部按 scope 定址）── */
  getState(scope: DataScope): Promise<CheckState>;
  /** 增量写入：`at = null` 表示取消勾选。不做整表重写（E-02） */
  setChecked(scope: DataScope, itemId: string, at: number | null): Promise<void>;
  /** 取消指定条目的勾选（K7：必传，不允许省略） */
  clearChecked(scope: DataScope, itemIds: string[]): Promise<void>;
  /** 清空本档案全部勾选（K7：独立方法，避免"漏传参数 = 清全库"） */
  clearAllChecked(scope: DataScope): Promise<void>;
  /**
   * 勾选日志整表落盘（2026-09-15）：日志在勾选时按内存态整体重算一次，
   * 体积小（90 天 × 每日若干 id）、频率与勾选一致，不需要增量协议。
   * 读路径走 `getBootstrap` 的 `log` 字段 —— 与 `state` 同一个首屏入口。
   */
  saveCheckLog(scope: DataScope, log: CheckLog): Promise<void>;
  getView(scope: DataScope): Promise<ViewPrefs>;
  saveView(scope: DataScope, view: ViewPrefs): Promise<void>;
  getOverrides(scope: DataScope): Promise<ItemOverrides>;
  saveOverrides(scope: DataScope, ov: ItemOverrides): Promise<void>;

  /* 条目增删（语义封装，内部改写 overrides） */
  addCustomItem(scope: DataScope, draft: ItemDraft): Promise<Item>;
  removeCustomItem(scope: DataScope, itemId: string): Promise<void>;
  hideItem(scope: DataScope, itemId: string): Promise<void>;
  restoreItem(scope: DataScope, itemId: string): Promise<void>;
  resetItemLibrary(scope: DataScope): Promise<void>;
  saveOrder(scope: DataScope, order: string[]): Promise<void>;

  /* ── 导入导出（S7）── */
  exportUserData(scope: DataScope): Promise<UserDataBundle>;
  importUserData(scope: DataScope, bundle: UserDataBundle): Promise<void>;
}
