import {
  assembleCapabilities,
  builtInDomainRegistry,
  createDomainPackageRegistry,
  createModelModuleRegistry,
  createRegistrationRegistry,
  cyberFactoryModels,
  defineDomainPackage,
  defineFactoryModelModule,
  DuplicateRegistrationError,
  type CapabilityDefinition,
} from "@solidloom/shared";
import { createReactUiExtensionRegistry } from "../apps/web/src/extensions/registry";
import type { ReactUiExtension } from "../apps/web/src/extensions/types";
import { describe, expect, it } from "vitest";

const capability = (id: string): CapabilityDefinition => ({
  id,
  status: "planned",
  method: "GET",
  path: `/api/${id}`,
  summary: id,
  description: id,
  tags: ["test"],
  safety: "read",
  agent: { useWhen: id, instructions: [id] },
  schema: {},
});

describe("extension registries", () => {
  it("preserves the existing cyber factory example order and semantics", () => {
    expect(cyberFactoryModels.map((model) => model.name)).toEqual([
      "办公桌",
      "电脑显示器",
      "主机箱",
      "笔记本",
      "房间",
      "简易人体工学椅",
      "极简风小人",
      "原创方块角色",
      "参数化零食售货机",
      "参数化咖啡机",
      "参数化下置桶饮水机",
      "现代休息区资产套件",
    ]);
    expect(builtInDomainRegistry.models.ids()).toEqual([
      "cyber-factory-desk",
      "cyber-factory-monitor",
      "cyber-factory-tower",
      "cyber-factory-laptop",
      "cyber-factory-room",
      "cyber-factory-chair",
      "cyber-factory-figure",
      "solidloom-block-avatar",
      "cyber-factory-snack-cabinet",
      "cyber-factory-coffee-machine",
      "cyber-factory-water-dispenser",
      "cyber-factory-lounge-kit",
    ]);
  });

  it("rejects duplicate IDs for generic and model registrations", () => {
    expect(() => createRegistrationRegistry("测试", [{ id: "same" }, { id: "same" }]))
      .toThrow(DuplicateRegistrationError);
    const module = defineFactoryModelModule({
      id: "same-model",
      status: "planned",
      createModel: () => ({ name: "测试" }),
    });
    expect(() => createModelModuleRegistry([module, module])).toThrow("重复 ID");
  });

  it("detects conflicts contributed by separate domain packages", () => {
    const first = defineDomainPackage({
      id: "first-domain",
      displayName: "领域一",
      description: "测试领域。",
      version: "1.0.0",
      status: "planned",
    }, { models: [], capabilities: [capability("domain.inspect")], uiExtensions: [] });
    const second = defineDomainPackage({
      id: "second-domain",
      displayName: "领域二",
      description: "测试领域。",
      version: "1.0.0",
      status: "planned",
    }, { models: [], capabilities: [capability("domain.inspect")], uiExtensions: [] });

    expect(() => createDomainPackageRegistry([first, second])).toThrow("领域能力注册表");
  });

  it("assembles core and planned domain capabilities through one validation path", () => {
    const domain = defineDomainPackage({
      id: "operations-domain",
      displayName: "运营领域",
      description: "测试领域。",
      version: "1.0.0",
      status: "planned",
    }, { models: [], capabilities: [capability("operations.observe")], uiExtensions: [] });
    const registry = createDomainPackageRegistry([domain]);

    expect(assembleCapabilities([capability("core.health")], registry).map((entry) => entry.id))
      .toEqual(["core.health", "operations.observe"]);
    expect(() => assembleCapabilities([capability("operations.observe")], registry)).toThrow("能力注册表");
  });

  it("validates React extension descriptor bindings and duplicate IDs", () => {
    const extension: ReactUiExtension = {
      id: "cyber-factory.employee-status",
      descriptor: {
        id: "cyber-factory.employee-status",
        slot: "hud",
        status: "planned",
        moduleId: "./employeeStatus.js",
      },
      component: () => null,
    };

    expect(createReactUiExtensionRegistry([extension]).ids()).toEqual([extension.id]);
    expect(() => createReactUiExtensionRegistry([extension, extension])).toThrow("重复 ID");
    expect(() => createReactUiExtensionRegistry([{
      ...extension,
      id: "cyber-factory.other-status",
    }])).toThrow("描述符 ID");
  });
});
