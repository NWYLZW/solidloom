import type { ModelFeature } from "@solidloom/shared";
import * as THREE from "three";
import type { NavigationObstacle } from "../navigation";
import type { NavigationContainerItem } from "../interaction-ui/types";
import type { ContainerProductDefinition } from "./containerInventory";
import type { NavigationInteractionDescriptor } from "./types";

export interface NavigationDynamicBodyRuntime {
  friction: number;
  id: string;
  linearDamping: number;
  mass: number;
  object: THREE.Group;
  obstacle: NavigationObstacle;
  velocity: THREE.Vector3;
}

export interface NavigationInteractionRuntime extends NavigationInteractionDescriptor {
  active: boolean;
  anchor: THREE.Object3D;
  articulationAxis: THREE.Vector3 | null;
  articulationCurrentValue: number;
  articulationPivot: THREE.Group | null;
  articulationTargetValue: number;
  containerItems: NavigationContainerItem[];
  containerProducts: ContainerProductDefinition[];
  deviceSelections: Record<string, string>;
  deviceCollectedOptionIds: Set<string>;
  deviceProgramOptionId: string | null;
  deviceProgramPhase: "idle" | "running" | "ready";
  deviceStatus: string | null;
  doorPivot: THREE.Group | null;
  dynamicBody: NavigationDynamicBodyRuntime | null;
  powerMaterials: Array<{
    emissive: THREE.Color;
    emissiveIntensity: number;
    material: THREE.MeshStandardMaterial;
  }>;
  proximityAnchor: THREE.Object3D | null;
  raycastMeshes: THREE.Mesh[];
  seatObject: THREE.Object3D | null;
  seatObstacle: NavigationObstacle | null;
  targetMeshes: THREE.Mesh[];
}

interface CreateNavigationInteractionRuntimesOptions {
  featureGroupById: Map<string, THREE.Group>;
  featureMeshById: Map<string, THREE.Mesh>;
  interactions: NavigationInteractionDescriptor[];
  savedContainerConfigurations: Map<string, {
    capacity: number;
    currency: string | undefined;
    label: string | undefined;
    products?: ContainerProductDefinition[];
  }> | undefined;
  savedContainerItems: Map<string, NavigationContainerItem[]> | undefined;
  savedDeviceSelections: Map<string, Record<string, string>> | undefined;
  savedDeviceStatuses: Map<string, string | null> | undefined;
  savedStates: Map<string, boolean> | undefined;
}

