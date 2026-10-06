'use strict';

// Run with Node.js: node tools/test_catalog.cjs
// Validate catalogue behavior and authored asset references without a browser.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../js/catalog.js');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'js/projects.js'), 'utf8'), context);
const projects = JSON.parse(JSON.stringify(context.window.projects));
const failures = [];
let passed = 0;

function test(name, run) {
  try {
    run();
    passed++;
    console.log('PASS ' + name);
  } catch (error) {
    failures.push({ name, error });
    console.error('FAIL ' + name + ': ' + error.message);
  }
}

function query(values = {}) {
  return { ...C.parseRoute('#/projeler').query, ...values };
}
const ids = list => list.map(project => project.id);

function checkAsset(url, label, directory = false) {
  assert.equal(typeof url, 'string', label + ' must be a URL');
  assert.ok(url.length > 0, label + ' cannot be empty');
  const parsed = new URL(url, 'https://catalogue.example/');
  assert.ok(['http:', 'https:'].includes(parsed.protocol), label + ' has an unsupported protocol');
  if (parsed.origin !== 'https://catalogue.example') return;
  const localPath = path.resolve(root, '.' + decodeURIComponent(parsed.pathname));
  assert.ok(localPath.startsWith(root + path.sep), label + ' must stay inside the site');
  const target = directory ? path.join(localPath, 'index.html') : localPath;
  assert.ok(fs.existsSync(target), label + ' does not exist: ' + url);
  assert.ok(fs.statSync(target).isFile(), label + ' must resolve to a file: ' + url);
}

test('catalogue entries have unique stable identities and valid metadata', () => {
  assert.ok(Array.isArray(projects) && projects.length > 0);
  assert.equal(new Set(ids(projects)).size, projects.length, 'Project IDs must be unique');
  const catalogNumbers = projects.map(project => project.catalogNumber).filter(Boolean);
  assert.equal(new Set(catalogNumbers).size, catalogNumbers.length, 'Catalogue numbers must be unique');
  for (const project of projects) {
    assert.match(project.id, /^[a-z0-9][a-z0-9-]*$/);
    assert.ok(project.title && project.description, project.id + ' needs a title and description');
    assert.ok(['game', 'studio'].includes(project.type), project.id + ' has an invalid type');
    assert.ok(['demo', 'released'].includes(project.status), project.id + ' has an invalid status');
    assert.ok(!project.format || ['45', '33'].includes(project.format), project.id + ' has an invalid format');
    assert.ok(Number.isInteger(project.year), project.id + ' needs a numeric year');
    assert.ok(Array.isArray(project.controls), project.id + ' needs a controls array');
    assert.ok(project.controls.every(control => typeof control === 'string' && control.length));
  }
});

test('Istanbul Parking is playable and belongs to both the 45 and demo shelves', () => {
  const parking = projects.find(project => project.id === 'istanbulparking');
  assert.ok(parking, 'The newly supplied game is missing');
  assert.equal(parking.playable, true);
  assert.equal(C.typeOf(parking), 'game');
  assert.equal(C.statusOf(parking), 'demo');
  assert.equal(C.formatLabel(parking), '45’LİK');
  assert.ok(C.inShelf(parking, '45') && C.inShelf(parking, 'demo'));
  assert.ok(!C.inShelf(parking, '33') && !C.inShelf(parking, 'studio'));
});

test('format and demo status intersect independently for both game lengths', () => {
  const shortDemos = ids(C.selectProjects(projects, query({ raf: '45', status: 'demo' })));
  const longDemos = ids(C.selectProjects(projects, query({ raf: '33', status: 'demo' })));
  assert.ok(shortDemos.includes('istanbulparking'));
  assert.ok(!shortDemos.includes('mothership'));
  assert.ok(longDemos.includes('mothership'));
  assert.ok(!longDemos.includes('istanbulparking'));
  assert.equal(C.formatLabel(projects.find(project => project.id === 'mothership')), '33’LÜK');
  assert.ok(ids(C.selectProjects(projects, query({ raf: 'demo' }))).includes('mothership'));
});

test('Turkish titles and genres can be searched with ASCII or Turkish input', () => {
  for (const q of ['istanbul', 'İstanbul', 'ISTANBUL', 'ıstanbul', '  istanbul  ']) {
    assert.ok(ids(C.selectProjects(projects, query({ q }))).includes('istanbulparking'), q);
  }
  assert.equal(C.fold('İıŞşĞğÜüÖöÇç'), 'iissgguuoocc');
  assert.ok(ids(C.selectProjects(projects, query({ q: 'surus' }))).includes('istanbulparking'));
  assert.equal(C.selectProjects(projects, query({ q: 'no-such-title-12345' })).length, 0);
});

