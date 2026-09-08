(function (Hub) {
  'use strict';
  var ui = Hub.ui;
  var time = Hub.time;
  function sessionDay(session) { return session.date || time.dayKey(session.startedAt); }
  function sum(sessions) {
    return sessions.reduce(function (total, session) { return total + session.duration; }, 0);
  }
  function forDay(sessions, key) {
    return sessions.filter(function (session) { return sessionDay(session) === key; });
  }
  function inPeriod(sessions, first, last) {
    return sessions.filter(function (session) {
      var key = sessionDay(session);
      return key >= first && key <= last;
    });
  }
  function categories(sessions) {
    var totals = Object.create(null);
    sessions.forEach(function (session) {
      totals[session.category] = (totals[session.category] || 0) + session.duration;
    });
    return Object.keys(totals).map(function (name) { return { name: name, duration: totals[name] }; })
      .sort(function (a, b) { return b.duration - a.duration || a.name.localeCompare(b.name); });
  }
  function streak(sessions, today) {
    var days = Object.create(null);
    sessions.forEach(function (session) { if (session.duration > 0) days[sessionDay(session)] = true; });
    var cursor = days[today] ? today : time.offsetDay(today, -1);
    var count = 0;
    while (days[cursor]) { count += 1; cursor = time.offsetDay(cursor, -1); }
    return count;
  }
  function summarize(sessions, today) {
    today = today || time.today();
    var daily = forDay(sessions, today);
    var week = inPeriod(sessions, time.offsetDay(today, -6), today);
    var total = sum(sessions);
    var allCategories = categories(sessions);
    var recentCategories = categories(inPeriod(sessions, time.offsetDay(today, -29), today));
    var activeDays = Object.create(null);
    sessions.forEach(function (session) { activeDays[sessionDay(session)] = true; });
    return { total: total, today: sum(daily), todayCount: daily.length, week: sum(week),
      month: sum(inPeriod(sessions, today.slice(0, 7) + '-01', today)), count: sessions.length,
      longest: sessions.reduce(function (max, s) { return Math.max(max, s.duration); }, 0),
      average: sessions.length ? Math.round(total / sessions.length) : 0,
      category: allCategories.length ? allCategories[0].name : 'Ainda sem categoria',
      recentCategory: recentCategories.length ? recentCategories[0].name : 'Seu primeiro foco',
      days: Object.keys(activeDays).length, streak: streak(sessions, today), categories: allCategories };
  }
  function statCard(label, value, detail, iconName) {
    var card = ui.el('article', 'card stat-card');
    var top = ui.el('div', 'stat-label', label);
    var mark = ui.el('span', 'stat-icon');
    mark.appendChild(ui.icon(iconName || 'clock'));
    top.appendChild(mark);
    card.appendChild(top);
    card.appendChild(ui.el('p', 'stat-value', value));
    card.appendChild(ui.el('p', 'stat-detail', detail));
    return card;
  }
  function weeklyChart(sessions) {
    var card = ui.el('article', 'card chart-card');
    card.appendChild(ui.el('h2', 'section-title', 'Últimos 7 dias'));
    card.appendChild(ui.el('p', 'page-subtitle', 'Tempo de foco registrado a cada dia.'));
    var chart = ui.el('div', 'week-chart');
    var values = [];
    for (var i = 6; i >= 0; i -= 1) {
      var day = time.daysAgo(i);
      values.push({ day: day, seconds: sum(forDay(sessions, day)) });
    }
    var max = Math.max.apply(null, values.map(function (day) { return day.seconds; }).concat([1]));
    var weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    values.forEach(function (day) {
      var col = ui.el('div', 'chart-column');
      col.appendChild(ui.el('span', 'chart-value', time.formatDuration(day.seconds)));
      var track = ui.el('div', 'chart-track');
      var bar = ui.el('div', 'chart-bar');
      bar.style.height = (day.seconds / max * 100) + '%';
      track.appendChild(bar);
      col.appendChild(track);
      var date = new Date(day.day + 'T12:00:00');
      col.appendChild(ui.el('span', 'chart-label' + (day.day === time.today() ? ' is-today' : ''), weekdays[date.getDay()]));
      col.setAttribute('aria-label', time.formatDate(day.day) + ': ' + time.formatDuration(day.seconds));
      chart.appendChild(col);
    });
    card.appendChild(chart);
    if (!sum(sessions)) card.appendChild(ui.el('p', 'field-hint', 'Sua primeira sessão vai dar vida a este gráfico.'));
    return card;
  }
  function categoryChart(items, total) {
    var card = ui.el('article', 'card chart-card');
    card.appendChild(ui.el('h2', 'section-title', 'Onde seu foco acontece'));
    card.appendChild(ui.el('p', 'page-subtitle', 'Distribuição do tempo por categoria.'));
    if (!items.length) ui.empty(card, 'Um espaço para cada interesse', 'Escolha uma categoria ao começar sua primeira sessão.', 'chart');
    var visible = items.slice(0, 5);
    if (items.length > 5) visible.push({ name: 'Demais categorias', duration: sum(items.slice(5)) });
    visible.forEach(function (item) {
      var row = ui.el('div', 'category-row');
      var heading = ui.el('div', 'category-heading');
      heading.appendChild(ui.el('span', '', item.name));
      heading.appendChild(ui.el('span', '', time.formatDuration(item.duration) + ' · ' + Math.round(item.duration / total * 100) + '%'));
      var track = ui.el('div', 'category-track');
      var bar = ui.el('div', 'category-fill');
      bar.style.width = (item.duration / total * 100) + '%';
      track.appendChild(bar);
      row.appendChild(heading);
      row.appendChild(track);
      card.appendChild(row);
    });
    return card;
  }
  function render() {
    var sessions = Hub.state.get().sessions;
    var data = summarize(sessions);
    var root = document.getElementById('stats-content');
    ui.clear(root);
    var cards = ui.el('div', 'stats-grid');
    cards.appendChild(statCard('Tempo acumulado', time.formatDuration(data.total), 'Todo seu progresso', 'clock'));
    cards.appendChild(statCard('Últimos 7 dias', time.formatDuration(data.week), 'Incluindo hoje', 'chart'));
    cards.appendChild(statCard('Mês atual', time.formatDuration(data.month), 'Um dia de cada vez', 'history'));
    cards.appendChild(statCard('Maior sessão', time.formatDuration(data.longest), 'Seu maior tempo de foco', 'focus'));
    root.appendChild(cards);
    var charts = ui.el('div', 'chart-grid');
    charts.appendChild(weeklyChart(sessions));
    charts.appendChild(categoryChart(data.categories, data.total));
    root.appendChild(charts);
    var numbers = ui.el('article', 'card');
    numbers.appendChild(ui.el('h2', 'section-title', 'Seu ritmo em números'));
    var grid = ui.el('div', 'numbers-grid');
    [['Foco hoje', time.formatDuration(data.today)], ['Sessões', data.count], ['Média por sessão', time.formatDuration(data.average)],
      ['Sequência atual', data.streak + (data.streak === 1 ? ' dia' : ' dias')], ['Dias ativos', data.days], ['Categoria principal', data.category]]
      .forEach(function (item) {
        var box = ui.el('div', 'number-item');
        box.appendChild(ui.el('p', 'stat-label', item[0]));
        box.appendChild(ui.el('p', 'stat-value', item[1]));
        grid.appendChild(box);
      });
    numbers.appendChild(grid);
    root.appendChild(numbers);
  }
  Hub.stats = { sum: sum, forDay: forDay, inPeriod: inPeriod, summarize: summarize, streak: streak,
    statCard: statCard, render: render };
}(window.Hub));
