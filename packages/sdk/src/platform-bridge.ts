export interface IPlatformBridge {
    openView(viewName: string): Promise<void>;
    emit(event: string, payload?: unknown): void;
    listen<T>(event: string, callback: (payload: T) => void): () => void;
}
