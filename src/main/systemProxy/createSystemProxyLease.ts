import type { ProxyBackupStore, ProxySettings, SystemProxyAdapter } from "./types";

function checkOwnedSettings(settings: ProxySettings, owner: string): boolean {
  return settings.ProxyEnable?.value === 1 && settings.ProxyServer?.value === owner;
}

export function resolveSystemProxyUpstream(settings: ProxySettings): string | undefined {
  if (settings.AutoConfigURL?.value || settings.AutoDetect?.value === 1)
    throw new Error("当前系统使用 PAC/WPAD 自动代理，请先手动确认代理配置；尚未修改系统设置。");
  if (settings.ProxyEnable?.value !== 1) return undefined;
  const server = String(settings.ProxyServer?.value ?? "").trim();
  if (!server || server.includes(";") || server.includes("="))
    throw new Error("不支持当前分协议系统代理配置；尚未修改系统设置。");
  const proxy = new URL(server.includes("://") ? server : `http://${server}`);
  if (
    !["http:", "https:"].includes(proxy.protocol) ||
    proxy.username ||
    proxy.password ||
    proxy.pathname !== "/" ||
    proxy.search ||
    proxy.hash
  )
    throw new Error("当前系统代理不是受支持的 HTTP(S) 代理。");
  return proxy.origin;
}

/** All mutation is explicit; recovery only restores settings still owned by this app. */
export function createSystemProxyLease(
  adapter: SystemProxyAdapter,
  store: ProxyBackupStore,
  ownership: {
    ownerPid?: number;
    isOwnerAlive?(pid: number): boolean;
  } = {},
) {
  const ownerPid = ownership.ownerPid ?? process.pid;
  const isOwnerAlive =
    ownership.isOwnerAlive ??
    ((pid: number) => {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === "EPERM";
      }
    });
  let queue: Promise<unknown> = Promise.resolve();
  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = queue.then(operation);
    queue = next.catch(() => undefined);
    return next;
  }
  async function restoreOwnedSettings(): Promise<void> {
    const backup = await store.read();
    if (!backup) return;
    if (backup.ownerPid !== ownerPid && isOwnerAlive(backup.ownerPid)) return;
    const current = await adapter.read();
    if (checkOwnedSettings(current, backup.owner)) await adapter.write(backup.settings);
    await store.remove();
  }
  return {
    recover: () => serialize(restoreOwnedSettings),
    restore: () => serialize(restoreOwnedSettings),
    async getUpstream(): Promise<string | undefined> {
      const current = await adapter.read();
      const backup = await store.read();
      return resolveSystemProxyUpstream(
        backup && checkOwnedSettings(current, backup.owner) ? backup.settings : current,
      );
    },
    activate(port: number): Promise<void> {
      return serialize(async () => {
        if (!Number.isInteger(port) || port < 1 || port > 65535)
          throw new Error("Invalid system proxy port");
        await restoreOwnedSettings();
        if (await store.read())
          throw new Error("另一应用实例正在管理系统代理，请先在该实例中停止抓取。");
        const settings = await adapter.read();
        resolveSystemProxyUpstream(settings);
        const owner = `127.0.0.1:${port}`;
        await store.write({ version: 1, owner, ownerPid, settings });
        try {
          await adapter.write({
            ProxyEnable: { value: 1, kind: "DWord" },
            ProxyServer: { value: owner, kind: "String" },
            ProxyOverride: { value: "<local>", kind: "String" },
            AutoConfigURL: null,
            AutoDetect: { value: 0, kind: "DWord" },
          });
        } catch (error) {
          // A registry write may have partially succeeded. Roll back the exact saved values.
          await adapter.write(settings);
          await store.remove();
          throw error;
        }
      });
    },
  };
}
