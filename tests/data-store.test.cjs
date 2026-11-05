const { test } = require('node:test');
const assert = require('node:assert/strict');
const createStore = require('../data-store.js');

function memory() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}
const row = (id, client = 'Ana') => ({ id, client, phone: '+50371234567', model: 'Galaxy', channel: 'WhatsApp', payment: 'Contado', event: 'Seguimiento', when: '2030-12-01T10:00', state: 'Pendiente', contactProfile: '', notes: '' });
const remote = (record, revision = 'remote', committed = true) => ({ id: record.id, record, revision, deleted: false, committed });

test('damaged target cannot publish its account identity or erase the previous account',()=>{
  const storage=memory(),store=createStore(storage);store.switchAccount('alice');store.save([row('saved')]);
  storage.setItem('lunivo-account-v1:bob','{"records":{},"outbox":{}}');
  assert.throws(()=>store.switchAccount('bob'));assert.equal(store.account(),'alice');assert.equal(storage.getItem('lunivo-active-account-v1'),'alice');assert.equal(store.records()[0].id,'saved');
});
test('corrupted local JSON cannot be replaced by a save and can recover after a valid read',()=>{
  const storage=memory(),store=createStore(storage);storage.setItem('crm-telefonos-seguimientos-v1','{broken');
  assert.throws(()=>store.save([row('new')]));assert.equal(storage.getItem('crm-telefonos-seguimientos-v1'),'{broken');
  storage.setItem('crm-telefonos-seguimientos-v1','[]');store.save([row('new')]);assert.equal(store.records()[0].id,'new');
});

test('legacy records stay local until an explicit account import', () => {
  const storage = memory();
  const store = createStore(storage);
  store.save([row('legacy')]);
  assert.equal(store.pending().length, 0);
  store.switchAccount('alice');
  assert.deepEqual(store.records(), []);
  store.switchAccount(null);
  assert.deepEqual(store.records(), [row('legacy')]);
  store.switchAccount('alice', store.legacyRecords());
  assert.equal(store.pending()[0].importing, true);
  assert.deepEqual(store.records(), [row('legacy')]);
});

test('two devices merge independent records without replacing the collection', () => {
  const a = createStore(memory()), b = createStore(memory());
  a.switchAccount('alice'); b.switchAccount('alice');
  a.save([row('one')]); b.save([row('two')]);
  const one = a.pending()[0], two = b.pending()[0];
  const snapshot = [remote(one.record, one.revision), remote(two.record, two.revision)];
  a.merge('alice', snapshot, false); b.merge('alice', snapshot, false);
  assert.deepEqual(a.records(), b.records());
  assert.equal(a.records().length, 2);
  assert.equal(a.pending().length, 0);
  assert.equal(b.pending().length, 0);
});

test('offline changes and deletion survive old snapshots and process restart', () => {
  const storage = memory(); let store = createStore(storage);
  store.switchAccount('alice'); store.merge('alice', [remote(row('one')), remote(row('two'))], false);
  store.save([row('one', 'Cambio sin conexión')]);
  const operations = store.pending();
  assert.equal(operations.length, 2);
  store = createStore(storage);
  store.merge('alice', [remote(row('one')), remote(row('two'))], false);
  assert.deepEqual(store.records(), [row('one', 'Cambio sin conexión')]);
  assert.deepEqual(store.pending(), operations);
});

test('stale acknowledgements cannot discard a newer edit', () => {
  const store = createStore(memory()); store.switchAccount('alice'); store.save([row('one')]);
  const older = store.pending()[0];
  store.save([row('one', 'Nueva edición')]);
  assert.equal(store.acknowledge('alice', 'one', older.revision), false);
  store.merge('alice', [remote(older.record, older.revision)], false);
  assert.equal(store.records()[0].client, 'Nueva edición');
  assert.equal(store.pending().length, 1);
});

test('cache snapshots never acknowledge an offline write or clear missing records', () => {
  const store = createStore(memory()); store.switchAccount('alice');
  store.merge('alice', [remote(row('existing'))], false);
  store.save([row('existing'), row('new')]);
  const op = store.pending()[0];
  store.merge('alice', [remote(op.record, op.revision, false)], true);
  assert.equal(store.pending().length, 1);
  assert.equal(store.records().length, 2);
});

test('server tombstones do not resurrect after a disconnected device reconnects', () => {
  const store = createStore(memory()); store.switchAccount('alice');
  store.merge('alice', [remote(row('one'))], false);
  store.merge('alice', [{ id: 'one', deleted: true, revision: 'deleted', committed: true }], false);
  assert.deepEqual(store.records(), []);
  assert.deepEqual(store.pending(), []);
});

test('account switching isolates records, queues and late network replies', () => {
  const store = createStore(memory()); store.switchAccount('alice'); store.save([row('alice')]);
  const op = store.pending()[0];
  store.switchAccount('bob'); store.save([row('bob')]);
  assert.equal(store.merge('alice', [remote(row('intruder'))], false), false);
  assert.equal(store.acknowledge('alice', 'alice', op.revision), false);
  assert.deepEqual(store.records(), [row('bob')]);
  store.switchAccount(null); assert.deepEqual(store.records(), []);
  store.switchAccount('alice'); assert.deepEqual(store.records(), [row('alice')]);
  assert.equal(store.pending()[0].revision, op.revision);
});

