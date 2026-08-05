import { createRegistrationRegistry } from "@solidloom/shared";
import type { ReactUiExtension } from "./types.js";

export function createReactUiExtensionRegistry(extensions: Iterable<ReactUiExtension>) {
  const values = [...extensions];
  values.forEach((extension) => {
    if (extension.id !== extension.descriptor.id) {
      throw new Error(`界面扩展 ${extension.id} 与描述符 ID ${extension.descriptor.id} 不一致。`);
    }
  });
  return createRegistrationRegistry("React 界面扩展注册表", values);
}
