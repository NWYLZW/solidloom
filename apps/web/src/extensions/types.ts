import type { ComponentType } from "react";
import type { UiExtensionDescriptor } from "@solidloom/shared";

export interface ExtensionComponentProps {
  modelId: string | null;
}

export interface ReactUiExtension {
  id: string;
  descriptor: UiExtensionDescriptor;
  component: ComponentType<ExtensionComponentProps>;
}
