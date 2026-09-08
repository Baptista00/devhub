(function (Hub) {
  'use strict';
  var currentView = 'dashboard';
  var day = Hub.time.today();
  var interval = null;
  var labels = { dashboard: 'Dashboard', focus: 'Foco', tasks: 'Tarefas', history: 'Histórico', stats: 'Estatísticas', notes: 'Notas', settings: 'Configurações' };
  var renderers = { dashboard: Hub.dashboard.render, focus: Hub.focus.render, tasks: Hub.tasks.render,
    history: Hub.history.render, stats: Hub.stats.render, notes: Hub.notes.render, settings: Hub.settings.render };
  function shell() {
    var state = Hub.state.get();
    document.getElementById('app-shell').classList.toggle('is-focus', currentView === 'focus' && !!state.activeSession);
    document.getElementById('active-indicator').hidden = !state.activeSession;
    Hub.ui.text('user-name', state.settings.userName);
    Hub.ui.text('user-avatar', state.settings.userName.slice(0, 1).toUpperCase());
    var warning = document.getElementById('storage-warning');
    var error = Hub.storage.getError();
    warning.hidden = !error;
    warning.textContent = error;
  }
  function showView(name, keepFocus) {
    if (!Object.prototype.hasOwnProperty.call(labels, name)) name = 'dashboard';
    currentView = name;
    Object.keys(labels).forEach(function (view) { document.getElementById('view-' + view).hidden = view !== name; });
    var buttons = document.querySelectorAll('.nav-item');
    Array.prototype.forEach.call(buttons, function (button) {
      var selected = button.getAttribute('data-view') === name;
      button.classList.toggle('is-active', selected);
      if (selected) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
    });
    Hub.ui.text('current-view-label', labels[name]);
    renderers[name]();
    shell();
    if (!keepFocus) {
      var heading = document.querySelector('#view-' + name + ' h1');
      if (heading) { heading.tabIndex = -1; heading.focus(); }
      window.scrollTo(0, 0);
    }
  }
  function onChange(section) {
    shell();
    if (section === 'notes') { if (currentView === 'notes') Hub.notes.render(); return; }
    if (section === 'activeSession') {
      if (currentView === 'focus') Hub.focus.render();
      if (currentView === 'dashboard') Hub.dashboard.render();
      return;
    }
    if (section === 'all' || section === 'settings' ||
        (section === 'tasks' && (currentView === 'dashboard' || currentView === 'tasks')) ||
        (section === 'sessions' && ['dashboard', 'history', 'stats'].indexOf(currentView) >= 0)) {
      renderers[currentView]();
    }
  }
  function clock() {
    var now = new Date();
    Hub.ui.text('header-clock', Hub.time.formatTime(now));
    Hub.ui.text('header-date', Hub.time.formatDate(now));
    Hub.ui.text('dashboard-title', Hub.time.greeting() + ', ' + Hub.state.get().settings.userName);
    if (day !== Hub.time.today()) {
      day = Hub.time.today();
      Hub.tasks.changeDay();
      renderers[currentView]();
    }
    var transition = Hub.timer.tick();
    if (transition) {
      Hub.focus.chime();
      Hub.ui.toast(transition === 'focusComplete' ? 'Foco concluído. Hora de descansar.' : 'Descanso concluído. Seu próximo ciclo está pronto.');
    }
    if (currentView === 'focus') Hub.focus.tick();
    if (currentView === 'dashboard') Hub.dashboard.tick();
  }
  function startClock() {
    if (interval !== null) window.clearInterval(interval);
    clock();
    interval = window.setInterval(clock, 1000);
  }
  function pwa() {
    // The app works independently of installation; local development stays uncached.
    var local = ['localhost', '127.0.0.1', '[::1]'].indexOf(location.hostname) >= 0;
    var testPwa = /(?:\?|&)pwa=1(?:&|$)/.test(location.search);
    if (!('serviceWorker' in navigator) || (local && !testPwa) || ['http:', 'https:'].indexOf(location.protocol) < 0) return;
    navigator.serviceWorker.register('service-worker.js').then(function (registration) {
      function updateAvailable() {
        Hub.ui.toast('Atualização disponível. Feche as abas do Hub e abra novamente para atualizar.');
      }
      if (registration.waiting) updateAvailable();
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) updateAvailable();
        });
      });
    }).catch(function () { Hub.ui.toast('Cache offline indisponível. O aplicativo continua funcionando online.', 'error'); });
  }
  function init() {
    Hub.state.init();
    Array.prototype.forEach.call(document.querySelectorAll('[data-icon]'), function (node) {
      node.appendChild(Hub.ui.icon(node.getAttribute('data-icon')));
      node.classList.add('icon-holder');
      node.setAttribute('aria-hidden', 'true');
    });
    document.addEventListener('click', function (event) {
      var target = event.target;
      while (target && target !== document) {
        if (target.getAttribute && target.getAttribute('data-view')) { showView(target.getAttribute('data-view')); return; }
        target = target.parentNode;
      }
    });
    document.querySelector('.brand').addEventListener('click', function (event) { event.preventDefault(); showView('dashboard'); });
    Hub.tasks.init();
    Hub.notes.init();
    Hub.settings.init();
    Hub.dashboard.init();
    Hub.state.subscribe(onChange);
    Hub.storage.onError(shell);
    showView('dashboard', true);
    startClock();
    document.addEventListener('visibilitychange', clock);
    window.addEventListener('pageshow', startClock);
    window.addEventListener('pagehide', function () { window.clearInterval(interval); interval = null; });
    pwa();
  }
  Hub.app = { showView: showView };
  init();
}(window.Hub));
