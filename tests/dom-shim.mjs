/* The control builders in inputs.js are the one layer the other suites
   never touch: they test algorithms against inputs written by hand in the
   test file, so a builder can go missing entirely and every check still
   passes. That is exactly what happened — 23 of them were lost in a bad
   merge and 13,551 checks stayed green while most of the site was dead.

   This is the smallest fake DOM that lets those builders run for real.
   It is deliberately not a browser: it only has the handful of properties
   inputs.js actually touches, so if a builder starts needing more of the
   DOM, this throws rather than quietly returning something wrong. */

class Node {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.style = {};
    this.className = '';
    this._text = '';
    this.listeners = {};
    this.classList = {
      add: (c) => { this.className = `${this.className} ${c}`.trim(); },
      remove: (c) => { this.className = this.className.split(/\s+/).filter((x) => x !== c).join(' '); },
      contains: (c) => this.className.split(/\s+/).includes(c),
      toggle: (c, on) => (on ?? !this.classList.contains(c)) ? this.classList.add(c) : this.classList.remove(c),
    };
  }

  get textContent() { return this._text; }
  set textContent(v) { this._text = String(v); this.children = []; }

  append(...kids) { for (const k of kids) if (k) this.children.push(k); }
  replaceChildren(...kids) { this.children = []; this.append(...kids); }
  remove() {}
  setAttribute(k, v) { this[k] = v; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }

  /** Only tag selectors — that is all inputs.js asks for. */
  querySelector(sel) {
    const want = sel.toUpperCase();
    for (const kid of this.children) {
      if (kid.tagName === want) return kid;
      const deeper = kid.querySelector?.(sel);
      if (deeper) return deeper;
    }
    return null;
  }

  /* The grid builder measures the canvas to pick a row count. */
  getBoundingClientRect() { return { width: 960, height: 505, top: 0, left: 0 }; }

  /** Fire a handler the way a real interaction would. */
  fire(type) { for (const fn of this.listeners[type] || []) fn.call(this, this); }
}

/**
 * A localStorage that behaves like the real one, including throwing
 * nowhere and persisting nothing. The progress store has to work when
 * storage is unavailable, so tests need to be able to break it too.
 */
export function fakeStorage({ broken = false } = {}) {
  const map = new Map();
  const guard = () => { if (broken) throw new Error('storage is not available'); };
  return {
    getItem: (k) => { guard(); return map.has(k) ? map.get(k) : null; },
    setItem: (k, v) => { guard(); map.set(k, String(v)); },
    removeItem: (k) => { guard(); map.delete(k); },
    clear: () => { guard(); map.clear(); },
    get length() { return map.size; },
  };
}

/** Install the shim globally; returns a function that removes it again. */
export function installDom({ storage = true } = {}) {
  const hadDoc = 'document' in globalThis;
  const hadStore = 'localStorage' in globalThis;
  globalThis.document = {
    createElement: (tag) => new Node(tag),
    getElementById: () => new Node('canvas'),
  };
  if (storage) globalThis.localStorage = fakeStorage();
  return () => {
    if (!hadDoc) delete globalThis.document;
    if (!hadStore) delete globalThis.localStorage;
  };
}

export { Node };
