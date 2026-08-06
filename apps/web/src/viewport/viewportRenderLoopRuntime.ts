import type { RuntimeDisposable } from "./runtimeLifecycle";

export interface ViewportRenderFrame {
  deltaSeconds: number;
  frameTime: number;
  renderRequested: boolean;
}

interface CreateViewportRenderLoopRuntimeOptions {
  cancelFrame?: (handle: number) => void;
  now?: () => number;
  onFrame: (frame: ViewportRenderFrame) => boolean;
  requestFrame?: (callback: FrameRequestCallback) => number;
}

export interface ViewportRenderLoopRuntime extends RuntimeDisposable {
  readonly renderRequested: boolean;
  requestRender: () => void;
}

export function createViewportRenderLoopRuntime({
  cancelFrame = (handle) => window.cancelAnimationFrame(handle),
  now = () => performance.now(),
  onFrame,
  requestFrame = (callback) => window.requestAnimationFrame(callback),
}: CreateViewportRenderLoopRuntimeOptions): ViewportRenderLoopRuntime {
  let disposed = false;
  let frameHandle = 0;
  let previousFrameTime = now();
  let renderRequested = false;

  const scheduleFrame = () => {
    if (disposed || frameHandle !== 0) return;
    frameHandle = requestFrame(renderFrame);
  };
  const requestRender = () => {
    if (disposed) return;
    renderRequested = true;
    scheduleFrame();
  };
  const renderFrame: FrameRequestCallback = (frameTime) => {
    frameHandle = 0;
    if (disposed) return;
    const frameWasRequested = renderRequested;
    renderRequested = false;
    const deltaSeconds = Math.min(0.05, Math.max(0, (frameTime - previousFrameTime) / 1000));
    previousFrameTime = frameTime;
    const continuousRendering = onFrame({
      deltaSeconds,
      frameTime,
      renderRequested: frameWasRequested,
    });
    if (continuousRendering || renderRequested) scheduleFrame();
  };

  const runtime: ViewportRenderLoopRuntime = {
    get renderRequested() {
      return renderRequested;
    },
    requestRender,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      if (frameHandle !== 0) cancelFrame(frameHandle);
      frameHandle = 0;
      renderRequested = false;
    },
  };
  requestRender();
  return runtime;
}
