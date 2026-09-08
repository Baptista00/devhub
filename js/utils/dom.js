(function (Hub) {
  'use strict';
  var currentModal = null;
  var iconPaths = {
    dashboard: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
    focus: 'M12 3a9 9 0 1 0 9 9 M12 7a5 5 0 1 0 5 5 M12 12l8-8 M16 4h4v4',
    check: 'M9 5h11 M9 12h11 M9 19h11 M3 5l1 1 2-2 M3 12l1 1 2-2 M3 19l1 1 2-2',
    history: 'M3 10a9 9 0 1 1 1 7 M3 4v6h6 M12 7v5l3 2',
    chart: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
    notes: 'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5',
    settings: 'M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6',
    play: 'M8 4l12 8-12 8z', pause: 'M8 5v14 M16 5v14',
    plus: 'M12 5v14 M5 12h14', edit: 'M4 16L16 4l4 4L8 20H4z M13 7l4 4',
    external: 'M14 3h7v7 M21 3L10 14 M10 3H4v17h17v-6',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l3 2',
    streak: 'M13 3c1 5-4 6-3 10 1-1 2-2 3-2 4 4 2 10-2 10-7 0-10-9-5-13 0 3 1 4 2 4 0-4 2-7 5-9z',
    arrow: 'M19 12H5 M11 6l-6 6 6 6', close: 'M6 6l12 12 M6 18L18 6',
    trash: 'M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',
    code: 'M8 6l-6 6 6 6 M16 6l6 6-6 6 M14 3l-4 18'
  };
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function icon(name) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'icon');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.6');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', iconPaths[name] || iconPaths.code);
    svg.appendChild(path);
    return svg;
  }
  function button(text, className, callback) {
    var node = el('button', className || 'btn btn-secondary', text);
    node.type = 'button';
    if (callback) node.addEventListener('click', callback);
    return node;
  }
  function text(id, value) {
    var node = document.getElementById(id);
    if (node && node.textContent !== String(value)) node.textContent = String(value);
  }
  function empty(container, title, copy, iconName) {
    var box = el('div', 'empty-state');
    var mark = el('div', 'empty-icon');
    mark.appendChild(icon(iconName || 'focus'));
    box.appendChild(mark);
    box.appendChild(el('p', 'empty-title', title));
    box.appendChild(el('p', 'empty-copy', copy));
    container.appendChild(box);
  }
  function toast(message, kind) {
    var container = document.getElementById('toast-container');
    var item = el('div', 'toast' + (kind === 'error' ? ' toast-error' : ''), message);
    while (container.children.length > 2) container.removeChild(container.firstChild);
    container.appendChild(item);
    window.setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 4500);
  }
  function modal(options) {
    if (currentModal) currentModal.close();
    var previousFocus = document.activeElement;
    var shell = document.getElementById('app-shell');
    var overlay = el('div', 'modal-overlay');
    var panel = el('section', 'modal-panel');
    var header = el('div', 'modal-header');
    var title = el('h2', 'modal-title', options.title);
    var form = el('form', 'modal-form');
    var content = el('div', 'modal-content');
    var actions = el('div', 'modal-actions');
    var closed = false;
    title.id = 'modal-title';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', title.id);
    panel.tabIndex = -1;
    function close() {
      if (closed) return;
      closed = true;
      document.removeEventListener('keydown', onKey);
      overlay.parentNode.removeChild(overlay);
      shell.removeAttribute('aria-hidden');
      document.body.classList.remove('modal-open');
      currentModal = null;
      if (options.onClose) options.onClose();
      if (previousFocus && document.documentElement.contains(previousFocus)) previousFocus.focus();
      else document.getElementById('main-content').focus();
    }
    var closeButton = button('', 'icon-btn modal-close', close);
    closeButton.setAttribute('aria-label', 'Fechar modal');
    closeButton.appendChild(icon('close'));
    header.appendChild(title);
    header.appendChild(closeButton);
    panel.appendChild(header);
    if (options.description) {
      var description = el('p', 'modal-description', options.description);
      description.id = 'modal-description';
      panel.setAttribute('aria-describedby', description.id);
      panel.appendChild(description);
    }
    if (options.content) content.appendChild(options.content);
    form.appendChild(content);
    actions.appendChild(button(options.onSubmit ? 'Cancelar' : 'Fechar', 'btn btn-secondary', close));
    if (options.onSubmit) {
      var submit = el('button', 'btn ' + (options.danger ? 'btn-danger' : 'btn-primary'), options.submitLabel || 'Salvar');
      submit.type = 'submit';
      actions.appendChild(submit);
    }
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!options.onSubmit) return;
      try { if (options.onSubmit(form) !== false) close(); }
      catch (error) { toast(error.message || 'Não foi possível concluir esta ação.', 'error'); }
    });
    form.appendChild(actions);
    panel.appendChild(form);
    overlay.appendChild(panel);
    // Dismiss only view/confirmation dialogs outside. Forms keep unsaved input.
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay && !options.content) close();
    });
    function onKey(event) {
      if (event.key === 'Escape' || event.keyCode === 27) { event.preventDefault(); close(); }
      if (event.key !== 'Tab' && event.keyCode !== 9) return;
      var nodes = panel.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea, select, a[href]');
      var first = nodes[0];
      var last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    shell.setAttribute('aria-hidden', 'true');
    var input = content.querySelector('input:not([type="hidden"]), textarea, select');
    (input || closeButton).focus();
    currentModal = { close: close };
    return currentModal;
  }
  function confirm(options) {
    return modal({ title: options.title, description: options.message, danger: options.danger,
      submitLabel: options.confirmLabel || 'Confirmar', onSubmit: options.onConfirm });
  }
  Hub.ui = { el: el, clear: clear, icon: icon, button: button, text: text, empty: empty,
    toast: toast, modal: modal, confirm: confirm };
}(window.Hub));
