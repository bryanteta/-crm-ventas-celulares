(() => {
  'use strict';
  const profiles = window.LunivoProfiles;
  const records = window.LunivoStore;
  const select = document.querySelector('#profile-current');
  const input = document.querySelector('#profile-name');
  const saveButton = document.querySelector('#profile-save');
  const cancelButton = document.querySelector('#profile-cancel');
  let editing = null;
  let scope = profiles.account();
  const selectionKey = () => `lunivo-selected-profile-v1:${profiles.account() || 'local'}`;
  const canUse = () => profiles.account() === records.account() && (!window.LunivoSyncCanSave || window.LunivoSyncCanSave());
  const normalize = name => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  function list() {
    if (!canUse()) return [];
    return profiles.records().filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.active === 'boolean');
  }
  function current() {
    if (!canUse()) return null;
    try {
      const id = localStorage.getItem(selectionKey());
      return list().find(p => p.id === id && p.active) || null;
    } catch { return null; }
  }
  function notify(text, tone = 'success') { window.LunivoApp?.notice(text, tone); }
  function reset() {
    editing = null; input.value = ''; saveButton.textContent = 'Agregar usuario'; cancelButton.hidden = true;
  }
  function commit(next) {
    if (!canUse()) { notify('Vuelve a iniciar sesión antes de modificar los usuarios.', 'error'); return false; }
    try { profiles.save(next); }
    catch { notify('No se pudieron guardar los usuarios. Los datos anteriores se conservan.', 'error'); return false; }
    window.dispatchEvent(new Event('lunivo-profiles-save'));
    return true;
  }
  function render() {
    try {
      if (scope !== profiles.account() || !canUse()) { scope = profiles.account(); reset(); }
      const rows = list().sort((a,b) => a.name.localeCompare(b.name, 'es'));
      const selected = current();
      document.querySelector('#profiles-scope').textContent = profiles.account()
        ? 'Estos usuarios se comparten entre los dispositivos de esta cuenta.'
        : 'Modo local: estos usuarios se guardan en este teléfono.';
      select.replaceChildren(new Option('Selecciona un usuario', ''));
      for (const p of rows.filter(p => p.active)) select.append(new Option(p.name, p.id));
      select.value = selected?.id || '';
      select.disabled = !canUse(); saveButton.disabled = !canUse(); input.disabled = !canUse();
      document.querySelector('#active-profile-summary').textContent = selected ? 'Usuario: ' + selected.name : 'Elige tu usuario en Ajustes';
      const record = window.LunivoApp?.editingRecord();
      document.querySelector('#record-author').textContent = record
        ? record.createdByName ? 'Registrado por: ' + record.createdByName : 'Sin usuario registrado · Seguimiento anterior'
        : selected ? 'Se registrará a nombre de: ' + selected.name : 'Selecciona quién usa este teléfono en Ajustes antes de guardar.';
      const target = document.querySelector('#profiles-list'); target.replaceChildren();
      if (!rows.length) {
        const empty = document.createElement('p'); empty.className = 'hint'; empty.textContent = 'Todavía no hay usuarios. Agrega el primer nombre para comenzar.'; target.append(empty);
      }
      for (const p of rows) {
        const row = document.createElement('div'); row.className = 'profile-row';
        const label = document.createElement('span'); label.textContent = p.name + (p.active ? '' : ' · Inactivo');
        const actions = document.createElement('div'); actions.className = 'actions';
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary'; edit.textContent = 'Editar nombre'; edit.setAttribute('aria-label', 'Editar nombre de ' + p.name);
        edit.addEventListener('click', () => { editing = p.id; input.value = p.name; saveButton.textContent = 'Guardar nombre'; cancelButton.hidden = false; input.focus(); });
        const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'secondary'; toggle.textContent = p.active ? 'Desactivar' : 'Reactivar'; toggle.setAttribute('aria-label', toggle.textContent + ' a ' + p.name);
        toggle.addEventListener('click', () => {
          try {
            const next = list().map(person => person.id === p.id ? { ...person, active: !person.active } : person);
            if (commit(next)) { if (editing === p.id) reset(); render(); notify(p.active ? 'Usuario desactivado. Sus registros se conservan.' : 'Usuario reactivado.'); }
          } catch { notify('No se pudieron actualizar los usuarios.', 'error'); }
        });
        edit.disabled = toggle.disabled = !canUse(); actions.append(edit, toggle); row.append(label, actions); target.append(row);
      }
    } catch {
      select.replaceChildren(new Option('No se pudieron cargar los usuarios', ''));
      select.disabled = true;
      document.querySelector('#active-profile-summary').textContent = 'Revisa tus usuarios en Ajustes';
      document.querySelector('#record-author').textContent = 'No se pudieron cargar los usuarios de esta cuenta.';
    }
  }
  function saveProfile() {
    if (!input.reportValidity()) return;
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (!name) { notify('Escribe el nombre del usuario.', 'error'); return; }
    try {
      const rows = list();
      if (rows.some(p => p.id !== editing && normalize(p.name) === normalize(name))) { notify('Ya existe un usuario con ese nombre, activo o inactivo.', 'error'); return; }
      const id = editing || crypto.randomUUID();
      if (editing && !rows.some(p => p.id === editing)) { reset(); render(); notify('Este usuario ya no está disponible. Vuelve a intentarlo.', 'error'); return; }
      const next = editing ? rows.map(p => p.id === editing ? { ...p, name } : p) : [...rows, { id, name, active: true }];
      if (commit(next)) { reset(); render(); notify('Usuario guardado. Elige quién usa este teléfono.'); }
    } catch { notify('No se pudieron guardar los usuarios. Vuelve a intentarlo.', 'error'); }
  }
  document.querySelector('#profile-form').addEventListener('submit', event => { event.preventDefault(); saveProfile(); });
  saveButton.addEventListener('click', saveProfile);
  cancelButton.addEventListener('click', reset);
  select.addEventListener('change', () => {
    try {
      if (!canUse()) throw new Error('Account not ready');
      localStorage.setItem(selectionKey(), select.value);
      render(); notify(select.value ? 'Usuario seleccionado para este teléfono.' : 'Selecciona un usuario antes de crear seguimientos.');
    } catch { render(); notify('No se pudo guardar la selección del usuario.', 'error'); }
  });
  window.LunivoProfileUI = { current, render, reset };
  window.addEventListener('storage', () => render());
  render();
})();
