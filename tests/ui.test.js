'use strict';

// Development-only DOM/event regressions: node tests/ui.test.js. No dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let passed = 0;
let failed = 0;

// Only the DOM operations used by these modules; layout is checked in a browser.
function documentFixture() {
    let document;
    class Node {
        constructor(tag, value) {
            this.tagName = tag.toUpperCase();
            this.nodeValue = value || '';
            this.childNodes = [];
            this.attributes = {};
            this.listeners = {};
            this.style = {};
            this.value = '';
            this.className = '';
            this.classList = {
                add: (name) => this.classList.toggle(name, true),
                remove: (name) => this.classList.toggle(name, false),
                toggle: (name, force) => {
                    const classes = this.className.split(/\s+/).filter(Boolean);
                    const present = classes.includes(name);
                    const enabled = force === undefined ? !present : force;
                    this.className = classes.filter((item) => item !== name).concat(enabled ? [name] : []).join(' ');
                    return enabled;
                }
            };
        }
        get children() { return this.childNodes.filter((node) => node.tagName !== '#TEXT'); }
        get firstChild() { return this.childNodes[0] || null; }
        get textContent() { return this.tagName === '#TEXT' ? this.nodeValue : this.childNodes.map((node) => node.textContent).join(''); }
        set textContent(value) {
            this.childNodes.forEach((node) => { node.parentNode = null; });
            this.childNodes = [];
            if (String(value)) { this.appendChild(new Node('#text', String(value))); }
        }
        appendChild(node) { if (node.parentNode) { node.parentNode.removeChild(node); } this.childNodes.push(node); node.parentNode = this; return node; }
        removeChild(node) { this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null; return node; }
        setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id' || name === 'class') { this[name === 'class' ? 'className' : name] = String(value); } }
        getAttribute(name) { return name === 'id' ? this.id || null : name === 'class' ? this.className : this.attributes[name] === undefined ? null : this.attributes[name]; }
        removeAttribute(name) { delete this.attributes[name]; }
        addEventListener(name, callback) { (this.listeners[name] || (this.listeners[name] = [])).push(callback); }
        removeEventListener(name, callback) { this.listeners[name] = (this.listeners[name] || []).filter((item) => item !== callback); }
        dispatch(name, data) { (this.listeners[name] || []).slice().forEach((callback) => callback(Object.assign({ target: this, preventDefault() {} }, data))); }
        click() { this.dispatch('click'); }
        focus() { document.activeElement = this; }
        setCustomValidity(value) { this.validationMessage = value; }
        reportValidity() { return !this.validationMessage; }
        contains(node) { return node === this || this.childNodes.some((child) => child.contains(node)); }
        matches(selector) {
            const excluded = /:not\(([^)]+)\)/.exec(selector);
            if (excluded && this.matches(excluded[1])) { return false; }
            selector = selector.replace(/:not\([^)]+\)/g, '');
            const tag = /^[a-z][\w-]*/i.exec(selector);
            if (tag && this.tagName !== tag[0].toUpperCase()) { return false; }
            const id = /#([\w-]+)/.exec(selector);
            if (id && this.id !== id[1]) { return false; }
            const classMatch = /\.([\w-]+)/.exec(selector);
            if (classMatch && !this.className.split(/\s+/).includes(classMatch[1])) { return false; }
            return Array.from(selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)).every((match) => {
                const value = match[1] === 'disabled' && this.disabled ? '' : this.getAttribute(match[1]);
                return value !== null && (match[2] === undefined || value === match[2]);
            });
        }
        querySelectorAll(selector) {
            const found = [];
            const alternatives = selector.split(',').map((part) => part.trim());
            const visit = (node) => node.children.forEach((child) => {
                if (alternatives.some((part) => child.matches(part))) { found.push(child); }
                visit(child);
            });
            visit(this);
            return found;
        }
        querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    }
    document = new Node('document');
    document.createElement = (tag) => new Node(tag);
    document.createElementNS = (namespace, tag) => new Node(tag);
    document.getElementById = (id) => document.querySelector('#' + id);
    const stack = [document];
    const voidTags = /^(meta|link|img|input|br|hr|source)$/i;
    for (const part of html.match(/<[^>]+>|[^<]+/g)) {
        if (/^<!/.test(part)) { continue; }
        if (/^<\//.test(part)) { stack.pop(); continue; }
        if (part[0] !== '<') { stack[stack.length - 1].appendChild(new Node('#text', part)); continue; }
        const tag = /^<([\w-]+)/.exec(part)[1];
        const node = new Node(tag);
        for (const attribute of part.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g)) { node.setAttribute(attribute[1], attribute[2] || ''); }
        stack[stack.length - 1].appendChild(node);
        if (!voidTags.test(tag)) { stack.push(node); }
    }
    document.documentElement = document.querySelector('html');
    document.body = document.querySelector('body');
    document.activeElement = document.body;
    return document;
}

