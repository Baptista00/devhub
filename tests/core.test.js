'use strict';

// Run with Node only during development: node tests/core.test.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const childProcess = require('node:child_process');
const RealDate = Date;
const files = ['js/config.js', 'js/utils/time.js', 'js/services/storage.js', 'js/state.js', 'js/modules/timer.js', 'js/modules/stats.js'];
const storageKey = 'lucasDevHub.data.v1';
let count = 0;
let failures = 0;

function environment(shared, clock) {
    shared = shared || { values: {}, fail: false };
    clock = clock || { now: new RealDate(2026, 8, 8, 10, 0, 0).getTime() };
    const listeners = {};
    class FakeDate extends RealDate {
        constructor(...args) { super(...(args.length ? args : [clock.now])); }
        static now() { return clock.now; }
    }
    const context = {
        Hub: { ui: {} },
        Date: FakeDate,
        Math: Math,
        console: console,
        addEventListener(name, listener) { listeners[name] = listener; },
        localStorage: {
            getItem(key) {
                if (shared.failRead) { throw new Error('read unavailable'); }
                return Object.prototype.hasOwnProperty.call(shared.values, key) ? shared.values[key] : null;
            },
            setItem(key, value) {
                if (shared.fail) { throw new Error('quota'); }
                shared.values[key] = value;
            }
        }
    };
    context.window = context;
    vm.createContext(context);
    files.forEach(function (file) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
    });
    context.Hub.state.init();
    return {
        hub: context.Hub,
        shared: shared,
        clock: clock,
        advance(ms) { clock.now += ms; },
        reload() { return environment(shared, clock); },
        storageEvent() { listeners.storage({ key: storageKey }); }
    };
}

function test(name, run) {
    try {
        run();
        count += 1;
        console.log('PASS ' + name);
    } catch (error) {
        failures += 1;
        console.error('FAIL ' + name + '\n' + error.stack);
    }
}

function start(env, type) {
    assert.equal(env.hub.timer.start({ type: type || 'stopwatch', category: 'JavaScript', focusMinutes: 1, breakMinutes: 1 }), true);
}

function sessionOn(key, duration, category) {
    const parts = key.split('-').map(Number);
    const beginning = new RealDate(parts[0], parts[1] - 1, parts[2], 12).getTime();
    const startedAt = new RealDate(beginning).toISOString();
    return {
        id: key + '-' + duration + '-' + (category || 'Estudos'),
        type: 'stopwatch', category: category || 'Estudos', date: key,
        startedAt: startedAt, endedAt: new RealDate(beginning + duration * 1000).toISOString(),
        duration: duration, pausedDuration: 0, createdAt: startedAt
    };
}

test('first access stays empty and does not seed storage', function () {
    const env = environment();
    assert.equal(env.hub.state.get().sessions.length, 0);
    assert.equal(env.hub.state.get().settings.dailyGoalMinutes, 180);
    assert.equal(env.hub.state.get().activeSession, null);
    assert.equal(Object.keys(env.shared.values).length, 0);
    assert.equal(env.hub.time.formatClock(3661), '01:01:01');
    assert.equal(env.hub.time.formatDuration(3661), '1h 01min');
    assert.equal(env.hub.time.formatClock(NaN), '00:00:00');
});

test('stopwatch restores running and paused sessions and excludes paused time', function () {
    let env = environment();
    start(env);
    env.advance(10250);
    env = env.reload();
    assert.equal(env.hub.timer.getElapsed(), 10);
    env.hub.timer.pause();
    env.advance(20000);
    env = env.reload();
    assert.equal(env.hub.timer.getElapsed(), 10);
    env.hub.timer.resume();
    env.advance(5750);
    const session = env.hub.timer.finish();
    assert.equal(session.duration, 16);
    assert.equal(session.pausedDuration, 20);
    assert.equal(env.hub.state.get().activeSession, null);
    assert.equal(env.reload().hub.state.get().sessions.length, 1);
});

test('background time comes from timestamps without interval ticks', function () {
    const env = environment();
    start(env);
    env.advance(7205123);
    assert.equal(env.hub.timer.getElapsed(), 7205);
    assert.equal(env.hub.timer.finish().duration, 7205);
});

test('zero seconds discarded; short valid focus kept; double start blocked', function () {
    const env = environment();
    start(env);
    assert.equal(env.hub.timer.start({ category: 'Projeto' }), false);
    env.advance(999);
    assert.equal(env.hub.timer.finish(), null);
    assert.equal(env.hub.state.get().sessions.length, 0);
    start(env);
    env.advance(1000);
    assert.equal(env.hub.timer.finish().duration, 1);
});

