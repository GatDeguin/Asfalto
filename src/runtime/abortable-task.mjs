/** Stop waiting immediately; continue observing the underlying task so late failures
 * are handled. Callers still own cancellation of work and disposal of late resources. */
export function waitWithSignal(value, signal) {
  const task = Promise.resolve(value);
  if (!signal) return task;
  if (signal.aborted) {
    task.catch(() => {});
    return Promise.reject(signal.reason || new DOMException('Operación cancelada', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason || new DOMException('Operación cancelada', 'AbortError'));
    };
    signal.addEventListener('abort', abort, {once: true});
    task.then(
      result => { signal.removeEventListener('abort', abort); resolve(result); },
      error => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}
