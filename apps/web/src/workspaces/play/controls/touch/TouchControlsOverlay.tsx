import { Gauge, Hand, MoveDown, MoveUp } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useInputRuntime, useInputSnapshot, type InputDigitalAction } from "../../../../input";
import { resolveTouchJoystick, resolveTouchLookDelta } from "../../../../input/touch/touchInputMath";
import type { EditorLocale } from "../../../editor/editorCopy";
import "./TouchControlsOverlay.css";

const MOVE_SOURCE = "touch:move";
const LOOK_SOURCE = "touch:look";

interface TouchControlsOverlayProps {
  locale: EditorLocale;
}

const copy = {
  "zh-CN": {
    crouch: "蹲下",
    interact: "交互",
    jump: "跳跃",
    look: "拖动调整视角",
    move: "移动",
    sprint: "冲刺",
  },
  en: {
    crouch: "Crouch",
    interact: "Interact",
    jump: "Jump",
    look: "Drag to look",
    move: "Move",
    sprint: "Sprint",
  },
} satisfies Record<EditorLocale, Record<string, string>>;

function TouchActionButton({
  action,
  children,
  className = "",
  label,
}: {
  action: InputDigitalAction;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const runtime = useInputRuntime();
  const sourceId = `touch:action:${action}`;
  const release = (event: ReactPointerEvent<HTMLButtonElement>) => {
    runtime.clearExternalInput(sourceId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  useEffect(() => () => runtime.clearExternalInput(sourceId), [runtime, sourceId]);
  return (
    <button
      aria-label={label}
      className={`play-touch-action ${className}`.trim()}
      data-touch-action={action}
      onContextMenu={(event) => event.preventDefault()}
      onPointerCancel={release}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        runtime.updateExternalInput(sourceId, { actions: { [action]: 1 }, device: "touch" });
      }}
      onPointerUp={release}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

export function TouchControlsOverlay({ locale }: TouchControlsOverlayProps) {
  const runtime = useInputRuntime();
  const snapshot = useInputSnapshot();
  const labels = copy[locale];
  const joystickPointer = useRef<number | null>(null);
  const joystickOrigin = useRef({ x: 0, y: 0 });
  const lookPointer = useRef<number | null>(null);
  const lookPrevious = useRef({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  useEffect(() => () => {
    runtime.clearExternalInput(MOVE_SOURCE);
    runtime.clearExternalInput(LOOK_SOURCE);
  }, [runtime]);

  const releaseJoystick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== event.pointerId) return;
    joystickPointer.current = null;
    setKnob({ x: 0, y: 0 });
    runtime.clearExternalInput(MOVE_SOURCE);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const releaseLook = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (lookPointer.current !== event.pointerId) return;
    lookPointer.current = null;
    runtime.clearExternalInput(LOOK_SOURCE);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="play-touch-controls" data-input-context={snapshot.context}>
      <div
        aria-label={labels.look}
        className="play-touch-look-surface"
        onContextMenu={(event) => event.preventDefault()}
        onPointerCancel={releaseLook}
        onPointerDown={(event) => {
          if (snapshot.context !== "gameplay" || lookPointer.current !== null) return;
          event.preventDefault();
          lookPointer.current = event.pointerId;
          lookPrevious.current = { x: event.clientX, y: event.clientY };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (lookPointer.current !== event.pointerId) return;
          event.preventDefault();
          const preferences = runtime.getPreferences();
          const delta = resolveTouchLookDelta(
            event.clientX - lookPrevious.current.x,
            event.clientY - lookPrevious.current.y,
            preferences.lookSensitivity,
            preferences.invertLookY,
          );
          lookPrevious.current = { x: event.clientX, y: event.clientY };
          runtime.updateExternalInput(LOOK_SOURCE, { device: "touch", lookDelta: delta });
        }}
        onPointerUp={releaseLook}
        role="application"
      />

      <div
        aria-label={labels.move}
        className="play-touch-joystick"
        onContextMenu={(event) => event.preventDefault()}
        onPointerCancel={releaseJoystick}
        onPointerDown={(event) => {
          if (snapshot.context !== "gameplay" || joystickPointer.current !== null) return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          joystickPointer.current = event.pointerId;
          joystickOrigin.current = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (joystickPointer.current !== event.pointerId) return;
          event.preventDefault();
          const radius = event.currentTarget.getBoundingClientRect().width * 0.34;
          const result = resolveTouchJoystick(
            joystickOrigin.current,
            { x: event.clientX, y: event.clientY },
            radius,
          );
          setKnob(result.knob);
          runtime.updateExternalInput(MOVE_SOURCE, {
            device: "touch",
            move: { x: result.value.x, y: -result.value.y },
          });
        }}
        onPointerUp={releaseJoystick}
        role="application"
      >
        <span className="play-touch-joystick-ring" />
        <span
          className="play-touch-joystick-knob"
          style={{ transform: `translate3d(${knob.x}px, ${knob.y}px, 0)` }}
        />
      </div>

      <div className="play-touch-actions" aria-label={labels.interact}>
        <TouchActionButton action="sprint" className="play-touch-action-secondary" label={labels.sprint}>
          <Gauge aria-hidden="true" />
        </TouchActionButton>
        <TouchActionButton action="crouch" className="play-touch-action-secondary" label={labels.crouch}>
          <MoveDown aria-hidden="true" />
        </TouchActionButton>
        <TouchActionButton action="jump" label={labels.jump}>
          <MoveUp aria-hidden="true" />
        </TouchActionButton>
        <TouchActionButton action="primary" className="play-touch-action-primary" label={labels.interact}>
          <Hand aria-hidden="true" />
        </TouchActionButton>
      </div>
    </div>
  );
}