test('filters compose and a new studio category does not require special catalogue code', () => {
  assert.ok(ids(C.selectProjects(projects, query({ raf: 'demo', genre: 'driving', delivery: 'web' }))).includes('istanbulparking'));
  assert.equal(C.selectProjects(projects, query({ raf: '33', genre: 'driving' })).length, 0);
  const future = { id: 'future-studio', title: 'Yeni İş', type: 'studio', status: 'released', genre: 'ceramics', year: 2027 };
  const extended = [...projects, future];
  assert.deepEqual(ids(C.selectProjects(extended, query({ raf: 'studio', genre: 'ceramics' }))), ['future-studio']);
  assert.equal(C.genreLabel('ceramics'), 'ceramics');
});

test('sorting does not mutate catalogue order and new entries retain author order', () => {
  const original = ids(projects);
  assert.deepEqual(ids(C.selectProjects(projects, query())), original);
  const named = C.selectProjects(projects, query({ sort: 'name' }));
  for (let i = 1; i < named.length; i++) assert.ok(named[i - 1].title.localeCompare(named[i].title, 'tr') <= 0);
  const newest = { id: 'next-project', title: 'Next', year: 2030, type: 'game', status: 'released' };
  assert.equal(C.selectProjects([...projects, newest], query({ sort: 'year' }))[0].id, 'next-project');
  assert.deepEqual(ids(projects), original);
});

test('static and encoded detail routes parse without losing the project identity', () => {
  for (const [hash, page] of [['', 'home'], ['#/', 'home'], ['#/projeler', 'projects'], ['#/hakkimda', 'about'], ['#/iletisim', 'contact']]) {
    assert.equal(C.parseRoute(hash).page, page);
  }
  for (const project of projects) {
    const route = C.parseRoute('#/proje/' + encodeURIComponent(project.id));
    assert.equal(route.page, 'projectDetail');
    assert.equal(route.id, project.id);
  }
  assert.equal(C.parseRoute('#/proje/%C4%B0stanbul%20Parking').id, 'İstanbul Parking');
  const unknown = C.parseRoute('#/proje/missing-project');
  assert.equal(unknown.page, 'projectDetail');
  assert.ok(!projects.some(project => project.id === unknown.id), 'Unknown IDs must remain unresolvable');
});

test('unknown and malformed routes fail closed instead of throwing or exposing prototype keys', () => {
  for (const hash of ['#/missing-page', '#not-a-route', '#constructor', '#toString', '#__proto__', '#/proje/%', '#/proje/%E0%A4%A']) {
    assert.equal(C.parseRoute(hash).page, 'notFound', hash);
  }
  assert.equal(C.parseRoute('#/projeler?raf=missing&sort=missing').query.raf, 'all');
  assert.equal(C.parseRoute('#/projeler?raf=missing&sort=missing').query.sort, 'new');
});

test('hash queries preserve Unicode and reserved characters across reload and history', () => {
  const selection = query({ raf: '45', q: 'İstanbul & Q/E #45 = park+et?', genre: 'driving', delivery: 'web', status: 'demo', sort: 'name' });
  const hash = C.catalogHash(selection);
  const parsed = C.parseRoute(hash);
  assert.equal(parsed.page, 'projects');
  assert.deepEqual(parsed.query, selection);
  assert.equal(C.catalogHash(query()), '#/projeler');
  assert.deepEqual(ids(C.selectProjects(projects, parsed.query)), ids(C.selectProjects(projects, selection)));
});

test('all cover variants, game URLs, and screenshot references resolve', () => {
  for (const project of projects) {
    checkAsset(project.cover, project.id + ' cover');
    for (const variant of ['coverThumb', 'coverLarge']) if (project[variant]) checkAsset(project[variant], project.id + ' ' + variant);
    if (project.playable) {
      assert.equal(C.deliveryOf(project), 'web');
      checkAsset(project.url, project.id + ' game URL', true);
    }
    for (const shot of project.screenshots || []) {
      checkAsset(shot.src, project.id + ' screenshot');
      assert.ok(shot.alt && typeof shot.alt === 'string', project.id + ' screenshot needs alternative text');
      if (shot.width !== undefined || shot.height !== undefined) assert.ok(shot.width > 0 && shot.height > 0);
    }
  }
});

console.log('\n' + passed + ' passed; ' + failures.length + ' failed.');
if (failures.length) process.exitCode = 1;