test('finishing a paused stopwatch includes its final pause', function () {
    const env = environment();
    start(env);
    env.advance(5000);
    env.hub.timer.pause();
    env.advance(7000);
    const session = env.hub.timer.finish();
    assert.equal(session.duration, 5);
    assert.equal(session.pausedDuration, 7);
    assert.equal(RealDate.parse(session.endedAt) - RealDate.parse(session.startedAt), 12000);
});

test('session crossing midnight belongs to its starting local date', function () {
    const env = environment(null, { now: new RealDate(2026, 8, 8, 23, 59, 50).getTime() });
    start(env);
    env.advance(30000);
    assert.equal(env.hub.timer.finish().date, '2026-09-08');
    assert.equal(env.hub.time.today(), '2026-09-09');
});

test('Pomodoro catches up after background and records exactly once after reload', function () {
    let env = environment();
    start(env, 'pomodoro');
    const began = env.clock.now;
    env.advance(600000);
    assert.equal(env.hub.timer.getRemaining(), 0);
    assert.equal(env.hub.timer.tick(), 'focusComplete');
    assert.equal(env.hub.state.get().activeSession.stage, 'readyBreak');
    assert.equal(env.hub.state.get().sessions[0].duration, 60);
    assert.equal(RealDate.parse(env.hub.state.get().sessions[0].endedAt), began + 60000);
    env = env.reload();
    assert.equal(env.hub.timer.tick(), null);
    assert.equal(env.hub.state.get().sessions.length, 1);
    assert.equal(env.hub.timer.startBreak(), true);
    env.advance(60000);
    assert.equal(env.hub.timer.tick(), 'breakComplete');
    assert.equal(env.hub.state.get().sessions.length, 1);
    assert.equal(env.hub.state.get().activeSession.stage, 'completed');
    assert.equal(env.hub.timer.finish(), null);
    assert.equal(env.hub.state.get().activeSession, null);
});

test('Pomodoro pause survives long closure and completion caps focus duration', function () {
    let env = environment();
    start(env, 'pomodoro');
    env.advance(30000);
    env.hub.timer.pause();
    env.advance(3600000);
    env = env.reload();
    assert.equal(env.hub.timer.getRemaining(), 30);
    assert.equal(env.hub.timer.tick(), null);
    env.hub.timer.resume();
    env.advance(90000);
    assert.equal(env.hub.timer.tick(), 'focusComplete');
    const session = env.hub.state.get().sessions[0];
    assert.equal(session.duration, 60);
    assert.equal(session.pausedDuration, 3600);
    assert.equal(RealDate.parse(session.endedAt) - RealDate.parse(session.startedAt), 3660000);
});

test('cancelled focus and breaks do not add sessions', function () {
    const env = environment();
    start(env, 'pomodoro');
    env.advance(20000);
    env.hub.timer.cancel();
    assert.equal(env.hub.state.get().sessions.length, 0);
    start(env, 'pomodoro');
    env.advance(65000);
    assert.equal(env.hub.timer.finish().duration, 60);
    assert.equal(env.hub.state.get().sessions.length, 1);
});

test('second tab observes newest state before writing and avoids duplicate focus records', function () {
    const first = environment();
    start(first, 'pomodoro');
    const second = first.reload();
    first.advance(61000);
    assert.equal(first.hub.timer.tick(), 'focusComplete');
    assert.equal(second.hub.timer.tick(), null);
    assert.equal(second.hub.state.get().sessions.length, 1);
    first.hub.state.update('notes', 'Nota da primeira aba');
    second.hub.state.transact(function (state) { state.settings.userName = 'Teste'; }, 'settings');
    assert.equal(second.hub.state.get().notes, 'Nota da primeira aba');
    first.storageEvent();
    assert.equal(first.hub.state.get().settings.userName, 'Teste');
});

