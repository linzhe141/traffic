# 架构

## 依赖方向

```text
renderer <-> preload TrafficApi <-> typed IPC <-> Electron Main
                                                 |
                                          JSON-RPC over stdio
                                                 |
                                              CLI serve
                                                 |
                                              Runtime
                                              |-- CaptureEngine -> mitmproxy adapter -> mitmdump
                                              |-- TrafficRepository -> memory
```

`createCaptureEngine` 管理抓取生命周期、目标展开和系统代理租约。`createRuntime` 统一状态、订阅、诊断与仓储。CLI 注入 Windows 功能，Electron Main 通过 fork 和标准流调用 CLI。 [Core API](CORE_API.md) · [CLI 协议](CLI_PROTOCOL.md)

## 桌面生命周期

主进程入口只启动应用；bootstrap 负责单实例、初始化、窗口及退出清理。窗口直接显示，避免将可见性依赖于 renderer 的 `ready-to-show` 事件。停止抓取和恢复本应用持有的系统代理后才退出。

Windows 使用 Window Controls Overlay 保留原生窗口按钮。renderer 通过嵌套 Reka Splitter 调整侧栏、请求列表和详情尺寸；基础组件集中于 `components/ui`。

## 抓取后端

Windows x64 内置官方 mitmproxy 12.3.1 独立版。Forge `generateAssets` 根据清单下载并校验引擎，`extraResource` 复制到 ASAR 外部。运行时依次查找 `MITMDUMP_PATH`、`resources/engine/<platform>-<arch>` 和系统 PATH；用户无需安装 Python。独立版首次启动会解压运行时，因此版本检查设置较长超时，并合并和缓存同一路径的检查。

Core 的 mitmproxy adapter 启动 mitmdump 并加载 `resources/mitm-addon`。addon 发布带会话 token 的 NDJSON 事件，adapter 校验消息并管理进程退出。请求、响应与错误通过稳定 ID 更新到仓储，正文存于 CLI 进程内存并按页读取。

本地进程模式按可执行文件/PID 接入，保留真实名称大小写并扩展当前子进程。系统代理兼容模式显式备份、切换和恢复 Windows 当前用户设置，沿用原 HTTP(S) 代理作为上游。恢复文件保存所有者 PID，避免覆盖其他活跃实例或用户后来改动的设置。

CA 位于应用 userData，公开证书通过受限 IPC 查看或显式信任。私钥不发送到 renderer。连接、TLS 和非 HTTP 诊断与请求记录分开处理。

## IPC 与状态

共享 `InvokeContract` 绑定 channel、input、output；main 校验输入和发送方，preload 只暴露具名 `TrafficApi`。renderer 不直接访问 Node、socket 或仓储。

服务层串行处理 start/stop，合并快照通知。快照 revision 用于丢弃旧消息。仓储限制历史条数和正文容量；清空后，旧的在途请求不能重新插入列表。

## 持久化预留

通过 `TrafficRepository` 替换内存仓储。后续 SQLite 存 sessions、requests、headers、body_refs 和迁移版本，正文放独立文件。数据库接入前需将仓储接口异步化，并增加分页摘要和按需正文读取；写入使用批次事务和独立 worker。CA 私钥与普通抓取记录分开保存。
