class Emitter<K, V extends object> {
  private listeners: Map<K, Set<(event: V) => void>> = new Map();

  public on(event: K, listener: (event: V) => void): void {
    const listeners = this.listeners.get(event) ?? new Set();
    this.listeners.set(event, listeners.add(listener));
  }

  public once(event: K, listener: (event: V) => void): void {
    this.on(event, (e) => {
      this.off(event, listener);
      listener(e);
    });
  }

  public off(event: K, listener: (event: V) => void): void {
    const listeners = this.listeners.get(event);

    listeners?.delete(listener);
  }

  public emit(event: V): void {
    if (!('identifier' in event)) return;
    const listeners = this.listeners.get(event.identifier as K);

    if (!listeners) return;
    for (const listener of listeners) {
      listener(event);
    }
  }
}

export { Emitter };
