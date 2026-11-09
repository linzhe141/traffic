import type { TrafficApi } from "./desktopApi";
declare global {
  interface Window {
    trafficApi?: TrafficApi;
  }
}
export {};
