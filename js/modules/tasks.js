(function (Hub) {
    'use strict';

    var selectedDate;
    var initialized = false;

    function tasksForDate(date, tasks) {
        return (tasks || Hub.state.get().tasks).filter(function (task) {
            return task.date === date;
        }).sort(function (left, right) {
            var difference = (left.order || 0) - (right.order || 0);
            return difference || left.createdAt.localeCompare(right.createdAt);
        });
    }

    function persist(mutator, message) {
        Hub.state.transact(mutator, 'tasks');
        if (Hub.storage.getError()) {
            Hub.ui.toast('Alteração mantida nesta aba. Não foi possível salvar no navegador.', 'error');
            return;
        }
        if (message) { Hub.ui.toast(message); }
    }

    function copyTask(task) {
        return {
            id: task.id,
            title: task.title,
            completed: task.completed,
            createdAt: task.createdAt,
            completedAt: task.completedAt,
            date: task.date,
            order: task.order || 0
        };
    }

    function toggleTask(id, compact) {
        persist(function (draft) {
            draft.tasks = draft.tasks.map(function (task) {
                if (task.id !== id) { return task; }
                var updated = copyTask(task);
                updated.completed = !updated.completed;
                updated.completedAt = updated.completed ? new Date().toISOString() : null;
                return updated;
            });
        });
        var container = document.getElementById(compact ? 'dashboard-tasks' : 'tasks-content');
        if (!container) { return; }
        var controls = container.querySelectorAll('[data-task-toggle]');
        for (var i = 0; i < controls.length; i += 1) {
            if (controls[i].getAttribute('data-task-toggle') === id) { controls[i].focus(); break; }
        }
    }

    function removeTask(task) {
        Hub.ui.confirm({
            title: 'Excluir tarefa?',
            message: 'A tarefa “' + task.title + '” será removida permanentemente.',
            confirmLabel: 'Excluir tarefa',
            danger: true,
            onConfirm: function () {
                persist(function (draft) {
                    draft.tasks = draft.tasks.filter(function (item) { return item.id !== task.id; });
                }, 'Tarefa excluída');
            }
        });
    }

    function titleField(value) {
        var wrapper = Hub.ui.el('div', 'form-field');
        var label = Hub.ui.el('label', '', 'O que precisa ser feito?');
        var input = Hub.ui.el('input', 'input');
        label.htmlFor = 'task-title-input';
        input.id = 'task-title-input';
        input.name = 'taskTitle';
        input.type = 'text';
        input.required = true;
        input.maxLength = 240;
        input.autocomplete = 'off';
        input.placeholder = 'Ex.: Revisar funções em JavaScript';
        input.value = value || '';
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        return { content: wrapper, input: input };
    }

    function openEditor(task, date) {
        var field = titleField(task ? task.title : '');
        Hub.ui.modal({
            title: task ? 'Editar tarefa' : 'Adicionar tarefa',
            description: Hub.time.formatDate(task ? task.date : date),
            content: field.content,
            submitLabel: task ? 'Salvar tarefa' : 'Adicionar tarefa',
            onSubmit: function () {
                var title = field.input.value.trim();
                if (!title || title.length > 240) {
                    field.input.setCustomValidity('Escreva uma tarefa de até 240 caracteres.');
                    field.input.focus();
                    if (field.input.reportValidity) { field.input.reportValidity(); }
                    return false;
                }
                persist(function (draft) {
                    if (task) {
                        draft.tasks = draft.tasks.map(function (item) {
                            if (item.id !== task.id) { return item; }
                            var updated = copyTask(item);
                            updated.title = title;
                            return updated;
                        });
                    } else {
                        var dayTasks = tasksForDate(date, draft.tasks);
                        draft.tasks.push({
                            id: Hub.time.newId(),
                            title: title,
                            completed: false,
                            createdAt: new Date().toISOString(),
                            completedAt: null,
                            date: date,
                            order: dayTasks.length ? (dayTasks[dayTasks.length - 1].order || 0) + 1 : 0
                        });
                    }
                }, task ? 'Tarefa atualizada' : 'Tarefa adicionada');
            }
        });
        field.input.addEventListener('input', function () { field.input.setCustomValidity(''); });
    }

    function moveTask(id, direction, date) {
        persist(function (draft) {
            var dayTasks = tasksForDate(date, draft.tasks);
            var index = -1;
            var orderById = Object.create(null);
            dayTasks.forEach(function (task, position) {
                if (task.id === id) { index = position; }
            });
            var target = index + direction;
            if (index < 0 || target < 0 || target >= dayTasks.length) { return false; }
            var moved = dayTasks[index];
            dayTasks[index] = dayTasks[target];
            dayTasks[target] = moved;
            dayTasks.forEach(function (task, position) { orderById[task.id] = position; });
            draft.tasks = draft.tasks.map(function (task) {
                if (task.date !== date) { return task; }
                var updated = copyTask(task);
                updated.order = orderById[task.id];
                return updated;
            });
        });
        var controls = document.getElementById('tasks-content').querySelectorAll('[data-task-move]');
        var fallback;
        for (var i = 0; i < controls.length; i += 1) {
            if (controls[i].getAttribute('data-task-id') === id && !controls[i].disabled) { fallback = controls[i]; }
            if (controls[i].getAttribute('data-task-id') === id &&
                    controls[i].getAttribute('data-task-move') === String(direction) && !controls[i].disabled) {
                controls[i].focus();
                return;
            }
        }
        if (fallback) { fallback.focus(); }
    }

    function actionButton(text, label, callback) {
        var button = Hub.ui.button(text, 'btn btn-ghost icon-btn', callback);
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.title = label;
        return button;
    }

    function taskRow(task, index, count, compact) {
        var row = Hub.ui.el('li', 'task-row' + (task.completed ? ' is-completed' : ''));
        var label = Hub.ui.el('label', 'task-check');
        var checkbox = Hub.ui.el('input', 'task-checkbox');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.setAttribute('data-task-toggle', task.id);
        checkbox.setAttribute('aria-label', (task.completed ? 'Desmarcar: ' : 'Concluir: ') + task.title);
        checkbox.addEventListener('change', function () { toggleTask(task.id, compact); });
        label.appendChild(checkbox);
        label.appendChild(Hub.ui.el('span', 'task-title', task.title));
        row.appendChild(label);
        if (compact) { return row; }
        var actions = Hub.ui.el('div', 'task-actions');
        var up = actionButton('↑', 'Mover para cima: ' + task.title, function () { moveTask(task.id, -1, task.date); });
        var down = actionButton('↓', 'Mover para baixo: ' + task.title, function () { moveTask(task.id, 1, task.date); });
        up.disabled = index === 0;
        down.disabled = index === count - 1;
        up.setAttribute('data-task-id', task.id);
        down.setAttribute('data-task-id', task.id);
        up.setAttribute('data-task-move', '-1');
        down.setAttribute('data-task-move', '1');
        actions.appendChild(up);
        actions.appendChild(down);
        actions.appendChild(actionButton('Editar', 'Editar: ' + task.title, function () { openEditor(task, task.date); }));
        actions.appendChild(actionButton('×', 'Excluir: ' + task.title, function () { removeTask(task); }));
        row.appendChild(actions);
        return row;
    }

    function emptyState(container, today) {
        var empty = Hub.ui.el('div', 'empty-state');
        empty.appendChild(Hub.ui.el('p', 'empty-title', today ? 'Um dia com espaço para criar.' : 'Nenhuma tarefa nesta data.'));
        empty.appendChild(Hub.ui.el('p', 'muted', 'Adicione uma tarefa pequena e dê o primeiro passo.'));
        container.appendChild(empty);
    }

    function renderPreview(container) {
        if (!container) { return; }
        Hub.ui.clear(container);
        var tasks = tasksForDate(Hub.time.today());
        if (!tasks.length) { emptyState(container, true); return; }
        var list = Hub.ui.el('ul', 'task-list task-list-preview');
        tasks.slice(0, 5).forEach(function (task, index) {
            list.appendChild(taskRow(task, index, tasks.length, true));
        });
        container.appendChild(list);
    }

    function render() {
        var container = document.getElementById('tasks-content');
        if (!container) { return; }
        if (!selectedDate) { selectedDate = Hub.time.today(); }
        var tasks = tasksForDate(selectedDate);
        var completed = tasks.filter(function (task) { return task.completed; }).length;
        var dateInput = document.getElementById('task-date');
        var summary = document.getElementById('task-summary');
        if (dateInput) { dateInput.value = selectedDate; }
        if (summary) { summary.textContent = completed + ' de ' + tasks.length + ' concluídas'; }
        Hub.ui.clear(container);
        if (!tasks.length) { emptyState(container, selectedDate === Hub.time.today()); return; }
        var list = Hub.ui.el('ul', 'task-list');
        tasks.forEach(function (task, index) {
            list.appendChild(taskRow(task, index, tasks.length, false));
        });
        container.appendChild(list);
    }

    function init() {
        if (initialized) { return; }
        initialized = true;
        selectedDate = Hub.time.today();
        document.getElementById('task-add').addEventListener('click', function () { openEditor(null, selectedDate); });
        document.getElementById('task-date').addEventListener('change', function (event) {
            var value = event.target.value;
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Hub.time.dayKey(value) !== value) {
                event.target.value = selectedDate;
                Hub.ui.toast('Escolha uma data válida.', 'error');
                return;
            }
            selectedDate = value;
            render();
        });
        document.getElementById('task-today').addEventListener('click', function () {
            selectedDate = Hub.time.today();
            render();
        });
        render();
    }

    Hub.tasks = {
        init: init,
        render: render,
        renderPreview: renderPreview,
        openAdd: function () { openEditor(null, Hub.time.today()); },
        changeDay: function () { selectedDate = Hub.time.today(); render(); }
    };
}(window.Hub));
