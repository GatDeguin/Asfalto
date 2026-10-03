/** Presentation only. The final DOM is committed before enter(), never by it. */
export function createMotionScope({document: doc = globalThis.document} = {}) {
  const win = doc.defaultView;
  const preference = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const active = new Map();
  let disposed = false;
  const reduced = () => !!preference?.matches || doc.body.classList.contains('v6-reduce-motion') || doc.body.classList.contains('an-v7-reduce-motion');
  function cancel() {
    const animations = [...active.values()];
    active.clear();
    for (const animation of animations) animation.cancel();
  }
  function reconcile() { if (reduced() || doc.hidden) cancel(); }
  const observer = new win.MutationObserver(reconcile);
  observer.observe(doc.body, {attributes:true, attributeFilter:['class']});
  preference?.addEventListener('change', reconcile);
  doc.addEventListener('visibilitychange', reconcile);
  win.addEventListener('pagehide', cancel);

  return {
    enter(element, {local = false, returning = false, vertical = false} = {}) {
      // Replacing presentation never replaces or cancels a domain operation.
      cancel();
      if (disposed || reduced() || doc.hidden || !element?.isConnected || !element.getClientRects().length || typeof element.animate !== 'function') return;
      const tokens = win.getComputedStyle(doc.documentElement);
      const duration = parseFloat(tokens.getPropertyValue(local ? '--an-motion-information' : '--an-motion-context'));
      const distance = parseFloat(tokens.getPropertyValue('--an-motion-travel')) * (returning ? -1 : 1);
      const opacity = parseFloat(tokens.getPropertyValue('--an-motion-readable'));
      const easing = tokens.getPropertyValue('--an-motion-arrive').trim();
      if (!Number.isFinite(duration) || duration < 0 || !Number.isFinite(distance) || !(opacity >= 0 && opacity <= 1) || !easing) return;
      const from = {opacity}, to = {opacity:1};
      if (!local) {
        from.transform = `translate${vertical ? 'Y' : 'X'}(${distance}px)`;
        to.transform = 'none';
      }
      const animation = element.animate([from, to], {duration, easing});
      active.set(element, animation);
      const release = () => {if (active.get(element) === animation) active.delete(element);};
      // No fill/inline transforms or state callbacks survive completion/cancel.
      void animation.finished.then(release, error => {
        release();
        if (error?.name !== 'AbortError') win.console.error('Transición de interfaz', error);
      });
    },
    cancel,
    dispose() {
      if (disposed) return;
      disposed = true;
      cancel();
      observer.disconnect();
      preference?.removeEventListener('change', reconcile);
      doc.removeEventListener('visibilitychange', reconcile);
      win.removeEventListener('pagehide', cancel);
    },
  };
}
