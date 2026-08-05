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
  private useMaintenanceKey = true;
  private status = "选择两侧实体，可存入、取出或原子交换。";
  private statusTone: "danger" | "neutral" | "success" = "neutral";
  private readonly refreshTimer: number;

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.addEventListener("click", this.onClick);
    this.refreshTimer = window.setInterval(() => this.render(), 1_000);
    this.render();
  }

  dispose() {
    window.clearInterval(this.refreshTimer);
    this.root.removeEventListener("click", this.onClick);
  }

  private nextActionId(prefix: string) {
    this.actionSequence += 1;
    return `preview-${prefix}-${this.actionSequence}`;
  }

  private credentials() {
    return this.useMaintenanceKey ? [snackCabinetOperationIds.maintenanceKey] : [];
  }

  private accessState(now: number): { icon: MaterialIconName; label: string; tone: string } {
    if (this.useMaintenanceKey && hasSnackCabinetManagementAccess(this.state, {
      now,
      credentialEntityIds: this.credentials(),
    })) return { icon: "key", label: "维修钥匙", tone: "credential" };
    const grant = Object.values(this.state.world.grants).find((candidate) => candidate.expiresAt > now);
    if (!grant) return { icon: "lock", label: "未授权", tone: "locked" };
    return {
      icon: "schedule",
      label: `临时授权 · ${Math.max(1, Math.ceil((grant.expiresAt - now) / 1_000))} 秒`,
      tone: "temporary",
    };
  }

  private entityList(containerId: string, selectedId: string, side: "external" | "machine") {
    const container = this.state.world.containers[containerId];
    if (!container) return "";
    const selectable = container.entityIds
      .map((entityId) => this.state.world.entities[entityId])
      .filter((entity) => entity && entity.tags.includes("stock"));
    if (selectable.length === 0) return '<p class="inventory-empty">暂无可交换实体</p>';
    return selectable.map((entity) => `
      <button
        class="entity-row${entity!.id === selectedId ? " is-selected" : ""}"
        type="button"
        data-select-side="${side}"
        data-entity-id="${escapeHtml(entity!.id)}"
      >
        <span class="entity-icon" aria-hidden="true">${materialIcon("inventory_2")}</span>
        <span class="entity-copy"><strong>${escapeHtml(entity!.label)}</strong><small>${side === "machine" ? "设备所有" : "外部所有"}</small></span>
        ${entity!.id === selectedId ? materialIcon("check_circle", "entity-selected-icon") : ""}
      </button>
    `).join("");
  }

  private render() {
    const now = Date.now();
    const external = this.state.world.containers[snackCabinetOperationIds.externalContainer];
    const machine = this.state.world.containers[snackCabinetOperationIds.machineContainer];
    const hasExternal = Boolean(external?.entityIds.some((id) => this.state.world.entities[id]?.tags.includes("stock")));
    const hasMachine = Boolean(machine?.entityIds.some((id) => this.state.world.entities[id]?.tags.includes("stock")));
    const keyOwner = this.state.world.entities[snackCabinetOperationIds.maintenanceKey]?.ownerId;
    const access = this.accessState(now);
    const statusIcon = this.statusTone === "success" ? "check_circle" : this.statusTone === "danger" ? "error" : "info";

    this.root.innerHTML = `
      <header class="operations-header">
        <div class="operations-title">
          <span class="operations-title-icon">${materialIcon("swap_horiz")}</span>
          <div><h2>实体交换</h2><p>所有权与容器归属同步提交</p></div>
        </div>
        <span class="access-badge ${access.tone}">${materialIcon(access.icon)}<span>${escapeHtml(access.label)}</span></span>
      </header>
      <div class="credential-row">
        <span class="credential-copy"><span class="credential-icon">${materialIcon("key")}</span><span><strong>维修钥匙</strong><small>凭证实体 · ${keyOwner === snackCabinetOperationIds.actor ? "外部所有" : "其他所有"}</small></span></span>
        <button type="button" class="key-toggle" data-toggle-key aria-pressed="${this.useMaintenanceKey}">
          ${materialIcon(this.useMaintenanceKey ? "lock_open" : "lock")}<span>${this.useMaintenanceKey ? "使用中" : "未使用"}</span>
        </button>
      </div>
      <div class="inventory-columns">
        <section aria-label="外部实体">
          <div class="inventory-heading"><h3>${materialIcon("inventory_2")}<span>外部实体</span></h3><span>${external?.entityIds.length ?? 0}</span></div>
          <div class="entity-list">${this.entityList(snackCabinetOperationIds.externalContainer, this.selectedExternalId, "external")}</div>
        </section>
        <section aria-label="设备库存">
          <div class="inventory-heading"><h3>${materialIcon("warehouse")}<span>设备库存</span></h3><span>${machine?.entityIds.length ?? 0}/${machine?.capacity ?? 0}</span></div>
          <div class="entity-list">${this.entityList(snackCabinetOperationIds.machineContainer, this.selectedMachineId, "machine")}</div>
        </section>
      </div>
      <div class="operation-actions">
        ${button("存入", "deposit", "login", !hasExternal)}
        ${button("取出", "withdraw", "logout", !hasMachine)}
        ${button("交换", "exchange", "swap_horiz", !hasExternal || !hasMachine)}
        ${button("破解", "hack", "security")}
      </div>
      <p class="operation-status ${this.statusTone}" role="status">${materialIcon(statusIcon)}<span>${escapeHtml(this.status)}</span></p>
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
    this.status = `${label}完成，实体所有权已原子提交。`;
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
      this.applyTransaction("存入", depositSnackCabinetEntity(this.state, {
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
      this.useMaintenanceKey = false;
      this.status = "破解成功，已签发 45 秒临时库存管理授权。";
      this.statusTone = "success";
    } else {
      this.status = hacked.reason === "cooldown" ? "安全模块冷却中，请稍后重试。" : "破解失败，设备进入短暂冷却。";
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
    if (target.closest("[data-toggle-key]")) {
      this.useMaintenanceKey = !this.useMaintenanceKey;
      this.status = this.useMaintenanceKey ? "维修钥匙已作为权限凭证提交。" : "已停止提交维修钥匙，可改用临时授权。";
      this.statusTone = "neutral";
      this.render();
      return;
    }
    const action = target.closest<HTMLElement>("[data-operation]")?.dataset.operation as OperationKind | undefined;
    if (action) this.runOperation(action);
  };
}
