const { before, after, beforeEach, test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, deleteDoc, collection, getDocs, serverTimestamp } = require('firebase/firestore');
let env;
const row = id => ({ id, client: 'Ana', phone: '+50371234567', model: 'Galaxy', channel: 'WhatsApp', payment: 'Contado', event: 'Seguimiento', when: '2030-12-01T10:00', state: 'Pendiente', contactProfile: '', notes: '' });
const change = id => ({ id, revision: 'revision-1', deleted: false, updatedAt: serverTimestamp(), record: row(id) });
const ref = (db, uid, id = 'one') => doc(db, 'users', uid, 'followups', id);

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-lunivo', firestore: {
    host: '127.0.0.1', port: 8787, rules: fs.readFileSync('firestore.rules', 'utf8')
  } });
});
after(async () => { if (env) await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });

test('an account can write, read and query only its own followups', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(setDoc(ref(alice, 'alice'), change('one')));
  await assertSucceeds(getDoc(ref(alice, 'alice')));
  await assertSucceeds(getDocs(collection(alice, 'users', 'alice', 'followups')));
  await assertFails(getDoc(ref(bob, 'alice')));
  await assertFails(getDocs(collection(bob, 'users', 'alice', 'followups')));
  await assertFails(setDoc(ref(bob, 'alice'), change('one')));
});

test('anonymous access is denied', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(ref(db, 'alice')));
  await assertFails(setDoc(ref(db, 'alice'), change('one')));
});

test('two sessions of the same user see changes and completion', async () => {
  const a = env.authenticatedContext('alice').firestore();
  const b = env.authenticatedContext('alice').firestore();
  await setDoc(ref(a, 'alice'), change('one'));
  let read = await getDoc(ref(b, 'alice'));
  if (read.data().record.client !== 'Ana') throw new Error('Missing cross-session record');
  const update = change('one'); update.record.state = 'Completado'; update.revision = 'revision-2';
  await setDoc(ref(b, 'alice'), update);
  read = await getDoc(ref(a, 'alice'));
  if (read.data().record.state !== 'Completado') throw new Error('Completion did not synchronize');
});

test('deletion uses a retained tombstone and physical removal is forbidden', async () => {
  const db = env.authenticatedContext('alice').firestore();
  await setDoc(ref(db, 'alice'), change('one'));
  await assertSucceeds(setDoc(ref(db, 'alice'), { id: 'one', revision: 'deleted', deleted: true, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(ref(db, 'alice')));
});

test('invalid fields, mismatched ids and client timestamps are rejected', async () => {
  const db = env.authenticatedContext('alice').firestore();
  const bad = change('one'); bad.record.client = 123;
  await assertFails(setDoc(ref(db, 'alice'), bad));
  const mismatch = change('one'); mismatch.record.id = 'other';
  await assertFails(setDoc(ref(db, 'alice'), mismatch));
  await assertFails(setDoc(ref(db, 'alice'), { ...change('one'), updatedAt: new Date(0) }));
  await assertFails(setDoc(ref(db, 'alice'), { ...change('one'), extra: 'unexpected' }));
});

test('profiles are private to the account and validate names and active status', async () => {
  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  const anonymous = env.unauthenticatedContext().firestore();
  const profile = (db, uid = 'alice') => doc(db, 'users', uid, 'profiles', 'ana');
  const value = { id: 'ana', revision: 'profile-1', deleted: false, updatedAt: serverTimestamp(), record: { id: 'ana', name: 'Ana María', active: true } };
  await assertSucceeds(setDoc(profile(alice), value));
  await assertSucceeds(getDocs(collection(alice, 'users','alice','profiles')));
  await assertFails(getDoc(profile(bob)));
  await assertFails(getDoc(profile(anonymous)));
  await assertFails(setDoc(profile(bob), value));
  await assertSucceeds(setDoc(profile(alice), { ...value, revision: 'profile-2', record: { ...value.record, active: false } }));
  await assertFails(setDoc(profile(alice), { ...value, record: { ...value.record, name: '' } }));
  await assertFails(setDoc(profile(alice), { ...value, record: { ...value.record, name: 'a'.repeat(81) } }));
  await assertFails(setDoc(profile(alice), { ...value, record: { ...value.record, active: 'true' } }));
  await assertFails(setDoc(profile(alice), { ...value, record: { ...value.record, admin: true } }));
  await assertFails(deleteDoc(profile(alice)));
});

test('creator is optional for legacy data and immutable on edits and completion', async () => {
  const db = env.authenticatedContext('alice').firestore();
  const authored = change('one');
  authored.record = { ...authored.record, createdById: 'ana', createdByName: 'Ana', createdAt: '2030-01-01T00:00:00Z' };
  await assertSucceeds(setDoc(ref(db, 'alice'), authored));
  await assertSucceeds(setDoc(ref(db, 'alice'), { ...authored, revision: 'edit', record: { ...authored.record, notes: 'Editado por otra persona', state: 'Completado' } }));
  await assertFails(setDoc(ref(db, 'alice'), { ...authored, record: { ...authored.record, createdByName: 'Bruno' } }));
  await assertFails(setDoc(ref(db, 'alice'), change('one')));
  const legacy = change('legacy');
  await assertSucceeds(setDoc(ref(db, 'alice', 'legacy'), legacy));
  await assertFails(setDoc(ref(db, 'alice', 'legacy'), { ...legacy, record: { ...legacy.record, createdById: 'ana', createdByName: 'Ana', createdAt: '2030-01-01T00:00:00Z' } }));
  await assertSucceeds(setDoc(ref(db, 'alice'), { id: 'one', revision: 'deleted', deleted: true, updatedAt: serverTimestamp() }));
  const partial = change('partial'); partial.record.createdById = 'ana';
  await assertFails(setDoc(ref(db, 'alice', 'partial'), partial));
});

test('Lunivo and Split brands are valid, legacy data remains valid and removing a stored brand is rejected', async () => {
  const db = env.authenticatedContext('alice').firestore();
  const legacy = change('one');
  await assertSucceeds(setDoc(ref(db, 'alice'), legacy));
  const split = { ...legacy, revision:'split-1', record:{ ...legacy.record, brand:'Split' } };
  await assertSucceeds(setDoc(ref(db, 'alice'), split));
  await assertFails(setDoc(ref(db, 'alice'), legacy));
  await assertFails(setDoc(ref(db, 'alice'), { ...split, record:{ ...split.record, brand:'Other' } }));
  await assertFails(setDoc(ref(db, 'alice'), { ...split, record:{ ...split.record, brand:true } }));
  await assertSucceeds(setDoc(ref(db, 'alice'), { ...split, revision:'lunivo-1', record:{ ...split.record, brand:'Lunivo' } }));
  const bob=env.authenticatedContext('bob').firestore();
  await assertFails(getDoc(ref(bob,'alice')));
});
