import type { TrafficApi } from "./contracts";
declare global {
  interface Window {
    trafficApi?: TrafficApi;
  }
}
export {};
