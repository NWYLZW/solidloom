import {
  attemptSnackCabinetHack,
  createSnackCabinetOperationsState,
  depositSnackCabinetEntity,
  exchangeSnackCabinetEntities,
  hasSnackCabinetManagementAccess,
  snackCabinetOperationIds,
  withdrawSnackCabinetEntity,
  type SnackCabinetOperationsState,
} from "./operations.js";
import { materialIcon, type MaterialIconName } from "./material-icons.js";

type OperationKind = "deposit" | "exchange" | "hack" | "withdraw";

export interface SnackCabinetOperationsPanelContext {
  nearServicePort?: boolean;
}

function button(label: string, action: OperationKind, icon: MaterialIconName, disabled = false) {
  return `<button type="button" data-operation="${action}"${disabled ? " disabled" : ""}>${materialIcon(icon)}<span>${label}</span></button>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export class SnackCabinetOperationsPanel {
  private actionSequence = 0;
  private readonly root: HTMLElement;
  private state: SnackCabinetOperationsState = createSnackCabinetOperationsState();
  private selectedExternalId = "external-seaweed";
  private selectedMachineId = "machine-oat";
  private nearServicePort: boolean;
  private sessionOpen = true;
  private useMaintenanceKey = true;
  private status = "选择两侧物品，可放入、取出或交换。";
  private statusTone: "danger" | "neutral" | "success" = "neutral";
  private readonly refreshTimer: number;

  constructor(root: HTMLElement, context: SnackCabinetOperationsPanelContext = {}) {
    this.root = root;
    this.nearServicePort = context.nearServicePort ?? true;
    this.root.addEventListener("click", this.onClick);
    this.refreshTimer = window.setInterval(() => this.render(), 1_000);
    this.render();
  }

  dispose() {
    window.clearInterval(this.refreshTimer);
    this.root.removeEventListener("click", this.onClick);
  }

  setInteractionContext(context: SnackCabinetOperationsPanelContext) {
    if (context.nearServicePort !== undefined) this.nearServicePort = context.nearServicePort;
    this.render();
  }

  private nextActionId(prefix: string) {
    this.actionSequence += 1;
    return `preview-${prefix}-${this.actionSequence}`;
  }

  private ownsMaintenanceKey() {
    return this.state.world.entities[snackCabinetOperationIds.maintenanceKey]?.ownerId === snackCabinetOperationIds.actor;
  }

  private credentials() {
    return this.sessionOpen && this.useMaintenanceKey && this.ownsMaintenanceKey()
      ? [snackCabinetOperationIds.maintenanceKey]
      : [];
  }

  private hasManagementSession(now: number) {
    return this.sessionOpen && hasSnackCabinetManagementAccess(this.state, {
      now,
      credentialEntityIds: this.credentials(),
    });
  }

  private isTerminalDiscoverable(now: number) {
    const hasActiveGrant = Object.values(this.state.world.grants).some((grant) => grant.expiresAt > now);
    return this.nearServicePort || this.ownsMaintenanceKey() || hasActiveGrant;
  }

  private accessState(now: number): { icon: MaterialIconName; label: string; tone: string } {
    if (!this.hasManagementSession(now)) return { icon: "lock", label: "需要验证", tone: "locked" };
    if (this.useMaintenanceKey) return { icon: "key", label: "管理模式", tone: "credential" };
    const grant = Object.values(this.state.world.grants).find((candidate) => candidate.expiresAt > now);
    if (!grant) return { icon: "lock", label: "需要验证", tone: "locked" };
    return {
      icon: "schedule",
      label: `临时权限 · ${Math.max(1, Math.ceil((grant.expiresAt - now) / 1_000))} 秒`,
      tone: "temporary",
    };
  }

  private terminalRail() {
    return `
      <div class="terminal-rail" aria-hidden="true">
        <span class="terminal-identity"><i class="terminal-pulse"></i>设备终端 · SNK-01</span>
        <span class="terminal-signal">在线</span>
      </div>
    `;
  }

  private statusMarkup() {
    const statusIcon = this.statusTone === "success" ? "check_circle" : this.statusTone === "danger" ? "error" : "info";
    return `<p class="operation-status ${this.statusTone}" role="status">${materialIcon(statusIcon)}<span>${escapeHtml(this.status)}</span></p>`;
  }

  private entityList(containerId: string, selectedId: string, side: "external" | "machine") {
    const container = this.state.world.containers[containerId];
    if (!container) return "";
    const selectable = container.entityIds
      .map((entityId) => this.state.world.entities[entityId])
      .filter((entity) => entity && entity.tags.includes("stock"));
    if (selectable.length === 0) return '<p class="inventory-empty">这里暂时没有物品</p>';
    return selectable.map((entity) => `
      <button
        class="entity-row${entity!.id === selectedId ? " is-selected" : ""}"
        type="button"
        data-select-side="${side}"
        data-entity-id="${escapeHtml(entity!.id)}"
      >
        <span class="entity-icon" aria-hidden="true">${materialIcon("inventory_2")}</span>
        <span class="entity-copy"><strong>${escapeHtml(entity!.label)}</strong><small>${side === "machine" ? "柜内" : "待放入"}</small></span>
        ${entity!.id === selectedId ? materialIcon("check_circle", "entity-selected-icon") : ""}
      </button>
    `).join("");
  }

  private renderAccessGate(access: ReturnType<SnackCabinetOperationsPanel["accessState"]>) {
    const canUseCredential = this.ownsMaintenanceKey();
    this.root.dataset.mode = "locked";
    this.root.innerHTML = `
      ${this.terminalRail()}
      <header class="operations-header">
        <div class="operations-title">
          <span class="operations-title-icon">${materialIcon("warehouse")}</span>
          <div><h2>库存终端</h2><p>管理售货机中的商品</p></div>
        </div>
        <span class="access-badge ${access.tone}">${materialIcon(access.icon)}<span>${escapeHtml(access.label)}</span></span>
      </header>
      <section class="access-gate">
        <span class="access-gate-icon">${materialIcon("security")}</span>
        <div><h3>库存管理受限</h3><p>请在后侧维护区操作，或使用持有的维护凭证。</p></div>
        <div class="access-gate-actions">
          ${canUseCredential ? `<button type="button" data-activate-key>${materialIcon("key")}<span>使用维护凭证</span></button>` : ""}
          ${button("尝试接入", "hack", "security")}
        </div>
      </section>
      ${this.statusMarkup()}
    `;
  }

  private render() {
    const now = Date.now();
    if (!this.isTerminalDiscoverable(now)) {
      this.root.hidden = true;
      this.root.innerHTML = "";
      return;
    }

    this.root.hidden = false;
    const access = this.accessState(now);
    if (!this.hasManagementSession(now)) {
      this.renderAccessGate(access);
      return;
    }

    this.root.dataset.mode = "active";
    const external = this.state.world.containers[snackCabinetOperationIds.externalContainer];
    const machine = this.state.world.containers[snackCabinetOperationIds.machineContainer];
    const hasExternal = Boolean(external?.entityIds.some((id) => this.state.world.entities[id]?.tags.includes("stock")));
    const hasMachine = Boolean(machine?.entityIds.some((id) => this.state.world.entities[id]?.tags.includes("stock")));

    this.root.innerHTML = `
      ${this.terminalRail()}
      <header class="operations-header">
        <div class="operations-title">
          <span class="operations-title-icon">${materialIcon("warehouse")}</span>
          <div><h2>库存终端</h2><p>管理售货机中的商品</p></div>
        </div>
        <span class="access-badge ${access.tone}">${materialIcon(access.icon)}<span>${escapeHtml(access.label)}</span></span>
      </header>
      <div class="session-strip">
        <span>${materialIcon("lock_open")}<span>已建立管理会话</span></span>
        <button type="button" data-end-session>${materialIcon("logout")}<span>结束</span></button>
      </div>
      <div class="inventory-columns">
        <section aria-label="待处理物品">
          <div class="inventory-heading"><h3>${materialIcon("inventory_2")}<span>待处理物品</span></h3><span>${external?.entityIds.length ?? 0}</span></div>
          <div class="entity-list">${this.entityList(snackCabinetOperationIds.externalContainer, this.selectedExternalId, "external")}</div>
        </section>
        <section aria-label="售货机库存">
          <div class="inventory-heading"><h3>${materialIcon("warehouse")}<span>售货机内</span></h3><span>${machine?.entityIds.length ?? 0}/${machine?.capacity ?? 0}</span></div>
          <div class="entity-list">${this.entityList(snackCabinetOperationIds.machineContainer, this.selectedMachineId, "machine")}</div>
        </section>
      </div>
      <div class="operation-actions">
        ${button("放入", "deposit", "login", !hasExternal)}
        ${button("取出", "withdraw", "logout", !hasMachine)}
        ${button("交换", "exchange", "swap_horiz", !hasExternal || !hasMachine)}
      </div>
      ${this.statusMarkup()}
    `;
  }

  private selectEntity(side: "external" | "machine", entityId: string) {
    if (side === "external") this.selectedExternalId = entityId;
    else this.selectedMachineId = entityId;
    this.render();
  }

  private applyTransaction(
    label: string,
    result: ReturnType<typeof depositSnackCabinetEntity>,
  ) {
    if (!result.transaction.ok) {
      this.status = result.transaction.error.message;
      this.statusTone = "danger";
      this.render();
      return;
    }
    this.state = result.state;
    this.status = `${label}完成，库存已更新。`;
    this.statusTone = "success";
    this.ensureSelections();
    this.render();
  }

  private ensureSelections() {
    const external = this.state.world.containers[snackCabinetOperationIds.externalContainer];
    const machine = this.state.world.containers[snackCabinetOperationIds.machineContainer];
    const nextExternal = external?.entityIds.find((id) => this.state.world.entities[id]?.tags.includes("stock"));
    const nextMachine = machine?.entityIds.find((id) => this.state.world.entities[id]?.tags.includes("stock"));
    if (!external?.entityIds.includes(this.selectedExternalId) && nextExternal) this.selectedExternalId = nextExternal;
    if (!machine?.entityIds.includes(this.selectedMachineId) && nextMachine) this.selectedMachineId = nextMachine;
  }

  private runOperation(operation: OperationKind) {
    const now = Date.now();
    const common = { now, credentialEntityIds: this.credentials() };
    if (operation === "deposit") {
      this.applyTransaction("放入", depositSnackCabinetEntity(this.state, {
        ...common,
        actionId: this.nextActionId("deposit"),
        entityId: this.selectedExternalId,
      }));
      return;
    }
    if (operation === "withdraw") {
      this.applyTransaction("取出", withdrawSnackCabinetEntity(this.state, {
        ...common,
        actionId: this.nextActionId("withdraw"),
        entityId: this.selectedMachineId,
      }));
      return;
    }
    if (operation === "exchange") {
      this.applyTransaction("交换", exchangeSnackCabinetEntities(this.state, {
        ...common,
        actionId: this.nextActionId("exchange"),
        externalEntityId: this.selectedExternalId,
        machineEntityId: this.selectedMachineId,
      }));
      return;
    }

    const hacked = attemptSnackCabinetHack(this.state, {
      actionId: this.nextActionId("hack"),
      now,
      skill: 5,
      roll: 4,
    });
    this.state = hacked.state;
    if (hacked.ok) {
      this.sessionOpen = true;
      this.useMaintenanceKey = false;
      this.status = "接入成功，已获得 45 秒临时管理权限。";
      this.statusTone = "success";
    } else {
      this.status = hacked.reason === "cooldown" ? "安全模块冷却中，请稍后重试。" : "接入失败，设备进入短暂冷却。";
      this.statusTone = "danger";
    }
    this.render();
  }

  private onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const select = target.closest<HTMLElement>("[data-select-side][data-entity-id]");
    if (select) {
      const side = select.dataset.selectSide;
      const entityId = select.dataset.entityId;
      if ((side === "external" || side === "machine") && entityId) this.selectEntity(side, entityId);
      return;
    }
    if (target.closest("[data-end-session]")) {
      this.sessionOpen = false;
      this.useMaintenanceKey = false;
      this.status = "管理会话已结束。";
      this.statusTone = "neutral";
      this.render();
      return;
    }
    if (target.closest("[data-activate-key]")) {
      if (this.ownsMaintenanceKey()) {
        this.sessionOpen = true;
        this.useMaintenanceKey = true;
        this.status = "维护凭证验证通过，库存管理已解锁。";
        this.statusTone = "success";
      }
      this.render();
      return;
    }
    const action = target.closest<HTMLElement>("[data-operation]")?.dataset.operation as OperationKind | undefined;
    if (action) this.runOperation(action);
  };
}
