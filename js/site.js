(function () {
  'use strict';
  const C = window.Catalog;
  const projects = Array.isArray(window.projects) ? window.projects : [];
  const $ = id => document.getElementById(id);
  let route = { page: '' };
  let catalogQuery = C.parseRoute('#/projeler').query;
  let currentProject = null;
  let lastCatalog = '#/projeler';
  try { lastCatalog = sessionStorage.getItem('anadolu:lastShelf') || lastCatalog; } catch { /* Storage is optional. */ }
  if (C.parseRoute(lastCatalog).page !== 'projects') lastCatalog = '#/projeler';
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const detailHref = project => '#/proje/' + encodeURIComponent(project.id);
  const statusLabel = project => C.statusOf(project) === 'demo' ? 'DEMO KAYDI' : 'TAMAMLANAN KAYIT';
  const inputLabel = project => project.input === 'keyboard-mouse' ? 'Klavye ve fare ile oynanır.' : project.input === 'keyboard' ? 'Klavye ile oynanır.' : '';
  const durationLabel = project => project.duration || (project.format === '45' ? '10 dakikadan kısa' : project.format === '33' ? '10 dakika ve üzeri' : '');

  function cover(project, large = false, eager = false) {
    const picture = el('picture');
    if (project.coverThumb && project.coverLarge) {
      const source = document.createElement('source');
      source.type = 'image/webp';
      source.srcset = project.coverThumb + ' 480w, ' + project.coverLarge + ' 960w';
      source.sizes = large ? '(max-width: 760px) 90vw, 510px' : '(max-width: 760px) 44vw, (max-width: 1100px) 30vw, 380px';
      picture.append(source);
    }
    const img = document.createElement('img');
    img.src = project.cover || 'images/record.svg';
    img.alt = project.title + ' plak kapağı';
    img.width = 960;
    img.height = 960;
    img.loading = eager ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (eager) img.fetchPriority = 'high';
    picture.append(img);
    return picture;
  }
  function tags(target, values) {
    target.replaceChildren();
    values.filter(Boolean).forEach(value => target.append(el('span', 'tag' + (value === 'DEMO KAYDI' ? ' demo' : ''), value)));
  }
  function recordCard(project) {
    const article = el('article', 'record-card');
    const link = el('a');
    link.href = detailHref(project);
    link.setAttribute('aria-label', project.title + ' — detayları aç');
    const art = el('div', 'record-art');
    const vinyl = el('span', 'record-vinyl');
    vinyl.setAttribute('aria-hidden', 'true');
    art.append(vinyl, cover(project));
    const serial = el('div', 'card-catalog');
    serial.append(el('span', '', project.catalogNumber || project.id.toUpperCase()), el('span', '', String(project.year || '')));
    const meta = el('div', 'card-tags');
    [C.formatLabel(project), C.genreLabel(project.genre)].filter(Boolean).forEach(value => meta.append(el('span', '', value)));
    if (C.statusOf(project) === 'demo') meta.append(el('span', 'status', 'DEMO'));
    link.append(art, serial, el('h3', '', project.title), meta);
    const bottom = el('div', 'card-bottom');
    bottom.append(el('span', '', durationLabel(project) || (C.typeOf(project) === 'studio' ? 'Stüdyodan' : 'Bağımsız proje')));
    const action = el('a', '', project.playable && project.url ? 'OYNA ↗' : 'İNCELE →');
    action.href = project.playable && project.url ? project.url : detailHref(project);
    action.setAttribute('aria-label', project.title + (project.playable ? ' oyna' : ' detayları'));
    bottom.append(action);
    article.append(link, bottom);
    return article;
  }
  function renderHome() {
    const featured = projects.find(project => project.featured) || projects[0];
    $('homeCount').textContent = '(' + projects.length + ')';
    if (!featured) {
      $('featuredCoverLink').hidden = true;
      $('featuredPlay').hidden = true;
      $('featuredDescription').textContent = 'İlk kayıtlar yakında bu rafta.';
      return;
    }
    $('featuredCover').replaceChildren(cover(featured, true, true));
    $('featuredCoverLink').href = detailHref(featured);
    $('featuredCoverLink').setAttribute('aria-label', featured.title + ' — kapağı çevir');
    $('featuredCatalog').textContent = featured.catalogNumber || '';
    $('featuredTitle').textContent = featured.title;
    $('featuredDescription').textContent = featured.description || '';
    tags($('featuredTags'), [C.formatLabel(featured), C.statusOf(featured) === 'demo' ? 'DEMO KAYDI' : '', C.genreLabel(featured.genre)]);
    $('featuredPlay').href = featured.url || detailHref(featured);
    $('featuredPlay').textContent = featured.playable ? 'OYNA ↗' : 'PROJEYİ İNCELE →';
    $('featuredLink').href = detailHref(featured);
    $('homeProjectsGrid').replaceChildren(...projects.filter(project => project.id !== featured.id).slice(0,4).map(recordCard));
  }
  function populateFilters() {
    const genres = [...new Set(projects.map(project => project.genre).filter(Boolean))].sort((a,b) => C.genreLabel(a).localeCompare(C.genreLabel(b), 'tr'));
    genres.forEach(genre => $('genreFilter').add(new Option(C.genreLabel(genre), genre)));
    [...new Set(projects.map(C.deliveryOf).filter(Boolean))].forEach(delivery => $('deliveryFilter').add(new Option(C.deliveryNames[delivery] || delivery, delivery)));
  }
  function renderCatalog(query) {
    const restoreShelfFocus = $('shelfTabs').contains(document.activeElement);
    const restoreResultsFocus = $('projectsGrid').contains(document.activeElement);
    catalogQuery = query;
    $('globalSearch').value = query.q;
    $('genreFilter').value = query.genre;
    $('deliveryFilter').value = query.delivery;
    $('statusFilter').value = query.status;
    $('sort').value = query.sort;
    $('shelfTabs').replaceChildren(...C.shelves.map(([key,label]) => {
      const link = el('a', '', label);
      link.href = C.catalogHash({ ...query, raf: key });
      if (key === query.raf) link.setAttribute('aria-current', 'page');
      link.append(el('small', '', String(projects.filter(project => C.inShelf(project,key)).length)));
      return link;
    }));
    const list = C.selectProjects(projects, query);
    $('resultCount').textContent = list.length + ' KAYIT';
    $('activeFilterSummary').textContent = [query.q ? '“' + query.q + '”' : '', query.genre ? C.genreLabel(query.genre) : '', query.delivery ? C.deliveryNames[query.delivery] || query.delivery : '', query.status ? query.status === 'demo' ? 'Demo' : 'Tamamlanan' : ''].filter(Boolean).join(' · ');
    $('projectsGrid').replaceChildren(...list.map(recordCard));
    if (!list.length) {
      const empty = el('div', 'empty-state');
      const isEmptyShelf = !projects.some(project => C.inShelf(project,query.raf));
      empty.append(el('h2', '', isEmptyShelf ? 'BU RAFIN HİKÂYESİ YENİ BAŞLIYOR.' : 'BU SEÇİME UYAN PLAK YOK.'), el('p', '', isEmptyShelf ? 'Yeni işler geldikçe burada yerini alacak. Şimdilik diğer rafları karıştırabilirsin.' : 'Başka bir kategori dene ya da aramayı ve filtreleri temizle.'));
      const clear = el('a', 'button', 'Bütün rafı göster →');
      clear.href = '#/projeler';
      empty.append(clear);
      $('projectsGrid').append(empty);
    }
    lastCatalog = C.catalogHash(query);
    try { sessionStorage.setItem('anadolu:lastShelf', lastCatalog); } catch { /* Storage is optional. */ }
    if (restoreShelfFocus) $('shelfTabs').querySelector('[aria-current="page"]')?.focus({ preventScroll: true });
    else if (restoreResultsFocus) $('projectsTitle').focus({ preventScroll: true });
  }
  function selectSide(index, focus = false) {
    ['A','B'].forEach((side,i) => {
      const tab = $('side' + side + 'Tab');
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      $('side' + side).hidden = i !== index;
      if (focus && i === index) tab.focus();
    });
  }
  function renderDetail(project) {
    currentProject = project;
    $('detailBack').href = lastCatalog;
    $('detailCover').replaceChildren(cover(project, true, true));
    $('detailTitle').textContent = project.title;
    $('detailCatalog').textContent = project.catalogNumber || project.id.toUpperCase();
    $('detailYear').textContent = String(project.year || '');
    $('detailKicker').textContent = [C.typeOf(project) === 'studio' ? 'STÜDYO' : 'OYUN', C.formatLabel(project), statusLabel(project)].filter(Boolean).join(' · ');
    tags($('detailMeta'), [C.genreLabel(project.genre), C.deliveryNames[C.deliveryOf(project)], durationLabel(project)]);
    $('detailDescription').textContent = project.description || '';
    $('detailAction').hidden = !project.url;
    if (project.url) $('detailAction').href = project.url;
    $('detailAction').textContent = project.playable ? 'OYNA ↗' : C.deliveryOf(project) === 'download' ? 'İNDİR ↗' : 'PROJEYİ AÇ ↗';
    $('detailDevice').textContent = inputLabel(project);
    $('detailAbout').textContent = project.details || project.description || '';
    $('detailControls').replaceChildren(...(project.controls?.length ? project.controls : ['Kontroller oyun içindeki yönergelerde yer alır.']).map(control => el('li','',control)));
    $('detailDuration').textContent = durationLabel(project) ? 'PLAK SÜRESİ · ' + durationLabel(project) : '';
    $('detailNotes').textContent = project.notes || 'Bu kaydın yapım notları henüz rafa bırakılmadı.';
    const credits = [['Kayıt',project.catalogNumber || project.id],['Yapım',project.creator || 'Anadolu Saykodeli'],['Yıl',project.year],['Durum',C.statusOf(project) === 'demo' ? 'Demo' : 'Tamamlandı'],['Format',C.formatLabel(project) || 'Stüdyo']];
    $('detailCredits').replaceChildren(...credits.filter(([,value]) => value).map(([label,value]) => { const row = el('div'); row.append(el('dt','',label),el('dd','',String(value))); return row; }));
    const screenshots = project.screenshots || [];
    $('detailGallery').hidden = !screenshots.length;
    $('detailGallery').replaceChildren(...screenshots.map(shot => {
      const figure = el('figure');
      const img = document.createElement('img');
      img.src = shot.src; img.alt = shot.alt || project.title + ' oyun görüntüsü'; img.loading = 'lazy'; img.decoding = 'async';
      if (shot.width && shot.height) { img.width = shot.width; img.height = shot.height; }
      figure.append(img);
      if (shot.caption) figure.append(el('figcaption','',shot.caption));
      return figure;
    }));
    $('relatedProjects').replaceChildren(...projects.filter(other => other.id !== project.id).sort((a,b) => Number(b.format === project.format) - Number(a.format === project.format)).slice(0,3).map(recordCard));
    $('shareProject').textContent = 'Bağlantıyı kopyala';
    $('shareStatus').textContent = '';
    selectSide(0);
  }
  function navigate() {
    const next = C.parseRoute(location.hash);
    if (next.page === 'skip') { $('main').focus(); return; }
    const previous = route;
    if (next.page === 'projectDetail') {
      const project = projects.find(item => item.id === next.id);
      if (project) renderDetail(project); else next.page = 'notFound';
    }
    if (next.page === 'projects') renderCatalog(next.query);
    document.querySelectorAll('.page').forEach(page => { page.hidden = page.id !== next.page; });
    document.querySelectorAll('[data-nav]').forEach(link => {
      const active = link.dataset.nav === next.page || (next.page === 'projectDetail' && link.dataset.nav === 'projects');
      if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
    });
    const titles = { home: 'Bağımsız proje rafı', projects: 'Proje rafı', about: 'Hakkımda', contact: 'İletişim', notFound: 'Plak bulunamadı' };
    document.title = (next.page === 'projectDetail' ? currentProject.title : titles[next.page]) + ' — Anadolu Saykodeli';
    document.querySelector('meta[name="description"]').content = next.page === 'projectDetail' ? currentProject.description || currentProject.title : 'Anadolu Saykodeli: bağımsız oyunlar, kısa deneyimler ve stüdyo işleri. Bir kapak seç, plağı çevir, oyuna gir.';
    if (previous.page !== next.page || previous.id !== next.id) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (previous.page) document.querySelector('#' + next.page + ' h1')?.focus({ preventScroll: true });
    }
    route = next;
  }
  function updateFilters() {
    location.hash = C.catalogHash({ ...catalogQuery, genre: $('genreFilter').value, delivery: $('deliveryFilter').value, status: $('statusFilter').value, sort: $('sort').value });
  }
  $('searchForm').addEventListener('submit', event => {
    event.preventDefault();
    location.hash = C.catalogHash({ q: $('globalSearch').value.trim() });
  });
  $('filterPanel').addEventListener('submit', event => event.preventDefault());
  ['genreFilter','deliveryFilter','statusFilter','sort'].forEach(id => $(id).addEventListener('change',updateFilters));
  $('clearFilters').addEventListener('click', () => { location.hash = '#/projeler'; });
  $('filterToggle').addEventListener('click', () => {
    const open = $('filterToggle').getAttribute('aria-expanded') !== 'true';
    $('filterToggle').setAttribute('aria-expanded',String(open));
    $('filterToggle').lastElementChild.textContent = open ? '−' : '＋';
    $('filterPanel').hidden = !open;
  });
  ['A','B'].forEach((side,index) => {
    $('side' + side + 'Tab').addEventListener('click', () => selectSide(index));
    $('side' + side + 'Tab').addEventListener('keydown', event => {
      if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
        event.preventDefault();
        selectSide(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1-index, true);
      }
    });
  });
  $('shareProject').addEventListener('click', async () => {
    const projectId = currentProject?.id;
    try {
      await navigator.clipboard.writeText(location.href);
      if (currentProject?.id !== projectId) return;
      $('shareProject').textContent = 'Bağlantı kopyalandı ✓';
      $('shareStatus').textContent = 'Projenin bağlantısı panoya kopyalandı.';
    } catch {
      $('shareProject').textContent = 'Adresi tarayıcı çubuğundan kopyala';
      $('shareStatus').textContent = 'Pano izni kullanılamıyor. Bağlantıyı tarayıcının adres çubuğundan kopyalayabilirsin.';
    }
  });
  window.addEventListener('hashchange',navigate);
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    $('main').focus();
    $('main').scrollIntoView();
  });
  $('featuredTitle').tabIndex = -1;
  populateFilters();
  renderHome();
  navigate();
})();
