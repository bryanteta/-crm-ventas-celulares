(function (root, factory) {
  const createStore = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = createStore;
  else {
    root.LunivoStore = createStore(root.localStorage);
    root.LunivoProfiles = createStore(root.localStorage, {
      localKey: 'lunivo-profiles-local-v1', accountPrefix: 'lunivo-profiles-account-v1:',
      fields: ['id', 'name', 'active']
    });
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const LEGACY = 'crm-telefonos-seguimientos-v1';
  const ACTIVE = 'lunivo-active-account-v1';
  const fields = ['id', 'client', 'phone', 'model', 'channel', 'payment', 'event', 'when', 'state', 'contactProfile', 'notes', 'createdById', 'createdByName', 'createdAt', 'brand'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const revision = () => typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return function createStore(storage, options = {}) {
    const localKey = options.localKey || LEGACY;
    const canonical = row => JSON.stringify((options.fields || fields).map(field => row[field] ?? ''));
    let account = null;
    try { account = storage.getItem(ACTIVE) || null; } catch { /* Read errors are reported on use. */ }
    const accountKey = uid => `${options.accountPrefix || 'lunivo-account-v1:'}${uid}`;
    function readEnvelope(uid = account) {
      if (!uid) {
        const records = JSON.parse(storage.getItem(localKey) || '[]');
        if (!Array.isArray(records)) throw new Error('No se pudo leer el almacenamiento local.');
        return { records, outbox: {} };
      }
      const raw = JSON.parse(storage.getItem(accountKey(uid)) || '{"records":[],"outbox":{}}');
      if (!Array.isArray(raw.records) || !raw.outbox || typeof raw.outbox !== 'object' || Array.isArray(raw.outbox)) {
        throw new Error('No se pudo leer el almacenamiento de la cuenta.');
      }
      return raw;
    }
    function persist(envelope, uid = account) {
      if (uid) storage.setItem(accountKey(uid), JSON.stringify(envelope));
      else storage.setItem(localKey, JSON.stringify(envelope.records));
    }
    function changed(envelope, next, importing = false) {
      const before = new Map(envelope.records.map(row => [row.id, row]));
      const after = new Map(next.map(row => [row.id, row]));
      const outbox = Object.assign(Object.create(null), envelope.outbox);
      for (const [id, record] of after) {
        if (!before.has(id) || canonical(record) !== canonical(before.get(id))) {
          outbox[id] = { id, revision: revision(), deleted: false, record: clone(record), importing };
        }
      }
      for (const id of before.keys()) {
        if (!after.has(id)) outbox[id] = { id, revision: revision(), deleted: true };
      }
      return { records: clone(next), outbox };
    }
    return {
      account: () => account,
      records: () => clone(readEnvelope().records),
      legacyRecords: () => clone(readEnvelope(null).records),
      pending: () => account ? Object.values(readEnvelope().outbox).map(clone) : [],
      save(next) {
        // In account mode, records and pending operations commit in ONE storage write.
        const before = readEnvelope();
        const envelope = account ? changed(before, next) : { records: next, outbox: {} };
        persist(envelope);
      },
      switchAccount(uid, imports = []) {
        if (uid !== null && (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid))) throw new Error('Cuenta inválida.');
        if (uid && imports.length) {
          const envelope = readEnvelope(uid);
          const existing = new Set(envelope.records.map(row => row.id));
          const added = imports.filter(row => !existing.has(row.id));
          persist(changed(envelope, [...envelope.records, ...added], true), uid);
        }
        // Validate the target before publishing its identity. Damaged data cannot half-switch accounts.
        const nextRecords = clone(readEnvelope(uid).records);
        // A failed storage write cannot silently switch the active data set.
        if (uid) storage.setItem(ACTIVE, uid);
        else storage.removeItem(ACTIVE);
        account = uid;
        return nextRecords;
      },
      merge(uid, documents, fromCache) {
        if (uid !== account) return false;
        const envelope = readEnvelope();
        const rows = new Map((fromCache ? envelope.records : []).map(row => [row.id, row]));
        for (const doc of documents) {
          if (doc.deleted) rows.delete(doc.id);
          else if (doc.record && doc.record.id === doc.id) rows.set(doc.id, clone(doc.record));
          // Only a server-confirmed revision can acknowledge a previous offline write.
          if (doc.committed && envelope.outbox[doc.id]?.revision === doc.revision) delete envelope.outbox[doc.id];
        }
        for (const op of Object.values(envelope.outbox)) {
          if (op.deleted) rows.delete(op.id);
          else rows.set(op.id, clone(op.record));
        }
        persist({ records: [...rows.values()], outbox: envelope.outbox });
        return true;
      },
      acknowledge(uid, id, rev) {
        if (uid !== account) return false;
        const envelope = readEnvelope();
        if (envelope.outbox[id]?.revision !== rev) return false;
        delete envelope.outbox[id];
        persist(envelope);
        return true;
      }
    };
  };
});
