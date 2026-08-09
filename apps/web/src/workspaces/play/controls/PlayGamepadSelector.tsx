import { type KeyboardEvent, useRef } from "react";
import asymmetricGamepadImage from "../../../assets/gamepads/asymmetric.png";
import genericGamepadImage from "../../../assets/gamepads/generic.png";
import splitGamepadImage from "../../../assets/gamepads/split.png";
import symmetricGamepadImage from "../../../assets/gamepads/symmetric.png";
import type { ConnectedGamepad } from "../../../input";
import type { EditorLocale } from "../../editor/editorCopy";
import {
  adjacentGamepad,
  connectedGamepadKey,
  gamepadDisplayName,
  gamepadVisualFamily,
} from "./gamepadPresentation";
import "./PlayGamepadSelector.css";

const imageByFamily = {
  asymmetric: asymmetricGamepadImage,
  generic: genericGamepadImage,
  split: splitGamepadImage,
  symmetric: symmetricGamepadImage,
};

interface PlayGamepadSelectorProps {
  gamepads: readonly ConnectedGamepad[];
  locale: EditorLocale;
  onSelect: (gamepad: ConnectedGamepad) => void;
  selectedKey: string;
}

function mappingLabel(gamepad: ConnectedGamepad, locale: EditorLocale) {
  if (locale === "en") {
    if (gamepad.mapping === "standard") return "Standard mapping";
    if (gamepad.mapping === "custom") return "Custom mapping";
    return "Needs calibration";
  }
  if (gamepad.mapping === "standard") return "标准映射";
  if (gamepad.mapping === "custom") return "自定义映射";
  return "需要校准";
}

export function PlayGamepadSelector({
  gamepads,
  locale,
  onSelect,
  selectedKey,
}: PlayGamepadSelectorProps) {
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  if (gamepads.length < 2) return null;

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    const next = adjacentGamepad(gamepads, currentIndex, event.key);
    if (!next) return;
    event.preventDefault();
    onSelect(next);
    const nextCard = cardRefs.current.get(connectedGamepadKey(next));
    nextCard?.focus();
    nextCard?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  };

  return (
    <div
      aria-label={locale === "en" ? "Connected gamepads" : "已连接手柄"}
      className="play-gamepad-selector"
      role="radiogroup"
    >
      {gamepads.map((gamepad, index) => {
        const key = connectedGamepadKey(gamepad);
        const selected = key === selectedKey;
        const fallbackName = locale === "en" ? `Gamepad ${index + 1}` : `手柄 ${index + 1}`;
        const name = gamepadDisplayName(gamepad, fallbackName);
        return (
          <button
            aria-checked={selected}
            className="play-gamepad-card"
            data-selected={selected || undefined}
            key={key}
            onClick={() => onSelect(gamepad)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            ref={(node) => {
              if (node) cardRefs.current.set(key, node);
              else cardRefs.current.delete(key);
            }}
            role="radio"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span className="play-gamepad-card-media">
              <img
                alt=""
                aria-hidden="true"
                draggable={false}
                src={imageByFamily[gamepadVisualFamily(gamepad.id)]}
              />
            </span>
            <span className="play-gamepad-card-copy">
              <strong title={gamepad.id}>{name}</strong>
              <small>{mappingLabel(gamepad, locale)}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
