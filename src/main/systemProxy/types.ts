export interface RegistryValue {
  value: string | number;
  kind: "String" | "ExpandString" | "DWord";
}
export const proxyValueNames = [
  "ProxyEnable",
  "ProxyServer",
  "ProxyOverride",
  "AutoConfigURL",
  "AutoDetect",
] as const;
export type ProxySettings = Record<(typeof proxyValueNames)[number], RegistryValue | null>;
export interface SystemProxyAdapter {
  read(): Promise<ProxySettings>;
  write(settings: ProxySettings): Promise<void>;
}
export interface ProxyBackup {
  version: 1;
  owner: string;
  ownerPid: number;
  settings: ProxySettings;
}
export interface ProxyBackupStore {
  read(): Promise<ProxyBackup | null>;
  write(backup: ProxyBackup): Promise<void>;
  remove(): Promise<void>;
}
