/* Shared frame for the original Godot exports. Engine files stay in each game folder. */
(() => {
  'use strict';

  const config = JSON.parse(document.getElementById('game-config').textContent);
  const catalog = typeof projects !== 'undefined' ? projects : (window.projects || []);
  const project = catalog.find((entry) => entry.id === config.projectId);
  const title = project?.title || config.title;
  const player = document.getElementById('player');
  const stage = document.getElementById('player-stage');
  const canvas = document.getElementById('canvas');
  const loader = document.getElementById('loader');
  const loadingTitle = document.getElementById('loading-title');
  const description = document.getElementById('loading-description');
  const progress = document.getElementById('load-progress');
  const amount = document.getElementById('load-amount');
  const controlsDialog = document.getElementById('controls-dialog');
  const fullscreenButton = document.getElementById('fullscreen-button');
  const notice = document.getElementById('player-notice');
  let ready = false;
  let failed = false;
  let noticeTimeout;

  document.title = `${title} · Anadolu Saykodeli`;
  document.getElementById('game-title').textContent = title;
  canvas.setAttribute('aria-label', title);
  document.querySelectorAll('[data-back-link]').forEach((link) => {
    link.href = `../../#/proje/${encodeURIComponent(config.projectId)}`;
  });
  const cover = document.getElementById('cover-image');
  if (project?.coverThumb || project?.cover) {
    cover.src = new URL(project.coverThumb || project.cover, new URL('../../', location.href)).href;
  }
  cover.addEventListener('error', () => { cover.hidden = true; });

  const controls = project?.controls?.length ? project.controls : ['Kontroller oyun içindeki yönergelerde yer alır.'];
  const controlsList = document.getElementById('controls-list');
  controls.forEach((control) => {
    const item = document.createElement('li');
    item.textContent = control;
    controlsList.append(item);
  });
  document.getElementById('controls-button').addEventListener('click', () => {
    if (document.pointerLockElement) document.exitPointerLock();
    controlsDialog.showModal();
  });
  controlsDialog.addEventListener('click', (event) => {
    if (event.target !== controlsDialog) return;
    const bounds = controlsDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      controlsDialog.close();
    }
  });

  function notify(message) {
    clearTimeout(noticeTimeout);
    notice.textContent = message;
    notice.hidden = false;
    noticeTimeout = setTimeout(() => { notice.hidden = true; }, 6500);
  }

  if (!player.requestFullscreen || !document.fullscreenEnabled) {
    fullscreenButton.disabled = true;
    fullscreenButton.title = 'Bu tarayıcı tam ekranı desteklemiyor.';
  }
  fullscreenButton.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await player.requestFullscreen();
      if (ready && !controlsDialog.open) canvas.focus({ preventScroll: true });
    } catch (_error) {
      notify('Tam ekran açılamadı. Oyuna bu pencerede devam edebilirsin.');
    }
  });
  document.addEventListener('fullscreenchange', () => {
    const active = Boolean(document.fullscreenElement);
    fullscreenButton.textContent = active ? 'Tam ekrandan çık' : 'Tam ekran';
    fullscreenButton.setAttribute('aria-pressed', String(active));
    resizeCanvas();
  });

  // Godot policy 0 delegates resizing to this template. Policy 2 would use the
  // entire window and crop the bottom of the game behind the toolbar.
  function resizeCanvas() {
    const bounds = stage.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(bounds.width * scale));
    const height = Math.max(1, Math.round(bounds.height * scale));
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }
  resizeCanvas();
  if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(stage);
  window.addEventListener('resize', resizeCanvas);
  window.visualViewport?.addEventListener('resize', resizeCanvas);

  document.getElementById('retry-button').addEventListener('click', () => location.reload());

  function showFailure(error, message = 'Bağlantını kontrol edip yeniden deneyebilirsin. Sorun sürerse rafa dönüp başka bir kayıt seç.') {
    if (failed) return;
    failed = true;
    ready = false;
    console.error('Oyun başlatılamadı:', error);
    loader.hidden = false;
    loader.classList.add('failed');
    loadingTitle.textContent = 'Plak çalınamadı';
    description.textContent = message;
    progress.hidden = true;
    amount.hidden = true;
    document.getElementById('error-actions').hidden = false;
    const details = document.getElementById('error-details');
    document.getElementById('error-text').textContent = error instanceof Error ? error.message : String(error);
    details.hidden = false;
    stage.setAttribute('aria-busy', 'false');
  }

  function updateProgress(current, total) {
    if (failed || ready) return;
    if (total > 0 && current >= 0) {
      const percent = Math.min(100, Math.round(current / total * 100));
      progress.max = total;
      progress.value = current;
      amount.textContent = `${percent}% · ${(current / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB`;
      if (current >= total) {
        loadingTitle.textContent = 'İğne plağa iniyor…';
        description.textContent = 'İndirme tamamlandı. Oyun hazırlanıyor.';
      } else {
        loadingTitle.textContent = 'Plak indiriliyor…';
        description.textContent = 'Kayıt hazır olduğunda oyun açılacak.';
      }
    } else {
      progress.removeAttribute('value');
      amount.textContent = 'İndirme boyutu hesaplanıyor…';
    }
  }

  async function start() {
    try {
      if (typeof Engine === 'undefined') {
        throw new Error('Oyun motoru yüklenemedi. Sayfayı yenileyerek tekrar dene.');
      }
      const missing = Engine.getMissingFeatures({ threads: Boolean(config.threads) });
      if (missing.length) {
        showFailure(missing.join('\n'), 'Bu tarayıcı oyunun ihtiyaç duyduğu bazı özellikleri desteklemiyor. Güncel bir tarayıcıyla yeniden deneyebilirsin.');
        return;
      }
      const engine = new Engine({
        ...config.engine,
        canvas,
        canvasResizePolicy: 0,
        onExit(code) {
          if (code !== 0) {
            showFailure(`Oyun ${code} koduyla kapandı.`);
            return;
          }
          ready = false;
          loader.hidden = false;
          loader.classList.add('finished');
          loadingTitle.textContent = 'Kayıt sona erdi';
          description.textContent = 'Yeniden çalabilir ya da dükkâna dönebilirsin.';
          progress.hidden = true;
          amount.hidden = true;
          document.getElementById('error-actions').hidden = false;
          document.getElementById('retry-button').textContent = 'Yeniden çal';
          stage.setAttribute('aria-busy', 'false');
        }
      });
      await engine.startGame({ onProgress: updateProgress });
      if (failed) return;
      ready = true;
      resizeCanvas();
      loadingTitle.textContent = 'Plak hazır';
      loader.hidden = true;
      stage.setAttribute('aria-busy', 'false');
      if (!controlsDialog.open) canvas.focus({ preventScroll: true });
    } catch (error) {
      showFailure(error);
    }
  }

  start();
})();
