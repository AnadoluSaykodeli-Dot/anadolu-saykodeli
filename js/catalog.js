/* Shared catalogue rules; no DOM, also usable by the validation script. */
(function (root) {
  'use strict';
  const shelves = [['all', 'Bütün raf'], ['45', '45’likler'], ['33', '33’lükler'], ['demo', 'Demo kayıtları'], ['studio', 'Stüdyo']];
  const genreNames = { arcade: 'Arcade', experimental: 'Deneysel', roguelike: 'Roguelike', driving: 'Sürüş', puzzle: 'Bulmaca', story: 'Hikâye', strategy: 'Strateji', '3d': '3D', 'pixel-art': 'Pixel art', visual: 'Görsel tasarım', audio: 'Ses / müzik' };
  const deliveryNames = { web: 'Tarayıcıda', download: 'İndirilebilir' };
  const formatLabel = project => project.format === '45' ? '45’LİK' : project.format === '33' ? '33’LÜK' : '';
  const statusOf = project => project.status || (project.type === 'demo' ? 'demo' : 'released');
  const typeOf = project => project.type === 'demo' ? 'game' : project.type === '3d' ? 'studio' : project.type;
  const deliveryOf = project => project.delivery || (project.playable ? 'web' : '');
  const genreLabel = genre => genreNames[genre] || genre || '';
  const fold = value => String(value || '').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i');
  function inShelf(project, shelf) {
    if (shelf === 'demo') return statusOf(project) === 'demo';
    if (shelf === 'studio') return typeOf(project) === 'studio';
    if (shelf === '45' || shelf === '33') return project.format === shelf;
    return true;
  }
  function selectProjects(projects, query) {
    const q = fold(query.q).trim();
    const list = projects.filter(project => inShelf(project, query.raf)
      && (!query.genre || project.genre === query.genre)
      && (!query.delivery || deliveryOf(project) === query.delivery)
      && (!query.status || statusOf(project) === query.status)
      && (!q || fold([project.title, project.description, genreLabel(project.genre), formatLabel(project)].join(' ')).includes(q)));
    if (query.sort === 'name') list.sort((a,b) => a.title.localeCompare(b.title, 'tr'));
    if (query.sort === 'year') list.sort((a,b) => Number(b.year || 0) - Number(a.year || 0));
    return list;
  }
  function parseRoute(hash) {
    if (hash === '#main') return { page: 'skip' };
    const raw = hash.replace(/^#/, '') || '/';
    const at = raw.indexOf('?');
    const path = at < 0 ? raw : raw.slice(0, at);
    const params = new URLSearchParams(at < 0 ? '' : raw.slice(at + 1));
    const query = Object.fromEntries(['raf','q','genre','delivery','status','sort'].map(key => [key, params.get(key) || '']));
    if (!shelves.some(([key]) => key === query.raf)) query.raf = 'all';
    if (!['new','name','year'].includes(query.sort)) query.sort = 'new';
    const pages = { '/': 'home', '/projeler': 'projects', '/hakkimda': 'about', '/iletisim': 'contact' };
    if (Object.hasOwn(pages, path)) return { page: pages[path], query };
    if (path.startsWith('/proje/')) {
      try { return { page: 'projectDetail', id: decodeURIComponent(path.slice(7)), query }; }
      catch { return { page: 'notFound', query }; }
    }
    return { page: 'notFound', query };
  }
  function catalogHash(query = {}) {
    const params = new URLSearchParams();
    for (const key of ['raf','q','genre','delivery','status','sort']) {
      if (query[key] && !(key === 'raf' && query[key] === 'all') && !(key === 'sort' && query[key] === 'new')) params.set(key, query[key]);
    }
    return '#/projeler' + (params.size ? '?' + params.toString() : '');
  }
  const api = { shelves, genreLabel, deliveryNames, formatLabel, statusOf, typeOf, deliveryOf, fold, inShelf, selectProjects, parseRoute, catalogHash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Catalog = api;
})(typeof window !== 'undefined' ? window : globalThis);
