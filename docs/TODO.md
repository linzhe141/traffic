# TODO

- [x] Electron Forge + Vue + TypeScript 分层
- [x] 类型安全 IPC 与运行时参数校验
- [x] createCaptureEngine / createRuntime 统一接口和可替换后端
- [x] 内置 mitmdump CLI、固定版本及校验，开发和发行共用资源定位
- [x] 本地进程与系统代理两种模式
- [x] 自动发现应用和 CLI，展开当前子进程
- [x] HTTPS CA 与显式信任、上游 HTTP(S) 代理
- [x] 系统代理备份、归属校验和恢复
- [x] 有界正文预览、压缩解码和连接诊断
- [x] Tailwind / Lucide / Reka UI 基础组件与可调整布局
- [x] Windows 原生 Window Controls Overlay
- [x] ProxyPin 源码分析
- [ ] 实际应用和 VPN 环境下的抓取兼容性
- [ ] 连接到进程的准确归属识别
- [ ] SQLite、正文文件、分页查询和容量策略
- [ ] 增量 IPC 与虚拟列表
- [ ] WebSocket 帧、HAR、回放和规则引擎

当前阶段不添加测试设施；需要时在独立 `test/` 目录添加单测和 E2E。
