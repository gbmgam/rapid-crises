type NavTarget = 'security_a' | 'exit' | 'lobby' | 'medical' | 'reset';

class NavBus extends EventTarget {
  emit(target: NavTarget) {
    this.dispatchEvent(new CustomEvent('map:navigate', { detail: target }));
  }

  on(callback: (target: NavTarget) => void) {
    const handler = (e: any) => callback(e.detail);
    this.addEventListener('map:navigate', handler);
    return () => this.removeEventListener('map:navigate', handler);
  }
}

export const navBus = new NavBus();