test('backup validates records, restores tasks and notes, and excludes active sessions', function () {
    const env = environment();
    start(env);
    env.advance(5000);
    env.hub.timer.finish();
    env.hub.state.update('notes', '<b>Texto literal</b>');
    env.hub.state.update('tasks', [{ id: 'task-1', title: 'Revisar JavaScript', completed: true, createdAt: new RealDate(env.clock.now).toISOString(), completedAt: new RealDate(env.clock.now).toISOString(), date: env.hub.time.today(), order: 0 }]);
    start(env);
    const backup = JSON.parse(JSON.stringify(env.hub.state.get()));
    const validated = env.hub.state.validateImport(backup);
    assert.equal(validated.activeSession, null);
    env.hub.state.reset();
    env.hub.state.replace(validated);
    assert.equal(env.hub.state.get().notes, '<b>Texto literal</b>');
    assert.equal(env.hub.state.get().tasks[0].completed, true);
    assert.equal(env.hub.state.get().sessions.length, 1);
    assert.equal(env.reload().hub.state.get().activeSession, null);
    backup.sessions.push(backup.sessions[0]);
    assert.throws(function () { env.hub.state.validateImport(backup); }, /duplicados/);
    assert.throws(function () { env.hub.state.validateImport({ arbitrary: true }); }, /incompatível/);
    backup.sessions.pop();
    backup.sessions[0].duration = Infinity;
    assert.throws(function () { env.hub.state.validateImport(backup); }, /duração/);
});

test('invalid JSON is preserved until explicit reset and other application keys stay intact', function () {
    const raw = '{bad json';
    const shared = { values: { [storageKey]: raw, 'other-app': 'keep me' }, fail: false };
    const env = environment(shared);
    assert.equal(env.hub.state.get().sessions.length, 0);
    assert.match(env.hub.storage.getError(), /inválidos/);
    env.hub.state.update('notes', 'Memória temporária');
    assert.equal(shared.values[storageKey], raw);
    assert.equal(env.hub.state.get().notes, 'Memória temporária');
    env.hub.state.reset();
    assert.equal(env.hub.storage.getError(), '');
    assert.equal(JSON.parse(shared.values[storageKey]).notes, '');
    assert.equal(shared.values['other-app'], 'keep me');
});

test('unavailable storage preserves subsequent changes in memory and reports failure', function () {
    const env = environment();
    env.hub.state.update('notes', 'Versão salva');
    env.shared.fail = true;
    env.hub.state.update('notes', 'Versão em memória');
    env.hub.state.transact(function (state) { state.settings.userName = 'Lucas 2'; }, 'settings');
    assert.equal(env.hub.state.get().notes, 'Versão em memória');
    assert.match(env.hub.storage.getError(), /salvar/);
    env.shared.fail = false;
    env.hub.state.update('notes', 'Recuperada');
    assert.equal(env.reload().hub.state.get().settings.userName, 'Lucas 2');
    assert.equal(env.hub.storage.getError(), '');
});

test('invalid JSON roots and empty stored text are protected from implicit replacement', function () {
    ['', 'null', 'false', '0', '""', 'true', '[]', '"text"'].forEach(function (raw) {
        const shared = { values: { [storageKey]: raw }, fail: false };
        const env = environment(shared);
        assert.equal(env.hub.storage.isProtected(), true, raw);
        assert.match(env.hub.storage.getError(), /inválidos/);
        env.hub.state.update('notes', 'Nota em memória');
        assert.equal(shared.values[storageKey], raw);
        assert.equal(env.hub.state.get().notes, 'Nota em memória');
        env.hub.state.reset();
        assert.equal(env.hub.storage.isProtected(), false);
        assert.equal(env.reload().hub.state.get().notes, '');
    });
});

test('corrupt external storage retains the last valid state in memory', function () {
    ['{bad json', 'null', '{}'].forEach(function (raw) {
        const env = environment();
        env.hub.state.update('notes', 'Última nota válida');
        start(env);
        env.advance(5000);
        env.hub.timer.finish();
        start(env);
        env.shared.values[storageKey] = raw;
        env.storageEvent();
        assert.equal(env.hub.state.get().notes, 'Última nota válida');
        assert.equal(env.hub.state.get().sessions.length, 1);
        assert.equal(env.hub.state.get().activeSession.status, 'running');
        assert.equal(env.hub.storage.isProtected(), true);
        env.hub.state.update('notes', 'Continua em memória');
        assert.equal(env.shared.values[storageKey], raw);
    });
});

