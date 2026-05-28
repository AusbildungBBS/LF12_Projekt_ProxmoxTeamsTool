// Minimale Typ-Stubs für @novnc/novnc/core/rfb.js — das Upstream-Paket liefert
// nur JS plus JSDoc, kein echtes .d.ts.

declare module "@novnc/novnc" {
  export default class RFB {
    constructor(
      target: HTMLElement,
      url: string,
      options?: {
        wsProtocols?: string[];
        credentials?: { username?: string; password?: string; target?: string };
        shared?: boolean;
        repeaterID?: string;
      }
    );
    scaleViewport: boolean;
    resizeSession: boolean;
    viewOnly: boolean;
    background: string;
    disconnect(): void;
    focus(): void;
    blur(): void;
    sendCtrlAltDel(): void;
    sendKey(keysym: number, code: string, down?: boolean): void;
    addEventListener(type: string, listener: (ev: Event) => void): void;
    removeEventListener(type: string, listener: (ev: Event) => void): void;
  }
}
