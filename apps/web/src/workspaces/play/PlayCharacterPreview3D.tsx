import { useEffect, useRef } from "react";
import type { NavigationAvatarSkin } from "../../navigationAvatar";
import { createCharacterPreviewScene } from "./characterPreviewScene";
import "./PlayCharacterPreview3D.css";

interface PlayCharacterPreview3DProps {
  label: string;
  skin: NavigationAvatarSkin;
}

export function PlayCharacterPreview3D({ label, skin }: PlayCharacterPreview3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const preview = createCharacterPreviewScene({ canvas, skin });

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      preview.resize(width, height);
    });
    resizeObserver.observe(canvas);
    preview.renderer.setAnimationLoop(preview.render);
    preview.render();

    return () => {
      preview.renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      preview.dispose();
    };
  }, [skin.model, skin.url]);

  return (
    <canvas
      aria-label={label}
      className="play-character-preview-canvas"
      ref={canvasRef}
      role="application"
      tabIndex={0}
    />
  );
}
