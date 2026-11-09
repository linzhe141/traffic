function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildNodeLaunchCommand(
  executablePath: string,
  certificatePath: string,
  port: number,
): string {
  const proxy = `http://127.0.0.1:${port}`;
  const environment: Record<string, string> = {
    HTTP_PROXY: proxy,
    HTTPS_PROXY: proxy,
    http_proxy: proxy,
    https_proxy: proxy,
    NO_PROXY: "localhost,127.0.0.1,::1",
    no_proxy: "localhost,127.0.0.1,::1",
    NODE_USE_ENV_PROXY: "1",
    NODE_USE_SYSTEM_CA: "1",
    NODE_EXTRA_CA_CERTS: certificatePath,
  };
  return [
    "$captureApp = New-Object System.Diagnostics.ProcessStartInfo",
    `$captureApp.FileName = ${quotePowerShell(executablePath)}`,
    "$captureApp.UseShellExecute = $false",
    "$captureApp.EnvironmentVariables.Remove('ELECTRON_RUN_AS_NODE')",
    ...Object.entries(environment).map(
      ([key, value]) =>
        `$captureApp.EnvironmentVariables[${quotePowerShell(key)}] = ${quotePowerShell(value)}`,
    ),
    "[System.Diagnostics.Process]::Start($captureApp) | Out-Null",
  ].join("\n");
}
