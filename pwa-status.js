let initialized = false;

export async function initPwaStatus() {
  if (initialized) return;
  initialized = true;

  const status = document.getElementById('pwa-status');
  const updateButton = document.getElementById('update-button');
  const setStatus = text => { if (status) status.textContent = text; };
  if (updateButton) updateButton.hidden = true;

  if (!('serviceWorker' in navigator) || location.protocol === 'file:' ||
      window.isSecureContext === false) {
    setStatus('当前环境不支持离线使用');
    return;
  }

  const serviceWorker = navigator.serviceWorker;
  let controller = serviceWorker.controller;
  let offlineReady = Boolean(controller);
  let failure = '';
  let updateAvailable = false;
  let updateActivated = false;
  let updateWorker = null;
  let refreshRequested = false;
  let refreshing = false;
  const watchedWorkers = new WeakSet();

  function render() {
    if (updateAvailable) {
      setStatus('新版本已准备好');
    } else if (failure) {
      setStatus(failure);
    } else if (offlineReady) {
      setStatus(navigator.onLine === false ? '当前离线 · 离线可用' : '离线可用');
    } else {
      setStatus('正在准备离线使用…');
    }
    if (updateButton) updateButton.hidden = !updateAvailable;
  }

  function refresh() {
    if (refreshing) return;
    refreshing = true;
    location.reload();
  }

  function markUpdateReady(worker, activated = false) {
    updateAvailable = true;
    updateWorker = worker;
    updateActivated = activated;
    failure = '';
    render();
    if (refreshRequested && updateActivated) refresh();
  }

  function watchWorker(worker) {
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);
    const updateState = () => {
      if (worker.state === 'installed' && controller) {
        markUpdateReady(worker);
      } else if (worker.state === 'activated') {
        offlineReady = true;
        failure = '';
        render();
      } else if (worker.state === 'redundant') {
        if (worker === updateWorker) {
          updateAvailable = false;
          updateActivated = false;
          refreshRequested = false;
          if (updateButton) updateButton.disabled = false;
        }
        failure = offlineReady ? '离线更新失败，当前版本仍可离线使用' : '离线准备失败，请联网后重试';
        render();
      }
    };
    worker.addEventListener('statechange', updateState);
    updateState();
  }

  serviceWorker.addEventListener('controllerchange', () => {
    const nextController = serviceWorker.controller;
    if (!nextController) return;
    // A first installation claims the page without prompting for an update.
    if (controller && controller !== nextController) {
      markUpdateReady(nextController, true);
    }
    controller = nextController;
    offlineReady = true;
    failure = '';
    render();
  });

  updateButton?.addEventListener('click', () => {
    if (!updateAvailable || refreshing) return;
    refreshRequested = true;
    if (updateActivated) {
      refresh();
    } else {
      updateButton.disabled = true;
      updateWorker?.postMessage({ type: 'SKIP_WAITING' });
    }
  });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  render();

  try {
    const registration = await serviceWorker.register('./service-worker.js');
    registration.addEventListener('updatefound', () => watchWorker(registration.installing));
    watchWorker(registration.installing);
    watchWorker(registration.waiting);
    if (registration.active?.state === 'activated') offlineReady = true;
    render();
    serviceWorker.ready.then(() => {
      offlineReady = true;
      failure = '';
      render();
    });
  } catch {
    failure = offlineReady ? '离线更新检查失败，当前版本仍可离线使用' : '离线准备失败，请联网后重试';
    render();
  }
}
