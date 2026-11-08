# Proxyman 的抓取入口与 Windows 覆盖范围

Proxyman 的 Windows 产品页将它定位为 HTTP 调试代理。界面里的应用、域名、Headers、正文和 WebSocket 都是代理获得连接并解析协议后展示的内容。Windows 更新日志明确提到接管当前系统代理，并在退出时恢复原设置。

[Windows 产品页](https://proxyman.com/windows) · [Windows 更新日志](https://proxyman.com/changelog-windows)

| 场景 | 接入机制 | 结果和边界 |
| --- | --- | --- |
| 遵循 Windows 系统代理的应用 | 将系统代理指到本地监听端口，抓取器接收 HTTP 或 HTTPS CONNECT | 同一个入口可以覆盖多款应用。本项目用连接四元组查 Windows 的 TCP 所属 PID，再关联可执行文件。 |
| 使用独立代理设置的应用 | 在应用或其启动环境里指定代理和 CA | Proxyman 的 Manual Setup 和 Automatic Setup 都有这类说明。应用已有的代理地址需要指到抓取入口。 [Manual Setup](https://proxyman.com/docs/automatic-setup/manual-setup) · [Automatic Setup](https://proxyman.com/docs/automatic-setup/automatic-setup) |
| 已有 VPN 或本机代理 | 抓取器接收客户端连接，再把上游流量转给原代理 | Proxyman 将其称为 External Proxy。原代理地址是出站路由，客户端是否经过抓取器由它自己的入口决定。 [External Proxy](https://proxyman.com/docs/advanced-features/external-proxy) |
| 忽略代理的直连 | 在操作系统层重定向新连接 | Proxyman 文档将其 Network Extension 方案标为 macOS 功能。本项目的 Windows 本地进程模式使用 mitmproxy 的原生重定向器。Windows WFP 提供 ALE 连接重定向接口，能作为扩展原生入口的基础。 [Proxyman 排障文档](https://proxyman.com/docs/automatic-setup/troubleshooting) · [mitmproxy 模式](https://docs.mitmproxy.org/stable/concepts/modes/) · [Microsoft WFP](https://learn.microsoft.com/en-us/windows-hardware/drivers/network/using-bind-or-connect-redirection) |
| HTTPS 正文、SSE、WSS | 代理与客户端及目标服务器分别握手，客户端信任本地 CA 后解析解密的数据 | Proxyman 的 SSL Proxying List 以域名或应用选择解密对象。SSE 是长时间接收的 HTTP 响应，WebSocket 则在握手成功后传输双向消息。客户端独立证书库和证书固定会影响解密。 [SSL Proxying](https://proxyman.com/docs/advanced-features/ssl-proxying) · [WebSocket](https://proxyman.com/docs/advanced-features/websocket) |

本项目提供两条 Windows 入口。系统代理模式接入所有经过抓取代理的应用。本地进程模式从 Windows 当前运行进程中选择目标，支持应用、CLI、进程名和 PID，并在开始抓取时展开当前子进程。对直接连接既有回环代理的进程，需要让该进程改用抓取端口，或者扩展 Windows 的原生重定向入口。已建立的 TLS 会话无法从中途还原明文。

应用归因属于连接层，HTTP 正文和 SSE 属于协议层。后续如果要覆盖直连、回环、UDP 和私有协议，应单独实现按进程的连接观察或抓包能力，并把 IP、端口和字节统计作为独立记录。只有协议和解密条件满足的连接，才能进一步显示 HTTP 请求。Electron 仍可通过进程间接口消费这些事件。
