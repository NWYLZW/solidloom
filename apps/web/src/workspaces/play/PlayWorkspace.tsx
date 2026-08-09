import { useEffect, useMemo, useState } from "react";
import {
  InputDeviceNotice,
  InputRuntimeProvider,
  useBrowserInputRuntime,
  useLastInputDevice,
} from "../../input";
import type { NavigationAvatarSkin } from "../../navigationAvatar";
import { PlayRuntimeState } from "../../play/PlayRuntimeState";
import type { RunRuntimeSnapshot } from "../../runtime-store/runRuntimeStore";
import {
  Viewport3D,
  type InteractionPresentation,
} from "../../Viewport3D";
import "../../styles/Viewport3D.css";
import { copyByLocale, type EditorLocale } from "../editor/editorCopy";
import { playCopyByLocale } from "./playCopy";
import { createPlayInteractionUI } from "./playInteractionUI";
import { PlayMenuOverlay } from "./PlayMenuOverlay";
import { resolvePlayMenuItems } from "./playMenu";
import {
  publishPlayAudioPreferences,
  readPlayAudioPreferences,
  readPlayInputPreferences,
  readPlayLocale,
  readPlayTheme,
  savePlayAudioPreferences,
  savePlayInputPreferences,
  type PlayTheme,
} from "./playPreferences";
import { usePlayUrlState } from "./usePlayUrlState";
import "./PlayWorkspace.css";

interface PlayWorkspaceProps {
  onPause: () => void;
  onReconnect: () => void;
  onResume: () => void;
  snapshot: RunRuntimeSnapshot;
}

export function PlayWorkspace({
  onPause,
  onReconnect,
  onResume,
  snapshot,
}: PlayWorkspaceProps) {
  const [locale, setLocale] = useState<EditorLocale>(readPlayLocale);
  const [theme, setTheme] = useState<PlayTheme>(readPlayTheme);
  const [audioPreferences, setAudioPreferences] = useState(readPlayAudioPreferences);
  const [inputPreferences, setInputPreferences] = useState(readPlayInputPreferences);
  const inputRuntime = useBrowserInputRuntime(inputPreferences);
  const lastInputDevice = useLastInputDevice(inputRuntime);
  const copy = copyByLocale[locale];
  const playCopy = playCopyByLocale[locale];
  const scene = snapshot.content?.scene ?? null;
  const runtimeModel = snapshot.content?.runtimeModel ?? null;
  const [avatarSkin, setAvatarSkin] = useState<NavigationAvatarSkin | null>(null);
  const {
    closeMenu,
    openMenuView,
    returnToMenu,
    setCameraMode,
    setFirstPersonAvatarMode,
    setSettingsCategory,
    state: { cameraMode, firstPersonAvatarMode, menuView, settingsCategory },
  } = usePlayUrlState();
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
  const menuItems = useMemo(
    () => resolvePlayMenuItems(scene?.featureGraph.runtimeUI?.menuItems),
    [scene?.featureGraph.runtimeUI?.menuItems],
  );

  useEffect(() => {
    document.body.classList.add("play-workspace-active");
    return () => document.body.classList.remove("play-workspace-active");
  }, []);

  useEffect(() => {
    if (menuView && snapshot.status === "ready") onPause();
    else if (!menuView && snapshot.status === "paused") onResume();
  }, [menuView, onPause, onResume, snapshot.status]);

  useEffect(() => {
    try {
      window.localStorage.setItem("solidloom.locale", locale);
    } catch {
      // 本机存储不可用时，当前运行会话中的语言仍然有效。
    }
    document.documentElement.lang = locale;
    document.title = scene ? `${scene.name} · ${playCopy.runtime}` : playCopy.runtime;
  }, [locale, playCopy.runtime, scene]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      document.documentElement.dataset.theme = theme === "system"
        ? (media.matches ? "dark" : "light")
        : theme;
    };
    try {
      window.localStorage.setItem("solidloom.theme", theme);
    } catch {
      // 本机存储不可用时，当前运行会话中的主题仍然有效。
    }
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    savePlayAudioPreferences(audioPreferences);
    publishPlayAudioPreferences(audioPreferences);
  }, [audioPreferences]);

  useEffect(() => {
    savePlayInputPreferences(inputPreferences);
  }, [inputPreferences]);

  useEffect(() => {
    setAvatarSkin(runtimeModel?.avatarSkin ?? null);
  }, [runtimeModel?.avatarSkin?.model, runtimeModel?.avatarSkin?.url]);

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
    keyHint: lastInputDevice === "gamepad" ? "A / ✕" : copy.interactionKeyHint,
    powerOff: copy.interactionPowerOff,
    powerOn: copy.interactionPowerOn,
    sit: copy.interactionSit,
    stand: copy.interactionStand,
  }), [copy, lastInputDevice]);

  return (
    <InputRuntimeProvider runtime={inputRuntime}>
      <main className="play-workspace" data-runtime-status={snapshot.status}>
        {scene && runtimeModel ? (
          <section className="play-runtime-layer play-runtime-world-layer" aria-label={playCopy.runtime}>
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
            navigationAvatarSkin={avatarSkin}
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
            semanticInputRuntime={inputRuntime}
            theme={theme}
            transformMode={null}
            viewCubeLabel={copy.viewCube}
            viewLabels={[copy.viewRight, copy.viewLeft, copy.viewTop, copy.viewBottom, copy.viewFront, copy.viewBack]}
          />
          </section>
        ) : (
          <PlayRuntimeState locale={locale} onReconnect={onReconnect} snapshot={snapshot} />
        )}

        {scene && runtimeModel && (
          <section className="play-runtime-layer play-runtime-panel-layer" aria-label={playCopy.menu}>
            <PlayMenuOverlay
              audioPreferences={audioPreferences}
              avatarSkin={avatarSkin}
              cameraLabels={{
                god: copy.navigationGodCamera,
                "first-person": copy.navigationFirstPerson,
                "third-person": copy.navigationThirdPerson,
              }}
              cameraMode={cameraMode}
              firstPersonAvatarMode={firstPersonAvatarMode}
              inputPreferences={inputPreferences}
              items={menuItems}
              locale={locale}
              onAudioPreferencesChange={setAudioPreferences}
              onAvatarSkinChange={setAvatarSkin}
              onAvatarSkinReset={() => setAvatarSkin(runtimeModel.avatarSkin)}
              onCameraModeChange={setCameraMode}
              onFirstPersonAvatarModeChange={setFirstPersonAvatarMode}
              onInputPreferencesChange={setInputPreferences}
              onLocaleChange={setLocale}
              onClose={closeMenu}
              onReturnWorkshop={() => window.location.assign("/")}
              onSettingsCategoryChange={setSettingsCategory}
              onThemeChange={setTheme}
              onViewBack={returnToMenu}
              onViewChange={openMenuView}
              sceneAvatarSkin={runtimeModel.avatarSkin}
              sceneName={scene.name}
              settingsCategory={settingsCategory}
              theme={theme}
              view={menuView}
            />
          </section>
        )}
        <InputDeviceNotice locale={locale} />
      </main>
    </InputRuntimeProvider>
  );
}
