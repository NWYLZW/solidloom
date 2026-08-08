import { ArrowLeft, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Viewport3D,
  type InteractionPresentation,
  type NavigationCameraMode,
  type NavigationFirstPersonAvatarMode,
} from "../../Viewport3D";
import { NAVIGATION_FIRST_PERSON_AVATAR_MODES } from "../../navigationAvatar";
import "../../styles/Viewport3D.css";
import { copyByLocale, type EditorLocale } from "../editor/editorCopy";
import { readPreference } from "../editor/workspacePreferences";
import { playCopyByLocale } from "./playCopy";
import { usePlayScene } from "./usePlayScene";
import { createPlayInteractionUI } from "./playInteractionUI";
import { PlaySettingsPanel } from "./PlaySettingsPanel";
import "./PlayWorkspace.css";

interface PlayWorkspaceProps {
  sceneId: string;
}

const FIRST_PERSON_AVATAR_MODE_KEY = "solidloom.play.firstPersonAvatarMode.v1";

export function PlayWorkspace({ sceneId }: PlayWorkspaceProps) {
  const locale = (window.localStorage.getItem("solidloom.locale") === "en" ? "en" : "zh-CN") as EditorLocale;
  const copy = copyByLocale[locale];
  const playCopy = playCopyByLocale[locale];
  const { error, loading, runtimeModel, scene } = usePlayScene(sceneId);
  const [cameraMode, setCameraMode] = useState<NavigationCameraMode>("third-person");
  const [firstPersonAvatarMode, setFirstPersonAvatarMode] = useState<NavigationFirstPersonAvatarMode>(() => (
    readPreference(
      FIRST_PERSON_AVATAR_MODE_KEY,
      NAVIGATION_FIRST_PERSON_AVATAR_MODES,
      "automatic",
    )
  ));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const theme = window.localStorage.getItem("solidloom.theme");
  const interactionPresentation = useMemo<InteractionPresentation>(() => {
    const requested = new URLSearchParams(window.location.search).get("interaction-ui");
    return requested === "quick" || requested === "panel" || requested === "modal"
      || requested === "sheet" || requested === "auto"
      ? requested
      : "modal";
  }, []);
  const interactionUI = useMemo(
    () => createPlayInteractionUI(interactionPresentation),
    [interactionPresentation],
  );

  useEffect(() => {
    document.body.classList.add("play-workspace-active");
    document.documentElement.lang = locale;
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
    document.title = scene ? `${scene.name} · ${playCopy.runtime}` : playCopy.runtime;
    return () => document.body.classList.remove("play-workspace-active");
  }, [locale, playCopy.runtime, scene, theme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FIRST_PERSON_AVATAR_MODE_KEY, firstPersonAvatarMode);
    } catch {
      // 浏览器禁用本机存储时，设置仍在当前会话内生效。
    }
  }, [firstPersonAvatarMode]);

  const interactionLabels = useMemo(() => ({
    articulationClose: copy.interactionArticulationClose,
    articulationOpen: copy.interactionArticulationOpen,
    containerClose: copy.interactionContainerClose,
    containerContents: copy.interactionContainerContents,
    containerAddProduct: copy.interactionContainerAddProduct,
    containerConfigure: copy.interactionContainerConfigure,
    containerConfigureApply: copy.interactionContainerConfigureApply,
    containerConfigureGranted: copy.interactionContainerConfigureGranted,
    containerCurrency: copy.interactionContainerCurrency,
    containerDeleteProduct: copy.interactionContainerDeleteProduct,
    containerItemsView: copy.interactionContainerItemsView,
    containerName: copy.interactionContainerName,
    containerEmpty: copy.interactionContainerEmpty,
    containerOpen: copy.interactionContainerOpen,
    containerSessionOnly: copy.interactionContainerSessionOnly,
    containerPrice: copy.interactionContainerPrice,
    containerProduct: copy.interactionContainerProduct,
    containerProducts: copy.interactionContainerProducts,
    containerStock: copy.interactionContainerStock,
    containerTakeSelected: copy.interactionContainerTakeSelected,
    containerUnavailable: copy.interactionContainerUnavailable,
    doorClose: copy.interactionDoorClose,
    doorOpen: copy.interactionDoorOpen,
    deviceClose: copy.interactionDeviceClose,
    deviceExecute: copy.interactionDeviceExecute,
    deviceOpen: copy.interactionDeviceOpen,
    deviceReady: copy.interactionDeviceReady,
    keyHint: copy.interactionKeyHint,
    powerOff: copy.interactionPowerOff,
    powerOn: copy.interactionPowerOn,
    sit: copy.interactionSit,
    stand: copy.interactionStand,
  }), [copy]);

  return (
    <main className="play-workspace">
      {scene && runtimeModel ? (
        <Viewport3D
          annotationMode={false}
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
          cutPlane={null}
          features={runtimeModel.features}
          groups={runtimeModel.groups}
          jointAnimation={null}
          joints={scene.featureGraph.joints ?? []}
          interactionUI={interactionUI}
          label={playCopy.runtime}
          modelId={scene.id}
          modelName={scene.name}
          navigation={scene.featureGraph.navigation ?? null}
          navigationAvatarSkin={runtimeModel.avatarSkin}
          navigationCameraLabels={{
            god: copy.navigationGodCamera,
            "first-person": copy.navigationFirstPerson,
            "third-person": copy.navigationThirdPerson,
          }}
          navigationCameraMode={cameraMode}
          navigationCameraControlsVisible={false}
          navigationCanConfigureInteractions={false}
          navigationFirstPersonAvatarMode={firstPersonAvatarMode}
          navigationDynamicBodies={runtimeModel.dynamicBodies}
          navigationInteractionLabels={interactionLabels}
          navigationInteractions={runtimeModel.interactions}
          navigationMode
          navigationModeLabel={copy.navigationModeActive}
          onJointAnimationComplete={() => undefined}
          onNavigationCameraModeChange={setCameraMode}
          onOpenContextMenu={() => undefined}
          onSelectFeature={() => undefined}
          onSelectGroup={() => undefined}
          onTransformCommit={() => undefined}
          rendererFailureLabel={copy.viewportRendererFailed}
          rendererReloadLabel={copy.reloadViewport}
          selectedFeatureIds={[]}
          selectedGroupId={null}
          theme={theme === "light" || theme === "dark" ? theme : "system"}
          transformMode={null}
          viewCubeLabel={copy.viewCube}
          viewLabels={[copy.viewRight, copy.viewLeft, copy.viewTop, copy.viewBottom, copy.viewFront, copy.viewBack]}
        />
      ) : (
        <div className="play-workspace-state" role="status">
          <Play aria-hidden="true" size={22} />
          <strong>{loading ? playCopy.loading : playCopy.missing}</strong>
          {error && <small>{error}</small>}
        </div>
      )}

      <nav className="play-workspace-controls" aria-label={playCopy.runtime}>
        <button
          aria-label={playCopy.back}
          className="play-icon-button play-workspace-back"
          title={playCopy.back}
          type="button"
          onClick={() => window.location.assign("/")}
        >
          <ArrowLeft aria-hidden="true" size={17} />
        </button>
      </nav>
      <PlaySettingsPanel
        cameraLabels={{
          god: copy.navigationGodCamera,
          "first-person": copy.navigationFirstPerson,
          "third-person": copy.navigationThirdPerson,
        }}
        cameraMode={cameraMode}
        firstPersonAvatarMode={firstPersonAvatarMode}
        locale={locale}
        open={settingsOpen}
        onCameraModeChange={setCameraMode}
        onFirstPersonAvatarModeChange={setFirstPersonAvatarMode}
        onOpenChange={setSettingsOpen}
      />
    </main>
  );
}
