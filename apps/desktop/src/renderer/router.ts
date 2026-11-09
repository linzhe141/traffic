import { createRouter, createWebHashHistory } from "vue-router";
import TrafficWorkspace from "./views/TrafficWorkspace.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/requests/:requestId?",
      name: "traffic",
      component: TrafficWorkspace,
      props: true,
    },
    { path: "/:pathMatch(.*)*", redirect: { name: "traffic" } },
  ],
});
