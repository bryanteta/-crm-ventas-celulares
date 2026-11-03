exports.installProfile = async page => page.addInitScript(() => {
  if (!localStorage.getItem('lunivo-profiles-local-v1')) {
    localStorage.setItem('lunivo-profiles-local-v1', JSON.stringify([{ id: 'test-user', name: 'Usuario de pruebas', active: true }]));
    localStorage.setItem('lunivo-selected-profile-v1:local', 'test-user');
  }
});