function environment(shared) {
    shared = shared || { values: {}, fail: false };
    const document = documentFixture();
    const context = {
        document, Date, Math,
        addEventListener() {},
        setTimeout() { return 1; },
        localStorage: {
            getItem(key) { return shared.values[key] || null; },
            setItem(key, value) { if (shared.fail) { throw new Error('quota'); } shared.values[key] = value; }
        }
    };
    context.window = context;
    vm.createContext(context);
    ['js/config.js', 'js/utils/time.js', 'js/services/storage.js', 'js/state.js', 'js/utils/dom.js',
        'js/modules/timer.js', 'js/modules/stats.js', 'js/modules/tasks.js', 'js/modules/history.js', 'js/modules/dashboard.js'].forEach((file) => {
        vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
    });
    const hub = context.Hub;
    hub.state.init();
    hub.tasks.init();
    let view = 'tasks';
    hub.state.subscribe(() => hub[view].render());
    return {
        hub, shared, document,
        byId(id) { const node = document.getElementById(id); assert.ok(node, 'Missing node: ' + id); return node; },
        view(name) { view = name; hub[name].render(); },
        submit() { document.querySelector('.modal-form').dispatch('submit'); },
        peer() { return environment(shared); }
    };
}

function task(env, id, order) {
    return { id, title: 'Tarefa ' + id, completed: false, createdAt: new Date().toISOString(), completedAt: null, date: env.hub.time.today(), order: order || 0 };
}

function clickTask(env, id, label) {
    const row = env.byId('tasks-content').querySelectorAll('li').find((item) => item.querySelector('[data-task-toggle]').getAttribute('data-task-toggle') === id);
    assert.ok(row, 'Missing task row: ' + id);
    const button = row.querySelectorAll('button').find((item) => item.getAttribute('aria-label').startsWith(label));
    assert.ok(button, 'Missing task action: ' + label);
    button.click();
}

function test(name, run) {
    try { run(); passed += 1; console.log('PASS ' + name); }
    catch (error) { failed += 1; console.error('FAIL ' + name + '\n' + error.stack); }
}

test('compact navigation and the unopened focus view retain accessible names', () => {
    const env = environment();
    const buttons = env.document.querySelectorAll('.nav-item');
    assert.equal(buttons.length, 7);
    buttons.forEach((button) => assert.equal(button.getAttribute('aria-label'), button.querySelector('.nav-label').textContent));
    assert.equal(env.byId('view-focus').getAttribute('aria-label'), 'Foco');
});

test('dashboard updates preserve its status mark and percentage typography', () => {
    const env = environment();
    env.view('dashboard');
    const mark = env.byId('hero-label').querySelector('.connection-dot');
    const suffix = env.byId('goal-percent').querySelector('span');
    assert.ok(mark);
    assert.equal(suffix.textContent, '%');
    env.hub.timer.start({ category: 'JavaScript' });
    env.hub.dashboard.tick();
    assert.equal(env.byId('hero-label-text').textContent, 'EM FOCO AGORA');
    assert.equal(env.byId('hero-label').querySelector('.connection-dot'), mark);
    assert.equal(env.byId('goal-percent').querySelector('span'), suffix);
    assert.equal(env.byId('goal-percent').textContent, '0%');
});

test('history filtering retains keyboard focus on the newly rendered control', () => {
    const env = environment();
    env.view('history');
    const before = env.byId('history-filter-today');
    before.focus();
    before.click();
    assert.notEqual(env.document.activeElement, before);
    assert.equal(env.document.activeElement, env.byId('history-filter-today'));
    assert.equal(env.document.activeElement.getAttribute('aria-pressed'), 'true');
});

