// appContext.ts
import { App } from "obsidian";

let _app: App;

export function setApp(app: App) {
    _app = app;
}

export function getApp(): App {
    return _app;
}