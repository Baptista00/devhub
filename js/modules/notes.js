(function (Hub) {
    'use strict';

    var initialized = false;

    function showSaveStatus() {
        var status = document.getElementById('notes-save-status');
        var error = Hub.storage.getError();
        status.textContent = error ? 'Sem salvar no navegador. Mantenha esta aba aberta e exporte seus dados.' : 'Salvo automaticamente neste navegador';
        status.className = error ? 'save-status save-status-error' : 'save-status';
    }

    function render() {
        var input = document.getElementById('notes-input');
        if (!input) { return; }
        var notes = Hub.state.get().notes;
        if (input.value !== notes) { input.value = notes; }
        showSaveStatus();
    }

    function init() {
        if (initialized) { return; }
        initialized = true;
        document.getElementById('notes-input').addEventListener('input', function (event) {
            Hub.state.update('notes', event.target.value);
            showSaveStatus();
        });
        render();
    }

    Hub.notes = { init: init, render: render };
}(window.Hub));
