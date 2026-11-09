/// <reference types="vite/client" />

interface Window {
    electron: {
        openView(viewName: string): Promise<void>;
        emit(event: string, payload?: unknown): void;
        listen<T = unknown>(event: string, callback: (payload: T) => void): () => void;
    };
}
