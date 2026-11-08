# ProxyPin 抓取内核源码分析

分析对象：`wanghongenpin/proxypin`，提交 `dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e`。下面的链接均固定到该提交；结论来自本地克隆源码的静态阅读，没有运行 ProxyPin、修改系统代理或安装证书。本文分析设计，不复制其实现。

## 1. 核心是什么

ProxyPin 的桌面主链路是 **Dart 实现的应用层 HTTP/HTTPS 代理服务器**。它自己接受 TCP 连接、解析 HTTP、建立到上游的连接，并在允许解密时分别终止客户端和服务端的 TLS。Flutter 负责界面，操作系统相关功能通过平台工具或插件提供。

因此，理解其桌面核心应从代理入口、协议解析、TLS 和转发入手。它与 Wireshark 通过网卡采集网络帧、离线解析协议的主要使用方式不同。仓库也有 Android VPN/TUN、SOCKS5、WebSocket、SSE 和 MQTT 支持，不能把这些能力都归结成桌面 HTTP 代理的同一个入口。

这也解释了“启动一个代理服务”和“本机 App 的流量真的进入代理”是两个步骤。应用遵循系统代理、显式配置代理，或者有平台引流机制，代理内核才能看到请求；证书信任又是下一道条件。

## 2. 可核对的模块地图

