(function (window) {
    'use strict';

    var KEY = 'lucasDevHub.data.v1';
    var listeners = [];
    var changeListeners = [];
    var lastError = '';
    var errorKind = '';
    var protectedData = false;

    function report(message, kind) {
        lastError = message;
        errorKind = kind || '';
        listeners.forEach(function (listener) { listener(message); });
    }

    function protect(message) {
        protectedData = true;
        report(message || 'Os dados salvos estão inválidos. Seu conteúdo original foi preservado. Importe um backup ou apague os dados nas configurações para voltar a salvar.', 'protected');
    }

    function clearReadError() {
        if (errorKind === 'read' && !protectedData) { report(''); }
    }

    function get() {
        try {
            var raw = window.localStorage.getItem(KEY);
            // Only null means absent data; undefined means the read failed.
            if (raw === null) { clearReadError(); return null; }
            try {
                var value = JSON.parse(raw);
                if (!value || typeof value !== 'object' || Array.isArray(value)) { protect(); return undefined; }
                clearReadError();
                return value;
            } catch (error) { protect(); return undefined; }
        } catch (error) {
            if (errorKind !== 'write' && !protectedData) {
                report('Não foi possível acessar os dados neste navegador. As alterações ficarão apenas nesta aba. Exporte um backup antes de sair.', 'read');
            }
            return undefined;
        }
    }

    function set(value, explicitReplacement) {
        if (protectedData && !explicitReplacement) { return false; }
        try {
            window.localStorage.setItem(KEY, JSON.stringify(value));
            protectedData = false;
            lastError = '';
            errorKind = '';
            return true;
        } catch (error) {
            report('Não foi possível salvar os dados neste navegador. Exporte um backup antes de fechar a aba.', 'write');
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
