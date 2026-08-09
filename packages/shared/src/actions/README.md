# 统一语义动作契约

动作定义和请求不区分玩家、React 或 Agent；所有调用方都使用同一 `SemanticActionRequest`，携带 `expectedRevision` 和 `idempotencyKey`。

- 生命周期为 `proposed → validated → running → committed → completed`，并可确定性进入 `cancelled` 或 `failed`。
- 通道只使用命名空间 ID，并按运行实例或主体占用；平台不预设 movement、岗位或其他工程语义。
- 提交点可在开始、进度阈值或完成时；提交效果通过 Server 适配器一次性返回领域事件。
- 参数始终是 JSON 对象；带约束的 JSON Schema 必须由显式参数校验适配器执行，未配置时动作会失败而不会假装可用。
- 提交前可配置允许或拒绝取消；提交后只允许拒绝，或调用显式补偿效果后取消。
- 进度由固定仿真时间派生，不作为可任意写入的持久字段。
- `planned` 动作定义不能执行。当前 SQLite 事务、HTTP/CLI 路由和跨进程恢复仍为 `planned`。
