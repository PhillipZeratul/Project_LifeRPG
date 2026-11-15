# 0002. Sandboxed Community Plugin Architecture

Community plugins are treated as untrusted code and execute within standard web sandboxes across both Electron and Capacitor runtimes.

Headless plugin logic executes inside isolated Web Workers, while custom plugin UI widgets render inside sandboxed iframes (`sandbox="allow-scripts"`), preventing direct access to the host DOM, local database, or native OS capabilities.
All communication between plugins and the host runtime traverses a typed asynchronous RPC message bridge (`postMessage`) validated against permissions declared in the plugin's manifest.

## Considered Options

* **QuickJS in WebAssembly**: Rejected for now due to bundle size overhead and additional runtime complexity; native Web Workers and sandboxed iframes provide sufficient isolation for web-standard runtimes.
