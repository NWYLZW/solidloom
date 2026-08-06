import { describe, expect, it } from "vitest";
import { createInteractionUI, mergeInteractionUI } from "./config";
import type {
  ContainerEmptySlotProps,
  ContainerInteractionRendererProps,
  ContainerItemSlotProps,
} from "./types";

function WorkspaceRenderer(_: ContainerInteractionRendererProps) {
  return null;
}

function WorkspaceItem(_: ContainerItemSlotProps) {
  return null;
}

function SceneEmptySlot(_: ContainerEmptySlotProps) {
  return null;
}

function InstanceItem(_: ContainerItemSlotProps) {
  return null;
}

describe("interaction UI configuration", () => {
  it("merges workspace, scene, and instance overrides without dropping inherited extensions", () => {
    const workspace = createInteractionUI({
      presentations: { container: "anchored" },
      renderers: { container: WorkspaceRenderer },
      slots: { container: { Item: WorkspaceItem } },
      theme: {
        id: "workspace",
        tokens: {
          "--interaction-color-accent": "green",
          "--interaction-surface-width": "340px",
        },
      },
    });
    const scene = createInteractionUI({
      presentations: { container: "modal" },
      slots: { container: { EmptySlot: SceneEmptySlot } },
      theme: {
        id: "scene",
        tokens: { "--interaction-surface-width": "520px" },
      },
    });
    const instance = createInteractionUI({
      slots: { container: { Item: InstanceItem } },
    });

    const resolved = mergeInteractionUI(mergeInteractionUI(workspace, scene), instance);

    expect(resolved.presentations?.container).toBe("modal");
    expect(resolved.renderers?.container).toBe(WorkspaceRenderer);
    expect(resolved.slots?.container?.EmptySlot).toBe(SceneEmptySlot);
    expect(resolved.slots?.container?.Item).toBe(InstanceItem);
    expect(resolved.theme).toEqual({
      id: "scene",
      tokens: {
        "--interaction-color-accent": "green",
        "--interaction-surface-width": "520px",
      },
    });
  });
});
