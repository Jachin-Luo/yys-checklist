/**
 * Http Adapter（本期**不实现**，留空壳 + TODO —— 设计文档 §5.4）。
 *
 * 接后端时的改动清单：
 *   1. 实现本文件 `implements ApiClient`（把每个方法映射到 REST 端点）；
 *   2. 改 `src/api/index.ts` 的选择分支（环境变量 `VITE_API_MODE=http`）；
 *   3. 配 `VITE_API_BASE_URL`。
 *
 * **业务代码改动：0 行。** 这是检验架构是否成功的唯一标准。
 *
 * 端点对应（参考）：
 *   getBootstrap      → GET  /api/bootstrap?profileId=…（服务端一次聚合，避免移动网络下多次往返）
 *   setChecked        → PUT  /api/profiles/:profileId/checked/:itemId  { at }
 *   clearChecked      → DELETE /api/profiles/:profileId/checked  { itemIds }
 *   clearAllChecked   → DELETE /api/profiles/:profileId/checked/all
 *   listProfiles 等   → 同名 REST 资源，**签名不变**
 */
import type { ApiClient } from '../contract';

const NOT_IMPLEMENTED = 'Http Adapter 本期未实现：请使用 VITE_API_MODE=mock';

/** 后期实现时替换本类；在此之前仅作类型占位，保证 `api/index.ts` 的切换分支可编译 */
export class HttpApi implements ApiClient {
  readonly baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // TODO(S2 之后 / M2)：实现全部 ApiClient 方法，并跑与 Mock 相同的一套契约单测
  }

  private fail(): never {
    throw new Error(NOT_IMPLEMENTED);
  }

  getMeta = async () => this.fail();
  getBootstrap = async () => this.fail();
  listItems = async () => this.fail();
  getItem = async () => this.fail();
  getYuhun = async () => this.fail();
  getBounty = async () => this.fail();
  getSouls = async () => this.fail();
  getSession = async () => this.fail();
  updateUser = async () => this.fail();
  listProfiles = async () => this.fail();
  createProfile = async () => this.fail();
  updateProfile = async () => this.fail();
  deleteProfile = async () => this.fail();
  switchProfile = async () => this.fail();
  getState = async () => this.fail();
  setChecked = async () => this.fail();
  clearChecked = async () => this.fail();
  clearAllChecked = async () => this.fail();
  getView = async () => this.fail();
  saveView = async () => this.fail();
  getOverrides = async () => this.fail();
  saveOverrides = async () => this.fail();
  addCustomItem = async () => this.fail();
  removeCustomItem = async () => this.fail();
  hideItem = async () => this.fail();
  restoreItem = async () => this.fail();
  resetItemLibrary = async () => this.fail();
  saveOrder = async () => this.fail();
  exportUserData = async () => this.fail();
  importUserData = async () => this.fail();
}