test('failed storage event reads preserve the last valid state until access recovers', function () {
    const env = environment();
    env.hub.state.update('notes', 'Nota salva');
    start(env);
    env.shared.failRead = true;
    env.storageEvent();
    assert.equal(env.hub.state.get().notes, 'Nota salva');
    assert.equal(env.hub.state.get().activeSession.status, 'running');
    assert.match(env.hub.storage.getError(), /acessar/);
    env.shared.failRead = false;
    const latest = JSON.parse(env.shared.values[storageKey]);
    latest.notes = 'Atualizada em outra aba';
    env.shared.values[storageKey] = JSON.stringify(latest);
    env.storageEvent();
    assert.equal(env.hub.state.get().notes, 'Atualizada em outra aba');
});

test('a write after external removal does not restore deleted data before the storage event', function () {
    const env = environment();
    env.hub.state.update('notes', 'Nota apagada');
    start(env);
    env.advance(5000);
    env.hub.timer.finish();
    start(env);
    delete env.shared.values[storageKey];
    env.hub.state.transact(function (state) { state.settings.userName = 'Novo nome'; }, 'settings');
    const recovered = env.reload().hub.state.get();
    assert.equal(recovered.settings.userName, 'Novo nome');
    assert.equal(recovered.notes, '');
    assert.equal(recovered.sessions.length, 0);
    assert.equal(recovered.activeSession, null);
});

test('impossible dates and malformed persisted active state are rejected safely', function () {
    const env = environment();
    const backup = JSON.parse(JSON.stringify(env.hub.state.get()));
    backup.tasks = [{ id: 'one', title: 'Test', completed: false, completedAt: null, createdAt: new RealDate(env.clock.now).toISOString(), date: '2026-02-31' }];
    assert.throws(function () { env.hub.state.validateImport(backup); }, /Data de tarefa/);
    start(env);
    const persisted = JSON.parse(env.shared.values[storageKey]);
    persisted.activeSession.pausedAt = null;
    persisted.activeSession.status = 'paused';
    env.shared.values[storageKey] = JSON.stringify(persisted);
    const recovered = env.reload();
    assert.equal(recovered.hub.state.get().activeSession, null);
    assert.match(recovered.hub.storage.getError(), /Pausa/);
});

test('active stage invariants prevent corrupt terminal and pause states', function () {
    const env = environment();
    start(env, 'pomodoro');
    const valid = JSON.parse(env.shared.values[storageKey]);
    const malformed = JSON.parse(JSON.stringify(valid));
    malformed.activeSession.stage = 'readyBreak';
    env.shared.values[storageKey] = JSON.stringify(malformed);
    assert.match(env.reload().hub.storage.getError(), /Etapa encerrada/);
    malformed.activeSession = JSON.parse(JSON.stringify(valid.activeSession));
    malformed.activeSession.stageStartedAt += 1000;
    env.shared.values[storageKey] = JSON.stringify(malformed);
    assert.match(env.reload().hub.storage.getError(), /etapa de foco/);
    malformed.activeSession = JSON.parse(JSON.stringify(valid.activeSession));
    malformed.activeSession.status = 'paused';
    malformed.activeSession.pausedAt = malformed.activeSession.startedAt + 1000;
    malformed.activeSession.pausedDuration = 2000;
    env.shared.values[storageKey] = JSON.stringify(malformed);
    assert.match(env.reload().hub.storage.getError(), /Tempo pausado/);
});

test('saved session duration cannot exceed its timestamp interval', function () {
    const env = environment();
    const backup = JSON.parse(JSON.stringify(env.hub.state.get()));
    const session = sessionOn('2026-09-08', 1);
    session.endedAt = session.startedAt;
    backup.sessions = [session];
    assert.throws(function () { env.hub.state.validateImport(backup); }, /intervalo/);
});

test('streak includes yesterday, counts each day once and breaks across gaps', function () {
    const env = environment();
    const sessions = [sessionOn('2026-09-05', 20), sessionOn('2026-09-06', 30), sessionOn('2026-09-07', 40)];
    assert.equal(env.hub.stats.streak(sessions, '2026-09-08'), 3);
    sessions.push(sessionOn('2026-09-08', 50), sessionOn('2026-09-07', 60));
    assert.equal(env.hub.stats.streak(sessions, '2026-09-08'), 4);
    assert.equal(env.hub.stats.streak([sessionOn('2026-09-06', 30)], '2026-09-08'), 0);
    assert.equal(env.hub.stats.streak([sessionOn('2026-09-09', 30)], '2026-09-08'), 0);
    assert.equal(env.hub.stats.streak([sessionOn('2026-09-08', 0)], '2026-09-08'), 0);
    assert.equal(env.hub.stats.streak([sessionOn('2025-12-31', 30), sessionOn('2026-01-01', 30)], '2026-01-01'), 2);
});

