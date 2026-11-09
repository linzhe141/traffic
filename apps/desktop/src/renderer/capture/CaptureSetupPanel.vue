<script setup lang="ts">
import type { EngineInfo } from "@local-traffic/protocol";
import AppInput from "../components/ui/AppInput.vue";
import AppButton from "../components/ui/AppButton.vue";
import AppSelect from "../components/ui/AppSelect.vue";
import ProcessTargetPicker from "./ProcessTargetPicker.vue";
import { FolderOpen, LockKeyhole, RefreshCw, ShieldCheck } from "@lucide/vue";
defineProps<{
  engine?: EngineInfo;
  upstreamProxy: string;
  target: string;
  busy: boolean;
  locked: boolean;
  hasBridge: boolean;
  mode: "local" | "system-proxy";
}>();
const modeOptions = [
  { value: "local", label: "本地进程 · 选择应用" },
  { value: "system-proxy", label: "系统代理" },
] as const;
defineEmits<{
  "update:upstreamProxy": [value: string];
  "update:target": [value: string];
  refresh: [];
  reveal: [];
  trust: [];
  "update:mode": [value: "local" | "system-proxy"];
}>();
</script>

<template>
  <section class="capture-setup" aria-label="本地抓取设置">
    <div class="setup-panel-heading">
      <div>
        <strong>抓取方式</strong>
        <span>HTTP / HTTPS</span>
      </div>
      <AppButton :disabled="busy || !hasBridge" @click="$emit('refresh')">
        <RefreshCw :size="13" /> 刷新引擎
      </AppButton>
    </div>
    <div v-if="locked" id="capture-settings-locked" class="capture-lock-notice" role="status">
      <LockKeyhole :size="15" class="shrink-0" />
      <div>
        <strong>本次抓取设置已锁定</strong>
        <p>停止抓取后，可修改抓取模式、范围和上游代理。</p>
      </div>
    </div>
    <div class="capture-mode-field">
      <span>抓取模式</span>
      <AppSelect
        label="抓取模式"
        :model-value="mode"
        :options="modeOptions"
        :disabled="locked"
        :described-by="locked ? 'capture-settings-locked' : undefined"
        @update:model-value="$emit('update:mode', $event)"
      />
    </div>
    <ProcessTargetPicker
      v-if="mode === 'local'"
      :target="target"
      :locked="locked"
      :has-bridge="hasBridge"
      @update:target="$emit('update:target', $event)"
    />
    <p v-if="mode === 'system-proxy'" class="capture-mode-notice" role="status">
      开始时临时切换当前用户的系统代理，沿用原代理作为上游，停止后恢复。
      遵循系统代理的应用会出现在来源应用和域名列表中。
    </p>
    <div class="setup-fields">
      <label v-if="mode === 'local'">
        <span>进程名或 PID <i>可手动补充</i></span>
        <AppInput
          aria-label="目标进程或 PID"
          placeholder="例如 chrome.exe,1234"
          :model-value="target"
          :disabled="locked"
          @update:model-value="$emit('update:target', $event)"
        />
      </label>
      <label>
        <span>
          上游 HTTP / HTTPS 代理
          <i>可选</i>
        </span>
        <AppInput
          aria-label="上游 HTTP 或 HTTPS 代理"
          :placeholder="
            mode === 'system-proxy' && engine?.systemProxyUpstream
              ? `自动沿用 ${engine.systemProxyUpstream}`
              : 'http://127.0.0.1:7890'
          "
          :model-value="upstreamProxy"
          :disabled="locked"
          :aria-describedby="locked ? 'capture-settings-locked' : undefined"
          @update:model-value="$emit('update:upstreamProxy', $event)"
        />
        <small> 接入 VPN / 代理客户端的 HTTP 或 HTTPS 端口，暂不支持认证。 </small>
      </label>
    </div>
    <div class="engine-state">
      <span class="status-dot" :class="{ recording: engine?.available }"></span>
      <strong>
        {{
          engine
            ? engine.available
              ? `mitmproxy ${engine.version}`
              : "抓取引擎未就绪"
            : "正在检测引擎…"
        }}
      </strong>
      <span class="truncate" :title="engine?.executablePath">
        {{ engine?.executablePath }}
      </span>
    </div>
    <p v-if="engine && !engine.available" class="setup-help">
      {{ engine.error || "未找到引擎" }}
      应用包含抓取引擎。资源缺失时请重新安装应用；开发环境可重启开发服务以准备资源。
    </p>
    <p v-if="engine?.loopbackProxyEnabled && mode === 'local'" class="setup-help" role="status">
      检测到系统代理指向本机。遵循系统代理的连接可用系统代理模式抓取；应用显式连接原代理的流量需要使用抓取端口。
    </p>
    <div class="certificate-setup">
      <div>
        <strong>
          {{ engine?.certificateTrusted ? "本地 CA 已信任" : "HTTPS 证书信任" }}
        </strong>
        <p>
          首次启动会生成本地 CA。信任后，当前用户的应用可接受抓取引擎签发的 HTTPS
          证书；使用证书固定的 App 可能仍拒绝连接。
        </p>
        <small v-if="!engine?.certificateReady"> 请先启动一次抓取以生成证书，再点击刷新。 </small>
        <small v-else :title="engine.certificatePath" class="truncate">
          {{ engine.certificatePath }}
        </small>
      </div>
      <div class="certificate-actions">
        <AppButton
          :disabled="busy || !engine?.certificateReady || !hasBridge"
          @click="$emit('reveal')"
        >
          <FolderOpen :size="13" /> 打开证书位置
        </AppButton>
        <span v-if="engine?.certificateTrusted" class="certificate-trusted">
          <ShieldCheck :size="13" /> 当前用户已信任
        </span>
        <AppButton
          v-else
          class="trust-button"
          :disabled="busy || locked || !engine?.certificateReady || !hasBridge"
          @click="$emit('trust')"
        >
          信任本地 CA
        </AppButton>
      </div>
    </div>
  </section>
</template>
