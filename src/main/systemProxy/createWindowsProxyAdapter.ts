import { execFile } from "node:child_process";
import { proxyValueNames, type ProxySettings, type SystemProxyAdapter } from "./types";

const registryPath = "Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings";
const refreshScript = `
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class TrafficWinInet { [DllImport("wininet.dll", SetLastError=true)] public static extern bool InternetSetOption(IntPtr h, int option, IntPtr buffer, int length); }';
if (-not [TrafficWinInet]::InternetSetOption([IntPtr]::Zero,39,[IntPtr]::Zero,0)) { throw 'Proxy refresh failed' }
if (-not [TrafficWinInet]::InternetSetOption([IntPtr]::Zero,37,[IntPtr]::Zero,0)) { throw 'Proxy notification failed' }
`;

function runRegistryScript(script: string): Promise<string> {
  if (process.platform !== "win32")
    return Promise.reject(new Error("系统代理模式目前仅支持 Windows。"));
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(
          `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); ${script}`,
          "utf16le",
        ).toString("base64"),
      ],
      { timeout: 10_000, maxBuffer: 64 * 1024, windowsHide: true, encoding: "utf8" },
      (error, stdout) => {
        if (error) reject(new Error("系统代理设置操作失败，请检查 Windows Internet Settings。"));
        else resolve(stdout.trim());
      },
    );
  });
}

function validateSettings(input: unknown): ProxySettings {
  if (typeof input !== "object" || input === null) throw new Error("Invalid system proxy settings");
  const settings = input as ProxySettings;
  for (const name of proxyValueNames) {
    const entry = settings[name];
    if (entry === null) continue;
    if (
      !entry ||
      !["String", "ExpandString", "DWord"].includes(entry.kind) ||
      (entry.kind === "DWord" ? !Number.isInteger(entry.value) : typeof entry.value !== "string")
    ) {
      throw new Error("系统代理注册表值类型不受支持，未修改设置。");
    }
  }
  return settings;
}

export function createWindowsProxyAdapter(): SystemProxyAdapter {
  return {
    async read() {
      const output = await runRegistryScript(`
$key=[Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('${registryPath}'); $result=@{};
foreach($name in @('${proxyValueNames.join("','")}')) {
  if ($key -and $key.GetValueNames() -contains $name) {
    $result[$name]=@{kind=$key.GetValueKind($name).ToString();value=$key.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}
  } else { $result[$name]=$null }
}; if ($key) {$key.Close()}; $result | ConvertTo-Json -Compress
`);
      return validateSettings(JSON.parse(output));
    },
    async write(settings) {
      validateSettings(settings);
      const payload = Buffer.from(JSON.stringify(settings), "utf8").toString("base64");
      await runRegistryScript(`
$settings=[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}')) | ConvertFrom-Json;
$key=[Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('${registryPath}');
try { foreach($name in @('${proxyValueNames.join("','")}')) {
  $entry=$settings.$name;
  if ($null -eq $entry) { $key.DeleteValue($name,$false) }
  else { $value=$entry.value; if ($entry.kind -eq 'DWord') { $value=[int]$value }; $kind=[Enum]::Parse([Microsoft.Win32.RegistryValueKind],[string]$entry.kind); $key.SetValue($name,$value,$kind) }
} } finally { $key.Close() }
${refreshScript}
`);
    },
  };
}
