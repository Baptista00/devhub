(function (window) {
    'use strict';

    var Hub = window.Hub;
    var weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    var months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    var idCounter = 0;

    function pad(value) {
        return value < 10 ? '0' + value : String(value);
    }

    function dateFrom(value) {
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            var parts = value.split('-');
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12);
        }
        return value === undefined ? new Date() : new Date(value);
    }

    function dayKey(value) {
        var date = dateFrom(value);
        if (!isFinite(date.getTime())) { return ''; }
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function offsetDay(key, offset) {
        var date = dateFrom(key);
        date.setDate(date.getDate() + offset);
        return dayKey(date.getTime());
    }

    function wholeSeconds(value) {
        return typeof value === 'number' && isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    }

    function formatClock(value) {
        var seconds = wholeSeconds(value);
        return pad(Math.floor(seconds / 3600)) + ':' + pad(Math.floor(seconds / 60) % 60) + ':' + pad(seconds % 60);
    }

    function formatDuration(value) {
        var seconds = wholeSeconds(value);
        var hours = Math.floor(seconds / 3600);
        var minutes = Math.floor(seconds / 60) % 60;
        if (hours) { return hours + 'h' + (minutes ? ' ' + pad(minutes) + 'min' : ''); }
        if (minutes) { return minutes + 'min'; }
        return seconds ? seconds + 's' : '0min';
    }

    function formatDate(value) {
        var date = dateFrom(value);
        if (!isFinite(date.getTime())) { return 'Data indisponível'; }
        return weekdays[date.getDay()] + ', ' + date.getDate() + ' de ' + months[date.getMonth()];
    }

    function formatTime(value) {
        var date = dateFrom(value);
        return isFinite(date.getTime()) ? pad(date.getHours()) + ':' + pad(date.getMinutes()) : '--:--';
    }

    function greeting() {
        var hour = new Date().getHours();
        return hour < 12 ? 'Bom dia' : (hour < 18 ? 'Boa tarde' : 'Boa noite');
    }

    function newId() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        idCounter += 1;
        return Date.now().toString(36) + '-' + idCounter.toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    }

    Hub.time = {
        dayKey: dayKey,
        today: function () { return dayKey(); },
        offsetDay: offsetDay,
        daysAgo: function (count) { return offsetDay(dayKey(), -count); },
        formatDuration: formatDuration,
        formatClock: formatClock,
        formatDate: formatDate,
        formatTime: formatTime,
        greeting: greeting,
        newId: newId
    };
}(window));
