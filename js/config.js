(function (window) {
    'use strict';

    var Hub = window.Hub = window.Hub || {};

    Hub.config = {
        version: 1,
        categories: ['JavaScript', 'Faculdade', 'Projeto', 'Estudos', 'Leitura', 'Outro'],
        defaults: {
            userName: 'Lucas',
            dailyGoalMinutes: 180,
            pomodoroFocusMinutes: 25,
            pomodoroBreakMinutes: 5
        },
        shortcuts: [
            { name: 'GitHub', url: 'https://github.com/', icon: 'GH' },
            { name: 'ChatGPT', url: 'https://chatgpt.com/', icon: 'AI' },
            { name: 'MDN', url: 'https://developer.mozilla.org/', icon: 'MD' },
            { name: 'Projetos', url: '', icon: 'PR' },
            { name: 'UNIFEBE', url: '', icon: 'UF' }
        ]
    };
}(window));