test('stats preserve the saved local day when a backup originated in another timezone', function () {
    const env = environment();
    const session = sessionOn('2026-09-07', 600);
    session.date = '2026-09-08';
    const result = env.hub.stats.summarize([session], '2026-09-08');
    assert.equal(result.today, 600);
    assert.equal(result.todayCount, 1);
    assert.equal(env.hub.stats.forDay([session], '2026-09-07').length, 0);
    assert.equal(env.hub.stats.inPeriod([session], '2026-09-08', '2026-09-08').length, 1);
});

test('stats recalculate totals, goal input and streak after deleting a session', function () {
    const env = environment();
    env.hub.state.update('sessions', [sessionOn('2026-08-31', 600), sessionOn('2026-09-07', 1200), sessionOn('2026-09-08', 1800)]);
    let data = env.hub.stats.summarize(env.hub.state.get().sessions, '2026-09-08');
    assert.equal(data.total, 3600);
    assert.equal(data.today, 1800);
    assert.equal(data.week, 3000);
    assert.equal(data.month, 3000);
    assert.equal(data.longest, 1800);
    assert.equal(data.average, 1200);
    assert.equal(data.streak, 2);
    env.hub.state.transact(function (state) { state.sessions = state.sessions.filter(function (session) { return session.date !== '2026-09-08'; }); }, 'sessions');
    data = env.hub.stats.summarize(env.hub.state.get().sessions, '2026-09-08');
    assert.equal(data.total, 1800);
    assert.equal(data.today, 0);
    assert.equal(data.week, 1200);
    assert.equal(data.month, 1200);
    assert.equal(data.longest, 1200);
    assert.equal(data.average, 900);
    assert.equal(data.count, 2);
    assert.equal(data.days, 2);
    assert.equal(data.streak, 1);
});

test('category aggregation handles prototype-like names and empty statistics', function () {
    const env = environment();
    const sessions = [sessionOn('2026-09-08', 100, '__proto__'), sessionOn('2026-09-08', 50, '__proto__'), sessionOn('2026-09-08', 75, 'constructor')];
    const data = env.hub.stats.summarize(sessions, '2026-09-08');
    assert.equal(data.category, '__proto__');
    assert.equal(data.categories[0].duration, 150);
    assert.equal(data.categories[1].duration, 75);
    const empty = env.hub.stats.summarize([], '2026-09-08');
    ['total', 'today', 'todayCount', 'week', 'month', 'count', 'longest', 'average', 'days', 'streak'].forEach(function (key) {
        assert.equal(empty[key], 0, key);
    });
});

test('calendar day arithmetic and streak survive 23-hour and 25-hour DST days', function () {
    const script = `
        const assert = require('node:assert/strict');
        const fs = require('node:fs');
        const vm = require('node:vm');
        const context = { Hub: { ui: {} } };
        context.window = context;
        vm.createContext(context);
        ['js/config.js', 'js/utils/time.js', 'js/modules/stats.js'].forEach(function (file) {
            vm.runInContext(fs.readFileSync(file, 'utf8'), context);
        });
        const time = context.Hub.time;
        assert.equal(time.offsetDay('2026-03-08', -1), '2026-03-07');
        assert.equal(time.offsetDay('2026-03-08', 1), '2026-03-09');
        assert.equal(time.offsetDay('2026-11-01', -1), '2026-10-31');
        assert.equal(time.offsetDay('2026-11-01', 1), '2026-11-02');
        assert.equal(new Date(2026, 2, 8, 12) - new Date(2026, 2, 7, 12), 23 * 3600000);
        assert.equal(new Date(2026, 10, 1, 12) - new Date(2026, 9, 31, 12), 25 * 3600000);
        const sessions = ['2026-03-07', '2026-03-08', '2026-03-09'].map(function (day) {
            return { date: day, startedAt: day + 'T12:00:00', duration: 60 };
        });
        assert.equal(context.Hub.stats.streak(sessions, '2026-03-09'), 3);
    `;
    childProcess.execFileSync(process.execPath, ['-e', script], {
        cwd: path.join(__dirname, '..'),
        env: Object.assign({}, process.env, { TZ: 'America/New_York' }),
        stdio: 'pipe'
    });
});

console.log('\n' + count + ' core tests passed.');
if (failures) {
    console.error(failures + ' core tests failed.');
    process.exitCode = 1;
}