test('records and outbox are atomic if local storage is full', () => {
  const storage = memory(); const store = createStore(storage);
  store.switchAccount('alice'); store.save([row('one')]);
  const before = storage.getItem('lunivo-account-v1:alice');
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => store.save([]));
  assert.equal(storage.getItem('lunivo-account-v1:alice'), before);
  assert.deepEqual(store.records(), [row('one')]);
});

test('import acknowledges an existing remote copy without overwriting it', () => {
  const store = createStore(memory()); store.switchAccount('alice', [row('one', 'Antigua')]);
  const op = store.pending()[0]; const server = [remote(row('one', 'Actualizada'))];
  store.merge('alice', server, false);
  assert.equal(store.records()[0].client, 'Antigua');
  store.acknowledge('alice', op.id, op.revision); store.merge('alice', server, false);
  assert.equal(store.records()[0].client, 'Actualizada');
});

test('legacy IDs do not pollute operation maps', () => {
  const store = createStore(memory()); store.switchAccount('alice'); store.save([row('__proto__')]);
  assert.equal(store.pending()[0].id, '__proto__');
});

const profileOptions = { localKey: 'lunivo-profiles-local-v1', accountPrefix: 'lunivo-profiles-account-v1:', fields: ['id','name','active'] };
test('profiles synchronize offline renames and deactivation without touching followups', () => {
  const disk = memory();
  const users = createStore(disk, profileOptions), followups = createStore(disk);
  users.switchAccount('alice'); followups.switchAccount('alice'); followups.save([row('client')]);
  users.save([{ id: 'ana', name: 'Ana', active: true }]);
  const older = users.pending()[0];
  users.save([{ id: 'ana', name: 'Ana María', active: false }]);
  const newer = users.pending()[0];
  const restarted = createStore(disk, profileOptions);
  restarted.merge('alice', [remote(older.record, older.revision)], false);
  assert.deepEqual(restarted.records(), [{ id: 'ana', name: 'Ana María', active: false }]);
  assert.equal(restarted.pending()[0].revision, newer.revision);
  restarted.merge('alice', [remote(newer.record, newer.revision)], false);
  assert.equal(restarted.pending().length, 0);
  assert.deepEqual(followups.records(), [row('client')]);
  restarted.switchAccount('bob');
  assert.deepEqual(restarted.records(), []);
  assert.equal(restarted.merge('alice', [remote(older.record)], false), false);
  restarted.switchAccount('alice'); assert.equal(restarted.records()[0].name, 'Ana María');
});

test('creator metadata survives offline restart, server merge and account import without assigning legacy records', () => {
  const disk = memory(), store = createStore(disk);
  const created = { ...row('one'), createdById: 'ana', createdByName: 'Ana', createdAt: '2030-01-01T00:00:00Z' };
  store.save([created, row('legacy')]);
  store.switchAccount('alice', store.legacyRecords());
  const restarted = createStore(disk), op = restarted.pending().find(p => p.id === 'one');
  restarted.merge('alice', [remote(op.record, op.revision)], true);
  assert.equal(restarted.records().find(r => r.id === 'one').createdByName, 'Ana');
  assert.equal(Object.hasOwn(restarted.records().find(r => r.id === 'legacy'), 'createdByName'), false);
  const copy = restarted.records(); copy[0].createdByName = 'Nombre distinto'; restarted.save(copy);
  assert.notEqual(restarted.pending().find(p => p.id === 'one').revision, op.revision);
});

test('changing only the brand queues a new revision and survives restart and server merge', () => {
  const disk = memory(); const store = createStore(disk); store.switchAccount('alice');
  const original = { ...row('one'), brand: 'Lunivo', createdById: 'ana', createdByName: 'Ana', createdAt: '2030-01-01T00:00:00Z' };
  store.merge('alice', [remote(original)], false);
  store.save([{ ...original, brand: 'Split' }]);
  const op = store.pending()[0]; assert.equal(op.record.brand, 'Split');
  const restarted = createStore(disk);
  restarted.merge('alice', [remote(original)], false);
  assert.equal(restarted.records()[0].brand, 'Split');
  restarted.merge('alice', [remote(op.record, op.revision)], false);
  assert.equal(restarted.pending().length, 0);
  assert.equal(restarted.records()[0].createdByName, 'Ana');
});

test('mixed-brand import and saving one brand cannot remove the other or rewrite legacy rows', () => {
  const store = createStore(memory());
  const legacy = row('legacy'), split = { ...row('split'), brand: 'Split' };
  store.save([legacy, split]); store.switchAccount('alice', store.legacyRecords());
  const rows = store.records(); rows.find(r => r.id === 'split').notes = 'Editado'; store.save(rows);
  assert.equal(store.records().length, 2);
  assert.equal(Object.hasOwn(store.records().find(r => r.id === 'legacy'), 'brand'), false);
  assert.equal(store.pending().find(op => op.id === 'split').record.brand, 'Split');
});
