# 通用运行时契约

该目录提供与具体工程无关、可 JSON 序列化的运行时原语。

## 领域数据边界

- `RuntimeDomainDefinitions` 声明实体、组件、关系、资源、指标和目标类型；定义均带命名空间 ID、领域包 ID、状态和修订。
- 组件通过 `persistent`、`ephemeral`、`derived` 明确区分持久、短期和派生状态。只有持久组件可以进入 `RuntimeDomainSnapshot`。
- 短期组件和派生组件/指标只进入 `RuntimeDomainProjection`，并记录来源修订，不与存档事实混合。
- 资源账户具有余额和预留量；指标是不可转移的计数、读数或派生值；目标具有独立状态、进度和作用域。
- `RuntimeDomainMutation` 是统一的写入信封。每个变体都要求 `expectedRevision`；派生状态没有写入变体。
- `packages/shared/src/schemas/runtimeDomain.ts` 导出同版本 JSON Schema，纯校验函数负责跨引用、状态边界、关系基数、作用域和修订冲突。

当前交付只包含契约、schema 和进程内纯校验。数据库持久化、查询投影执行、固定时间、动作生命周期和 HTTP 接入仍是后续 `planned` 能力。

## 实体转移纯函数

该目录只提供与领域无关的本地实体事务原语：

- `ownerId` 表示实体所有权，`containerId` 表示当前容器，二者独立保存。
- 输入端口声明目标所有者、目标容器、标签匹配与访问要求。
- 多条转移腿在一次事务中校验容量和权限，并在同一修订中提交或全部失败。
- `prepareEntityTransfer` 不改变世界状态，适合在动画开始前预留；取消后不可提交。
- 凭证是普通实体附带的能力组件，转移钥匙仍使用同一个实体转移原语。
- 破解等领域行为不绕过权限，而应调用 `issueTemporaryAccessGrant` 签发有作用域和过期时间的授权。

当前模块是进程内纯函数库。HTTP 动作生命周期、持久化和跨进程锁仍属于后续运行时任务，调用方不得把它们标记为已可用。