| 层次 | 源文件与符号 | 实际职责 |
| --- | --- | --- |
| 组装入口 | [`lib/network/bin/server.dart`：`ProxyServer`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/bin/server.dart#L47) | 组装编解码器、拦截器、事件监听器；启动/停止服务；按配置设置桌面系统代理。 |
| TCP 生命周期 | [`lib/network/channel/network.dart`：`Network`、`Server`、`Client`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/channel/network.dart#L40) | 绑定端口、接收连接、监听字节流、连接上游；选择 TLS、SOCKS、HTTP 或原始转发路径。 |
| 单连接对象 | [`lib/network/channel/channel.dart`：`Channel`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/channel/channel.dart#L54) | 包装 socket、读写、关闭、TLS 升级和连接标识。 |
| 编解码调度 | [`lib/network/channel/channel_dispatcher.dart`：`ChannelDispatcher`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/channel/channel_dispatcher.dart#L24) | 管理字节缓冲，调用 decoder/encoder/handler，处理分片、转发和关闭收尾。 |
| 会话关联 | [`lib/network/channel/channel_context.dart`：`ChannelContext`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/channel/channel_context.dart#L19) | 关联 client/server channel、目标地址、当前请求、HTTP/2 stream 和连接属性。 |
| HTTP 协议 | [`lib/network/http/codec.dart`：`HttpCodec`、`HttpRequestCodec`、`HttpResponseCodec`、`HttpClientCodec`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/http/codec.dart) | HTTP/1 解析/编码、正文边界，以及根据 ALPN/连接前言转入 HTTP/2 codec。 |
| 请求/响应转发 | [`lib/network/handle/http_proxy_handle.dart`：`HttpProxyChannelHandler`、`HttpResponseProxyHandler`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/handle/http_proxy_handle.dart#L22) | 选择上游、CONNECT、改写/阻断/合成响应、监听器通知、响应回写。 |
| 插件式处理 | [`lib/network/components/interceptor.dart`：`Interceptor`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/components/interceptor.dart) | `preConnect`、`onRequest`、`execute`、`onResponse`、`onError`，按优先级运行。 |
| 观察事件 | [`lib/network/bin/listener.dart`：`EventListener`、`CombinedEventListener`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/bin/listener.dart) | 向多个订阅者广播请求、响应和消息事件。 |
| CA/叶子证书 | [`lib/network/util/crts.dart`：`CertificateManager`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/util/crts.dart#L44) | 初始化 CA、读取/保存密钥、按域名签发并缓存叶子证书和 `SecurityContext`。 |

## 3. 一次桌面 HTTP 请求怎样经过内核

1. `ProxyServer.start()` 创建 `Server` 和 `CombinedEventListener`，组装 `Hosts`、映射、改写、脚本、阻断、断点、网络条件等拦截器，并按 `priority` 排序。
2. 它为接入 channel 安装 `HttpRequestCodec`、`HttpResponseCodec` 和 `HttpProxyChannelHandler`。这里的 encoder 是返回客户端的响应编码器；连接上游时另有客户端方向的 codec。
3. `Server.bind()` 使用 `ServerSocket.bind(InternetAddress.anyIPv4, port)` 监听；每个 socket 对应一个 `Channel` 和 `ChannelContext`。这是源码实际行为，并非仅监听 loopback；我们的工具默认仍应限制为 `127.0.0.1`。
4. `Network.listen()` 将 socket 的数据、错误和关闭事件交给 `ChannelDispatcher`。dispatcher 缓冲不完整数据，decoder 识别完整请求后交给 HTTP handler。
5. `HttpProxyChannelHandler.forward()` 获取或创建上游 channel，运行请求拦截器，通知 `listener.onRequest()`。`execute()` 可以直接合成响应；正常请求则编码后写往上游。
6. `HttpResponseProxyHandler` 关联原请求，执行响应拦截器，通知 `listener.onResponse()`，再把响应写回客户端。

连接、HTTP 请求和 UI 行应有各自的 ID。同一 TCP 连接可能承载多个请求，HTTP/2 又在一个连接上复用多个 stream。ProxyPin 的 `ChannelContext` 为此维护 stream map、队列和 h2/h1 转换状态，说明这个问题需要内核处理，不能交给列表组件猜测关联。

## 4. HTTPS：CONNECT 后才开始解密

HTTPS 显式代理的过程可以分成三段：

1. 客户端先发明文 `CONNECT example.com:443`。`_getRemoteChannel()` 保存目标并连接上游；直连路径向客户端返回 `200 Connection established`。CONNECT 本身只是建立通道的代理指令。
2. 客户端随后发送 TLS ClientHello。`Server.onEvent()` 根据连接上下文或 `TLS.isTLSClientHello()` 进入 `Server.ssl()`；它读取 SNI、决定是否解密，并通过 `CertificateManager.getCertificateContext()` 取得相应域名的证书。
3. `SecureSocket.secureServer(..., bufferedData: data)` 让 ProxyPin 在客户端这一侧充当 TLS 服务端；上游另一侧通过 `SecureSocket.secure()` 或 `SecureSocket.connect()` 充当 TLS 客户端。完成后，代理能读取应用层明文，再交给 HTTP codec。请求和响应分别重新加密后写入各自的连接。

因此不是“拿服务器私钥解开原始 HTTPS 包”，而是建立两段独立的 TLS 连接。客户端必须信任代理 CA；应用自己的证书固定策略仍可能拒绝，不能承诺所有 App 都可解密。

`Server.ssl()` 还负责 ALPN 选择，并安装 [`ProtocolSniffer`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/mqtt/protocol_sniffer.dart)，在解密后的首批字节上选择 HTTP 或 MQTT 路径。域名过滤或关闭 HTTPS 抓取时，`Network.relay()` 使用 `RawCodec` 和 `RelayHandler` 双向透传，不生成 HTTPS 明文。

值得借鉴的是阶段划分，不应照搬所有策略。该提交的 `Channel.secureSocket()`、`startSecureSocket()` 和 `Client.secureConnect()` 存在 `onBadCertificate: (...) => true`，会接受上游异常证书。我们当前引擎应继续保留正常的上游证书验证，单独报告错误；CA 签发、证书信任和上游验证分别建模。

## 5. 外部代理怎样串联

外部代理配置由 `Server.onEvent()` 放入 `ChannelContext` 的 `proxyInfo` 属性。`HttpProxyChannelHandler._getRemoteChannel()` 发现它后，先连接外部代理并标记 `useProxy`：

- HTTP 请求经外部代理转发；直接连源站时则把绝对 URL 改为 HTTP/1 的路径形式。
- HTTPS 需要将 CONNECT 发给外部代理，必要时附带 Basic `Proxy-Authorization`；之后在该通道上建立到目标站的 TLS。
- `HttpClients.connectRequest()` 处理代码主动创建的 CONNECT 链路。外部代理关闭抓取的配置可进入直接转发路径。

可核对 [`http_proxy_handle.dart` 的 `_getRemoteChannel()`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/handle/http_proxy_handle.dart#L201) 与 [`lib/network/http/http_client.dart`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/http/http_client.dart)。

对于我们当前的 VPN/本地代理环境，实际需要的是 `App → 抓取代理 → 原外部代理 → 目标网站`。只启动 local 引流，或者只修改一个上游 URL，都不能替代入口路由设计。系统代理接管必须保存和恢复原设置，不能把“关闭抓取”简单实现为“关闭用户原本的代理”。

## 6. UI、存储和进程归属怎样接上来

`CombinedEventListener` 让网络转发代码不必直接调用某个页面组件。不过，该提交的桌面页面 [`_DesktopHomePagePageState`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/ui/desktop/desktop.dart#L65) 自身实现 `EventListener`：请求进入请求列表，响应更新列表和详情面板。这是现有 UI 接线，不能据此认为所有存储逻辑都已从 UI 解耦。

另一个可借鉴的消费者是 [`lib/mcp/capture/flow_store.dart` 的 `FlowStore`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/mcp/capture/flow_store.dart#L35)：它同样订阅 `EventListener`，但不依赖 UI，使用有界请求缓存和单独的消息帧索引。这证明“同一事件同时供 UI、查询接口和存储消费”的边界是可行的。

历史存储由 [`lib/storage/histories.dart` 的 `HistoryStorage`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/storage/histories.dart#L35) 管理：`histories.json` 保存索引，历史会话写入独立文件，内容经 `Har.toHar()` 转换并通过 `Har.readFile()` 读取。它不是 SQLite 实现，也不能推断“每个网络事件都立即自动持久化”。我们的持久化可独立选择 SQLite 元数据、正文文件和延迟加载。

应用归属另由 [`lib/network/util/process_info.dart` 的 `ProcessInfoUtils`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/util/process_info.dart#L38) 处理：按客户端 socket 地址/端口查询 PID，再补进程信息，并做正负缓存。这是平台适配能力，不是从 HTTP Host 或 User-Agent 推测 App 名。查询失败应保留 unknown，不能影响转发。

## 7. 桌面系统代理与移动 VPN 是两条入口

桌面由 `ProxyServer` 调用 [`SystemProxy`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/network/util/system_proxy.dart#L27)，后者按 Windows/macOS/Linux 选择实现，使用平台代理管理或系统命令。Windows 代码查询/修改 Internet Settings 注册表；这不等于网卡级全流量捕获，也不保证遵循不了系统代理的 App 被捕获。

Android 的入口则是 [`lib/native/vpn.dart` 的 `Vpn`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/lib/native/vpn.dart) 调用 MethodChannel，再到 [`ProxyVpnService : VpnService`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/android/app/src/main/kotlin/com/network/proxy/ProxyVpnService.kt#L36)。后者建立 VPN 接口、设置路由和应用名单，由 [`ProxyVpnThread`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/android/app/src/main/kotlin/com/network/proxy/vpn/ProxyVpnThread.kt#L19) 读取接口数据并交给其网络处理流程。

这部分属于移动端平台引流机制，不能据此推导桌面版本已经有同等的 VPN/TUN 全流量能力。

## 8. 对本项目的分层建议

应复用 ProxyPin 展现出的职责划分：入口引流、协议内核、处理管道、事件消费者分开。当前使用 mitmproxy 的实现保留为可替换适配器，不需要把 Dart 的 Channel/HTTP2/TLS 实现逐文件翻译成 TypeScript。

建议的依赖方向是：Electron/Vue 壳调用应用 Runtime；Runtime 依赖纯数据契约、`CaptureEngine` 和平台端口接口；具体适配器实现接口。核心契约和 Runtime 不导入 Electron、Vue、Windows 注册表或 mitmproxy 的 DTO。

| 边界 | 负责 | 不应负责 |
| --- | --- | --- |
| `CaptureEngine` | `startCapture`、`stopCapture`、能力查询，输出请求更新和诊断；适配 mitmproxy 或未来其他内核。 | 修改系统代理、操作窗口、直接写 UI store。 |
| `CaptureRuntime` | 编排启动/停止、会话 ID、状态机、订阅释放、背压和资源清理；调用引擎与平台端口。 | 解析 TLS 字节或了解 Electron IPC channel 名。 |
| 平台端口 | `SystemProxyPort`、`CertificateTrustPort`、`ProcessResolverPort`、`RuntimePathsPort`。 | 决定请求详情组件怎样展示。 |
| 数据端口 | `TrafficRepository`、`BodyStore`、查询分页与保留策略。 | 控制 socket 或改变 TLS 验证行为。 |
| Electron 适配层 | 窗口、安全 preload、typed IPC、主进程组合根。 | 承载通用抓取状态机和所有业务逻辑。 |
| Vue 展示层 | 列表、筛选、详情、用户操作和错误提示。 | 直接启动子进程、查询注册表或持有原始 socket。 |

进一步的接口应区分 `connectionId`、`flowId`、`sessionId` 和可选的 `streamId`；请求更新携带 revision，正文使用有界预览或独立 `bodyRef`。诊断是独立事件：TLS 被拒绝、连接建立但没有 HTTP、上游失败都要能被观察，不能让用户只能看到一个零请求列表。

跨进程边界采用版本化、可序列化事件，避免把平台对象和可变共享模型暴露给 UI。TypeScript 编译期契约和运行时参数/事件校验都需要保留。未来换壳时，只替换 IPC/展示适配层；换抓取内核时，只替换 `CaptureEngine` 适配器。

## 9. 使用源码的边界

上游 [`LICENSE`](https://github.com/wanghongenpin/proxypin/blob/dbc0ac1d321d4a1fe61c3227852e878b9bef1b5e/LICENSE) 为 Apache-2.0，多个源码文件保留作者版权与许可头。本次仅阅读并描述设计，没有移植其代码。以后若复制或改写具体实现，应按仓库许可保留必要声明和归属信息；本报告也不表示已验证上游所有协议和平台行为。
