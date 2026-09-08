(function (Hub) {
  'use strict';
  var ui = Hub.ui;
  var time = Hub.time;
  var selected = 'all';
  var filters = [{ id: 'today', label: 'Hoje' }, { id: 'yesterday', label: 'Ontem' },
    { id: 'week', label: 'Últimos 7 dias' }, { id: 'month', label: 'Últimos 30 dias' }, { id: 'all', label: 'Todos' }];
  function sorted() {
    return Hub.state.get().sessions.slice().sort(function (a, b) { return Date.parse(b.startedAt) - Date.parse(a.startedAt); });
  }
  function removeSession(session) {
    ui.confirm({ title: 'Excluir sessão?', message: session.category + ' · ' + time.formatDuration(session.duration) +
      '. A meta e as estatísticas serão recalculadas.', confirmLabel: 'Excluir sessão', danger: true,
      onConfirm: function () {
        Hub.state.update('sessions', Hub.state.get().sessions.filter(function (item) { return item.id !== session.id; }));
        ui.toast('Sessão excluída.');
      } });
  }
  function row(session, canDelete) {
    var item = ui.el('div', 'session-row');
    var mark = ui.el('span', 'session-icon');
    mark.appendChild(ui.icon(session.type === 'pomodoro' ? 'focus' : 'code'));
    var info = ui.el('div', 'session-info');
    info.appendChild(ui.el('p', 'session-title', session.category));
    info.appendChild(ui.el('p', 'session-meta', time.formatTime(session.startedAt) + ' – ' + time.formatTime(session.endedAt) +
      ' · ' + (session.type === 'pomodoro' ? 'Pomodoro' : 'Cronômetro') + (canDelete ? '' : ' · ' + time.formatDate(session.date || time.dayKey(session.startedAt)))));
    item.appendChild(mark);
    item.appendChild(info);
    item.appendChild(ui.el('span', 'session-duration', time.formatDuration(session.duration)));
    if (canDelete) {
      var remove = ui.button('', 'icon-btn session-actions', function () { removeSession(session); });
      remove.setAttribute('aria-label', 'Excluir sessão de ' + session.category + ' às ' + time.formatTime(session.startedAt));
      remove.appendChild(ui.icon('trash'));
      item.appendChild(remove);
    }
    return item;
  }
  function renderRecent(container) {
    ui.clear(container);
    var sessions = sorted().slice(0, 3);
    if (!sessions.length) ui.empty(container, 'Seu progresso começa com uma sessão', 'Escolha algo para fazer e dê o primeiro passo.', 'history');
    sessions.forEach(function (session) { container.appendChild(row(session, false)); });
  }
  function render() {
    var filterRoot = document.getElementById('history-filters');
    ui.clear(filterRoot);
    filters.forEach(function (filter) {
      var button = ui.button(filter.label, 'filter-btn' + (selected === filter.id ? ' is-active' : ''), function () {
        selected = filter.id; render();
      });
      button.setAttribute('aria-pressed', String(selected === filter.id));
      filterRoot.appendChild(button);
    });
    var sessions = sorted();
    if (selected === 'today') sessions = Hub.stats.forDay(sessions, time.today());
    if (selected === 'yesterday') sessions = Hub.stats.forDay(sessions, time.daysAgo(1));
    if (selected === 'week') sessions = Hub.stats.inPeriod(sessions, time.daysAgo(6), time.today());
    if (selected === 'month') sessions = Hub.stats.inPeriod(sessions, time.daysAgo(29), time.today());
    ui.text('history-total', sessions.length + ' sessões · ' + time.formatDuration(Hub.stats.sum(sessions)));
    var root = document.getElementById('history-content');
    ui.clear(root);
    if (!sessions.length) ui.empty(root, 'Nenhuma sessão neste período', 'Comece uma sessão de foco para construir seu histórico.', 'history');
    var lastDay = '';
    var group;
    sessions.forEach(function (session) {
      var day = session.date || time.dayKey(session.startedAt);
      if (day !== lastDay) {
        group = ui.el('article', 'card history-group');
        group.appendChild(ui.el('h2', 'history-date', time.formatDate(day)));
        root.appendChild(group);
        lastDay = day;
      }
      group.appendChild(row(session, true));
    });
  }
  Hub.history = { render: render, renderRecent: renderRecent };
}(window.Hub));
