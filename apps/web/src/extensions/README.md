# React 界面扩展约定

HUD 与管理界面扩展分别使用 `hud`、`manage` 插槽。每个扩展维护自己的组件、样式与注册文件，公共入口只负责汇总注册。

扩展描述符属于领域包，React 组件属于 Web 应用；两者通过相同 ID 关联。`createReactUiExtensionRegistry` 会拒绝描述符 ID 与组件 ID 不一致或多个组件重复使用同一 ID。

未实现的扩展可以在领域包中声明为 `planned`，但不得注册成可渲染组件或在界面中表现为已可用。
