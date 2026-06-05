import "./styles.css";
import { bootstrapDesktopBody } from "./desktop-body";

const app = document.querySelector<HTMLElement>("#app");

if (app) {
  void bootstrapDesktopBody(app);
}
