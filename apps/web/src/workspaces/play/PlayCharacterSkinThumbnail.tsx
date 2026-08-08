import { useEffect, useState } from "react";
import type { NavigationAvatarSkin } from "../../navigationAvatar";
import { createCharacterPreviewScene } from "./characterPreviewScene";
import "./PlayCharacterSkinThumbnail.css";

const thumbnailCache = new Map<string, Promise<string>>();
let thumbnailQueue = Promise.resolve();

function thumbnailKey(skin: NavigationAvatarSkin) {
  return `${skin.model}:${skin.url}`;
}

function waitForFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function renderThumbnail(skin: NavigationAvatarSkin) {
  const key = thumbnailKey(skin);
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  const task = thumbnailQueue.then(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 240;
    let resolveTexture: () => void = () => {};
    const textureReady = new Promise<void>((resolve) => { resolveTexture = resolve; });
    const preview = createCharacterPreviewScene({
      canvas,
      onTextureReady: resolveTexture,
      preserveDrawingBuffer: true,
      skin,
    });
    preview.resize(canvas.width, canvas.height);
    await Promise.race([
      textureReady,
      new Promise<void>((resolve) => window.setTimeout(resolve, 500)),
    ]);
    await waitForFrame();
    preview.render();
    const imageUrl = canvas.toDataURL("image/png");
    preview.dispose(true);
    return imageUrl;
  });
  thumbnailQueue = task.then(() => undefined, () => undefined);
  thumbnailCache.set(key, task);
  return task;
}

interface PlayCharacterSkinThumbnailProps {
  label: string;
  skin: NavigationAvatarSkin;
}

export function PlayCharacterSkinThumbnail({ label, skin }: PlayCharacterSkinThumbnailProps) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSrc("");
    void renderThumbnail(skin).then((imageUrl) => {
      if (!cancelled) setSrc(imageUrl);
    });
    return () => { cancelled = true; };
  }, [skin.model, skin.url]);

  return src
    ? <img alt={label} className="play-character-skin-thumbnail" src={src} />
    : <span aria-label={label} className="play-character-skin-thumbnail loading" role="img" />;
}