test('task creation, edit, completion and deletion survive reload', () => {
    let env = environment();
    env.byId('task-add').click();
    env.byId('task-title-input').value = 'Revisar JavaScript';
    env.submit();
    const id = env.hub.state.get().tasks[0].id;
    clickTask(env, id, 'Editar:');
    env.byId('task-title-input').value = 'Revisar funções';
    env.submit();
    env.byId('tasks-content').querySelector('[data-task-toggle]').dispatch('change');
    env = env.peer();
    assert.equal(env.hub.state.get().tasks[0].title, 'Revisar funções');
    assert.equal(env.hub.state.get().tasks[0].completed, true);
    assert.ok(env.hub.state.get().tasks[0].completedAt);
    clickTask(env, id, 'Excluir:');
    env.submit();
    assert.equal(env.peer().hub.state.get().tasks.length, 0);
});

test('adding a task preserves another tab task and appends after its latest order', () => {
    const env = environment();
    env.byId('task-add').click();
    env.byId('task-title-input').value = 'Tarefa local';
    const peer = env.peer();
    peer.hub.state.update('tasks', [task(peer, 'remote', 4)]);
    env.submit();
    const tasks = env.peer().hub.state.get().tasks;
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].id, 'remote');
    assert.equal(tasks[1].order, 5);
});

test('editing, toggling and deleting stale task rows preserve changes from another tab', () => {
    for (const action of ['edit', 'toggle', 'delete']) {
        const env = environment();
        env.hub.state.update('tasks', [task(env, 'local')]);
        const peer = env.peer();
        peer.hub.state.transact((draft) => {
            draft.tasks[0].title = 'Nome remoto';
            draft.tasks.push(task(peer, 'remote', 1));
        }, 'tasks');
        if (action === 'edit') {
            clickTask(env, 'local', 'Editar:');
            env.byId('task-title-input').value = 'Nome local';
            env.submit();
        } else if (action === 'toggle') {
            env.byId('tasks-content').querySelector('[data-task-toggle]').dispatch('change');
        } else { clickTask(env, 'local', 'Excluir:'); env.submit(); }
        const tasks = env.peer().hub.state.get().tasks;
        assert.ok(tasks.some((item) => item.id === 'remote'), action + ' must preserve the remote task');
        if (action === 'toggle') { assert.equal(tasks[0].title, 'Nome remoto'); assert.equal(tasks[0].completed, true); }
        if (action === 'edit') { assert.equal(tasks[0].title, 'Nome local'); }
        if (action === 'delete') { assert.equal(tasks.length, 1); }
    }
});

test('task reordering uses the latest order and preserves remote additions', () => {
    const env = environment();
    env.hub.state.update('tasks', [task(env, 'a'), task(env, 'b', 1)]);
    const peer = env.peer();
    peer.hub.state.transact((draft) => { draft.tasks.push(task(peer, 'c', 2)); }, 'tasks');
    clickTask(env, 'b', 'Mover para cima:');
    const tasks = env.peer().hub.state.get().tasks.slice().sort((left, right) => left.order - right.order);
    assert.equal(tasks.map((item) => item.id).join(','), 'b,a,c');
    assert.equal(env.document.activeElement.getAttribute('data-task-id'), 'b');
});

test('deleting history preserves a session completed in another tab and reports storage failure', () => {
    const env = environment();
    const startedAt = new Date(Date.now() - 60000).toISOString();
    const first = { id: 'first', type: 'stopwatch', category: 'Estudos', startedAt, endedAt: new Date().toISOString(), duration: 60, pausedDuration: 0, createdAt: startedAt, date: env.hub.time.today() };
    env.hub.state.update('sessions', [first]);
    env.view('history');
    env.byId('history-content').querySelector('button').click();
    const peer = env.peer();
    peer.hub.state.transact((draft) => { draft.sessions.push(Object.assign({}, first, { id: 'second' })); }, 'sessions');
    env.submit();
    assert.equal(env.peer().hub.state.get().sessions.map((item) => item.id).join(','), 'second');
    env.byId('history-content').querySelector('button').click();
    env.shared.fail = true;
    env.submit();
    assert.equal(env.hub.state.get().sessions.length, 0);
    const errors = env.byId('toast-container').querySelectorAll('.toast-error');
    assert.match(errors[errors.length - 1].textContent, /Não foi possível salvar/);
});

console.log('\n' + passed + ' UI regressions passed (DOM fixture; browser layout verification is separate).');
if (failed) { process.exitCode = 1; }
