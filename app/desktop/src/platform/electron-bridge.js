export class ElectronPlatformBridge {
    async openView(viewName) {
        await window.electron.openView(viewName);
    }
    emit(event, payload) {
        window.electron.emit(event, payload);
    }
    listen(event, callback) {
        return window.electron.listen(event, callback);
    }
}
//# sourceMappingURL=electron-bridge.js.map