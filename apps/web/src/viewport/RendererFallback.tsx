interface RendererFallbackProps {
  failureLabel: string;
  reloadLabel: string;
}

export function RendererFallback({ failureLabel, reloadLabel }: RendererFallbackProps) {
  return (
    <div className="viewport-renderer-fallback" role="alert">
      <span>{failureLabel}</span>
      <button type="button" onClick={() => window.location.reload()}>{reloadLabel}</button>
    </div>
  );
}
