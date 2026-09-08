(function (Hub) {
    'use strict';

    var initialized = false;
    var MAX_BACKUP_BYTES = 5 * 1024 * 1024;

    function feedback(message) {
        if (Hub.storage.getError()) {
            Hub.ui.toast('Dados atualizados nesta aba, mas não salvos no navegador. Exporte um backup.', 'error');
            return;
        }
        Hub.ui.toast(message);
    }

    function field(name, labelText, value, type, min, max) {
        var wrapper = Hub.ui.el('div', 'form-field');
        var label = Hub.ui.el('label', '', labelText);
        var input = Hub.ui.el('input', 'input');
        label.htmlFor = 'settings-' + name;
        input.id = 'settings-' + name;
        input.name = name;
        input.type = type || 'number';
        input.value = String(value);
        input.required = true;
        if (input.type === 'number') {
            input.min = String(min);
            input.max = String(max);
            input.step = '1';
            input.setAttribute('inputmode', 'numeric');
        } else {
            input.maxLength = 60;
            input.autocomplete = 'given-name';
        }
        input.addEventListener('input', function () { input.setCustomValidity(''); });
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        return { node: wrapper, input: input };
    }

    function validNumber(input, minimum, maximum) {
        var value = Number(input.value);
        if (!input.value.trim() || !isFinite(value) || Math.floor(value) !== value || value < minimum || value > maximum) {
            input.setCustomValidity('Use um número inteiro entre ' + minimum + ' e ' + maximum + '.');
            input.focus();
            if (input.reportValidity) { input.reportValidity(); }
            return null;
        }
        return value;
    }

    function section(title, description) {
        var card = Hub.ui.el('section', 'card settings-section');
        card.appendChild(Hub.ui.el('h2', 'section-title', title));
        if (description) { card.appendChild(Hub.ui.el('p', 'muted section-description', description)); }
        return card;
    }

    function preferences() {
        var settings = Hub.state.get().settings;
        var card = section('Seu espaço, seu ritmo', 'Ajuste seu nome e os tempos que fazem sentido para sua rotina.');
        var form = Hub.ui.el('form', 'settings-form');
        form.id = 'preferences-form';
        var grid = Hub.ui.el('div', 'form-grid');
        var name = field('userName', 'Seu nome', settings.userName, 'text');
        var goal = field('dailyGoalMinutes', 'Meta diária (minutos)', settings.dailyGoalMinutes, 'number', 1, 1440);
        var focus = field('pomodoroFocusMinutes', 'Pomodoro: foco (minutos)', settings.pomodoroFocusMinutes, 'number', 1, 180);
        var rest = field('pomodoroBreakMinutes', 'Pomodoro: descanso (minutos)', settings.pomodoroBreakMinutes, 'number', 1, 60);
        [name, goal, focus, rest].forEach(function (item) { grid.appendChild(item.node); });
        form.appendChild(grid);
        form.appendChild(Hub.ui.el('p', 'muted settings-hint', 'Os novos tempos do Pomodoro serão usados na próxima sessão.'));
        var save = Hub.ui.el('button', 'btn btn-primary', 'Salvar preferências');
        save.type = 'submit';
        form.appendChild(save);
        form.addEventListener('submit', function (event) {
            event.preventDefault();
            var userName = name.input.value.trim();
            if (!userName || userName.length > 60) {
                name.input.setCustomValidity('Escreva um nome de até 60 caracteres.');
                name.input.focus();
                if (name.input.reportValidity) { name.input.reportValidity(); }
                return;
            }
            var dailyGoal = validNumber(goal.input, 1, 1440);
            if (dailyGoal === null) { return; }
            var focusMinutes = validNumber(focus.input, 1, 180);
            if (focusMinutes === null) { return; }
            var breakMinutes = validNumber(rest.input, 1, 60);
            if (breakMinutes === null) { return; }
            Hub.state.update('settings', {
                userName: userName,
                dailyGoalMinutes: dailyGoal,
                pomodoroFocusMinutes: focusMinutes,
                pomodoroBreakMinutes: breakMinutes
            });
            feedback('Preferências salvas');
        });
        card.appendChild(form);
        return card;
    }

    function exportData() {
        var state = Hub.state.get();
        var backup = {
            version: state.version,
            exportedAt: new Date().toISOString(),
            settings: state.settings,
            sessions: state.sessions,
            tasks: state.tasks,
            notes: state.notes,
            activeSession: null
        };
        var urlAPI = window.URL || window.webkitURL;
        if (!window.Blob || !urlAPI || !urlAPI.createObjectURL) {
            Hub.ui.toast('Este navegador não oferece download de arquivos. Abra o app em um navegador atualizado para exportar.', 'error');
            return;
        }
        try {
            var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
            var url = urlAPI.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = 'lucas-dev-hub-' + Hub.time.today() + '.json';
            link.rel = 'noopener';
            link.style.display = 'none';
            var supportsDownload = 'download' in document.createElement('a');
            if (!supportsDownload) { link.target = '_blank'; }
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.setTimeout(function () { urlAPI.revokeObjectURL(url); }, 60000);
            Hub.ui.toast(supportsDownload ? 'Download do backup solicitado' : 'Backup aberto. Use Compartilhar para salvar o arquivo.');
        } catch (error) {
            Hub.ui.toast('Não foi possível gerar o backup neste navegador.', 'error');
        }
    }

    function confirmImport(data) {
        var details = data.sessions.length + ' sessões, ' + data.tasks.length + ' tarefas e suas notas.';
        Hub.ui.confirm({
            title: 'Restaurar este backup?',
            message: 'O backup contém ' + details + ' Todos os dados atuais serão substituídos. Uma sessão em andamento será descartada. Exporte seus dados atuais antes de continuar.',
            confirmLabel: 'Restaurar backup',
            danger: true,
            onConfirm: function () {
                Hub.state.replace(data);
                feedback('Backup restaurado');
                Hub.app.showView('dashboard');
            }
        });
    }

    function readBackup(file) {
        if (!file) { return; }
        if (file.size > MAX_BACKUP_BYTES) {
            Hub.ui.toast('O backup deve ter no máximo 5 MB.', 'error');
            return;
        }
        if (!window.FileReader) {
            Hub.ui.toast('Este navegador não consegue ler arquivos de backup.', 'error');
            return;
        }
        var reader = new FileReader();
        reader.onload = function () {
            var data;
            try {
                data = Hub.state.validateImport(JSON.parse(reader.result));
            } catch (error) {
                Hub.ui.toast('Backup inválido: ' + (error.message || 'confira o formato do arquivo.'), 'error');
                return;
            }
            confirmImport(data);
        };
        reader.onerror = function () { Hub.ui.toast('Não foi possível ler o arquivo de backup.', 'error'); };
        reader.readAsText(file, 'UTF-8');
    }

    function confirmReset() {
        var content = Hub.ui.el('div', 'form-field');
        var label = Hub.ui.el('label', '', 'Digite APAGAR para confirmar');
        var input = Hub.ui.el('input', 'input');
        label.htmlFor = 'confirm-reset-input';
        input.id = 'confirm-reset-input';
        input.name = 'confirmation';
        input.type = 'text';
        input.required = true;
        input.autocomplete = 'off';
        input.spellcheck = false;
        input.setAttribute('autocapitalize', 'characters');
        input.addEventListener('input', function () { input.setCustomValidity(''); });
        content.appendChild(label);
        content.appendChild(input);
        Hub.ui.modal({
            title: 'Apagar todos os dados?',
            description: 'Esta ação apagará sessões, tarefas, notas e configurações deste navegador, incluindo uma sessão em andamento. Exporte um backup antes. Esta ação não pode ser desfeita.',
            content: content,
            submitLabel: 'Apagar todos os dados',
            danger: true,
            onSubmit: function () {
                if (input.value.trim() !== 'APAGAR') {
                    input.setCustomValidity('Digite APAGAR exatamente como mostrado.');
                    input.focus();
                    if (input.reportValidity) { input.reportValidity(); }
                    return false;
                }
                Hub.state.reset();
                feedback('Dados do Lucas Dev Hub apagados');
                Hub.app.showView('dashboard');
            }
        });
    }

    function dataControls() {
        var card = section('Seus dados', 'Tudo fica neste navegador. Faça backups para guardar seu histórico ou transferi-lo para outro dispositivo.');
        var actions = Hub.ui.el('div', 'settings-actions');
        actions.appendChild(Hub.ui.button('Exportar dados', 'btn btn-secondary', exportData));
        var input = Hub.ui.el('input', 'sr-only');
        input.id = 'backup-file';
        input.type = 'file';
        input.accept = '.json,application/json';
        input.setAttribute('aria-label', 'Selecionar backup JSON');
        input.tabIndex = -1;
        input.addEventListener('change', function () {
            readBackup(input.files && input.files[0]);
            input.value = '';
        });
        actions.appendChild(Hub.ui.button('Importar dados', 'btn btn-secondary', function () { input.click(); }));
        actions.appendChild(input);
        card.appendChild(actions);
        card.appendChild(Hub.ui.el('p', 'muted settings-hint', 'O backup inclui sessões finalizadas, tarefas, notas e preferências. A sessão em andamento não é exportada. Importação: JSON de até 5 MB.'));
        var danger = Hub.ui.el('div', 'danger-zone');
        danger.appendChild(Hub.ui.el('h3', '', 'Recomeçar do zero'));
        danger.appendChild(Hub.ui.el('p', 'muted', 'Remova os dados deste aplicativo neste navegador.'));
        danger.appendChild(Hub.ui.button('Apagar todos os dados', 'btn btn-danger', confirmReset));
        card.appendChild(danger);
        return card;
    }

    function openGoal() {
        var goal = field('goalModal', 'Meta diária em minutos', Hub.state.get().settings.dailyGoalMinutes, 'number', 1, 1440);
        Hub.ui.modal({
            title: 'Sua meta diária',
            description: 'Escolha um tempo possível para seu dia. 180 minutos equivalem a 3 horas.',
            content: goal.node,
            submitLabel: 'Salvar meta',
            onSubmit: function () {
                var minutes = validNumber(goal.input, 1, 1440);
                if (minutes === null) { return false; }
                Hub.state.transact(function (state) { state.settings.dailyGoalMinutes = minutes; }, 'settings');
                feedback('Meta atualizada');
            }
        });
    }

    function render() {
        var container = document.getElementById('settings-content');
        if (!container) { return; }
        Hub.ui.clear(container);
        container.appendChild(preferences());
        container.appendChild(dataControls());
    }

    function init() {
        if (initialized) { return; }
        initialized = true;
        render();
    }

    Hub.settings = { init: init, render: render, openGoal: openGoal };
}(window.Hub));
