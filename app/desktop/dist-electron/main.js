import { BrowserWindow as e, app as t, ipcMain as n } from "electron";
import r from "node:path";
import { fileURLToPath as i } from "node:url";
//#region electron/main.ts
var a = r.dirname(i(import.meta.url));
process.env.APP_ROOT = r.join(a, "..");
var o = r.join(process.env.APP_ROOT, "dist-electron"), s = r.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL ? r.join(process.env.APP_ROOT, "public") : s;
var c = /* @__PURE__ */ new Map();
function l(e) {
	for (let t = 0; t < e.length; t++) if (e[t] === "--view" && e[t + 1]) return e[t + 1];
	return "master-hub";
}
function u(t) {
	let n = c.get(t);
	if (n && !n.isDestroyed()) return n.isMinimized() && n.restore(), n.show(), n.focus(), n;
	let i = t === "routine-time-tracker", o = new e({
		title: i ? "Routine Time Tracker" : "LifeRPG Hub",
		width: i ? 400 : 800,
		height: 600,
		alwaysOnTop: i,
		resizable: !i,
		autoHideMenuBar: !0,
		webPreferences: {
			preload: r.join(a, "preload.mjs"),
			contextIsolation: !0,
			nodeIntegration: !1
		}
	});
	c.set(t, o), o.on("closed", () => {
		c.delete(t);
	});
	let l = `/${t}`;
	return process.env.VITE_DEV_SERVER_URL ? (o.loadURL(`${process.env.VITE_DEV_SERVER_URL}#${l}`), o.webContents.openDevTools()) : o.loadFile(r.join(s, "index.html"), { hash: l }), o;
}
t.requestSingleInstanceLock() ? (t.on("second-instance", (e, t) => {
	u(l(t));
}), t.whenReady().then(() => {
	n.handle("open_view", (e, { viewName: t }) => {
		u(t);
	}), n.on("app:emit", (e, { event: t, payload: n }) => {
		for (let e of c.values()) e.isDestroyed() || e.webContents.send(`event:${t}`, n);
	}), u(l(process.argv));
})) : t.quit(), t.on("window-all-closed", () => {
	process.platform !== "darwin" && t.quit();
});
//#endregion
export { o as MAIN_DIST, s as RENDERER_DIST };
