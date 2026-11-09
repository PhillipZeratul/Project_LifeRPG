let electron = require("electron");
//#region electron/preload.ts
electron.contextBridge.exposeInMainWorld("electron", {
	openView: (viewName) => electron.ipcRenderer.invoke("open_view", { viewName }),
	emit: (event, payload) => electron.ipcRenderer.send("app:emit", {
		event,
		payload
	}),
	listen: (event, callback) => {
		const channel = `event:${event}`;
		const listener = (_e, payload) => callback(payload);
		electron.ipcRenderer.on(channel, listener);
		return () => electron.ipcRenderer.removeListener(channel, listener);
	}
});
//#endregion
