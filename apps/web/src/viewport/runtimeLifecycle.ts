export interface RuntimeDisposable {
  dispose: () => void;
}

export interface RuntimeLifecycle extends RuntimeDisposable {
  readonly disposed: boolean;
  add: <Runtime extends RuntimeDisposable>(runtime: Runtime) => Runtime;
  onDispose: (dispose: () => void) => void;
}

export function createRuntimeLifecycle(): RuntimeLifecycle {
  const disposers: Array<() => void> = [];
  let disposed = false;

  const onDispose = (dispose: () => void) => {
    if (disposed) {
      dispose();
      return;
    }
    disposers.push(dispose);
  };

  return {
    add: <Runtime extends RuntimeDisposable>(runtime: Runtime) => {
      onDispose(() => runtime.dispose());
      return runtime;
    },
    onDispose,
    get disposed() {
      return disposed;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      const errors: unknown[] = [];
      for (const dispose of disposers.reverse()) {
        try {
          dispose();
        } catch (error) {
          errors.push(error);
        }
      }
      disposers.length = 0;
      if (errors.length > 0) throw new AggregateError(errors, "Failed to dispose viewport runtimes");
    },
  };
}
