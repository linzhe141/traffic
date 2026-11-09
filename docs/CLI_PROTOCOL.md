# 抓取 CLI 协议

CLI 可以由 Electron Main、Node.js 服务或本地 agent 启动。调用方只需要启动子进程并读写标准流。

```powershell
pnpm build:cli
node apps/cli/.vite/build/capture-cli.cjs serve --resources .\resources --data .\tmp\capture-cli
```

`--resources` 指向包含 `engine` 和 `mitm-addon` 的目录。`--data` 保存 CA、引擎临时文件和系统代理恢复记录。每个桌面实例应沿用自己的数据目录，以便重启后恢复代理设置。

## 传输

stdin 和 stdout 使用 UTF-8 NDJSON，每行一个 [JSON-RPC 2.0](https://www.jsonrpc.org/specification) 对象，包含换行符在内最多 64 MiB。诊断写入 stderr。调用方可以同时发送多条请求，按 `id` 匹配回复。每条业务请求使用字符串或整数 ID，参数使用命名对象。需要并发时发送多行请求。CLI 会话目前支持单对象消息。

先调用 `core.initialize`，收到成功响应后再发业务命令。下面是握手请求及响应。

```json
{"jsonrpc":"2.0","id":1,"method":"core.initialize","params":{"protocolVersion":1}}
{"jsonrpc":"2.0","id":1,"result":{"protocolVersion":1}}
```

## 业务命令

| 方法 | 参数 | 结果 |
| --- | --- | --- |
| `core.initialize` | `{ protocolVersion: 1 }` | 协议版本。初始化时尝试恢复遗留代理租约 |
| `capture.start` | `{ port, mode?, target?, upstreamProxy? }`。默认 `local`，须提供进程名或 PID。使用 `system-proxy` 时可以省略 `target`，提供时仅接受 PID。 | 抓取状态 |
| `capture.stop` | `{}` | 停止后的抓取状态 |
| `capture.snapshot` | `{}` | 包含状态、请求、诊断和递增 revision 的快照 |
| `capture.clear` | `{}` | `null` |
| `capture.readBody` | `{ id, side, offset }` | 正文页或 `null` |
| `engine.info` | `{}` | 引擎及证书状态 |
| `certificate.trust` | `{}` | 信任 CA 后的引擎及证书状态 |
| `process.list` | `{}` | 检测到的进程 |
| `core.dispose` | `{}` | 停止并清理成功时返回 `null`，随后退出 |

`capture.changed` 是 CLI 主动推送的通知，无 `id`，`params` 为完整快照，客户端可以按 revision 忽略过期快照。CLI 的 revision 随进程重置。stdout 发生背压时，待发送快照会合并为最新版本。

正文页中的 `dataBase64` 编码最多 32 KiB 字节。用 `nextOffset` 继续读取，`available` 是当前可读长度，`generation` 变化时从头重新读，`binary` 标识二进制数据。

解析失败、无效请求、未知命令和无效参数使用标准错误码。业务执行失败使用 `-32000`，版本不匹配使用 `-32001`，缺少初始化使用 `-32002`，正在退出使用 `-32003`。正常关闭优先发送 `core.dispose`，stdin 关闭也会触发清理。

类型定义位于 `packages/protocol/src/index.ts`。证书文件夹、剪贴板及进程图标等桌面操作由 Electron Main 处理。
