import { createApp } from "vue";
import App from "./App.vue";
import "./styles/base.css";
import "./styles/native-shell.css";
import "./styles/native-table.css";
import "./styles/native-inspector.css";
import "./styles/native-settings.css";
import "./styles/process-picker.css";
import "./styles/theme.css";

document.documentElement.dataset.platform = navigator.platform.startsWith("Mac")
  ? "darwin"
  : "other";
createApp(App).mount("#app");
