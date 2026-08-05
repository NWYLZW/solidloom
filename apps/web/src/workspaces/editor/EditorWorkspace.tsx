import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import {
  ChevronDown,
  Settings2,
} from "lucide-react";
import {
  BOX_CORNER_KEYS,
  BOX_CORNER_LABELS,
  boxCornerRadiiAreUniform,
  clampBoxCornerRadii,
  formatBoxCornerRadiusExpression,
  parseBoxCornerRadiusExpression,
  resolveBoxCornerRadii,
  regenerateProceduralMeshFeature,
  synchronizeRoomAssemblyFeatures,
  type BoxCornerKey,
  type BoxCornerRadii,
  type BoxFeature,
  type CornerAlgorithm,
  type CylinderFeature,
  type FeatureAppearance,
  type FeatureGroup,
  type FeatureMaterialPreset,
  type ModelFeature,
  type ModelRecord,
  type ProceduralMeshSource,
  type RoomShellSource,
  type Unit,
  type Vector3Tuple,
  type VoxelSkinModel,
} from "@solidloom/shared";
import {
  ApiError,
  createModel,
  getHealth,
  getModel,
  listModels,
  replaceFeatureGraph,
  updateModel,
} from "../../api";
import { Viewport3D, type NavigationCameraMode, type TransformCommit, type TransformMode } from "../../Viewport3D";
import { createLocomotionAnimation, resolveLocomotionState } from "../../articulation/locomotion";
import { useJointAnimation } from "../../articulation/useJointAnimation";
import { ModelActionsPanel } from "../../components/ModelActionsPanel";
import { SelectionSummary, type SelectionSummaryIcon } from "../../components/SelectionSummary";
import { StatusBar } from "../../components/StatusBar";
import { TopBar } from "../../components/TopBar";
import { VoxelSkinPanel } from "../../components/VoxelSkinPanel";
import { resolveFeatureColor } from "../../featureMaterials";
import { evaluateBoolean, evaluatePlaneCut, featureTriangleCount, featureVolume, type BooleanOperation } from "../../meshOperations";
import { upsertModelInStableOrder } from "../../modelCollection";
import {
  mergeLatestModelsPreservingIdentity,
  referenceIdFromViewportGroupId,
  referenceViewportGroupId,
  resolveModelReferences,
} from "../../modelReferences";
import { readTreeUrlState, writeTreeUrlState } from "../../treeUrlState";
import { BUILTIN_VOXEL_SKIN_URL } from "../../voxelSkin";
import { EditorDialogs } from "./components/EditorDialogs";
import { EditorInspectorPanel } from "./components/EditorInspectorPanel";
import { ModelVariableEditor } from "./components/ModelVariableEditor";
import { EditorViewportToolbar, type ViewportObjectTool } from "./components/EditorViewportToolbar";
import { ObjectToolPopover } from "./components/ObjectToolPopover";
import { EditorWorkspaceShell } from "./components/EditorWorkspaceShell";
import { ProjectTree } from "./components/ProjectTree";
import { TreeContextMenu, type TreeContextMenuState, type TreeMenuTarget } from "./components/TreeContextMenu";
import { WorkspaceMenu } from "./components/WorkspaceMenu";
import { copyByLocale, type EditorLocale } from "./editorCopy";
import { cloneModel, comparableModel, meshDimensions, rebuildParameterizedFeatureGraph } from "./editorModelUtils";
import { clamp, readNumberPreference, readPreference, readTextPreference } from "./workspacePreferences";
import { usePanelResize } from "../../hooks/usePanelResize";
import "../../styles/Viewport3D.css";
import "../../styles/responsive.css";

type ServiceState = "checking" | "online" | "offline";
type Locale = EditorLocale;
type Theme = "light" | "dark" | "system";
type InspectorTab = "features" | "properties";
type SaveState = "idle" | "saving" | "saved" | "error";
type ObjectTool = ViewportObjectTool;
type EditorHistorySnapshot = {
  content: Pick<ModelRecord, "description" | "featureGraph" | "name" | "unit">;
  expandedGroupIds: string[];
  inspectorTab: InspectorTab;
  selectedFeatureIds: string[];
  selectedGroupId: string | null;
  selectedReferenceId: string | null;
};

