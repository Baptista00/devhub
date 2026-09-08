(function (Hub) {
  'use strict';
  var ui = Hub.ui;
  var audioContext = null;
  function unlockAudio() {
    var Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      if (!audioContext) audioContext = new Audio();
      if (audioContext.state === 'suspended' && audioContext.resume) {
        var result = audioContext.resume();
        if (result && result.catch) result.catch(function () {});
      }
    } catch (error) { audioContext = null; }
  }
  function chime() {
    if (!audioContext || audioContext.state !== 'running') return;
    try {
      var sound = audioContext.createOscillator();
      var volume = audioContext.createGain();
      sound.type = 'sine';
      sound.frequency.value = 660;
      volume.gain.setValueAtTime(0.06, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.6);
      sound.connect(volume);
      volume.connect(audioContext.destination);
      sound.onended = function () { sound.disconnect(); volume.disconnect(); };
      sound.start();
      sound.stop(audioContext.currentTime + 0.65);
    } catch (error) { /* Visual feedback remains available when audio is blocked. */ }
  }
  function numberField(labelText, value, maximum, id) {
    var node = ui.el('div', 'form-field');
    var label = ui.el('label', 'field-label', labelText);
    var input = ui.el('input', 'input');
    label.htmlFor = id;
    input.id = id;
    input.type = 'number';
    input.min = '1';
    input.max = String(maximum);
    input.step = '1';
    input.required = true;
    input.value = value;
    node.appendChild(label);
    node.appendChild(input);
    return { node: node, input: input };
  }
  function openStart(type) {
    if (Hub.state.get().activeSession) { Hub.app.showView('focus'); return; }
    var content = ui.el('div');
    var choices = ui.el('div', 'category-options');
    var categoryField = ui.el('div', 'form-field');
    var label = ui.el('label', 'field-label', 'Categoria');
    var input = ui.el('input', 'input');
    label.htmlFor = 'focus-category-input';
    input.id = 'focus-category-input';
    input.maxLength = 80;
    input.required = true;
    input.value = Hub.config.categories[0];
    input.placeholder = 'Ou escreva uma categoria personalizada';
    var chips = [];
    function selectCategory() {
      chips.forEach(function (chip) {
        var selected = chip.textContent === input.value;
        chip.classList.toggle('is-selected', selected);
        chip.setAttribute('aria-pressed', String(selected));
      });
    }
    Hub.config.categories.forEach(function (name) {
      var chip = ui.button(name, 'category-chip', function () { input.value = name; selectCategory(); });
      chips.push(chip);
      choices.appendChild(chip);
    });
    input.addEventListener('input', selectCategory);
    selectCategory();
    content.appendChild(choices);
    categoryField.appendChild(label);
    categoryField.appendChild(input);
    content.appendChild(categoryField);
    var settings = Hub.state.get().settings;
    var focusField;
    var breakField;
    if (type === 'pomodoro') {
      var presets = ui.el('div', 'preset-options');
      focusField = numberField('Foco (minutos)', settings.pomodoroFocusMinutes, 180, 'pomo-focus');
      breakField = numberField('Descanso (minutos)', settings.pomodoroBreakMinutes, 60, 'pomo-break');
      var presetButtons = [];
      [[25, 5], [50, 10]].forEach(function (preset) {
        var button = ui.button(preset[0] + ' / ' + preset[1], 'preset-btn', function () {
          focusField.input.value = preset[0]; breakField.input.value = preset[1]; updatePreset();
        });
        presetButtons.push({ button: button, focus: preset[0], rest: preset[1] });
        presets.appendChild(button);
      });
      function updatePreset() {
        presetButtons.forEach(function (preset) {
          var selected = Number(focusField.input.value) === preset.focus && Number(breakField.input.value) === preset.rest;
          preset.button.classList.toggle('is-selected', selected);
          preset.button.setAttribute('aria-pressed', String(selected));
        });
      }
      focusField.input.addEventListener('input', updatePreset);
      breakField.input.addEventListener('input', updatePreset);
      updatePreset();
      content.appendChild(ui.el('p', 'field-label', 'Seu ciclo Pomodoro'));
      content.appendChild(presets);
      var fields = ui.el('div', 'form-row');
      fields.appendChild(focusField.node);
      fields.appendChild(breakField.node);
      content.appendChild(fields);
      content.appendChild(ui.el('p', 'field-hint', 'Escolha um preset ou personalize os minutos acima. O descanso começa quando você decidir.'));
    }
    ui.modal({ title: 'O que você vai fazer?', description: type === 'pomodoro' ? 'Um período de foco. Depois, uma pausa merecida.' : 'Escolha uma direção. O resto pode esperar.',
      content: content, submitLabel: 'Iniciar foco', onSubmit: function () {
        var category = input.value.trim();
        if (!category) { ui.toast('Escreva uma categoria para sua sessão.', 'error'); input.focus(); return false; }
        var options = { type: type, category: category };
        if (focusField) {
          options.focusMinutes = Number(focusField.input.value);
          options.breakMinutes = Number(breakField.input.value);
          if (options.focusMinutes % 1 || options.breakMinutes % 1 || options.focusMinutes < 1 || options.focusMinutes > 180 || options.breakMinutes < 1 || options.breakMinutes > 60) {
            ui.toast('Use foco de 1 a 180 minutos e descanso de 1 a 60 minutos, em números inteiros.', 'error'); return false;
          }
        }
        unlockAudio();
        Hub.timer.start(options);
        Hub.app.showView('focus');
      } });
  }
  function finish() {
    var active = Hub.state.get().activeSession;
    if (!active) return;
    var seconds = Hub.timer.getElapsed();
    var isFocus = active.stage === 'focus';
    ui.confirm({ title: isFocus ? 'Finalizar sessão?' : 'Encerrar este ciclo?',
      message: isFocus ? (seconds < 1 ? 'Sessões com menos de um segundo não são registradas.' : 'Seu tempo de foco será registrado no histórico. O tempo em pausa fica de fora.') : 'Seu foco já foi registrado. O descanso não entra nas estatísticas.',
      confirmLabel: isFocus ? 'Finalizar sessão' : 'Encerrar ciclo', onConfirm: function () {
        var saved = Hub.timer.finish();
        Hub.app.showView('dashboard');
        ui.toast(Hub.storage.getError() ? 'Sessão encerrada nesta aba. Exporte um backup antes de sair.' : saved ? 'Sessão finalizada · ' + Hub.time.formatDuration(saved.duration) : isFocus && seconds < 1 ? 'Sessão muito curta. Nenhum registro criado.' : 'Ciclo encerrado.', Hub.storage.getError() ? 'error' : '');
      } });
  }
  function cancel() {
    var active = Hub.state.get().activeSession;
    if (!active) return;
    ui.confirm({ title: 'Cancelar Pomodoro?', message: active.stage === 'focus' ? 'O tempo deste foco será descartado. Para guardá-lo, use Finalizar sessão.' : 'O descanso será encerrado. O foco já registrado permanece no histórico.',
      confirmLabel: 'Cancelar ciclo', danger: true, onConfirm: function () { Hub.timer.cancel(); Hub.app.showView('dashboard'); ui.toast('Ciclo cancelado.'); } });
  }
  function idle(root) {
    var intro = ui.el('div', 'focus-idle');
    intro.appendChild(ui.el('p', 'eyebrow', 'PRESENTE NO QUE IMPORTA'));
    var title = ui.el('h1', 'page-title', 'Encontre seu foco.');
    title.id = 'focus-title';
    intro.appendChild(title);
    intro.appendChild(ui.el('p', 'page-subtitle', 'Escolha seu ritmo. Dê espaço para uma coisa de cada vez.'));
    var modes = ui.el('div', 'mode-grid');
    [['stopwatch', 'clock', 'Tempo livre', 'Seu ritmo, sem contagem regressiva.', 'Começar sessão'],
      ['pomodoro', 'focus', 'Pomodoro', 'Alterne concentração e descanso.', 'Configurar Pomodoro']].forEach(function (mode) {
      var card = ui.el('article', 'card mode-card');
      var mark = ui.el('div', 'mode-icon');
      mark.appendChild(ui.icon(mode[1]));
      card.appendChild(mark);
      card.appendChild(ui.el('h2', 'section-title', mode[2]));
      card.appendChild(ui.el('p', 'page-subtitle', mode[3]));
      card.appendChild(ui.button(mode[4], mode[0] === 'stopwatch' ? 'btn btn-primary' : 'btn btn-secondary', function () { openStart(mode[0]); }));
      modes.appendChild(card);
    });
    intro.appendChild(modes);
    root.appendChild(intro);
  }
  function render() {
    var root = document.getElementById('focus-content');
    ui.clear(root);
    var active = Hub.state.get().activeSession;
    if (!active) { idle(root); return; }
    var top = ui.el('div', 'focus-top');
    var back = ui.button('Voltar ao dashboard', 'btn btn-ghost', function () { Hub.app.showView('dashboard'); });
    back.insertBefore(ui.icon('arrow'), back.firstChild);
    top.appendChild(back);
    top.appendChild(ui.el('span', 'badge', active.type === 'pomodoro' ? 'POMODORO' : 'TEMPO LIVRE'));
    root.appendChild(top);
    var stage = ui.el('div', 'focus-stage');
    stage.appendChild(ui.el('p', 'eyebrow', active.stage === 'break' || active.stage === 'completed' ? 'RESPIRAR TAMBÉM É PRODUTIVO' : 'UMA COISA DE CADA VEZ'));
    var title = ui.el('h1', 'focus-category', active.category);
    title.id = 'focus-title';
    stage.appendChild(title);
    var display = ui.el('p', 'focus-display');
    display.id = 'focus-display';
    display.setAttribute('role', 'timer');
    display.setAttribute('aria-label', active.type === 'pomodoro' ? 'Tempo restante' : 'Tempo de foco');
    stage.appendChild(display);
    var status = ui.el('p', 'focus-status');
    status.id = 'focus-status';
    status.setAttribute('role', 'status');
    stage.appendChild(status);
    var controls = ui.el('div', 'focus-controls');
    if (active.stage === 'readyBreak') {
      stage.appendChild(ui.el('p', 'focus-subtitle', Hub.time.formatDuration(active.focusDuration) + ' de foco registrados. Uma pausa para recarregar.'));
      controls.appendChild(ui.button('Começar descanso', 'btn btn-primary', function () { unlockAudio(); Hub.timer.startBreak(); }));
      controls.appendChild(ui.button('Encerrar ciclo', 'btn btn-secondary', finish));
    } else if (active.stage === 'completed') {
      stage.appendChild(ui.el('p', 'focus-subtitle', 'Seu descanso terminou. Pronto para o próximo passo?'));
      controls.appendChild(ui.button('Novo Pomodoro', 'btn btn-primary', function () { Hub.timer.finish(); openStart('pomodoro'); }));
      controls.appendChild(ui.button('Encerrar ciclo', 'btn btn-secondary', finish));
    } else {
      var pause = ui.button(active.status === 'paused' ? 'Continuar' : 'Pausar', 'btn btn-primary', function () {
        unlockAudio();
        if (Hub.state.get().activeSession.status === 'paused') Hub.timer.resume(); else Hub.timer.pause();
        var next = document.getElementById('focus-pause');
        if (next) next.focus();
      });
      pause.id = 'focus-pause';
      controls.appendChild(pause);
      controls.appendChild(ui.button(active.stage === 'break' ? 'Encerrar descanso' : 'Finalizar sessão', 'btn btn-secondary', finish));
      if (active.type === 'pomodoro') controls.appendChild(ui.button('Cancelar', 'btn btn-ghost', cancel));
    }
    stage.appendChild(controls);
    stage.appendChild(ui.el('p', 'focus-bottom', 'Seu tempo está guardado. Volte ao dashboard quando quiser.'));
    root.appendChild(stage);
    tick();
  }
  function tick() {
    var active = Hub.state.get().activeSession;
    if (!active) return;
    ui.text('focus-display', Hub.time.formatClock(active.type === 'pomodoro' ? Hub.timer.getRemaining() : Hub.timer.getElapsed()));
    ui.text('focus-status', active.stage === 'readyBreak' ? 'Foco concluído' : active.stage === 'completed' ? 'Descanso concluído' : active.status === 'paused' ? 'Pausado' : active.stage === 'break' ? 'Em descanso' : 'Em foco');
  }
  Hub.focus = { openStart: openStart, render: render, tick: tick, chime: chime };
}(window.Hub));
