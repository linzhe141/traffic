# Local Traffic

Electron Forge + Vue 3 + TypeScript 的本机 HTTP/HTTPS 请求工作台。

## 环境与启动

需要 Node.js 22.13+、pnpm 10。Windows x64 使用随应用提供的 mitmproxy 独立版，用户无需安装 Python、mitmproxy 或配置 PATH。

```powershell
pnpm install
pnpm dev
```

Forge 的 `generateAssets` 在开发或打包前准备引擎：缺失时下载官方 12.3.1 独立版，校验固定 SHA-256 并提取 `mitmdump.exe`；已存在时直接复用。首次开发需要联网，下载缓存位于 `.engine-cache`。`.npmrc` 已配置 Forge 要求的 `node-linker=hoisted`。

内置引擎位于 `resources/engine/win32-x64/mitmdump.exe`。调试替代版本时可以设置 `MITMDUMP_PATH`；否则优先使用内置资源，最后才从系统 PATH 查找。其他平台目前需要自行提供相应引擎。

独立版启动时解压到 userData 下的 `engine-temp`，启动前检查至少 256 MiB 可用空间。磁盘不足会直接提示剩余空间；解压错误保留原始原因与临时目录位置。

## 抓取方式

桌面界面支持从 Windows 的运行进程中选择本地目标，也支持通过系统代理接入应用流量。应用重启或新建进程后，刷新列表并重新开始抓取可更新本地进程范围。 [Windows 抓取入口与覆盖范围](docs/CAPTURE-MODES.md)

- **本地进程**接入所选应用及其当前子进程新建的直连流量。Windows 抓取辅助程序可能请求管理员权限。
- **系统代理**临时切换当前用户的系统代理，沿用原 HTTP(S) 代理作为上游，停止后恢复设置。所有经过抓取代理的应用都可被记录。

HTTPS 需要先生成应用专属 CA，并由用户显式信任。首次抓取会生成证书；系统代理模式在 CA 尚未信任时不会切换设置。证书固定或独立信任库的应用仍可能拒绝连接。

开始抓取后重新建立目标连接。已有 TLS 长连接无法从中途恢复明文。Windows 本地进程模式无法接入部分回环代理流量；系统代理模式可以接入遵循系统代理的请求。显式连接其他代理的应用需要将其请求送到抓取端口。

上游支持无认证 HTTP/HTTPS，暂不支持 SOCKS 和代理认证。VPN TUN 的兼容性取决于实际网络环境。

请求和响应正文随会话记录存放在抓取 CLI 进程内存中。Body 和 Raw 滚动时按页读取，SSE 的 Messages 列表逐页解析完整事件。WebSocket 显示最近 64 条双向消息，每条预览前 1 KiB。其他非 HTTP 连接可在连接诊断里查看。

## 项目结构

- `apps/cli`：独立抓取服务、JSON-RPC 服务端和 Windows 平台适配。
- `apps/desktop`：Electron 主进程、preload、Vue 工作区和 Forge 打包配置。
- `packages/core`：抓取生命周期、mitmproxy 适配、状态订阅和内存仓储。
- `packages/protocol`：共享类型、JSON-RPC 契约、校验和 NDJSON 传输。
- `resources/mitm-addon`：由 mitmdump 加载的请求/响应事件及正文预览插件。
- `resources/engine`：内置引擎、版本清单和许可证；大体积二进制由构建流程准备，不提交 Git。

这是一个 pnpm workspace。内部依赖通过 `workspace:*` 引用，Core 和 Protocol 直接导出 TypeScript，由 CLI 或桌面的 Vite 入口打包。

记录和正文只保存在内存中。停止抓取后可以继续查看，清空或关闭应用会释放数据。

## 构建

```powershell
pnpm typecheck
pnpm test:cli
pnpm build
pnpm make
```

`build` 生成应用目录，`make` 生成 ZIP，产物位于 `apps/desktop/out`。Forge `extraResource` 将引擎与 addon 放在发行包的 resources 目录，位于 ASAR 外部。Windows x64 发行包不依赖目标机器的 Python 环境。

`build:cli` 生成可由 Node.js 启动的 `apps/cli/.vite/build/capture-cli.cjs`，`test:cli` 验证独立进程的协议收发。参考仓库、临时证书、截图、缓存和构建产物均排除在版本控制之外。

## 发版

将包含 workflow 的提交推送到 GitHub，然后在该提交上创建并推送版本 tag。tag 须匹配 `apps/desktop/package.json` 中的版本，可以带 `v` 前缀。当前版本的发版命令如下。

```powershell
git tag v0.0.1-test.1
git push origin v0.0.1-test.1
```

GitHub Actions 会构建 Windows x64 ZIP 并上传到该 tag 对应的 Release。带预发行后缀的版本会标记为 Prerelease。

见 [CLI 协议](docs/CLI_PROTOCOL.md)、[Core API](docs/CORE_API.md)、[架构](docs/ARCHITECTURE.md)、[TODO](docs/TODO.md)、[ProxyPin 源码分析](docs/PROXYPIN-CORE.md)。
