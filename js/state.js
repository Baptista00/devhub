(function (window) {
    'use strict';

    var Hub = window.Hub;
    var current;
    var listeners = [];
    var initialized = false;
    var memoryOnly = false;
    var maxDuration = 315360000;

    function object(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function fail(message) { throw new Error(message); }

    function number(value, min, max, label) {
        if (typeof value !== 'number' || !isFinite(value) || value < min || value > max) {
            fail('Valor inválido: ' + label + '.');
        }
        return value;
    }

    function text(value, max, label, allowEmpty) {
        if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
            fail('Texto inválido: ' + label + '.');
        }
        return value;
    }

    function iso(value, label) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !isFinite(Date.parse(value))) {
            fail('Data inválida: ' + label + '.');
        }
        return new Date(value).toISOString();
    }

    function dateKey(value) {
        if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Hub.time.dayKey(value) !== value) {
            fail('Data de tarefa inválida.');
        }
        return value;
    }

    function uniqueId(value, seen) {
        var id = text(value, 160, 'identificador');
        if (Object.prototype.hasOwnProperty.call(seen, id)) { fail('O arquivo contém identificadores duplicados.'); }
        seen[id] = true;
        return id;
    }

    function defaults() {
        var settings = {};
        Object.keys(Hub.config.defaults).forEach(function (key) { settings[key] = Hub.config.defaults[key]; });
        return { version: Hub.config.version, settings: settings, sessions: [], tasks: [], notes: '', activeSession: null };
    }

    function validateSettings(settings) {
        if (!object(settings)) { fail('Configurações ausentes ou inválidas.'); }
        return {
            userName: text(settings.userName, 60, 'nome').trim(),
            dailyGoalMinutes: number(settings.dailyGoalMinutes, 1, 1440, 'meta diária'),
            pomodoroFocusMinutes: number(settings.pomodoroFocusMinutes, 1, 180, 'minutos de foco'),
            pomodoroBreakMinutes: number(settings.pomodoroBreakMinutes, 1, 60, 'minutos de descanso')
        };
    }

    function validateSession(session, seen) {
        if (!object(session)) { fail('Sessão inválida.'); }
        if (session.type !== 'stopwatch' && session.type !== 'pomodoro') { fail('Tipo de sessão inválido.'); }
        var startedAt = iso(session.startedAt, 'início da sessão');
        var endedAt = iso(session.endedAt, 'fim da sessão');
        var duration = number(session.duration, 1, maxDuration, 'duração da sessão');
        var pausedDuration = number(session.pausedDuration, 0, maxDuration, 'tempo pausado');
        if (Date.parse(endedAt) < Date.parse(startedAt) || duration + pausedDuration > (Date.parse(endedAt) - Date.parse(startedAt)) / 1000 + 0.001) {
            fail('A duração de uma sessão não corresponde ao seu intervalo.');
        }
        return {
            id: uniqueId(session.id, seen),
            type: session.type,
            category: text(session.category, 80, 'categoria').trim(),
            startedAt: startedAt,
            endedAt: endedAt,
            duration: Math.floor(duration),
            pausedDuration: Math.floor(pausedDuration),
            createdAt: iso(session.createdAt, 'criação da sessão'),
            date: session.date ? dateKey(session.date) : Hub.time.dayKey(startedAt)
        };
    }

    function validateTask(task, seen, index) {
        if (!object(task) || typeof task.completed !== 'boolean') { fail('Tarefa inválida.'); }
        return {
            id: uniqueId(task.id, seen),
            title: text(task.title, 240, 'tarefa').trim(),
            completed: task.completed,
            createdAt: iso(task.createdAt, 'criação da tarefa'),
            completedAt: task.completed ? iso(task.completedAt, 'conclusão da tarefa') : null,
            date: dateKey(task.date),
            order: task.order === undefined ? index : number(task.order, 0, 10000000, 'ordem da tarefa')
        };
    }

    function validateActive(active) {
        if (active === null || active === undefined) { return null; }
        if (!object(active) || ['stopwatch', 'pomodoro'].indexOf(active.type) < 0 || ['running', 'paused'].indexOf(active.status) < 0 || ['focus', 'readyBreak', 'break', 'completed'].indexOf(active.stage) < 0) {
            fail('Sessão ativa inválida.');
        }
        var startedAt = number(active.startedAt, 0, 8640000000000000, 'início da sessão ativa');
        var stageStartedAt = number(active.stageStartedAt, startedAt, 8640000000000000, 'início da etapa');
        var pausedAt = active.pausedAt === null ? null : number(active.pausedAt, stageStartedAt, 8640000000000000, 'início da pausa');
        var pausedDuration = number(active.pausedDuration, 0, maxDuration * 1000, 'tempo pausado');
        if (active.status === 'paused' && pausedAt === null) { fail('Pausa sem horário de início.'); }
        if (active.status === 'running' && pausedAt !== null) { fail('Sessão ativa com pausa inconsistente.'); }
        if (active.type === 'stopwatch' && active.stage !== 'focus') { fail('Etapa de cronômetro inválida.'); }
        if ((active.stage === 'readyBreak' || active.stage === 'completed') && active.status !== 'paused') {
            fail('Etapa encerrada com estado inválido.');
        }
        if ((active.stage === 'focus' || active.stage === 'readyBreak') && stageStartedAt !== startedAt) {
            fail('Horário da etapa de foco inconsistente.');
        }
        if (pausedAt !== null && pausedDuration > pausedAt - stageStartedAt) {
            fail('Tempo pausado maior que o intervalo da etapa.');
        }
        return {
            id: text(active.id, 140, 'identificador da sessão ativa'),
            type: active.type,
            category: text(active.category, 80, 'categoria').trim(),
            startedAt: startedAt,
            stageStartedAt: stageStartedAt,
            status: active.status,
            stage: active.stage,
            pausedAt: pausedAt,
            pausedDuration: pausedDuration,
            focusDuration: number(active.focusDuration, 60, 10800, 'duração de foco'),
            breakDuration: number(active.breakDuration, 60, 3600, 'duração de descanso')
        };
    }

    function normalize(data, importing) {
        if (!object(data) || data.version !== Hub.config.version) { fail('Backup incompatível. É necessário um arquivo Lucas Dev Hub versão 1.'); }
        if (!Array.isArray(data.sessions) || !Array.isArray(data.tasks) || data.sessions.length > 100000 || data.tasks.length > 100000) {
            fail('Listas de sessões ou tarefas inválidas.');
        }
        var sessionIds = Object.create(null);
        var taskIds = Object.create(null);
        return {
            version: Hub.config.version,
            settings: validateSettings(data.settings),
            sessions: data.sessions.map(function (session) { return validateSession(session, sessionIds); }),
            tasks: data.tasks.map(function (task, index) { return validateTask(task, taskIds, index); }),
            notes: text(data.notes, 2000000, 'notas', true),
            activeSession: importing ? null : validateActive(data.activeSession)
        };
    }

    function notify(section) {
        listeners.forEach(function (listener) { listener(section); });
    }

    function readLatest() {
        if (memoryOnly || Hub.storage.isProtected()) { return current; }
        var stored = Hub.storage.get();
        if (!stored) { return current; }
        try { return normalize(stored, false); } catch (error) {
            Hub.storage.protect(error.message + ' O conteúdo original foi preservado. Importe um backup ou apague os dados nas configurações.');
            return current;
        }
    }

    function init() {
        if (initialized) { return current; }
        current = defaults();
        current = readLatest();
        initialized = true;
        Hub.storage.onChange(function () {
            if (memoryOnly || Hub.storage.isProtected()) { return; }
            var stored = Hub.storage.get();
            try { current = stored ? normalize(stored, false) : defaults(); } catch (error) {
                Hub.storage.protect(error.message + ' O conteúdo original foi preservado.');
                return;
            }
            notify('all');
        });
        return current;
    }

    function commit(value, section, explicitReplacement) {
        current = value;
        memoryOnly = !Hub.storage.set(current, explicitReplacement);
        notify(section || 'all');
        return current;
    }

    function transact(mutator, section) {
        if (!initialized) { init(); }
        var draft = readLatest();
        if (mutator(draft) === false) { current = draft; return current; }
        return commit(draft, section || 'all', false);
    }

    Hub.state = {
        init: init,
        get: function () { return initialized ? current : init(); },
        update: function (section, value) {
            if (['settings', 'sessions', 'tasks', 'notes', 'activeSession'].indexOf(section) < 0) { fail('Seção de dados inválida.'); }
            return transact(function (draft) { draft[section] = value; }, section);
        },
        transact: transact,
        subscribe: function (listener) { listeners.push(listener); },
        validateImport: function (data) { return normalize(data, true); },
        replace: function (data) { return commit(normalize(data, true), 'all', true); },
        reset: function () { return commit(defaults(), 'all', true); },
        subscribeStorageError: function (listener) { Hub.storage.onError(listener); }
    };
}(window));
