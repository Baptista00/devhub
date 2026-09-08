(function (window) {
    'use strict';

    var KEY = 'lucasDevHub.data.v1';
    var listeners = [];
    var changeListeners = [];
    var lastError = '';
    var protectedData = false;

    function report(message) {
        lastError = message;
        listeners.forEach(function (listener) { listener(message); });
    }

    function protect(message) {
        protectedData = true;
        report(message || 'Os dados salvos estão inválidos. Seu conteúdo original foi preservado. Importe um backup ou apague os dados nas configurações para voltar a salvar.');
    }

    function get() {
        try {
            var raw = window.localStorage.getItem(KEY);
            if (!raw) { return null; }
            try { return JSON.parse(raw); } catch (error) { protect(); return null; }
        } catch (error) {
            report('Não foi possível acessar os dados neste navegador. As alterações ficarão apenas nesta aba. Exporte um backup antes de sair.');
            return null;
        }
    }

    function set(value, explicitReplacement) {
        if (protectedData && !explicitReplacement) { return false; }
        try {
            window.localStorage.setItem(KEY, JSON.stringify(value));
            protectedData = false;
            lastError = '';
            return true;
        } catch (error) {
            report('Não foi possível salvar os dados neste navegador. Exporte um backup antes de fechar a aba.');
            return false;
        }
    }

    window.addEventListener('storage', function (event) {
        if (event.key !== KEY && event.key !== null) { return; }
        changeListeners.forEach(function (listener) { listener(); });
    });

    window.Hub.storage = {
        key: KEY,
        get: get,
        set: set,
        protect: protect,
        getError: function () { return lastError; },
        isProtected: function () { return protectedData; },
        onError: function (listener) { listeners.push(listener); },
        onChange: function (listener) { changeListeners.push(listener); }
    };
}(window));