export function EditorWorkspace() {
  const initialTreeUrlStateRef = useRef(
    typeof window === "undefined" ? null : readTreeUrlState(window.location.href),
  );
  const [serviceState, setServiceState] = useState<ServiceState>("checking");
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [savedModel, setSavedModel] = useState<ModelRecord | null>(null);
  const [draftModel, setDraftModel] = useState<ModelRecord | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusDetail, setStatusDetail] = useState("");
  const [activeInspectorTab, setActiveInspectorTab] = useState<InspectorTab>("features");
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(null);
  const [activeObjectTool, setActiveObjectTool] = useState<ObjectTool | null>(null);
  const [annotationMode, setAnnotationMode] = useState(false);
  const [navigationMode, setNavigationMode] = useState(false);
  const [navigationCameraMode, setNavigationCameraMode] = useState<NavigationCameraMode>("god");
  const [locomotionSpeed, setLocomotionSpeed] = useState(0);
  const [booleanOperation, setBooleanOperation] = useState<BooleanOperation>("union");
  const [cutRotation, setCutRotation] = useState<Vector3Tuple>([0, 0, 0]);
  const [cutOffset, setCutOffset] = useState(0);
  const [keepPositive, setKeepPositive] = useState(true);
  const [preserveSources, setPreserveSources] = useState(false);
  const [uniformScale, setUniformScale] = useState(true);
  const [operationError, setOperationError] = useState("");
  const [cornerRadiusExpression, setCornerRadiusExpression] = useState("");
  const [cornerRadiusExpressionError, setCornerRadiusExpressionError] = useState("");
  const [parameterExpressionError, setParameterExpressionError] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState(() => readTextPreference("solidloom.projectName.v1", "未命名项目"));
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [renameProjectOpen, setRenameProjectOpen] = useState(false);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shortcutGuideOpen, setShortcutGuideOpen] = useState(false);
  const [projectExpanded, setProjectExpanded] = useState(() => initialTreeUrlStateRef.current?.projectExpanded ?? true);
  const [modelsExpanded, setModelsExpanded] = useState(() => initialTreeUrlStateRef.current?.modelsExpanded ?? true);
  const [expandedModelIds, setExpandedModelIds] = useState<string[]>(() => initialTreeUrlStateRef.current?.expandedModelIds ?? []);
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>(() => initialTreeUrlStateRef.current?.expandedGroupIds ?? []);
  const [treeUrlReady, setTreeUrlReady] = useState(false);
  const [libraryWidth, setLibraryWidth] = useState(() => readNumberPreference("solidloom.layout.libraryWidth.v1", 260, 180, 420));
  const [inspectorWidth, setInspectorWidth] = useState(() => readNumberPreference("solidloom.layout.inspectorWidth.v1", 294, 240, 480));
  const [treeMenu, setTreeMenu] = useState<TreeContextMenuState | null>(null);
  const [locale, setLocale] = useState<Locale>(() => readPreference("solidloom.locale", ["zh-CN", "en"], "zh-CN"));
  const [theme, setTheme] = useState<Theme>(() => readPreference("solidloom.theme", ["light", "dark", "system"], "system"));
  const menuRef = useRef<HTMLDivElement>(null);
  const treeMenuRef = useRef<HTMLDivElement>(null);
  const { beginResize, resizeWithKeyboard } = usePanelResize();
  const draftModelRef = useRef<ModelRecord | null>(null);
  const undoStackRef = useRef<EditorHistorySnapshot[]>([]);
  const redoStackRef = useRef<EditorHistorySnapshot[]>([]);
  const [historySize, setHistorySize] = useState({ redo: 0, undo: 0 });
  draftModelRef.current = draftModel;
  const copy = copyByLocale[locale];
  const shortcutSections = useMemo(() => locale === "zh-CN" ? [
    {
      title: "镜头导航",
      rows: [
        ["W / A / S / D", "前进、左移、后退、右移"],
        ["Q / E", "下降、上升"],
        ["Shift / Option", "加速 / 精细移动"],
        ["方向键", "环绕观察"],
        ["F / Home", "聚焦选中对象 / 显示全部"],
        ["1 / 3 / 7", "前视图 / 右视图 / 顶视图"],
      ],
    },
    {
      title: "选择与变换",
      rows: [
        ["Esc", "退出工具并清除选择"],
        ["⌘ / Ctrl + 单击", "增减多选对象"],
        ["M / R / Shift + S", "移动 / 旋转 / 缩放"],
        ["Enter", "结束当前变换工具"],
        ["⌘ / Ctrl + G", "将多选对象建立分组"],
        ["⌘ / Ctrl + Shift + G", "解散当前分组"],
      ],
    },
    {
      title: "通用操作",
      rows: [
        ["⌘ / Ctrl + Z", "撤销"],
        ["⌘ / Ctrl + Shift + Z", "重做"],
        ["⌘ / Ctrl + S", "保存"],
        ["⌘ / Ctrl + A", "选择当前模型的全部对象"],
        ["?", "打开快捷键说明"],
      ],
    },
  ] : [
    {
      title: "Camera navigation",
      rows: [
        ["W / A / S / D", "Forward, left, backward, right"],
        ["Q / E", "Move down / up"],
        ["Shift / Option", "Fast / precise movement"],
        ["Arrow keys", "Orbit the camera"],
        ["F / Home", "Frame selection / frame all"],
        ["1 / 3 / 7", "Front / right / top view"],
      ],
    },
    {
      title: "Selection and transforms",
      rows: [
        ["Esc", "Exit the tool and clear selection"],
        ["⌘ / Ctrl + click", "Toggle objects in the selection"],
        ["M / R / Shift + S", "Move / rotate / scale"],
        ["Enter", "Finish the current transform tool"],
        ["⌘ / Ctrl + G", "Group the selected objects"],
        ["⌘ / Ctrl + Shift + G", "Dissolve the selected group"],
      ],
    },
    {
      title: "General",
      rows: [
        ["⌘ / Ctrl + Z", "Undo"],
        ["⌘ / Ctrl + Shift + Z", "Redo"],
        ["⌘ / Ctrl + S", "Save"],
        ["⌘ / Ctrl + A", "Select every object in the current model"],
        ["?", "Open this shortcut guide"],
      ],
    },
  ], [locale]);
  const viewLabels = useMemo<[string, string, string, string, string, string]>(
    () => [copy.viewRight, copy.viewLeft, copy.viewTop, copy.viewBottom, copy.viewFront, copy.viewBack],
    [copy],
  );
  const isDirty = comparableModel(savedModel) !== comparableModel(draftModel);
  const featureGroups = useMemo(() => draftModel?.featureGraph.groups ?? [], [draftModel?.featureGraph.groups]);
  const voxelSkinFeatures = useMemo(
    () => draftModel?.featureGraph.features.filter((feature) => feature.appearance?.voxelSkin) ?? [],
    [draftModel?.featureGraph.features],
  );
  const voxelSkin = voxelSkinFeatures[0]?.appearance?.voxelSkin ?? null;
  const navigationAvatarSkin = useMemo(() => {
    const avatarModel = models.find((item) => item.name === "原创方块角色")
      ?? models.find((item) => item.featureGraph.features.some((feature) => feature.appearance?.voxelSkin));
    const skin = avatarModel?.featureGraph.features.find((feature) => feature.appearance?.voxelSkin)
      ?.appearance?.voxelSkin;
    return skin ? { model: skin.model, url: skin.url } : null;
  }, [models]);
  const locomotionProfile = draftModel?.featureGraph.locomotion;
  const locomotionPreview = useMemo(() => locomotionProfile
    ? createLocomotionAnimation(locomotionProfile, draftModel?.featureGraph.animations ?? [], locomotionSpeed)
    : null, [draftModel?.featureGraph.animations, locomotionProfile, locomotionSpeed]);
  const locomotionState = locomotionProfile
    ? resolveLocomotionState(locomotionProfile, locomotionSpeed)
    : "idle";
  const modelReferences = useMemo(() => draftModel?.featureGraph.references ?? [], [draftModel?.featureGraph.references]);
  const navigationDynamicBodies = useMemo(() => modelReferences.flatMap((reference) => (
    reference.physics?.bodyType === "dynamic"
      ? [{
          friction: reference.physics.friction ?? 0.4,
          groupId: referenceViewportGroupId(reference.id),
          linearDamping: reference.physics.linearDamping ?? 2.6,
          mass: reference.physics.mass ?? 20,
        }]
      : []
  )), [modelReferences]);
  const navigationInteractions = useMemo(() => modelReferences.flatMap((reference) => {
    const groupId = referenceViewportGroupId(reference.id);
    const sourceModel = models.find((model) => model.id === reference.modelId);
    return (reference.interactions ?? []).flatMap((interaction) => {
      const joint = interaction.kind === "articulation"
        ? sourceModel?.featureGraph.joints?.find((candidate) => candidate.id === interaction.jointId)
        : null;
      if (interaction.kind === "articulation" && !joint) return [];
      const jointDescriptor = joint
        ? {
            jointAxis: joint.axis,
            jointClosedValue: interaction.closedValue ?? joint.min,
            jointInitialValue: reference.jointValues?.[joint.id] ?? joint.value,
            jointOpenValue: interaction.openValue ?? joint.value,
            jointPivot: joint.pivot,
          }
        : {};
      return [{
        ...interaction,
        groupId,
        id: `${reference.id}:${interaction.id}`,
        ...jointDescriptor,
        targetFeatureIds: interaction.targetFeatureIds?.map((featureId) => `${groupId}:${featureId}`) ?? [],
      }];
    });
  }), [modelReferences, models]);
  const navigationInteractionLabels = useMemo(() => ({
    articulationClose: copy.interactionArticulationClose,
    articulationOpen: copy.interactionArticulationOpen,
    doorClose: copy.interactionDoorClose,
    doorOpen: copy.interactionDoorOpen,
    keyHint: copy.interactionKeyHint,
    powerOff: copy.interactionPowerOff,
    powerOn: copy.interactionPowerOn,
    sit: copy.interactionSit,
    stand: copy.interactionStand,
  }), [copy]);
  const resolvedReferences = useMemo(
    () => resolveModelReferences(draftModel?.featureGraph ?? { version: 1, features: [] }, models, draftModel?.id),
    [draftModel?.featureGraph, draftModel?.id, models],
  );
  const viewportFeatures = useMemo(
    () => [...(draftModel?.featureGraph.features ?? []), ...resolvedReferences.features],
    [draftModel?.featureGraph.features, resolvedReferences.features],
  );
  const viewportGroups = useMemo(
    () => [...featureGroups, ...resolvedReferences.groups],
    [featureGroups, resolvedReferences.groups],
  );
  const selectedReference = selectedReferenceId
    ? modelReferences.find((reference) => reference.id === selectedReferenceId) ?? null
    : null;
  const selectedReferenceSource = selectedReference
    ? models.find((model) => model.id === selectedReference.modelId) ?? null
    : null;
  const selectedReferenceHasRoomShell = selectedReferenceSource?.featureGraph.features.some((feature) => (
    feature.type === "mesh" && feature.parameters.source?.kind === "room-shell"
  )) ?? false;
  const selectedFeatures = !selectedGroupId && !selectedReferenceId
    ? draftModel?.featureGraph.features.filter((feature) => selectedFeatureIds.includes(feature.id)) ?? []
    : [];
  const selectedFeature = selectedFeatures.length === 1
    ? selectedFeatures[0]
    : null;
  const selectedProceduralSource = selectedFeature?.type === "mesh"
    ? selectedFeature.parameters.source ?? null
    : null;
  const selectedBoxCornerRadii = useMemo(
    () => selectedFeature?.type === "box" ? resolveBoxCornerRadii(selectedFeature.parameters) : null,
    [selectedFeature],
  );
  const selectedBoxCornerSignature = selectedBoxCornerRadii
    ? BOX_CORNER_KEYS.map((key) => selectedBoxCornerRadii[key]).join(",")
    : "";
  useEffect(() => {
    if (!selectedBoxCornerRadii) {
      setCornerRadiusExpression("");
      setCornerRadiusExpressionError("");
      return;
    }
    setCornerRadiusExpression(formatBoxCornerRadiusExpression(selectedBoxCornerRadii));
    setCornerRadiusExpressionError("");
  }, [selectedFeature?.id, selectedBoxCornerSignature]);
  const selectedGroup = selectedGroupId
    ? featureGroups.find((group) => group.id === selectedGroupId) ?? null
    : null;
  const selectedJoint = selectedGroup
    ? draftModel?.featureGraph.joints?.find((joint) => joint.groupId === selectedGroup.id) ?? null
    : null;
  const selectedTransformTarget = selectedReference ?? selectedGroup ?? selectedFeature;
  const selectedViewportFeatureIds = useMemo(
    () => selectedReference
      ? resolvedReferences.groups.find((group) => group.id === referenceViewportGroupId(selectedReference.id))?.featureIds ?? []
      : selectedGroup
        ? selectedGroup.featureIds
        : selectedFeatureIds,
    [resolvedReferences.groups, selectedFeatureIds, selectedGroup, selectedReference],
  );
  const selectedOperationFeatures = useMemo(
    () => selectedViewportFeatureIds.flatMap((featureId) => {
      const feature = draftModel?.featureGraph.features.find((item) => item.id === featureId);
      return feature ? [feature] : [];
    }),
    [draftModel?.featureGraph.features, selectedViewportFeatureIds],
  );
  const transformMode: TransformMode = activeObjectTool === "translate"
    || activeObjectTool === "rotate"
    || activeObjectTool === "scale"
    ? activeObjectTool
    : null;
  const groupedFeatureIds = useMemo(
    () => new Set(featureGroups.flatMap((group) => group.featureIds)),
    [featureGroups],
  );
  const ungroupedFeatures = draftModel?.featureGraph.features.filter((feature) => !groupedFeatureIds.has(feature.id)) ?? [];
  const contextFeatureIds = treeMenu?.target.kind === "feature"
    ? [treeMenu.target.featureId]
    : treeMenu?.target.kind === "selection"
      ? treeMenu.target.featureIds
      : [];
  const contextGroupId = treeMenu?.target.kind === "group" ? treeMenu.target.groupId : null;
  const selectedFeatureGroup = selectedFeature
    ? featureGroups.find((group) => group.featureIds.includes(selectedFeature.id)) ?? null
    : null;
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(locale === "zh-CN" ? "zh-CN" : "en-US", { maximumFractionDigits: 2 }),
    [locale],
  );
  const formatNumber = (value: number) => numberFormatter.format(value);
  const selectedFeatureSize = selectedFeature?.type === "box"
    ? `${formatNumber(selectedFeature.parameters.width * Math.abs(selectedFeature.scale?.[0] ?? 1))} × ${formatNumber(selectedFeature.parameters.depth * Math.abs(selectedFeature.scale?.[2] ?? 1))} × ${formatNumber(selectedFeature.parameters.height * Math.abs(selectedFeature.scale?.[1] ?? 1))} ${draftModel?.unit ?? "mm"}`
    : selectedFeature?.type === "cylinder"
      ? `⌀${formatNumber(selectedFeature.parameters.radius * 2 * Math.max(Math.abs(selectedFeature.scale?.[0] ?? 1), Math.abs(selectedFeature.scale?.[2] ?? 1)))} × ${formatNumber(selectedFeature.parameters.height * Math.abs(selectedFeature.scale?.[1] ?? 1))} ${draftModel?.unit ?? "mm"}`
      : selectedFeature?.type === "mesh"
        ? `${meshDimensions(selectedFeature).map(formatNumber).join(" × ")} ${draftModel?.unit ?? "mm"}`
        : "";
  const selectedFeatureVolume = useMemo(
    () => selectedFeature ? featureVolume(selectedFeature) : 0,
    [selectedFeature],
  );
  const selectedFeatureTriangles = useMemo(
    () => selectedFeature ? featureTriangleCount(selectedFeature) : 0,
    [selectedFeature],
  );
  const statusPath = [
    { id: "project", label: projectName },
    { id: "models", label: copy.models },
    ...(draftModel ? [{ id: `model-${draftModel.id}`, label: draftModel.name }] : []),
    ...(selectedGroup ? [{ id: `group-${selectedGroup.id}`, label: selectedGroup.name }] : []),
    ...(selectedReference ? [{ id: `reference-${selectedReference.id}`, label: selectedReference.name }] : []),
    ...(selectedFeatureGroup ? [{ id: `group-${selectedFeatureGroup.id}`, label: selectedFeatureGroup.name }] : []),
    ...(selectedFeature ? [{ id: `feature-${selectedFeature.id}`, label: selectedFeature.name }] : []),
    ...(selectedFeatures.length > 1 ? [{ id: "selection", label: `${copy.selectedObjects} ${selectedFeatures.length}` }] : []),
  ];

  const syncHistorySize = () => {
    setHistorySize({ redo: redoStackRef.current.length, undo: undoStackRef.current.length });
  };

  const clearHistory = () => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    syncHistorySize();
  };

  const captureHistorySnapshot = (model: ModelRecord): EditorHistorySnapshot => ({
    content: structuredClone({
      description: model.description,
      featureGraph: model.featureGraph,
      name: model.name,
      unit: model.unit,
    }),
    expandedGroupIds: [...expandedGroupIds],
    inspectorTab: activeInspectorTab,
    selectedFeatureIds: [...selectedFeatureIds],
    selectedGroupId,
    selectedReferenceId,
  });

  const restoreHistorySnapshot = (snapshot: EditorHistorySnapshot) => {
    const current = draftModelRef.current;
    if (!current) return;
    const next = cloneModel({ ...current, ...structuredClone(snapshot.content) });
    draftModelRef.current = next;
    setDraftModel(next);
    setSelectedFeatureIds([...snapshot.selectedFeatureIds]);
    setSelectedGroupId(snapshot.selectedGroupId);
    setSelectedReferenceId(snapshot.selectedReferenceId);
    setActiveInspectorTab(snapshot.inspectorTab);
    setExpandedGroupIds([...snapshot.expandedGroupIds]);
    setTreeMenu(null);
    setSaveState("idle");
    setStatusDetail("");
  };

  const updateDraftWithHistory = (update: (current: ModelRecord) => ModelRecord) => {
    const current = draftModelRef.current;
    if (!current) return;
    const next = update(current);
    if (comparableModel(current) === comparableModel(next)) return;
    undoStackRef.current.push(captureHistorySnapshot(current));
    if (undoStackRef.current.length > 100) undoStackRef.current.shift();
    redoStackRef.current = [];
    draftModelRef.current = next;
    setDraftModel(next);
    setSaveState("idle");
    setStatusDetail("");
    syncHistorySize();
  };

  const jointAnimation = useJointAnimation((jointValues) => {
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        joints: (current.featureGraph.joints ?? []).map((joint) => {
          const value = jointValues[joint.id];
          return value === undefined ? joint : { ...joint, value };
        }),
      },
    }));
  });

  const playLocomotionAtSpeed = (requestedSpeed: number) => {
    const profile = draftModel?.featureGraph.locomotion;
    const joints = draftModel?.featureGraph.joints ?? [];
    if (!profile || joints.length === 0) return;
    const nextSpeed = clamp(requestedSpeed, profile.minimumSpeed, profile.maximumSpeed);
    setLocomotionSpeed(nextSpeed);
    const locomotion = createLocomotionAnimation(profile, draftModel?.featureGraph.animations ?? [], nextSpeed);
    if (locomotion) {
      jointAnimation.startClip(locomotion.animation, joints, { transitionMs: profile.transitionDurationMs });
      return;
    }
    const standingPose = draftModel?.featureGraph.poses?.find((pose) => pose.id === "cyber-figure-pose-stand")
      ?? draftModel?.featureGraph.poses?.[0];
    if (standingPose) jointAnimation.start(standingPose.jointValues, profile.transitionDurationMs, joints);
    else jointAnimation.cancel();
  };

  const updateLocomotionProfile = (
    key: "walkReferenceSpeed" | "runReferenceSpeed" | "transitionStartSpeed" | "transitionEndSpeed",
    requestedValue: number,
  ) => {
    const profile = draftModel?.featureGraph.locomotion;
    if (!profile || !Number.isFinite(requestedValue)) return;
    const nextValue = key === "transitionStartSpeed"
      ? clamp(requestedValue, profile.minimumSpeed, profile.transitionEndSpeed - 0.1)
      : key === "transitionEndSpeed"
        ? clamp(requestedValue, profile.transitionStartSpeed + 0.1, profile.maximumSpeed)
        : clamp(requestedValue, 0.1, profile.maximumSpeed);
    const nextProfile = { ...profile, [key]: nextValue };
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: { ...current.featureGraph, locomotion: nextProfile },
    }));
    const locomotion = createLocomotionAnimation(nextProfile, draftModel?.featureGraph.animations ?? [], locomotionSpeed);
    if (locomotion) {
      jointAnimation.startClip(locomotion.animation, draftModel?.featureGraph.joints ?? [], {
        transitionMs: nextProfile.transitionDurationMs,
      });
    }
  };

  const undo = () => {
    const current = draftModelRef.current;
    const previous = undoStackRef.current.pop();
    if (!current || !previous) return;
    redoStackRef.current.push(captureHistorySnapshot(current));
    restoreHistorySnapshot(previous);
    syncHistorySize();
  };

  const redo = () => {
    const current = draftModelRef.current;
    const next = redoStackRef.current.pop();
    if (!current || !next) return;
    undoStackRef.current.push(captureHistorySnapshot(current));
    restoreHistorySnapshot(next);
    syncHistorySize();
  };

  useEffect(() => {
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if ((!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target;
      if (target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", handleHistoryShortcut);
    return () => window.removeEventListener("keydown", handleHistoryShortcut);
  }, [activeInspectorTab, expandedGroupIds, historySize.redo, historySize.undo, selectedFeatureIds, selectedGroupId, selectedReferenceId]);

  useEffect(() => {
    const handleToolShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.metaKey || event.ctrlKey || event.altKey
        || target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable)
        || selectedViewportFeatureIds.length === 0) return;
      const shortcut = event.key.toLowerCase();
      const mode = shortcut === "m" && !event.shiftKey
        ? "translate"
        : shortcut === "r" && !event.shiftKey
          ? "rotate"
          : shortcut === "s" && event.shiftKey
            ? "scale"
            : null;
      if (!mode) return;
      event.preventDefault();
      setOperationError("");
      setActiveObjectTool((current) => current === mode ? null : mode);
    };
    window.addEventListener("keydown", handleToolShortcut);
    return () => window.removeEventListener("keydown", handleToolShortcut);
  }, [selectedViewportFeatureIds.length]);

  useEffect(() => {
    const handleEditorShortcut = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditableTarget = target instanceof HTMLInputElement
        || target instanceof HTMLTextAreaElement
        || target instanceof HTMLSelectElement
        || (target instanceof HTMLElement && target.isContentEditable);
      if (isEditableTarget) return;

      const shortcut = event.key.toLowerCase();
      const commandModifier = event.metaKey || event.ctrlKey;
      if (!commandModifier && !event.altKey && event.key === "?") {
        event.preventDefault();
        setMenuOpen(false);
        setShortcutGuideOpen(true);
        return;
      }
      if (!commandModifier && !event.altKey && event.key === "Enter" && activeObjectTool) {
        event.preventDefault();
        setActiveObjectTool(null);
        return;
      }
      if (!commandModifier) return;

      if (shortcut === "s" && !event.shiftKey) {
        event.preventDefault();
        void saveChanges();
        return;
      }
      if (shortcut === "a" && !event.shiftKey) {
        const featureIds = draftModel?.featureGraph.features.map((feature) => feature.id) ?? [];
        if (featureIds.length === 0) return;
        event.preventDefault();
        setSelectedFeatureIds(featureIds);
        setSelectedGroupId(null);
        setSelectedReferenceId(null);
        setActiveInspectorTab("features");
        return;
      }
      if (shortcut !== "g") return;
      if (event.shiftKey && selectedGroupId) {
        event.preventDefault();
        dissolveFeatureGroup(selectedGroupId);
        return;
      }
      if (!event.shiftKey && selectedFeatureIds.length > 1 && !selectedReferenceId) {
        event.preventDefault();
        createFeatureGroup(selectedFeatureIds);
      }
    };
    window.addEventListener("keydown", handleEditorShortcut);
    return () => window.removeEventListener("keydown", handleEditorShortcut);
  }, [activeObjectTool, draftModel?.featureGraph.features, selectedFeatureIds, selectedGroupId, selectedReferenceId]);

  useEffect(() => {
    if (selectedViewportFeatureIds.length === 0) setActiveObjectTool(null);
  }, [selectedViewportFeatureIds.length]);

  const applyModel = (model: ModelRecord, options: { preserveHistory?: boolean } = {}) => {
    const next = cloneModel(model);
    if (!options.preserveHistory) clearHistory();
    setSavedModel(next);
    const nextDraft = cloneModel(model);
    draftModelRef.current = nextDraft;
    setDraftModel(nextDraft);
    setSelectedGroupId((current) => next.featureGraph.groups?.some((group) => group.id === current) ? current : null);
    setSelectedReferenceId((current) => next.featureGraph.references?.some((reference) => reference.id === current) ? current : null);
    setSelectedFeatureIds((current) => {
      const existing = current.filter((featureId) => model.featureGraph.features.some((feature) => feature.id === featureId));
      return existing.length > 0 ? existing : model.featureGraph.features[0] ? [model.featureGraph.features[0].id] : [];
    });
    if (!options.preserveHistory) {
      setExpandedModelIds([model.id]);
      setExpandedGroupIds((next.featureGraph.groups ?? []).map((group) => group.id));
    }
    setModels((current) => upsertModelInStableOrder(current, model));
    setSaveState("idle");
    setStatusDetail("");
    if (!options.preserveHistory) {
      jointAnimation.cancel();
      setLocomotionSpeed(next.featureGraph.locomotion?.defaultSpeed ?? 0);
      setNavigationMode(false);
    }
  };

  useEffect(() => {
    Promise.all([getHealth(), listModels()])
      .then(([, modelList]) => {
        setModels(modelList.items);
        const treeUrlState = initialTreeUrlStateRef.current;
        const firstModel = treeUrlState?.modelId
          ? modelList.items.find((model) => model.id === treeUrlState.modelId) ?? modelList.items[0]
          : modelList.items[0];
        if (firstModel) {
          const normalized = cloneModel(firstModel);
          setSavedModel(normalized);
          setDraftModel(cloneModel(firstModel));
          setLocomotionSpeed(normalized.featureGraph.locomotion?.defaultSpeed ?? 0);
          if (treeUrlState) {
            const validGroupIds = new Set((normalized.featureGraph.groups ?? []).map((group) => group.id));
            const validReferenceIds = new Set((normalized.featureGraph.references ?? []).map((reference) => reference.id));
            const validFeatureIds = new Set(normalized.featureGraph.features.map((feature) => feature.id));
            const selectedReferenceId = treeUrlState.selectedReferenceId && validReferenceIds.has(treeUrlState.selectedReferenceId)
              ? treeUrlState.selectedReferenceId
              : null;
            const selectedGroupId = treeUrlState.selectedGroupId && validGroupIds.has(treeUrlState.selectedGroupId)
              ? treeUrlState.selectedGroupId
              : null;
            setSelectedReferenceId(selectedReferenceId);
            setSelectedGroupId(selectedReferenceId ? null : selectedGroupId);
            setSelectedFeatureIds(selectedReferenceId || selectedGroupId
              ? []
              : treeUrlState.selectedFeatureIds.filter((featureId) => validFeatureIds.has(featureId)));
            const modelIds = new Set(modelList.items.map((model) => model.id));
            setExpandedModelIds(treeUrlState.expandedModelIds.filter((modelId) => modelIds.has(modelId)));
            setExpandedGroupIds(treeUrlState.expandedGroupIds.filter((groupId) => validGroupIds.has(groupId)));
          } else {
            setSelectedFeatureIds(firstModel.featureGraph.features[0] ? [firstModel.featureGraph.features[0].id] : []);
            setExpandedModelIds([firstModel.id]);
            setExpandedGroupIds((normalized.featureGraph.groups ?? []).map((group) => group.id));
          }
        }
        setServiceState("online");
        setTreeUrlReady(true);
      })
      .catch(() => setServiceState("offline"));
  }, []);

  useEffect(() => {
    if (!draftModel || modelReferences.length === 0) return;
    let cancelled = false;
    const refreshReferencedModels = async () => {
      try {
        const latest = await listModels();
        if (cancelled) return;
        setModels((current) => mergeLatestModelsPreservingIdentity(current, latest.items));
        setServiceState("online");
      } catch {
        if (!cancelled) setServiceState("offline");
      }
    };
    const interval = window.setInterval(() => void refreshReferencedModels(), 2000);
    window.addEventListener("focus", refreshReferencedModels);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshReferencedModels);
    };
  }, [draftModel?.id, modelReferences.length]);

  useEffect(() => {
    if (!treeUrlReady) return;
    const nextUrl = writeTreeUrlState(window.location.href, {
      modelId: draftModel?.id ?? null,
      selectedFeatureIds,
      selectedGroupId,
      selectedReferenceId,
      projectExpanded,
      modelsExpanded,
      expandedModelIds: draftModel && expandedModelIds.includes(draftModel.id) ? [draftModel.id] : [],
      expandedGroupIds: expandedGroupIds.filter((groupId) => featureGroups.some((group) => group.id === groupId)),
    });
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [
    draftModel?.id,
    expandedGroupIds,
    expandedModelIds,
    featureGroups,
    modelsExpanded,
    projectExpanded,
    selectedFeatureIds,
    selectedGroupId,
    selectedReferenceId,
    treeUrlReady,
  ]);

  useEffect(() => {
    window.localStorage.setItem("solidloom.locale", locale);
    document.documentElement.lang = locale;
    document.title = copy.pageTitle;
  }, [copy.pageTitle, locale]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    window.localStorage.setItem("solidloom.theme", theme);
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("solidloom.layout.libraryWidth.v1", String(libraryWidth));
  }, [libraryWidth]);

  useEffect(() => {
    window.localStorage.setItem("solidloom.layout.inspectorWidth.v1", String(inspectorWidth));
  }, [inspectorWidth]);

  useEffect(() => {
    window.localStorage.setItem("solidloom.projectName.v1", projectName);
  }, [projectName]);

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (treeMenuRef.current && !treeMenuRef.current.contains(event.target as Node)) setTreeMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (document.pointerLockElement) return;
        event.preventDefault();
        setMenuOpen(false);
        setTreeMenu(null);
        setCreateDialogOpen(false);
        setRenameProjectOpen(false);
        setShortcutGuideOpen(false);
        setActiveObjectTool(null);
        setAnnotationMode(false);
        setSelectedFeatureIds([]);
        setSelectedGroupId(null);
        setSelectedReferenceId(null);
      }
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const serviceLabel = serviceState === "checking"
    ? copy.connecting
    : serviceState === "online"
      ? copy.serviceOnline
      : copy.serviceOffline;

  const saveLabel = saveState === "saving"
    ? copy.saving
    : saveState === "saved"
      ? copy.saved
      : saveState === "error"
        ? copy.saveFailed
        : isDirty
          ? copy.unsaved
          : copy.ready;
  const showEditorStatus = isDirty || saveState !== "idle" || Boolean(statusDetail);
  const editorStatusClass = isDirty && saveState === "idle" ? "dirty" : saveState;

  useEffect(() => {
    if (saveState !== "saved") return;
    const timeout = window.setTimeout(() => setSaveState("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  const selectModel = async (model: ModelRecord) => {
    if (draftModel?.id === model.id) {
      setSelectedFeatureIds([]);
      setSelectedGroupId(null);
      setSelectedReferenceId(null);
      setActiveObjectTool(null);
      setAnnotationMode(false);
      setNavigationMode(false);
      setActiveInspectorTab("features");
      return;
    }
    try {
      const freshModel = await getModel(model.id);
      applyModel(freshModel);
      setSelectedFeatureIds([]);
      setSelectedGroupId(null);
      setSelectedReferenceId(null);
      setActiveInspectorTab("features");
    } catch (error) {
      setSaveState("error");
      setStatusDetail(error instanceof Error ? error.message : String(error));
    }
  };

  const handleCreateModel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = createName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const model = await createModel({ name });
      applyModel(model);
      setCreateName("");
      setCreateDialogOpen(false);
      setProjectExpanded(true);
      setModelsExpanded(true);
      setActiveInspectorTab("features");
    } catch (error) {
      setSaveState("error");
      setStatusDetail(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  const saveChanges = async () => {
    if (!draftModel || !savedModel || !isDirty || saveState === "saving") return;
    setSaveState("saving");
    setStatusDetail("");
    let current = savedModel;
    try {
      const metadataChanged = current.name !== draftModel.name
        || current.description !== draftModel.description
        || current.unit !== draftModel.unit;
      if (metadataChanged) {
        current = await updateModel(current.id, {
          expectedRevision: current.revision,
          name: draftModel.name,
          description: draftModel.description,
          unit: draftModel.unit,
        });
      }
      if (JSON.stringify(current.featureGraph) !== JSON.stringify(draftModel.featureGraph)) {
        current = await replaceFeatureGraph(current.id, current.revision, draftModel.featureGraph);
      }
      applyModel(current, { preserveHistory: true });
      setSaveState("saved");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const latest = await getModel(draftModel.id);
        applyModel(latest);
        setSaveState("error");
        setStatusDetail(copy.conflictReloaded);
      } else {
        setSaveState("error");
        setStatusDetail(error instanceof Error ? error.message : String(error));
      }
    }
  };

  const updateBoxParameter = (key: "width" | "depth" | "height" | "cornerRadius", value: number) => {
    if (!Number.isFinite(value) || (key === "cornerRadius" ? value < 0 : value <= 0)) return;
    updateDraftWithHistory((current) => {
      const features = current.featureGraph.features.map((feature) => feature.id === selectedFeature?.id && feature.type === "box"
        ? (() => {
          const parameters: BoxFeature["parameters"] = { ...feature.parameters, [key]: value };
          const maximumRadius = Math.min(parameters.width, parameters.depth, parameters.height) / 2;
          parameters.cornerRadius = Math.min(parameters.cornerRadius ?? 0, maximumRadius);
          if (key === "cornerRadius") delete parameters.cornerRadii;
          else if (parameters.cornerRadii) {
            parameters.cornerRadii = clampBoxCornerRadii(resolveBoxCornerRadii(parameters), maximumRadius);
          }
          return { ...feature, parameters };
        })()
        : feature);
      return { ...current, featureGraph: { ...current.featureGraph, features } };
    });
  };

  const updateBoxCornerRadius = (corner: BoxCornerKey, value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    updateDraftWithHistory((current) => {
      const features = current.featureGraph.features.map((feature) => feature.id === selectedFeature?.id && feature.type === "box"
        ? (() => {
          const maximumRadius = Math.min(feature.parameters.width, feature.parameters.depth, feature.parameters.height) / 2;
          const cornerRadii: BoxCornerRadii = {
            ...clampBoxCornerRadii(resolveBoxCornerRadii(feature.parameters), maximumRadius),
            [corner]: Math.min(value, maximumRadius),
          };
          return {
            ...feature,
            parameters: {
              ...feature.parameters,
              cornerRadius: cornerRadii.xMinYMinZMin,
              cornerRadii,
            },
          };
        })()
        : feature);
      return { ...current, featureGraph: { ...current.featureGraph, features } };
    });
  };

  const applyBoxCornerRadiusExpression = () => {
    const parsed = parseBoxCornerRadiusExpression(cornerRadiusExpression);
    if (!parsed || selectedFeature?.type !== "box") {
      setCornerRadiusExpressionError(copy.cornerExpressionInvalid);
      return;
    }
    const maximumRadius = Math.min(
      selectedFeature.parameters.width,
      selectedFeature.parameters.depth,
      selectedFeature.parameters.height,
    ) / 2;
    const cornerRadii = clampBoxCornerRadii(parsed, maximumRadius);
    updateDraftWithHistory((current) => {
      const features = current.featureGraph.features.map((feature) => feature.id === selectedFeature.id && feature.type === "box"
        ? (() => {
          const parameters: BoxFeature["parameters"] = {
            ...feature.parameters,
            cornerRadius: cornerRadii.xMinYMinZMin,
          };
          if (boxCornerRadiiAreUniform(cornerRadii)) delete parameters.cornerRadii;
          else parameters.cornerRadii = cornerRadii;
          return { ...feature, parameters };
        })()
        : feature);
      return { ...current, featureGraph: { ...current.featureGraph, features } };
    });
    setCornerRadiusExpression(formatBoxCornerRadiusExpression(cornerRadii));
    setCornerRadiusExpressionError("");
  };

  const updateBoxCornerAlgorithm = (value: CornerAlgorithm) => {
    updateDraftWithHistory((current) => {
      const features = current.featureGraph.features.map((feature) => feature.id === selectedFeature?.id && feature.type === "box"
        ? { ...feature, parameters: { ...feature.parameters, cornerAlgorithm: value } }
        : feature);
      return { ...current, featureGraph: { ...current.featureGraph, features } };
    });
  };

  const updateCylinderParameter = (key: keyof CylinderFeature["parameters"], value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    updateDraftWithHistory((current) => {
      const features = current.featureGraph.features.map((feature) => feature.id === selectedFeature?.id && feature.type === "cylinder"
        ? { ...feature, parameters: { ...feature.parameters, [key]: value } }
        : feature);
      return { ...current, featureGraph: { ...current.featureGraph, features } };
    });
  };

  const updateSelectedProceduralSource = (mutate: (source: ProceduralMeshSource) => void) => {
    if (!selectedFeature || selectedFeature.type !== "mesh" || !selectedFeature.parameters.source) return;
    updateDraftWithHistory((current) => {
      let roomSource: RoomShellSource | null = null;
      const rebuiltFeatures = current.featureGraph.features.map((feature) => {
          if (feature.id !== selectedFeature.id || feature.type !== "mesh" || !feature.parameters.source) return feature;
          const source = structuredClone(feature.parameters.source);
          mutate(source);
          const regenerated = regenerateProceduralMeshFeature(feature, source);
          if (regenerated.parameters.source?.kind === "room-shell") roomSource = regenerated.parameters.source;
          return regenerated;
        });
      const features = roomSource ? synchronizeRoomAssemblyFeatures(rebuiltFeatures, roomSource) : rebuiltFeatures;
      return {
        ...current,
        featureGraph: { ...current.featureGraph, features },
      };
    });
  };

  const updateProceduralSize = (index: number, value: number) => {
    if (!Number.isFinite(value) || value <= 0) return;
    updateSelectedProceduralSource((source) => {
      source.size[index] = value;
    });
  };

  const updateProceduralRadius = (key: "outlineRadius" | "edgeFilletRadius", value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    updateSelectedProceduralSource((source) => {
      if (source.kind === "room-shell") return;
      source[key] = value;
    });
  };

  const updateRoomShellParameter = (
    key: "wallThickness" | "floorThickness" | "autoHideSurfaces",
    value: number | boolean,
  ) => {
    if (typeof value === "number" && (!Number.isFinite(value) || value <= 0)) return;
    updateSelectedProceduralSource((source) => {
      if (source.kind !== "room-shell") return;
      if (key === "autoHideSurfaces") source.autoHideSurfaces = Boolean(value);
      else source[key] = Number(value);
    });
  };

  const updateRoomOpening = (
    opening: "door" | "window",
    key: "width" | "height" | "offsetZ" | "sillHeight" | "offsetX",
    value: number,
  ) => {
    if (!Number.isFinite(value)) return;
    if ((key === "width" || key === "height") && value <= 0) return;
    if (key === "sillHeight" && value < 0) return;
    updateSelectedProceduralSource((source) => {
      if (source.kind !== "room-shell") return;
      if (opening === "door") {
        if (key === "width" || key === "height" || key === "offsetZ") source.door[key] = value;
      } else if (key === "width" || key === "height" || key === "sillHeight" || key === "offsetX") {
        source.window[key] = value;
      }
    });
  };

  const updateRoomWindowMode = (fullWall: boolean) => {
    updateSelectedProceduralSource((source) => {
      if (source.kind !== "room-shell") return;
      source.window.fullWall = fullWall;
    });
  };

  const updateModelVariable = (variableId: string, value: number | string) => {
    if (typeof value === "number" ? !Number.isFinite(value) : !/^#[0-9A-F]{6}$/.test(value)) return;
    updateDraftWithHistory((current) => {
      const variables = (current.featureGraph.variables ?? []).map((variable) => {
        if (variable.id !== variableId) return variable;
        if (variable.type === "color" && typeof value === "string") return { ...variable, value };
        if (variable.type !== "color" && typeof value === "number") return { ...variable, value };
        return variable;
      });
      const resolved = rebuildParameterizedFeatureGraph({ ...current.featureGraph, variables });
      setParameterExpressionError(resolved.issues[0]
        ? `${copy.expressionError}：${resolved.issues[0].message}`
        : "");
      return { ...current, featureGraph: resolved.featureGraph };
    });
  };

  const updateSelectedFeatureExpression = (target: string, expression: string) => {
    if (!selectedFeature) return;
    updateDraftWithHistory((current) => {
      const features = current.featureGraph.features.map((feature) => feature.id === selectedFeature.id
        ? {
            ...feature,
            parameterExpressions: {
              ...feature.parameterExpressions,
              [target]: expression,
            },
          } as ModelFeature
        : feature);
      const resolved = rebuildParameterizedFeatureGraph({ ...current.featureGraph, features });
      setParameterExpressionError(resolved.issues[0]
        ? `${copy.expressionError}：${resolved.issues[0].message}`
        : "");
      return { ...current, featureGraph: resolved.featureGraph };
    });
  };

  const updatePanelRecess = (key: "size" | "radius", index: number, value: number) => {
    if (!Number.isFinite(value) || value < 0) return;
    updateSelectedProceduralSource((source) => {
      if (source.kind !== "recessed-panel") return;
      if (key === "radius") source.recessRadius = value;
      else source.recessSize[index] = value;
    });
  };

  const updateDeckRecess = (
    recessIndex: number,
    key: "center" | "size" | "depth",
    axis: number,
    value: number,
  ) => {
    if (!Number.isFinite(value) || (key !== "center" && value < 0)) return;
    updateSelectedProceduralSource((source) => {
      if (source.kind !== "recessed-deck") return;
      const recess = source.recesses[recessIndex];
      if (!recess) return;
      if (key === "depth") recess.depth = value;
      else recess[key][axis] = value;
    });
  };

  const updateSelectedFeatureAppearance = (patch: Partial<FeatureAppearance>) => {
    if (!selectedFeature || selectedFeature.operation !== "add") return;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: current.featureGraph.features.map((feature) => feature.id === selectedFeature.id
          ? { ...feature, appearance: { ...feature.appearance, ...patch } }
          : feature),
      },
    }));
  };

  const clearSelectedFeatureColor = () => {
    if (!selectedFeature?.appearance?.color) return;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: current.featureGraph.features.map((feature) => {
          if (feature.id !== selectedFeature.id) return feature;
          const { color: _color, ...appearance } = feature.appearance ?? {};
          return { ...feature, appearance };
        }),
      },
    }));
  };

  const resetSelectedFeatureAppearance = () => {
    if (!selectedFeature?.appearance) return;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: current.featureGraph.features.map((feature) => {
          if (feature.id !== selectedFeature.id) return feature;
          const { appearance: _appearance, ...rest } = feature;
          return rest as ModelFeature;
        }),
      },
    }));
  };

  const updateVoxelSkinModel = (nextModel: VoxelSkinModel) => {
    if (!voxelSkin) return;
    updateDraftWithHistory((current) => {
      const torso = current.featureGraph.features.find((feature) => (
        feature.type === "box" && feature.appearance?.voxelSkin?.part === "torso"
      ));
      const pixelSize = torso?.type === "box" ? torso.parameters.width / 8 : null;
      const features = current.featureGraph.features.map((feature) => {
        const skin = feature.appearance?.voxelSkin;
        if (!skin) return feature;
        const appearance = { ...feature.appearance, voxelSkin: { ...skin, model: nextModel } };
        if (feature.type !== "box" || pixelSize === null || (skin.part !== "leftArm" && skin.part !== "rightArm")) {
          return { ...feature, appearance };
        }
        const width = pixelSize * (nextModel === "slim" ? 3 : 4);
        const torsoWidth = torso?.type === "box" ? torso.parameters.width : pixelSize * 8;
        const direction = skin.part === "leftArm" ? -1 : 1;
        return {
          ...feature,
          appearance,
          position: [direction * (torsoWidth / 2 + width / 2), feature.position[1], feature.position[2]] as Vector3Tuple,
          parameters: { ...feature.parameters, width },
        };
      });
      return { ...current, featureGraph: { ...current.featureGraph, features } };
    });
  };

  const updateVoxelSkinUrl = (url: string) => {
    if (!voxelSkin || (!url.startsWith("data:image/png") && url !== BUILTIN_VOXEL_SKIN_URL)) return;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: current.featureGraph.features.map((feature) => feature.appearance?.voxelSkin
          ? {
              ...feature,
              appearance: {
                ...feature.appearance,
                voxelSkin: { ...feature.appearance.voxelSkin, url },
              },
            }
          : feature),
      },
    }));
  };

  const updateFeatureGroups = (update: (groups: FeatureGroup[]) => FeatureGroup[]) => {
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        groups: update(current.featureGraph.groups ?? []),
      },
    }));
  };

  const selectFeatureFromPointer = (featureId: string | null, additive: boolean) => {
    setTreeMenu(null);
    const referenceId = featureId ? resolvedReferences.referenceIdByFeatureId.get(featureId) : null;
    if (referenceId) {
      setSelectedFeatureIds([]);
      setSelectedGroupId(null);
      setSelectedReferenceId(referenceId);
      setActiveInspectorTab("features");
      return;
    }
    if (!featureId) {
      if (!additive) {
        setSelectedFeatureIds([]);
        setSelectedGroupId(null);
        setSelectedReferenceId(null);
        setActiveInspectorTab("properties");
      }
      return;
    }

    if (!additive) {
      setSelectedFeatureIds([featureId]);
      setSelectedGroupId(null);
      setSelectedReferenceId(null);
      setActiveInspectorTab("features");
      return;
    }

    const groupSelection = selectedGroup?.featureIds ?? [];
    setSelectedFeatureIds((current) => {
      const base = groupSelection.length > 0 ? groupSelection : current;
      return base.includes(featureId) ? base.filter((id) => id !== featureId) : [...base, featureId];
    });
    setSelectedGroupId(null);
    setSelectedReferenceId(null);
    setActiveInspectorTab("features");
  };

  const selectGroupFromTree = (group: FeatureGroup, additive: boolean) => {
    if (!additive) {
      setSelectedFeatureIds([]);
      setSelectedGroupId(group.id);
      setSelectedReferenceId(null);
      setActiveInspectorTab("features");
      return;
    }

    const groupSelection = selectedGroup?.featureIds ?? [];
    setSelectedFeatureIds((current) => {
      const base = groupSelection.length > 0 ? groupSelection : current;
      const allMembersSelected = group.featureIds.length > 0 && group.featureIds.every((id) => base.includes(id));
      return allMembersSelected
        ? base.filter((id) => !group.featureIds.includes(id))
        : [...new Set([...base, ...group.featureIds])];
    });
    setSelectedGroupId(null);
    setSelectedReferenceId(null);
    setActiveInspectorTab("features");
  };

  const openContextMenu = (x: number, y: number, target: TreeMenuTarget) => {
    setMenuOpen(false);
    setTreeMenu({
      x: Math.min(x, window.innerWidth - 220),
      y: Math.min(y, window.innerHeight - 330),
      target,
    });
  };

  const openFeatureContextMenu = (featureId: string, x: number, y: number) => {
    if (selectedGroup?.featureIds.includes(featureId)) {
      openContextMenu(x, y, { kind: "group", groupId: selectedGroup.id });
      return;
    }
    if (selectedFeatureIds.includes(featureId)) {
      openContextMenu(x, y, selectedFeatureIds.length > 1
        ? { kind: "selection", featureIds: selectedFeatureIds }
        : { kind: "feature", featureId });
      return;
    }
    setSelectedFeatureIds([featureId]);
    setSelectedGroupId(null);
    setActiveInspectorTab("features");
    openContextMenu(x, y, { kind: "feature", featureId });
  };

  const openGroupContextMenu = (group: FeatureGroup, x: number, y: number) => {
    const groupAlreadySelected = selectedGroup?.id === group.id
      || (group.featureIds.length > 0 && group.featureIds.every((id) => selectedFeatureIds.includes(id)));
    if (!groupAlreadySelected) {
      setSelectedFeatureIds([]);
      setSelectedGroupId(group.id);
      setActiveInspectorTab("features");
    }
    openContextMenu(x, y, { kind: "group", groupId: group.id });
  };

  const createFeatureGroup = (featureIds: string[] = []) => {
    const groupId = window.crypto.randomUUID();
    const groupName = `${copy.newGroup} ${featureGroups.length + 1}`;
    updateFeatureGroups((groups) => [
      ...groups.map((group) => featureIds.length > 0
        ? { ...group, featureIds: group.featureIds.filter((id) => !featureIds.includes(id)) }
        : group),
      {
        id: groupId,
        name: groupName,
        featureIds,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      },
    ]);
    setSelectedFeatureIds([]);
    setSelectedGroupId(groupId);
    setSelectedReferenceId(null);
    setActiveInspectorTab("features");
    setExpandedGroupIds((current) => [...current, groupId]);
    setTreeMenu(null);
  };

  const moveFeaturesToGroup = (featureIds: string[], groupId: string) => {
    updateFeatureGroups((groups) => groups.map((group) => ({
      ...group,
      featureIds: group.id === groupId
        ? [...group.featureIds.filter((id) => !featureIds.includes(id)), ...featureIds]
        : group.featureIds.filter((id) => !featureIds.includes(id)),
    })));
    setExpandedGroupIds((current) => current.includes(groupId) ? current : [...current, groupId]);
    setSelectedGroupId(null);
    setSelectedFeatureIds(featureIds);
    setTreeMenu(null);
  };

  const removeFeaturesFromGroups = (featureIds: string[]) => {
    updateFeatureGroups((groups) => groups.map((group) => ({
      ...group,
      featureIds: group.featureIds.filter((id) => !featureIds.includes(id)),
    })));
    setTreeMenu(null);
  };

  const dissolveFeatureGroup = (groupId: string) => {
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        groups: (current.featureGraph.groups ?? []).filter((group) => group.id !== groupId),
        joints: (current.featureGraph.joints ?? []).filter((joint) => joint.groupId !== groupId),
      },
    }));
    if (selectedGroupId === groupId) setSelectedGroupId(null);
    setActiveInspectorTab("properties");
    setExpandedGroupIds((current) => current.filter((id) => id !== groupId));
    setTreeMenu(null);
  };

  const updateSelectedGroupName = (name: string) => {
    if (!selectedGroup || !name.trim()) return;
    updateFeatureGroups((groups) => groups.map((group) => group.id === selectedGroup.id ? { ...group, name } : group));
  };

  const updateSelectedGroupVector = (key: "position" | "rotation", index: number, value: number) => {
    if (!selectedGroup || !Number.isFinite(value)) return;
    updateFeatureGroups((groups) => groups.map((group) => {
      if (group.id !== selectedGroup.id) return group;
      const vector = [...group[key]] as Vector3Tuple;
      vector[index] = value;
      return { ...group, [key]: vector };
    }));
  };

  const updateJointValue = (jointId: string, value: number, minimum: number, maximum: number) => {
    if (!Number.isFinite(value)) return;
    jointAnimation.cancel();
    setLocomotionSpeed(0);
    const nextValue = clamp(value, minimum, maximum);
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        joints: (current.featureGraph.joints ?? []).map((joint) => joint.id === jointId
          ? { ...joint, value: nextValue }
          : joint),
      },
    }));
  };

  const updateSelectedJointValue = (value: number) => {
    if (!selectedJoint) return;
    updateJointValue(selectedJoint.id, value, selectedJoint.min, selectedJoint.max);
  };

  const updateSelectedReferenceName = (name: string) => {
    if (!selectedReference || !name.trim()) return;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        references: (current.featureGraph.references ?? []).map((reference) => reference.id === selectedReference.id
          ? { ...reference, name }
          : reference),
      },
    }));
  };

  const addModelReference = (modelId: string) => {
    if (!draftModel || modelId === draftModel.id) return;
    const source = models.find((model) => model.id === modelId);
    if (!source) return;
    const referenceId = `model-reference-${crypto.randomUUID()}`;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        references: [
          ...(current.featureGraph.references ?? []),
          {
            id: referenceId,
            name: `${source.name} · ${locale === "zh-CN" ? "引用" : "Reference"}`,
            modelId: source.id,
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          },
        ],
      },
    }));
    setSelectedFeatureIds([]);
    setSelectedGroupId(null);
    setSelectedReferenceId(referenceId);
    setActiveInspectorTab("features");
    setExpandedModelIds((current) => current.includes(draftModel.id) ? current : [...current, draftModel.id]);
    setTreeMenu(null);
  };

  const removeModelReference = (referenceId: string) => {
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        references: (current.featureGraph.references ?? []).filter((reference) => reference.id !== referenceId),
      },
    }));
    if (selectedReferenceId === referenceId) setSelectedReferenceId(null);
    setActiveInspectorTab("properties");
    setTreeMenu(null);
  };

  const updateSelectedReferenceRoomSurfaceMode = (roomSurfaceMode: "source" | "interior" | "exterior") => {
    if (!selectedReference) return;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        references: (current.featureGraph.references ?? []).map((reference) => reference.id === selectedReference.id
          ? { ...reference, roomSurfaceMode }
          : reference),
      },
    }));
  };

  const updateSelectedTransformVector = (key: "position" | "rotation" | "scale", index: number, value: number) => {
    if (!Number.isFinite(value) || (key === "scale" && value <= 0)) return;
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: current.featureGraph.features.map((feature) => {
          if (selectedGroup || selectedFeatures.length !== 1 || feature.id !== selectedFeatures[0]!.id) return feature;
          const vector = [...(key === "scale" ? feature.scale ?? [1, 1, 1] : feature[key])] as Vector3Tuple;
          if (key === "scale" && uniformScale) vector.fill(value);
          else vector[index] = value;
          return { ...feature, [key]: vector };
        }),
        groups: (current.featureGraph.groups ?? []).map((group) => {
          if (!selectedGroup || group.id !== selectedGroup.id) return group;
          const vector = [...(key === "scale" ? group.scale ?? [1, 1, 1] : group[key])] as Vector3Tuple;
          if (key === "scale" && uniformScale) vector.fill(value);
          else vector[index] = value;
          return { ...group, [key]: vector };
        }),
        references: (current.featureGraph.references ?? []).map((reference) => {
          if (!selectedReference || reference.id !== selectedReference.id) return reference;
          const vector = [...(key === "scale" ? reference.scale ?? [1, 1, 1] : reference[key])] as Vector3Tuple;
          if (key === "scale" && uniformScale) vector.fill(value);
          else vector[index] = value;
          return { ...reference, [key]: vector };
        }),
      },
    }));
  };

  const commitViewportTransforms = (transforms: TransformCommit[]) => {
    if (transforms.length === 0) return;
    const featureTransforms = new Map(transforms.filter((transform) => transform.kind === "feature").map((transform) => [transform.id, transform]));
    const groupTransforms = new Map(transforms.filter((transform) => transform.kind === "group").map((transform) => [transform.id, transform]));
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: current.featureGraph.features.map((feature) => {
          const transform = featureTransforms.get(feature.id);
          return transform ? {
            ...feature,
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale.map((value) => Math.max(0.001, Math.abs(value))) as Vector3Tuple,
          } : feature;
        }),
        groups: (current.featureGraph.groups ?? []).map((group) => {
          const transform = groupTransforms.get(group.id);
          return transform ? {
            ...group,
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale.map((value) => Math.max(0.001, Math.abs(value))) as Vector3Tuple,
          } : group;
        }),
        references: (current.featureGraph.references ?? []).map((reference) => {
          const transform = groupTransforms.get(referenceViewportGroupId(reference.id));
          return transform ? {
            ...reference,
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale.map((value) => Math.max(0.001, Math.abs(value))) as Vector3Tuple,
          } : reference;
        }),
      },
    }));
  };

  const applyMeshResult = (result: ModelFeature, sourceIds: string[]) => {
    updateDraftWithHistory((current) => ({
      ...current,
      featureGraph: {
        ...current.featureGraph,
        features: preserveSources
          ? [...current.featureGraph.features, result]
          : [...current.featureGraph.features.filter((feature) => !sourceIds.includes(feature.id)), result],
        groups: preserveSources
          ? current.featureGraph.groups ?? []
          : (current.featureGraph.groups ?? [])
            .map((group) => ({ ...group, featureIds: group.featureIds.filter((id) => !sourceIds.includes(id)) }))
            .filter((group) => group.featureIds.length > 0),
      },
    }));
    setExpandedGroupIds((current) => current.filter((groupId) => featureGroups.some((group) => group.id === groupId && (preserveSources || group.featureIds.some((id) => !sourceIds.includes(id))))));
    setSelectedGroupId(null);
    setSelectedFeatureIds([result.id]);
    setActiveInspectorTab("features");
    setActiveObjectTool(null);
    setOperationError("");
  };

  const executeBooleanOperation = () => {
    if (selectedOperationFeatures.length < 2) return;
    try {
      const result = evaluateBoolean(selectedOperationFeatures, featureGroups, booleanOperation, `${copy.booleanResult} · ${copy[booleanOperation]}`);
      applyMeshResult(result, selectedOperationFeatures.map((feature) => feature.id));
    } catch (error) {
      setOperationError(`${copy.operationFailed}：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const executePlaneCutOperation = () => {
    if (selectedOperationFeatures.length === 0) return;
    try {
      const result = evaluatePlaneCut(selectedOperationFeatures, featureGroups, cutRotation, cutOffset, keepPositive, copy.cutResult);
      applyMeshResult(result, selectedOperationFeatures.map((feature) => feature.id));
    } catch (error) {
      setOperationError(`${copy.operationFailed}：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const toggleObjectTool = (tool: ObjectTool) => {
    setOperationError("");
    setAnnotationMode(false);
    setNavigationMode(false);
    setActiveObjectTool((current) => current === tool ? null : tool);
  };

  const selectionSummaryTitle = selectedReference?.name
    ?? selectedGroup?.name
    ?? selectedFeature?.name
    ?? `${copy.selectedObjects} ${selectedFeatures.length}`;
  const selectionSummarySubtitle = selectedReference
    ? copy.modelReferences
    : selectedGroup
      ? copy.groups
      : selectedFeatures.length > 1
        ? copy.multipleSelection
        : `${selectedFeature?.type === "box" ? copy.box : selectedFeature?.type === "cylinder" ? copy.cylinder : selectedProceduralSource?.kind === "room-shell" ? copy.roomShell : selectedProceduralSource ? copy.proceduralShell : copy.mesh} · ${selectedFeature ? copy[selectedFeature.operation] : ""}`;
  const selectionSummaryIcon: SelectionSummaryIcon = selectedReference
    ? "reference"
    : selectedGroup
      ? "group"
      : selectedFeatures.length > 1
        ? "multiple"
        : selectedFeature?.type === "box"
          ? "box"
          : selectedFeature?.type === "cylinder"
            ? "cylinder"
            : "multiple";
  const selectionSummaryEntries = selectedFeature
    ? [
      { label: copy.size, value: selectedFeatureSize },
      { label: copy.position, value: `${selectedFeature.position.map(formatNumber).join(", ")} ${draftModel?.unit}` },
      { label: copy.volume, value: `${formatNumber(selectedFeatureVolume)} ${draftModel?.unit}³` },
      { label: copy.triangles, value: numberFormatter.format(selectedFeatureTriangles) },
    ]
    : selectedGroup
      ? [
        { label: copy.groupMembers, value: numberFormatter.format(selectedGroup.featureIds.length) },
        { label: copy.position, value: `${selectedGroup.position.map(formatNumber).join(", ")} ${draftModel?.unit}` },
        { label: copy.rotationLabel, value: selectedGroup.rotation.map((value) => `${formatNumber(value)}°`).join(", ") },
      ]
      : selectedReference
        ? [
          { label: copy.referencedModel, value: selectedReferenceSource?.name ?? copy.referenceMissing },
          { label: copy.liveRevision, value: selectedReferenceSource ? numberFormatter.format(selectedReferenceSource.revision) : "—" },
          { label: copy.position, value: `${selectedReference.position.map(formatNumber).join(", ")} ${draftModel?.unit}` },
          { label: copy.rotationLabel, value: selectedReference.rotation.map((value) => `${formatNumber(value)}°`).join(", ") },
        ]
        : selectedFeatures.length > 1
          ? [{ label: copy.groupMembers, value: numberFormatter.format(selectedFeatures.length) }]
          : [];

  return (
    <EditorWorkspaceShell
      className={`studio-shell${libraryCollapsed ? " library-collapsed" : ""}`}
      style={{
        "--library-width": libraryCollapsed ? "0px" : `${libraryWidth}px`,
        "--inspector-width": `${inspectorWidth}px`,
      } as CSSProperties}
    >
      <TopBar
        canRedo={historySize.redo > 0}
        canSave={isDirty && saveState !== "saving"}
        canUndo={historySize.undo > 0}
        collapsed={libraryCollapsed}
        labels={{
          collapseLibrary: copy.collapseLibrary,
          expandLibrary: copy.expandLibrary,
          noModel: copy.noModel,
          redo: copy.redo,
          revision: copy.revision,
          save: copy.save,
          undo: copy.undo,
        }}
        modelName={draftModel?.name}
        onCollapseChange={setLibraryCollapsed}
        onRedo={redo}
        onSave={saveChanges}
        onUndo={undo}
        revision={draftModel?.revision}
      />

      {!libraryCollapsed && (
        <aside className="library-panel">
          <div
            className="panel-resizer library-resizer"
            role="separator"
            tabIndex={0}
            aria-label={copy.resizeProjectTree}
            aria-orientation="vertical"
            aria-valuemin={180}
            aria-valuemax={420}
            aria-valuenow={libraryWidth}
            onPointerDown={(event) => {
              const startWidth = libraryWidth;
              const maximum = Math.min(420, Math.max(180, window.innerWidth - inspectorWidth - 420));
              beginResize(event, "resizing-column", (deltaX) => setLibraryWidth(clamp(startWidth + deltaX, 180, maximum)));
            }}
            onKeyDown={(event) => resizeWithKeyboard(event, "vertical", (delta) => {
              const maximum = Math.min(420, Math.max(180, window.innerWidth - inspectorWidth - 420));
              setLibraryWidth((width) => clamp(width + delta, 180, maximum));
            })}
          />
          <ProjectTree
            draftModel={draftModel}
            expandedGroupIds={expandedGroupIds}
            expandedModelIds={expandedModelIds}
            featureGroups={featureGroups}
            labels={copy}
            modelReferences={modelReferences}
            models={models}
            modelsExpanded={modelsExpanded}
            onExpandedGroupIdsChange={setExpandedGroupIds}
            onExpandedModelIdsChange={setExpandedModelIds}
            onFeatureContextMenu={(featureId, x, y) => openFeatureContextMenu(featureId, x, y)}
            onFeatureSelect={selectFeatureFromPointer}
            onGroupContextMenu={openGroupContextMenu}
            onGroupSelect={selectGroupFromTree}
            onModelClick={(model, isCurrentModel) => {
              if (!isCurrentModel) {
                void selectModel(model).then(() => {
                  setSelectedFeatureIds([]);
                  setSelectedGroupId(null);
                  setSelectedReferenceId(null);
                  setActiveInspectorTab("features");
                });
                setExpandedModelIds((current) => current.includes(model.id) ? current : [...current, model.id]);
              } else if (selectedFeatureIds.length > 0 || selectedGroup || selectedReference) {
                setSelectedFeatureIds([]);
                setSelectedGroupId(null);
                setSelectedReferenceId(null);
                setActiveInspectorTab("features");
              } else {
                setExpandedModelIds((current) => current.includes(model.id)
                  ? current.filter((id) => id !== model.id)
                  : [...current, model.id]);
              }
            }}
            onModelContextMenu={(modelId, x, y) => {
              setTreeMenu({
                x: Math.min(x, window.innerWidth - 210),
                y: Math.min(y, window.innerHeight - 320),
                target: { kind: "model", modelId },
              });
            }}
            onModelsExpandedChange={setModelsExpanded}
            onProjectExpandedChange={setProjectExpanded}
            onReferenceContextMenu={(referenceId, x, y) => openContextMenu(x, y, { kind: "reference", referenceId })}
            onReferenceSelect={(referenceId) => {
              setSelectedFeatureIds([]);
              setSelectedGroupId(null);
              setSelectedReferenceId(referenceId);
              setActiveInspectorTab("features");
            }}
            onTreeContextMenu={(x, y) => {
              setMenuOpen(false);
              setTreeMenu({
                x: Math.min(x, window.innerWidth - 210),
                y: Math.min(y, window.innerHeight - 320),
                target: { kind: "tree" },
              });
            }}
            projectExpanded={projectExpanded}
            projectName={projectName}
            selectedFeatureIds={selectedFeatureIds}
            selectedGroupId={selectedGroup?.id ?? null}
            selectedReferenceId={selectedReference?.id ?? null}
            ungroupedFeatures={ungroupedFeatures}
          />


          <WorkspaceMenu
            labels={copy}
            locale={locale}
            menuOpen={menuOpen}
            menuRef={menuRef}
            onLocaleChange={setLocale}
            onMenuOpenChange={setMenuOpen}
            onOpenShortcutGuide={() => {
              setMenuOpen(false);
              setShortcutGuideOpen(true);
            }}
            onThemeChange={setTheme}
            onTreeMenuClose={() => setTreeMenu(null)}
            theme={theme}
          />
        </aside>
      )}

      <TreeContextMenu
        collapsed={libraryCollapsed}
        contextFeatureIds={contextFeatureIds}
        contextGroupId={contextGroupId}
        currentModel={draftModel}
        featureGroups={featureGroups}
        labels={copy}
        menu={treeMenu}
        menuRef={treeMenuRef}
        modelsExpanded={modelsExpanded}
        onAddModelReference={addModelReference}
        onClose={() => setTreeMenu(null)}
        onCreateGroup={createFeatureGroup}
        onCreateModel={() => {
          setCreateName(copy.untitledModel);
          setCreateDialogOpen(true);
        }}
        onDissolveGroup={dissolveFeatureGroup}
        onMoveToGroup={moveFeaturesToGroup}
        onRemoveFromGroups={removeFeaturesFromGroups}
        onRemoveModelReference={removeModelReference}
        onRenameProject={() => {
          setProjectNameDraft(projectName);
          setRenameProjectOpen(true);
        }}
        onToggleTree={(expanded) => {
          setProjectExpanded(expanded);
          setModelsExpanded(expanded);
          setExpandedModelIds(expanded ? models.map((model) => model.id) : []);
          setExpandedGroupIds(expanded ? featureGroups.map((group) => group.id) : []);
        }}
        projectExpanded={projectExpanded}
      />

      <main className="viewport-panel">
        <EditorViewportToolbar
          activeInspectorTab={activeInspectorTab}
          activeObjectTool={activeObjectTool}
          annotationMode={annotationMode}
          hasModel={Boolean(draftModel)}
          labels={copy}
          modelNavigationEnabled={Boolean(draftModel?.featureGraph.navigation?.enabled)}
          navigationMode={navigationMode}
          onAnnotationModeToggle={() => {
            setActiveObjectTool(null);
            setNavigationMode(false);
            setOperationError("");
            setAnnotationMode((value) => !value);
          }}
          onCreateGroup={createFeatureGroup}
          onCreateModel={() => {
            setCreateName(copy.untitledModel);
            setCreateDialogOpen(true);
          }}
          onDissolveGroup={dissolveFeatureGroup}
          onInspectorTabChange={setActiveInspectorTab}
          onNavigationModeToggle={() => {
            setActiveObjectTool(null);
            setAnnotationMode(false);
            setOperationError("");
            setNavigationMode((value) => !value);
          }}
          onRemoveFromGroup={removeFeaturesFromGroups}
          onToggleObjectTool={toggleObjectTool}
          selectedFeatureCount={selectedFeatures.length}
          selectedFeatureGroup={Boolean(selectedFeatureGroup)}
          selectedFeatureId={selectedFeature?.id ?? null}
          selectedFeatureIds={selectedFeatureIds}
          selectedGroupId={selectedGroup?.id ?? null}
          selectedReference={Boolean(selectedReference)}
          selectedViewportCount={selectedViewportFeatureIds.length}
        />

        <ObjectToolPopover
          activeObjectTool={activeObjectTool}
          booleanOperation={booleanOperation}
          cutOffset={cutOffset}
          cutRotation={cutRotation}
          keepPositive={keepPositive}
          labels={copy}
          onBooleanOperationChange={setBooleanOperation}
          onCutOffsetChange={setCutOffset}
          onCutRotationChange={setCutRotation}
          onExecuteBoolean={executeBooleanOperation}
          onExecutePlaneCut={executePlaneCutOperation}
          onKeepPositiveChange={setKeepPositive}
          onPreserveSourcesChange={setPreserveSources}
          onTransformVectorChange={updateSelectedTransformVector}
          onUniformScaleChange={setUniformScale}
          operationError={operationError}
          preserveSources={preserveSources}
          selectedOperationCount={selectedOperationFeatures.length}
          selectedViewportCount={selectedViewportFeatureIds.length}
          transformTarget={selectedTransformTarget ?? null}
          uniformScale={uniformScale}
          unit={draftModel?.unit}
        />

        {draftModel && viewportFeatures.length > 0 && (
          <Viewport3D
            annotationMode={annotationMode}
            annotationStrings={{
              add: copy.add,
              assistActive: copy.annotationAssistActive,
              box: copy.box,
              cut: copy.cut,
              cylinder: copy.cylinder,
              feature: copy.annotationFeature,
              group: copy.annotationGroup,
              members: copy.annotationMembers,
              mesh: copy.mesh,
              path: copy.annotationPath,
              proceduralShell: copy.proceduralShell,
              roomShell: copy.roomShell,
            }}
            cutPlane={activeObjectTool === "plane-cut" ? { offset: cutOffset, rotation: cutRotation } : null}
            features={viewportFeatures}
            groups={viewportGroups}
            jointAnimation={jointAnimation.request}
            joints={draftModel.featureGraph.joints ?? []}
            label={copy.viewportPreview}
            modelId={draftModel.id}
            modelName={draftModel.name}
            rendererFailureLabel={copy.viewportRendererFailed}
            rendererReloadLabel={copy.reloadViewport}
            onSelectFeature={selectFeatureFromPointer}
            onSelectGroup={(groupId) => {
              const referenceId = referenceIdFromViewportGroupId(groupId);
              if (referenceId) {
                setSelectedFeatureIds([]);
                setSelectedGroupId(null);
                setSelectedReferenceId(referenceId);
                setActiveInspectorTab("features");
                return;
              }
              const group = featureGroups.find((item) => item.id === groupId);
              if (group) selectGroupFromTree(group, false);
            }}
            onOpenContextMenu={(featureId, point) => {
              if (featureId) openFeatureContextMenu(featureId, point.x, point.y);
              else setTreeMenu(null);
            }}
            onTransformCommit={commitViewportTransforms}
            navigation={draftModel.featureGraph.navigation ?? null}
            navigationAvatarSkin={navigationAvatarSkin}
            navigationCameraLabels={{
              god: copy.navigationGodCamera,
              "first-person": copy.navigationFirstPerson,
              "third-person": copy.navigationThirdPerson,
            }}
            navigationCameraMode={navigationCameraMode}
            navigationDynamicBodies={navigationDynamicBodies}
            navigationInteractions={navigationInteractions}
            navigationInteractionLabels={navigationInteractionLabels}
            navigationMode={navigationMode}
            navigationModeLabel={copy.navigationModeActive}
            onJointAnimationComplete={jointAnimation.complete}
            onNavigationCameraModeChange={setNavigationCameraMode}
            selectedFeatureIds={selectedViewportFeatureIds}
            selectedGroupId={selectedReference ? referenceViewportGroupId(selectedReference.id) : selectedGroup?.id ?? null}
            theme={theme}
            transformMode={transformMode}
            viewCubeLabel={copy.viewCube}
            viewLabels={viewLabels}
          />
        )}

        {(selectedFeatures.length > 0 || selectedGroup || selectedReference) && (
          <SelectionSummary
            entries={selectionSummaryEntries}
            icon={selectionSummaryIcon}
            label={copy.selectionSummary}
            subtitle={selectionSummarySubtitle}
            title={selectionSummaryTitle}
          />
        )}

        {!draftModel && (
          <div className="viewport-note">
            <strong>{copy.noModel}</strong>
            <p>{copy.selectModelHint}</p>
          </div>
        )}

      </main>

      <EditorInspectorPanel
        activeTab={activeInspectorTab}
        labels={copy}
        onResizeKeyDown={(event) => resizeWithKeyboard(event, "vertical", (delta) => {
          const maximum = Math.min(480, Math.max(240, window.innerWidth - (libraryCollapsed ? 0 : libraryWidth) - 420));
          setInspectorWidth((width) => clamp(width - delta, 240, maximum));
        })}
        onResizePointerDown={(event) => {
          const startWidth = inspectorWidth;
          const maximum = Math.min(480, Math.max(240, window.innerWidth - (libraryCollapsed ? 0 : libraryWidth) - 420));
          beginResize(event, "resizing-column", (deltaX) => setInspectorWidth(clamp(startWidth - deltaX, 240, maximum)));
        }}
        onTabChange={setActiveInspectorTab}
        width={inspectorWidth}
      >
          {activeInspectorTab === "features" ? (
            <div className="inspector-lower-pane">
              <section className="inspector-section properties">
                <div className="section-title"><span>{selectedReference ? copy.referenceTransform : selectedGroup ? copy.groupTransform : copy.parameters}</span><Settings2 size={15} /></div>
                {selectedFeatures.length === 0 && !selectedGroup && !selectedReference && (draftModel?.featureGraph.variables?.length ?? 0) > 0 && (
                  <ModelVariableEditor
                    fallbackUnit={draftModel?.unit ?? "mm"}
                    hint={copy.modelVariablesHint}
                    title={copy.modelVariables}
                    variables={draftModel?.featureGraph.variables ?? []}
                    onChange={updateModelVariable}
                  />
                )}
                {selectedFeatures.length === 0 && !selectedGroup && !selectedReference && voxelSkin && (
                  <VoxelSkinPanel
                    labels={{
                      builtIn: copy.voxelSkinBuiltIn,
                      classic: copy.voxelSkinClassic,
                      hint: copy.voxelSkinHint,
                      import: copy.voxelSkinImport,
                      imported: copy.voxelSkinImported,
                      invalid: copy.voxelSkinInvalid,
                      model: copy.voxelSkinModel,
                      reset: copy.voxelSkinReset,
                      slim: copy.voxelSkinSlim,
                      source: copy.voxelSkinSource,
                      title: copy.voxelSkinTitle,
                      tooLarge: copy.voxelSkinTooLarge,
                    }}
                    model={voxelSkin.model}
                    onModelChange={updateVoxelSkinModel}
                    onSkinUrlChange={updateVoxelSkinUrl}
                    skinUrl={voxelSkin.url}
                  />
                )}
                {selectedFeatures.length === 0 && !selectedGroup && !selectedReference && (draftModel?.featureGraph.joints?.length ?? 0) > 0 && (
                  <ModelActionsPanel
                    activeAnimationId={jointAnimation.activeClipId}
                    animations={draftModel?.featureGraph.animations ?? []}
                    joints={draftModel?.featureGraph.joints ?? []}
                    locomotion={locomotionProfile}
                    locomotionBlend={locomotionPreview?.blend ?? 0}
                    locomotionCycleDurationMs={locomotionPreview?.cycleDurationMs ?? null}
                    locomotionSpeed={locomotionSpeed}
                    locomotionState={locomotionState}
                    poses={draftModel?.featureGraph.poses ?? []}
                    labels={{
                      angle: copy.jointAngle,
                      animations: copy.animationClips,
                      closed: copy.jointClosed,
                      expanded: copy.jointExpanded,
                      half: copy.jointHalf,
                      modelActions: copy.modelActions,
                      locomotionBlend: copy.locomotionBlend,
                      locomotionCycle: copy.locomotionCycle,
                      locomotionIdle: copy.locomotionIdle,
                      locomotionRun: copy.locomotionRun,
                      locomotionRunReference: copy.locomotionRunReference,
                      locomotionSpeed: copy.locomotionSpeed,
                      locomotionTransitionEnd: copy.locomotionTransitionEnd,
                      locomotionTransitionStart: copy.locomotionTransitionStart,
                      locomotionTransition: copy.locomotionTransition,
                      locomotionWalk: copy.locomotionWalk,
                      locomotionWalkReference: copy.locomotionWalkReference,
                      posePresets: copy.posePresets,
                      range: copy.jointRange,
                      revolute: copy.jointTypeRevolute,
                    }}
                    onJointValueChange={(joint, value) => updateJointValue(joint.id, value, joint.min, joint.max)}
                    onJointPresetSelect={(joint, value) => {
                      setLocomotionSpeed(0);
                      jointAnimation.start({ [joint.id]: value }, 420, draftModel?.featureGraph.joints ?? []);
                    }}
                    onLocomotionProfileChange={updateLocomotionProfile}
                    onLocomotionSpeedChange={playLocomotionAtSpeed}
                    onAnimationSelect={(animation) => {
                      if (jointAnimation.activeClipId === animation.id) {
                        setLocomotionSpeed(0);
                        const standingPose = draftModel?.featureGraph.poses?.find((pose) => pose.id === "cyber-figure-pose-stand");
                        if (standingPose) jointAnimation.start(standingPose.jointValues, standingPose.durationMs ?? 600, draftModel?.featureGraph.joints ?? []);
                        else jointAnimation.cancel();
                        return;
                      }
                      if (locomotionProfile?.walkAnimationId === animation.id) setLocomotionSpeed(locomotionProfile.walkReferenceSpeed);
                      if (locomotionProfile?.runAnimationId === animation.id) setLocomotionSpeed(locomotionProfile.runReferenceSpeed);
                      jointAnimation.startClip(
                        animation,
                        draftModel?.featureGraph.joints ?? [],
                        locomotionProfile ? { transitionMs: locomotionProfile.transitionDurationMs } : {},
                      );
                    }}
                    onPoseSelect={(pose) => {
                      setLocomotionSpeed(0);
                      jointAnimation.start(pose.jointValues, pose.durationMs ?? 600, draftModel?.featureGraph.joints ?? []);
                    }}
                  />
                )}
                {selectedGroup && (
                  <>
                    <label className="group-name-row">
                      {copy.groupName}
                      <input
                        className="group-name-input"
                        aria-label={copy.groupName}
                        value={selectedGroup.name}
                        maxLength={120}
                        onChange={(event) => updateSelectedGroupName(event.target.value)}
                      />
                    </label>
                    <p className="group-member-count">{copy.groupMembers} · {selectedGroup.featureIds.length}</p>
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                      <label key={`position-${axis}`}>{copy.position} {axis} <span><input aria-label={`${copy.position} ${axis}`} type="number" step="0.1" value={selectedGroup.position[index]} onChange={(event) => updateSelectedGroupVector("position", index, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    ))}
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                      <label key={`rotation-${axis}`}>{copy.rotationLabel} {axis} <span><input aria-label={`${copy.rotationLabel} ${axis}`} type="number" step="1" value={selectedGroup.rotation[index]} onChange={(event) => updateSelectedGroupVector("rotation", index, Number(event.target.value))} /> °</span></label>
                    ))}
                    {selectedJoint && (
                      <div className="joint-editor">
                        <strong>{copy.joint} · {copy.jointTypeRevolute}</strong>
                        <label>{copy.jointAngle}
                          <span><input aria-label={copy.jointAngle} type="number" step="1" min={selectedJoint.min} max={selectedJoint.max} value={selectedJoint.value} onChange={(event) => updateSelectedJointValue(Number(event.target.value))} /> °</span>
                        </label>
                        <input className="joint-range" aria-label={copy.jointAngle} type="range" step="1" min={selectedJoint.min} max={selectedJoint.max} value={selectedJoint.value} onChange={(event) => updateSelectedJointValue(Number(event.target.value))} />
                        <small>{copy.jointRange} · {selectedJoint.min}°–{selectedJoint.max}°</small>
                        <div className="joint-actions">
                          <button type="button" onClick={() => updateSelectedJointValue(selectedJoint.min)}>{copy.jointClose}</button>
                          <button type="button" onClick={() => updateSelectedJointValue(selectedJoint.restValue)}>{copy.jointOpen}</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {selectedReference && (
                  <>
                    <label className="group-name-row">
                      {copy.referenceName}
                      <input
                        className="group-name-input"
                        aria-label={copy.referenceName}
                        value={selectedReference.name}
                        maxLength={120}
                        onChange={(event) => updateSelectedReferenceName(event.target.value)}
                      />
                    </label>
                    <p className="group-member-count">
                      {copy.referencedModel} · {selectedReferenceSource?.name ?? copy.referenceMissing}
                      {selectedReferenceSource ? ` · ${copy.liveRevision} ${selectedReferenceSource.revision}` : ""}
                    </p>
                    {selectedReferenceHasRoomShell && (
                      <label>{copy.roomReferenceView}
                        <select
                          aria-label={copy.roomReferenceView}
                          value={selectedReference.roomSurfaceMode ?? "source"}
                          onChange={(event) => updateSelectedReferenceRoomSurfaceMode(event.target.value as "source" | "interior" | "exterior")}
                        >
                          <option value="source">{copy.roomReferenceSource}</option>
                          <option value="interior">{copy.roomReferenceInterior}</option>
                          <option value="exterior">{copy.roomReferenceExterior}</option>
                        </select>
                      </label>
                    )}
                    {resolvedReferences.issues.filter((issue) => issue.referenceId === selectedReference.id).map((issue) => (
                      <p className="parameter-expression-error" key={`${issue.kind}-${issue.message}`}>{issue.message}</p>
                    ))}
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                      <label key={`reference-position-${axis}`}>{copy.position} {axis} <span><input aria-label={`${copy.position} ${axis}`} type="number" step="0.1" value={selectedReference.position[index]} onChange={(event) => updateSelectedTransformVector("position", index, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    ))}
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                      <label key={`reference-rotation-${axis}`}>{copy.rotationLabel} {axis} <span><input aria-label={`${copy.rotationLabel} ${axis}`} type="number" step="1" value={selectedReference.rotation[index]} onChange={(event) => updateSelectedTransformVector("rotation", index, Number(event.target.value))} /> °</span></label>
                    ))}
                    {(["X", "Y", "Z"] as const).map((axis, index) => (
                      <label key={`reference-scale-${axis}`}>{copy.scaleTool} {axis} <span><input aria-label={`${copy.scaleTool} ${axis}`} type="number" min="1" step="1" value={(selectedReference.scale?.[index] ?? 1) * 100} onChange={(event) => updateSelectedTransformVector("scale", index, Number(event.target.value) / 100)} /> %</span></label>
                    ))}
                  </>
                )}
                {selectedFeature?.type === "box" && (
                  <>
                    <label>{copy.width} <span><input aria-label={`${copy.width} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.width} onChange={(event) => updateBoxParameter("width", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.depth} <span><input aria-label={`${copy.depth} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.depth} onChange={(event) => updateBoxParameter("depth", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.height} <span><input aria-label={`${copy.height} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.height} onChange={(event) => updateBoxParameter("height", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.cornerUniform} <span><input aria-label={`${copy.cornerUniform} ${draftModel?.unit ?? "mm"}`} type="number" min="0" max={Math.min(selectedFeature.parameters.width, selectedFeature.parameters.depth, selectedFeature.parameters.height) / 2} step="0.1" placeholder="—" value={selectedFeature.parameters.cornerRadii ? "" : selectedFeature.parameters.cornerRadius ?? 0} onChange={(event) => updateBoxParameter("cornerRadius", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <details className="corner-radius-editor" key={`corner-editor-${selectedFeature.id}`}>
                      <summary><span>{copy.cornerRadii}</span><ChevronDown size={13} aria-hidden="true" /></summary>
                      <p>{copy.cornerLocalAxes}</p>
                      <div className="corner-expression-row">
                        <label htmlFor={`corner-expression-${selectedFeature.id}`}>{copy.cornerExpression}</label>
                        <div>
                          <input
                            id={`corner-expression-${selectedFeature.id}`}
                            aria-label={copy.cornerExpression}
                            value={cornerRadiusExpression}
                            onChange={(event) => setCornerRadiusExpression(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              applyBoxCornerRadiusExpression();
                            }}
                          />
                          <button type="button" onClick={applyBoxCornerRadiusExpression}>{copy.apply}</button>
                        </div>
                        <small className={cornerRadiusExpressionError ? "error" : ""}>{cornerRadiusExpressionError || copy.cornerExpressionHint}</small>
                      </div>
                      {([
                        {
                          label: copy.cornerBottom,
                          keys: ["xMinYMinZMin", "xMaxYMinZMin", "xMinYMinZMax", "xMaxYMinZMax"],
                        },
                        {
                          label: copy.cornerTop,
                          keys: ["xMinYMaxZMin", "xMaxYMaxZMin", "xMinYMaxZMax", "xMaxYMaxZMax"],
                        },
                      ] satisfies Array<{ label: string; keys: BoxCornerKey[] }>).map((layer) => (
                        <section className="corner-layer" key={layer.label}>
                          <strong>{layer.label}</strong>
                          <div className="corner-grid">
                            {layer.keys.map((corner) => (
                              <label key={corner}>
                                <span>{BOX_CORNER_LABELS[corner]}</span>
                                <div><input aria-label={`${BOX_CORNER_LABELS[corner]} ${draftModel?.unit ?? "mm"}`} type="number" min="0" max={Math.min(selectedFeature.parameters.width, selectedFeature.parameters.depth, selectedFeature.parameters.height) / 2} step="0.1" value={selectedBoxCornerRadii?.[corner] ?? 0} onChange={(event) => updateBoxCornerRadius(corner, Number(event.target.value))} /><small>{draftModel?.unit}</small></div>
                              </label>
                            ))}
                          </div>
                        </section>
                      ))}
                    </details>
                    <label>{copy.cornerAlgorithm} <select aria-label={copy.cornerAlgorithm} value={selectedFeature.parameters.cornerAlgorithm ?? "circular"} onChange={(event) => updateBoxCornerAlgorithm(event.target.value as CornerAlgorithm)}><option value="circular">{copy.cornerCircular}</option><option value="smooth">{copy.cornerSmooth}</option></select></label>
                  </>
                )}
                {selectedFeature?.type === "cylinder" && (
                  <>
                    <label>{copy.radius} <span><input aria-label={`${copy.radius} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.radius} onChange={(event) => updateCylinderParameter("radius", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.height} <span><input aria-label={`${copy.height} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedFeature.parameters.height} onChange={(event) => updateCylinderParameter("height", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                  </>
                )}
                {selectedFeature?.type === "mesh" && selectedProceduralSource && (
                  <>
                    <p className="inspector-empty">{copy.proceduralMeshHint}</p>
                    <label>{copy.width} <span><input aria-label={`${copy.width} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedProceduralSource.size[0]} onChange={(event) => updateProceduralSize(0, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.height} <span><input aria-label={`${copy.height} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedProceduralSource.size[1]} onChange={(event) => updateProceduralSize(1, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    <label>{copy.depth} <span><input aria-label={`${copy.depth} ${draftModel?.unit ?? "mm"}`} type="number" min="0.01" step="0.1" value={selectedProceduralSource.size[2]} onChange={(event) => updateProceduralSize(2, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                    {selectedProceduralSource.kind === "room-shell" ? (
                      <div className="procedural-room-editor">
                        <label>{copy.wallThickness} <span><input aria-label={`${copy.wallThickness} ${draftModel?.unit ?? "mm"}`} type="number" min="0.1" step="1" value={selectedProceduralSource.wallThickness} onChange={(event) => updateRoomShellParameter("wallThickness", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                        <label>{copy.floorThickness} <span><input aria-label={`${copy.floorThickness} ${draftModel?.unit ?? "mm"}`} type="number" min="0.1" step="1" value={selectedProceduralSource.floorThickness} onChange={(event) => updateRoomShellParameter("floorThickness", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                        <section className="room-opening-editor">
                          <strong>{copy.doorSettings}</strong>
                          <label>{copy.doorWidth} <span><input aria-label={`${copy.doorWidth} ${draftModel?.unit ?? "mm"}`} type="number" min="0.1" step="1" value={selectedProceduralSource.door.width} onChange={(event) => updateRoomOpening("door", "width", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                          <label>{copy.doorHeight} <span><input aria-label={`${copy.doorHeight} ${draftModel?.unit ?? "mm"}`} type="number" min="0.1" step="1" value={selectedProceduralSource.door.height} onChange={(event) => updateRoomOpening("door", "height", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                          <label>{copy.doorPosition} <span><input aria-label={`${copy.doorPosition} ${draftModel?.unit ?? "mm"}`} type="number" step="1" value={selectedProceduralSource.door.offsetZ} onChange={(event) => updateRoomOpening("door", "offsetZ", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                        </section>
                        <section className="room-opening-editor">
                          <strong>{copy.windowSettings}</strong>
                          <label className="tool-checkbox"><input aria-label={copy.fullWallWindow} type="checkbox" checked={selectedProceduralSource.window.fullWall === true} onChange={(event) => updateRoomWindowMode(event.target.checked)} /> {copy.fullWallWindow}</label>
                          {selectedProceduralSource.window.fullWall ? (
                            <small>{copy.fullWallWindowHint}</small>
                          ) : (
                            <>
                              <label>{copy.windowWidth} <span><input aria-label={`${copy.windowWidth} ${draftModel?.unit ?? "mm"}`} type="number" min="0.1" step="1" value={selectedProceduralSource.window.width} onChange={(event) => updateRoomOpening("window", "width", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                              <label>{copy.windowHeight} <span><input aria-label={`${copy.windowHeight} ${draftModel?.unit ?? "mm"}`} type="number" min="0.1" step="1" value={selectedProceduralSource.window.height} onChange={(event) => updateRoomOpening("window", "height", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                              <label>{copy.windowSillHeight} <span><input aria-label={`${copy.windowSillHeight} ${draftModel?.unit ?? "mm"}`} type="number" min="0" step="1" value={selectedProceduralSource.window.sillHeight} onChange={(event) => updateRoomOpening("window", "sillHeight", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                              <label>{copy.windowPosition} <span><input aria-label={`${copy.windowPosition} ${draftModel?.unit ?? "mm"}`} type="number" step="1" value={selectedProceduralSource.window.offsetX} onChange={(event) => updateRoomOpening("window", "offsetX", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                            </>
                          )}
                        </section>
                        <label className="tool-checkbox procedural-room-toggle"><input aria-label={copy.autoHideRoomSurfaces} type="checkbox" checked={selectedProceduralSource.autoHideSurfaces} onChange={(event) => updateRoomShellParameter("autoHideSurfaces", event.target.checked)} /> {copy.autoHideRoomSurfaces}</label>
                      </div>
                    ) : (
                      <>
                        <label>{copy.outlineRadius} <span><input aria-label={`${copy.outlineRadius} ${draftModel?.unit ?? "mm"}`} type="number" min="0" step="0.1" value={selectedProceduralSource.outlineRadius} onChange={(event) => updateProceduralRadius("outlineRadius", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                        <label>{copy.edgeFilletRadius} <span><input aria-label={`${copy.edgeFilletRadius} ${draftModel?.unit ?? "mm"}`} type="number" min="0" step="0.1" value={selectedProceduralSource.edgeFilletRadius} onChange={(event) => updateProceduralRadius("edgeFilletRadius", Number(event.target.value))} /> {draftModel?.unit}</span></label>
                        <div className="procedural-recess-editor">
                          <strong>{copy.recessSettings}</strong>
                          {selectedProceduralSource.kind === "recessed-panel" ? (
                            <div className="procedural-recess-fields">
                              <label>{copy.recessSpanX} <span><input type="number" min="0.01" step="0.1" value={selectedProceduralSource.recessSize[0]} onChange={(event) => updatePanelRecess("size", 0, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                              <label>{copy.recessSpanY} <span><input type="number" min="0.01" step="0.1" value={selectedProceduralSource.recessSize[1]} onChange={(event) => updatePanelRecess("size", 1, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                              <label>{copy.recessCutDepth} <span><input type="number" min="0" step="0.1" value={selectedProceduralSource.recessSize[2]} onChange={(event) => updatePanelRecess("size", 2, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                              <label>{copy.recessRadius} <span><input type="number" min="0" step="0.1" value={selectedProceduralSource.recessRadius} onChange={(event) => updatePanelRecess("radius", 0, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                            </div>
                          ) : selectedProceduralSource.recesses.map((recess, recessIndex) => (
                            <details className="corner-radius-editor" key={`recess-${recessIndex}`}>
                              <summary><span>{copy.recessSettings} {recessIndex + 1}</span><ChevronDown size={13} aria-hidden="true" /></summary>
                              <div className="procedural-recess-fields">
                                <label>{copy.position} X <span><input type="number" step="0.1" value={recess.center[0]} onChange={(event) => updateDeckRecess(recessIndex, "center", 0, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                                <label>{copy.position} Z <span><input type="number" step="0.1" value={recess.center[1]} onChange={(event) => updateDeckRecess(recessIndex, "center", 1, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                                <label>{copy.recessSpanX} <span><input type="number" min="0.01" step="0.1" value={recess.size[0]} onChange={(event) => updateDeckRecess(recessIndex, "size", 0, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                                <label>{copy.recessSpanZ} <span><input type="number" min="0.01" step="0.1" value={recess.size[1]} onChange={(event) => updateDeckRecess(recessIndex, "size", 1, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                                <label>{copy.recessCutDepth} <span><input type="number" min="0" step="0.1" value={recess.depth} onChange={(event) => updateDeckRecess(recessIndex, "depth", 0, Number(event.target.value))} /> {draftModel?.unit}</span></label>
                              </div>
                            </details>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
                {selectedFeature?.type === "mesh" && !selectedProceduralSource && <p className="inspector-empty">{copy.meshResultNotice}</p>}
                {selectedFeature && Object.keys(selectedFeature.parameterExpressions ?? {}).length > 0 && (
                  <div className="node-expression-editor">
                    <strong>{copy.nodeExpressions}</strong>
                    {Object.entries(selectedFeature.parameterExpressions ?? {}).map(([target, expression]) => (
                      <label key={target}>
                        <span><small>{copy.expressionTarget}</small><code>{target}</code></span>
                        <input aria-label={`${copy.expressionTarget} ${target}`} value={expression} onChange={(event) => updateSelectedFeatureExpression(target, event.target.value)} />
                      </label>
                    ))}
                  </div>
                )}
                {parameterExpressionError && <p className="parameter-expression-error">{parameterExpressionError}</p>}
                {selectedFeature?.operation === "add" && (
                  <div className="appearance-editor">
                    <div className="appearance-heading">
                      <strong>{copy.appearance}</strong>
                      <button type="button" disabled={!selectedFeature.appearance} onClick={resetSelectedFeatureAppearance}>{copy.resetAppearance}</button>
                    </div>
                    <label>{copy.material}
                      <select
                        aria-label={copy.material}
                        value={selectedFeature.appearance?.material ?? "default"}
                        onChange={(event) => updateSelectedFeatureAppearance({ material: event.target.value as FeatureMaterialPreset })}
                      >
                        <option value="default">{copy.materialDefault}</option>
                        <option value="wood">{copy.materialWood}</option>
                        <option value="metal">{copy.materialMetal}</option>
                        <option value="plastic">{copy.materialPlastic}</option>
                        <option value="glass">{copy.materialGlass}</option>
                        <option value="fabric">{copy.materialFabric}</option>
                        <option value="rubber">{copy.materialRubber}</option>
                      </select>
                    </label>
                    <label>{copy.color}
                      <span className="appearance-color-control">
                        <input
                          aria-label={copy.color}
                          type="color"
                          value={resolveFeatureColor(selectedFeature)}
                          onChange={(event) => updateSelectedFeatureAppearance({ color: event.target.value.toUpperCase() })}
                        />
                        <code>{resolveFeatureColor(selectedFeature).toUpperCase()}</code>
                      </span>
                    </label>
                    {selectedFeature.appearance?.color && <button className="material-color-button" type="button" onClick={clearSelectedFeatureColor}>{copy.useMaterialColor}</button>}
                  </div>
                )}
                {selectedFeatures.length > 1 && <p className="inspector-empty">{copy.selectedObjects} · {selectedFeatures.length}</p>}
                {selectedFeatures.length === 0 && !selectedGroup && !selectedReference && (draftModel?.featureGraph.variables?.length ?? 0) === 0 && (draftModel?.featureGraph.joints?.length ?? 0) === 0 && <p className="inspector-empty">{copy.noSelection}</p>}
              </section>
            </div>
          ) : (
            <div className="inspector-lower-pane">
              <section className="inspector-section metadata-form">
                <div className="section-title"><span>{copy.metadata}</span><Settings2 size={15} /></div>
                {draftModel ? (
                  <>
                    <label>
                      <span>{copy.modelName}</span>
                      <input value={draftModel.name} maxLength={120} onChange={(event) => {
                        updateDraftWithHistory((current) => ({ ...current, name: event.target.value }));
                      }} />
                    </label>
                    <label>
                      <span>{copy.modelDescription}</span>
                      <textarea value={draftModel.description} maxLength={2000} onChange={(event) => {
                        updateDraftWithHistory((current) => ({ ...current, description: event.target.value }));
                      }} />
                    </label>
                  </>
                ) : <p className="inspector-empty">{copy.selectModelHint}</p>}
              </section>
            </div>
          )}
      </EditorInspectorPanel>

      <StatusBar
        detail={statusDetail}
        editorStatusClass={editorStatusClass}
        labels={{ currentPath: copy.currentPath, unit: copy.unit, units: copy.units, workspaceStatus: copy.workspaceStatus }}
        onUnitChange={(unit) => updateDraftWithHistory((current) => ({ ...current, unit }))}
        path={statusPath}
        saveLabel={saveLabel}
        serviceLabel={serviceLabel}
        serviceState={serviceState}
        showEditorStatus={showEditorStatus}
        unit={draftModel?.unit}
      />

      <EditorDialogs
        createDialogOpen={createDialogOpen}
        createName={createName}
        creating={creating}
        labels={copy}
        onCreateDialogOpenChange={setCreateDialogOpen}
        onCreateModel={handleCreateModel}
        onCreateNameChange={setCreateName}
        onProjectNameChange={setProjectName}
        onProjectNameDraftChange={setProjectNameDraft}
        onRenameProjectOpenChange={setRenameProjectOpen}
        onShortcutGuideOpenChange={setShortcutGuideOpen}
        projectNameDraft={projectNameDraft}
        renameProjectOpen={renameProjectOpen}
        shortcutGuideOpen={shortcutGuideOpen}
        shortcutSections={shortcutSections}
      />
    </EditorWorkspaceShell>
  );
}