export function createNavigationInteractionRuntimes({
  featureGroupById,
  featureMeshById,
  interactions,
  savedContainerConfigurations,
  savedContainerItems,
  savedDeviceSelections,
  savedDeviceStatuses,
  savedStates,
}: CreateNavigationInteractionRuntimesOptions): NavigationInteractionRuntime[] {
  return interactions.flatMap((interaction) => {
    const groupObject = featureGroupById.get(interaction.groupId);
    if (!groupObject) return [];
    let proximityAnchor: THREE.Object3D | null = null;
    if (interaction.anchorPosition) {
      proximityAnchor = new THREE.Object3D();
      proximityAnchor.name = `navigation-interaction-anchor:${interaction.id}`;
      proximityAnchor.position.set(...interaction.anchorPosition);
      groupObject.add(proximityAnchor);
    }
    const targetMeshes = interaction.targetFeatureIds
      .map((featureId) => featureMeshById.get(featureId))
      .filter((mesh): mesh is THREE.Mesh => Boolean(mesh));
    let doorPivot: THREE.Group | null = null;
    if (interaction.kind === "door" && targetMeshes.length > 0) {
      const doorMesh = targetMeshes[0]!;
      const doorFeature = doorMesh.userData.feature as ModelFeature | undefined;
      const parent = doorMesh.parent;
      if (parent && doorFeature?.type === "box") {
        const doorWidth = doorFeature.parameters.depth * Math.abs(doorMesh.scale.z);
        doorPivot = new THREE.Group();
        doorPivot.name = `navigation-door-pivot:${interaction.id}`;
        doorPivot.position.set(
          doorMesh.position.x,
          doorMesh.position.y,
          doorMesh.position.z - doorWidth / 2,
        );
        parent.add(doorPivot);
        for (const mesh of targetMeshes) {
          if (mesh.parent !== parent) continue;
          parent.remove(mesh);
          mesh.position.sub(doorPivot.position);
          doorPivot.add(mesh);
        }
      }
    }
    let articulationPivot: THREE.Group | null = null;
    let articulationAxis: THREE.Vector3 | null = null;
    if (
      interaction.kind === "articulation"
      && interaction.jointPivot
      && interaction.jointAxis
      && targetMeshes.length > 0
    ) {
      const parent = targetMeshes[0]!.parent;
      if (parent) {
        articulationPivot = new THREE.Group();
        articulationPivot.name = `navigation-articulation-pivot:${interaction.id}`;
        articulationPivot.position.set(...interaction.jointPivot);
        parent.add(articulationPivot);
        for (const mesh of targetMeshes) {
          if (mesh.parent !== parent) continue;
          parent.remove(mesh);
          mesh.position.sub(articulationPivot.position);
          articulationPivot.add(mesh);
        }
        articulationAxis = new THREE.Vector3(...interaction.jointAxis).normalize();
      }
    }
    const powerMaterials = [...new Set(targetMeshes.flatMap((mesh) => (
      Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    )).filter((material): material is THREE.MeshStandardMaterial => material instanceof THREE.MeshStandardMaterial))]
      .map((material) => ({
        emissive: material.emissive.clone(),
        emissiveIntensity: material.emissiveIntensity,
        material,
      }));
    const raycastMeshes: THREE.Mesh[] = interaction.kind === "door" ? [...targetMeshes] : [];
    if (interaction.kind !== "door" || raycastMeshes.length === 0) {
      groupObject.traverse((child) => {
        if (child instanceof THREE.Mesh) raycastMeshes.push(child);
      });
    }
    const jointInitialValue = interaction.jointInitialValue ?? 0;
    const jointClosedValue = interaction.jointClosedValue ?? 0;
    const jointOpenValue = interaction.jointOpenValue ?? jointInitialValue;
    const savedActive = savedStates?.get(interaction.id);
    const active = savedActive ?? (interaction.kind === "articulation"
      ? Math.abs(jointInitialValue - jointOpenValue) <= Math.abs(jointInitialValue - jointClosedValue)
      : false);
    const articulationTargetValue = active ? jointOpenValue : jointClosedValue;
    const savedContainerConfiguration = savedContainerConfigurations?.get(interaction.id);
    const runtime: NavigationInteractionRuntime = {
      ...interaction,
      ...(savedContainerConfiguration ? {
        containerCapacity: savedContainerConfiguration.capacity,
        containerProducts: savedContainerConfiguration.products?.map((product) => ({ ...product }))
          ?? interaction.containerProducts?.map((product) => ({ ...product }))
          ?? [],
        ...(savedContainerConfiguration.currency
          ? { containerCurrency: savedContainerConfiguration.currency }
          : {}),
        ...(savedContainerConfiguration.label ? { label: savedContainerConfiguration.label } : {}),
      } : {}),
      active,
      anchor: articulationPivot ?? doorPivot ?? groupObject,
      articulationAxis,
      articulationCurrentValue: interaction.kind === "articulation" ? articulationTargetValue : 0,
      articulationPivot,
      articulationTargetValue,
      containerItems: savedContainerItems?.get(interaction.id)?.map((item) => ({ ...item }))
        ?? interaction.containerItems?.map((item) => ({ ...item }))
        ?? [],
      containerProducts: savedContainerConfiguration?.products?.map((product) => ({ ...product }))
        ?? interaction.containerProducts?.map((product) => ({ ...product }))
        ?? [],
      deviceSelections: savedDeviceSelections?.get(interaction.id) ?? Object.fromEntries(
        (interaction.operationGroups ?? []).map((group) => [group.id, group.options[0]?.id ?? ""]),
      ),
      deviceCollectedOptionIds: new Set(),
      deviceProgramOptionId: null,
      deviceProgramPhase: "idle",
      deviceStatus: savedDeviceStatuses?.get(interaction.id) ?? null,
      doorPivot,
      dynamicBody: null,
      powerMaterials,
      proximityAnchor,
      raycastMeshes,
      seatObject: null,
      seatObstacle: null,
      targetMeshes,
    };
    if (runtime.kind === "door" && runtime.doorPivot) {
      runtime.doorPivot.rotation.y = runtime.active ? THREE.MathUtils.degToRad(runtime.openAngle ?? 90) : 0;
    }
    if (runtime.kind === "articulation" && runtime.articulationPivot && runtime.articulationAxis) {
      runtime.articulationPivot.setRotationFromAxisAngle(
        runtime.articulationAxis,
        THREE.MathUtils.degToRad(runtime.articulationCurrentValue - jointInitialValue),
      );
    }
    if (runtime.kind === "power") {
      for (const entry of runtime.powerMaterials) {
        entry.material.emissive.copy(runtime.active ? new THREE.Color(0x5adcf0) : entry.emissive);
        entry.material.emissiveIntensity = runtime.active ? 1.45 : entry.emissiveIntensity;
      }
    }
    return [runtime];
  });
}
