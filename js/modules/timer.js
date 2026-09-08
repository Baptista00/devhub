(function (window) {
    'use strict';

    var Hub = window.Hub;

    function elapsed(active, now) {
        if (!active) { return 0; }
        if (active.stage === 'readyBreak') { return active.focusDuration; }
        if (active.stage === 'completed') { return active.breakDuration; }
        var endpoint = active.status === 'paused' ? active.pausedAt : now;
        return Math.max(0, Math.floor((endpoint - active.stageStartedAt - active.pausedDuration) / 1000));
    }

    function target(active) {
        return active.stage === 'break' || active.stage === 'completed' ? active.breakDuration : active.focusDuration;
    }

    function isTiming(active) {
        return active && (active.stage === 'focus' || active.stage === 'break');
    }

    function record(draft, active, endedAt, duration) {
        if (duration < 1 || active.stage !== 'focus') { return null; }
        var id = active.id + '-focus';
        var existing = draft.sessions.filter(function (session) { return session.id === id; })[0];
        if (existing) { return existing; }
        var paused = active.pausedDuration;
        if (active.status === 'paused') { paused += Math.max(0, endedAt - active.pausedAt); }
        var session = {
            id: id,
            type: active.type,
            category: active.category,
            startedAt: new Date(active.startedAt).toISOString(),
            endedAt: new Date(endedAt).toISOString(),
            duration: duration,
            pausedDuration: Math.floor(paused / 1000),
            createdAt: new Date().toISOString(),
            date: Hub.time.dayKey(active.startedAt)
        };
        draft.sessions.push(session);
        return session;
    }

    function start(options) {
        var started = false;
        var now = Date.now();
        options = options || {};
        Hub.state.transact(function (draft) {
            if (draft.activeSession) { return false; }
            var focus = Number(options.focusMinutes || draft.settings.pomodoroFocusMinutes);
            var rest = Number(options.breakMinutes || draft.settings.pomodoroBreakMinutes);
            var category = typeof options.category === 'string' ? options.category.trim() : '';
            if (!category || category.length > 80 || !isFinite(focus) || focus < 1 || focus > 180 || !isFinite(rest) || rest < 1 || rest > 60) {
                throw new Error('Escolha uma categoria e tempos válidos para começar.');
            }
            draft.activeSession = {
                id: Hub.time.newId(),
                type: options.type === 'pomodoro' ? 'pomodoro' : 'stopwatch',
                category: category,
                startedAt: now,
                stageStartedAt: now,
                status: 'running',
                stage: 'focus',
                pausedAt: null,
                pausedDuration: 0,
                focusDuration: Math.round(focus * 60),
                breakDuration: Math.round(rest * 60)
            };
            started = true;
        }, 'activeSession');
        return started;
    }

    function tick() {
        var current = Hub.state.get().activeSession;
        var now = Date.now();
        if (!current || current.type !== 'pomodoro' || !isTiming(current) || current.status !== 'running' || elapsed(current, now) < target(current)) { return null; }
        var transition = null;
        Hub.state.transact(function (draft) {
            var active = draft.activeSession;
            if (!active || active.type !== 'pomodoro' || !isTiming(active) || active.status !== 'running' || elapsed(active, now) < target(active)) { return false; }
            var endedAt = active.stageStartedAt + active.pausedDuration + target(active) * 1000;
            if (active.stage === 'focus') {
                record(draft, active, endedAt, active.focusDuration);
                active.stage = 'readyBreak';
                transition = 'focusComplete';
            } else {
                active.stage = 'completed';
                transition = 'breakComplete';
            }
            active.status = 'paused';
            active.pausedAt = endedAt;
        }, 'all');
        return transition;
    }

    function pause() {
        tick();
        Hub.state.transact(function (draft) {
            var active = draft.activeSession;
            if (!isTiming(active) || active.status !== 'running') { return false; }
            active.status = 'paused';
            active.pausedAt = Math.max(active.stageStartedAt, Date.now());
        }, 'activeSession');
    }

    function resume() {
        Hub.state.transact(function (draft) {
            var active = draft.activeSession;
            if (!isTiming(active) || active.status !== 'paused') { return false; }
            active.pausedDuration += Math.max(0, Date.now() - active.pausedAt);
            active.pausedAt = null;
            active.status = 'running';
        }, 'activeSession');
    }

    function finish() {
        var saved = null;
        var now = Date.now();
        Hub.state.transact(function (draft) {
            var active = draft.activeSession;
            if (!active) { return false; }
            if (active.stage === 'focus') {
                var duration = elapsed(active, now);
                var endedAt = now;
                if (active.type === 'pomodoro' && duration >= active.focusDuration) {
                    duration = active.focusDuration;
                    endedAt = active.stageStartedAt + active.pausedDuration + duration * 1000;
                }
                saved = record(draft, active, endedAt, duration);
            }
            draft.activeSession = null;
        }, 'all');
        return saved;
    }

    function cancel() {
        Hub.state.transact(function (draft) {
            if (!draft.activeSession) { return false; }
            draft.activeSession = null;
        }, 'activeSession');
    }

    function startBreak() {
        var started = false;
        Hub.state.transact(function (draft) {
            var active = draft.activeSession;
            if (!active || active.type !== 'pomodoro' || active.stage !== 'readyBreak') { return false; }
            active.stage = 'break';
            active.stageStartedAt = Date.now();
            active.status = 'running';
            active.pausedAt = null;
            active.pausedDuration = 0;
            started = true;
        }, 'activeSession');
        return started;
    }

    Hub.timer = {
        start: start,
        getElapsed: function (now) { return elapsed(Hub.state.get().activeSession, now === undefined ? Date.now() : now); },
        getRemaining: function (now) {
            var active = Hub.state.get().activeSession;
            return active && active.type === 'pomodoro' ? Math.max(0, target(active) - elapsed(active, now === undefined ? Date.now() : now)) : 0;
        },
        pause: pause,
        resume: resume,
        finish: finish,
        cancel: cancel,
        startBreak: startBreak,
        tick: tick
    };
}(window));
