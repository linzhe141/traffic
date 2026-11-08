# Core API

`src/core/index.ts` 是内核公共入口。内核可以在具备 Node.js 能力的宿主中使用，不导入 Electron，也不依赖 `src/main`。

## 两层入口

`createCaptureEngine(options)` 创建抓取引擎，负责进程目标展开、引擎启动、证书前置检查及系统代理租约的恢复。返回：

```ts
interface CaptureEngine {
  start(options: CaptureOptions): Promise<{ host: string; port: number }>;
  stop(): Promise<void>;
}
```

通过 `callbacks.onRecord/onDiagnostic/onError` 上报数据和错误。`createEngine` 选项可以替换底层适配器，默认使用 `adapters/mitmproxy`。mitmdump 可执行文件检查属于该适配器；自定义适配器不需要安装 mitmdump。

宿主注入 `resolvePaths`、`resolveTargets`、`getCertificateState` 与 `proxyLease`。这些是平台端口，内核不会自行调用 Electron API、修改注册表或信任证书。

`createRuntime(options)` 在引擎之上统一管理状态、请求仓储、订阅、诊断和生命周期。返回：

```ts
interface Runtime {
  initialize(): Promise<void>;
  start(options: CaptureOptions): Promise<CaptureStatus>;
  stop(): Promise<CaptureStatus>;
  snapshot(): TrafficSnapshot;
  clear(): Promise<void>;
  onSnapshot(listener: (snapshot: TrafficSnapshot) => void): () => void;
  dispose(): Promise<void>;
  getEngineInfo(): Promise<EngineInfo>;
  trustCertificate(): Promise<EngineInfo>;
  revealCertificate(): Promise<void>;
  listProcesses(): Promise<DetectedProcess[]>;
}
```

运行时创建时可以传 `engine`，由运行时调用公共引擎工厂；也可以传 `createEngine(callbacks)`，完全替换引擎，适用于另一种实现或测试。两种方式互斥。`platform` 提供引擎信息、证书操作、进程列表和可选初始化方法。

`initialize()` 用于宿主恢复此前由本应用持有的系统代理租约。启动操作有运行时参数校验。`dispose()` 先停止引擎和恢复租约，再释放订阅；失败时允许重试，关闭过程中拒绝再次启动。

## 数据与替换点

- `engines/types.ts`：引擎、事件回调和适配器契约。
- `engines/createCaptureEngine.ts`：与宿主无关的启动/停止编排。
- `adapters/mitmproxy/`：当前 HTTPS、HTTP/2 抓取后端及进程协议。
- `runtime/`：串行操作、状态、事件合并、统一对外接口。
- `storage/trafficRepository.ts`：仓储接口与内存适配器。替换持久化时不需要修改 IPC 或页面。

请求通过稳定 ID 更新，先发送 `pending`，结束后发送 `complete` 或 `failed`。清空后，在途请求的后续更新不会重新插入列表。快照包含递增 `revision`，供消费端丢弃过期数据。

仓储目前保留最多 500 条请求、16 MiB 正文预览；快照按 100 ms 合并发布。持久化实现需要保持相同的清空与更新语义。若数据库采用异步读写，先扩展仓储契约和运行时，再接入适配器。

## Electron 接入

`src/main/bootstrap/createDesktopRuntime.ts` 是桌面组合入口，注入 Windows 进程发现、专用证书目录和系统代理适配器。`registerTrafficHandlers.ts` 只做 IPC 来源检查、输入校验和 Runtime 方法映射，不直接操作内核适配器或仓储。

`src/main/index.ts` 只配置开发测试目录并启动桌面生命周期。窗口创建留在独立模块中。renderer 使用 preload 暴露的 `TrafficApi`，不直接导入内核。

当前不维护测试设施；后续单测和 E2E 统一放在独立 `test/` 目录。
