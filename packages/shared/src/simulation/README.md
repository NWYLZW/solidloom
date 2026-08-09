# 固定仿真时间与调度

该模块只定义通用时间机制，不包含任何具体工程字段或离线收益规则。

- `FixedSimulationClockState` 以权威墙钟锚点、固定步长和整数 tick 序号推进，不读取 React 或 Three.js 帧率。
- 暂停会先结算暂停时刻之前的完整 tick；恢复会重设墙钟锚点，因此暂停期间不会产生离线效果。
- 后台恢复必须显式选择 `freeze` 或有上限的 `catch-up`；积压还受 `maxCatchUpTicks` 保护。
- `SimulationScheduleState` 支持一次性和周期项，并按到期时间、优先级、创建序号和稳定 ID 排序。
- 调度 payload 只携带通用 purpose、命名空间 handler ID 和 JSON 数据。状态衰减、超时和流程推进由领域适配器处理。
- 时钟和调度的每次状态修改都要求 `expectedRevision`；派发结果可由事件层记录后重放。

当前交付提供共享纯函数和进程内 Server 包装。SQLite 持久化、HTTP 路由、任意脚本 handler 和领域效果提交仍为 `planned`。
