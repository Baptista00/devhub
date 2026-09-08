(function (Hub) {
  'use strict';
  var ui = Hub.ui;
  function shortcuts() {
    var root = document.getElementById('shortcuts-list');
    ui.clear(root);
    Hub.config.shortcuts.forEach(function (item) {
      var configured = /^https?:\/\//i.test(item.url || '');
      var link = ui.el(configured ? 'a' : 'div', 'shortcut-item');
      if (configured) { link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      var mark = ui.el('span', 'shortcut-icon', item.icon || item.name.slice(0, 2));
      var detail = ui.el('span', 'shortcut-text');
      detail.appendChild(ui.el('span', 'session-title', item.name));
      detail.appendChild(ui.el('span', 'session-meta', configured ? item.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'Link a configurar'));
      link.appendChild(mark);
      link.appendChild(detail);
      if (configured) link.appendChild(ui.icon('external'));
      root.appendChild(link);
    });
  }
  function renderHero() {
    var active = Hub.state.get().activeSession;
    document.getElementById('active-indicator').hidden = !active;
    if (!active) return;
    ui.text('hero-label-text', active.stage === 'readyBreak' || active.stage === 'completed' ? 'CICLO CONCLUÍDO' : 'EM FOCO AGORA');
    ui.text('hero-time', Hub.time.formatClock(active.type === 'pomodoro' ? Hub.timer.getRemaining() : Hub.timer.getElapsed()));
    ui.text('hero-caption', active.category + (active.stage === 'break' ? ' · Descanso' : active.status === 'paused' ? ' · Pausado' : ' · Seu tempo está sendo contado'));
    if (active.stage === 'readyBreak') ui.text('hero-caption', active.category + ' · Foco registrado. Seu descanso está pronto.');
    if (active.stage === 'completed') ui.text('hero-caption', 'Descanso concluído. Pronto para um novo ciclo?');
  }
  function render() {
    var state = Hub.state.get();
    var data = Hub.stats.summarize(state.sessions);
    var todayTasks = state.tasks.filter(function (task) { return task.date === Hub.time.today(); });
    var completed = todayTasks.filter(function (task) { return task.completed; }).length;
    ui.text('dashboard-title', Hub.time.greeting() + ', ' + state.settings.userName);
    ui.text('dashboard-subtitle', state.sessions.length ? 'Bom ter você por aqui. Continue de onde parou.' : 'Bem-vindo ao seu espaço de foco. Um passo de cada vez.');
    ui.text('hero-label-text', 'HOJE EM FOCO');
    ui.text('hero-time', Hub.time.formatDuration(data.today));
    ui.text('hero-caption', data.today ? 'Tempo bem investido no que importa para você.' : 'Reserve um tempo para o que importa.');
    ui.text('hero-badge', state.sessions.length ? data.recentCategory : 'Seu próximo passo começa aqui');
    ui.text('hero-start-label', state.activeSession ? 'Abrir modo foco' : 'Começar sessão');
    document.getElementById('hero-pomodoro').hidden = !!state.activeSession;
    var goal = state.settings.dailyGoalMinutes * 60;
    var percent = Math.floor(data.today / goal * 100);
    document.getElementById('goal-percent').firstChild.nodeValue = String(percent);
    ui.text('goal-copy', Hub.time.formatDuration(data.today) + ' de ' + Hub.time.formatDuration(goal));
    document.getElementById('goal-fill').style.width = Math.min(100, percent) + '%';
    document.getElementById('goal-progress').setAttribute('aria-valuenow', String(Math.min(100, percent)));
    document.getElementById('goal-progress').setAttribute('aria-valuetext', percent + '% da meta diária');
    ui.text('goal-footer', percent >= 100 ? 'Meta alcançada. Reconheça seu progresso.' : data.today ? 'Faltam ' + Hub.time.formatDuration(goal - data.today) + '. Você está no caminho.' : 'Seu foco de hoje aparece aqui.');
    var cards = document.getElementById('dashboard-stats');
    ui.clear(cards);
    cards.appendChild(Hub.stats.statCard('Sessões hoje', data.todayCount, data.todayCount ? 'Cada sessão é um avanço' : 'Pronto para a primeira?', 'focus'));
    cards.appendChild(Hub.stats.statCard('Sequência atual', data.streak + (data.streak === 1 ? ' dia' : ' dias'), 'Construa sua constância', 'streak'));
    cards.appendChild(Hub.stats.statCard('Tarefas concluídas', completed + ' / ' + todayTasks.length, 'Um passo de cada vez', 'check'));
    cards.appendChild(Hub.stats.statCard('Últimos 7 dias', Hub.time.formatDuration(data.week), 'Seu ritmo nesta semana', 'chart'));
    Hub.tasks.renderPreview(document.getElementById('dashboard-tasks'));
    Hub.history.renderRecent(document.getElementById('recent-sessions'));
    renderHero();
  }
  function init() {
    document.getElementById('hero-start').addEventListener('click', function () {
      if (Hub.state.get().activeSession) Hub.app.showView('focus');
      else Hub.focus.openStart('stopwatch');
    });
    document.getElementById('hero-pomodoro').addEventListener('click', function () { Hub.focus.openStart('pomodoro'); });
    document.getElementById('goal-edit').addEventListener('click', function () { Hub.settings.openGoal(); });
    document.getElementById('dashboard-add-task').addEventListener('click', function () { Hub.tasks.openAdd(Hub.time.today()); });
    shortcuts();
  }
  Hub.dashboard = { init: init, render: render, tick: renderHero };
}(window.Hub));
