// Live updates from server.py over one WebSocket (/api/events): monitor status, collect
// and apply jobs, new facts. Reconnects by itself. Features that use it fall back to HTTP
// polling while it is down, so nothing depends on it.
import { store } from './store.js';

export class Events {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.handlers = new Map(); // type -> Set(fn)
    this.retry = 1000;
    this.wantMonitor = false;
    this.timer = null;
  }
  get available() { return store.mode === 'server' && typeof WebSocket !== 'undefined'; }

  start() { if (this.available && !this.ws) this.open(); }
  open() {
    clearTimeout(this.timer);
    let ws;
    try { ws = new WebSocket(`ws://${location.host}/api/events`); } catch { this.later(); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.connected = true; this.retry = 1000;
      if (this.wantMonitor) this.send({ type: 'subscribe', monitor: true });
      this.emit('open', {});
    };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m && m.type) this.emit(m.type, m); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      const was = this.connected;
      this.connected = false; this.ws = null;
      if (was) this.emit('close', {});
      this.later();
    };
  }
  later() { this.timer = setTimeout(() => this.open(), this.retry); this.retry = Math.min(30000, this.retry * 2); }

  on(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); return () => this.handlers.get(type).delete(fn); }
  emit(type, m) { for (const fn of this.handlers.get(type) || []) { try { fn(m); } catch (e) { console.error(e); } } }
  send(obj) { if (this.connected && this.ws?.readyState === 1) { this.ws.send(JSON.stringify(obj)); return true; } return false; }
  /** Ask the server for monitor status pushes (one agent poll for all windows). */
  monitor(on) { this.wantMonitor = on; this.send({ type: 'subscribe', monitor: on }); }
}
