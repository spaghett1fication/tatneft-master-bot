const tg = window.Telegram.WebApp;

tg.expand();
tg.ready();

const STORAGE_KEY = 'tatneft_reports';
const MASTERS_KEY = 'tatneft_masters_history';

function loadReports() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        console.error('Ошибка загрузки данных:', e);
        return [];
    }
}

function saveReports(reports) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
        return true;
    } catch (e) {
        console.error('Ошибка сохранения данных:', e);
        return false;
    }
}

function showStatus(message, type = 'success') {
    const existingStatus = document.querySelector('.status-message');
    if (existingStatus) {
        existingStatus.remove();
    }

    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message status-${type}`;
    statusDiv.textContent = message;

    const container = document.querySelector('.container');
    container.insertBefore(statusDiv, container.firstChild);

    setTimeout(() => statusDiv.remove(), 3000);
}

function renderReports() {
    const reports = loadReports();
    const reportsList = document.getElementById('reportsList');
    const reportCount = document.getElementById('reportCount');

    reportCount.textContent = reports.length;

    if (reports.length === 0) {
        reportsList.innerHTML = '<p style="color: #888; text-align: center;">Нет сохраненных отчетов</p>';
        return;
    }

    reportsList.innerHTML = reports.map((report, index) => `
        <div class="report-item">
            <strong>${report.date} - ${report.masterName}</strong>
            <div>Гос. номер: ${report.plateNumber}</div>
            <div>Часы: ${report.hours}</div>
            <div>Объект: ${report.object}</div>
            <div>Работы: ${report.workType}</div>
            <small>Сохранено: ${new Date(report.timestamp).toLocaleString('ru-RU')}</small>
        </div>
    `).join('');
}

// Автоматическая нормализация ФИО
function capitalizeName(name) {
    return name
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Нормализация гос. номера: латиница -> кириллица, верхний регистр
function normalizePlateNumber(value) {
    const latinToCyrillic = {
        'A': 'А', 'B': 'В', 'E': 'Е', 'K': 'К', 'M': 'М',
        'H': 'Н', 'O': 'О', 'P': 'Р', 'C': 'С', 'T': 'Т',
        'Y': 'У', 'X': 'Х',
        'a': 'А', 'b': 'В', 'e': 'Е', 'k': 'К', 'm': 'М',
        'h': 'Н', 'o': 'О', 'p': 'Р', 'c': 'С', 't': 'Т',
        'y': 'У', 'x': 'Х'
    };

    let normalized = value
        .split('')
        .map(char => latinToCyrillic[char] || char)
        .join('')
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .trim();

    return normalized;
}

function validatePlateNumber(value) {
    if (!value || value.trim().length === 0) return false;

    const cleaned = normalizePlateNumber(value);
    // Упрощенная проверка: буква, цифры, буквы, пробел, цифры
    // Принимаем больше вариантов форматов
    const pattern = /^[А-ЯЁ]\d{3}[А-ЯЁ]{2}\s?\d{2,3}$/;
    return pattern.test(cleaned);
}

// Расстояние Левенштейна для проверки похожести строк
function levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[str2.length][str1.length];
}

// Поиск похожих имён
function findSimilarNames(input, history) {
    const inputLower = input.toLowerCase();
    const similar = [];

    history.forEach(name => {
        const nameLower = name.toLowerCase();
        const distance = levenshteinDistance(inputLower, nameLower);
        const maxLen = Math.max(inputLower.length, nameLower.length);
        const similarity = 1 - (distance / maxLen);

        // Если похожесть > 70% и это не точное совпадение
        if (similarity > 0.7 && inputLower !== nameLower) {
            similar.push({ name, similarity });
        }
    });

    return similar.sort((a, b) => b.similarity - a.similarity);
}

// Получить историю мастеров
function getMastersHistory() {
    try {
        const data = localStorage.getItem(MASTERS_KEY);
        return data ? JSON.parse(data) : [];
    } catch (e) {
        return [];
    }
}

// Сохранить мастера в историю
function saveMasterToHistory(masterName) {
    const history = getMastersHistory();

    // Удаляем если уже есть (чтобы переместить в начало)
    const filtered = history.filter(name => name.toLowerCase() !== masterName.toLowerCase());

    // Добавляем в начало
    filtered.unshift(masterName);

    // Храним только последние 20 мастеров
    const updated = filtered.slice(0, 20);

    try {
        localStorage.setItem(MASTERS_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('Ошибка сохранения истории:', e);
    }
}

document.getElementById('reportForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const masterNameInput = document.getElementById('masterName');
    const plateNumberInput = document.getElementById('plateNumber');

    // Нормализация ФИО
    const normalizedName = capitalizeName(masterNameInput.value);
    masterNameInput.value = normalizedName;

    // Нормализация гос. номера
    const normalizedPlate = normalizePlateNumber(plateNumberInput.value);
    plateNumberInput.value = normalizedPlate;

    const formData = {
        date: document.getElementById('date').value,
        masterName: normalizedName,
        plateNumber: normalizedPlate,
        hours: parseFloat(document.getElementById('hours').value),
        object: document.getElementById('object').value,
        workType: document.getElementById('workType').value,
        timestamp: new Date().toISOString()
    };

    if (!validatePlateNumber(formData.plateNumber)) {
        console.log('Введенный номер:', formData.plateNumber);
        console.log('Коды символов:', [...formData.plateNumber].map(c => c.charCodeAt(0)));
        showStatus('Неправильный формат гос. номера! Пример: А123БВ 116', 'error');
        return;
    }

    if (formData.hours < 0 || formData.hours > 24) {
        showStatus('Часы должны быть от 0 до 24', 'error');
        return;
    }

    const reports = loadReports();
    reports.push(formData);

    if (saveReports(reports)) {
        // Сохраняем мастера в историю
        saveMasterToHistory(formData.masterName);

        showStatus('✓ Отчет сохранен локально', 'success');

        this.reset();
        document.getElementById('date').value = new Date().toISOString().split('T')[0];

        renderReports();

        tg.HapticFeedback.notificationOccurred('success');
    } else {
        showStatus('Ошибка сохранения отчета', 'error');
        tg.HapticFeedback.notificationOccurred('error');
    }
});

function exportToExcel() {
    const reports = loadReports();

    if (!reports || reports.length === 0) {
        showStatus('Нет данных для экспорта', 'error');
        tg.HapticFeedback.notificationOccurred('error');
        return;
    }

    // Создаем CSV содержимое
    let csvContent = '﻿'; // BOM для корректного отображения кириллицы в Excel

    // Заголовки
    csvContent += 'Дата;Объект;Мастер;Событие;АвтоМ;АвтоН;Мер;ВремДу;ДенДу;ФиоДу\n';

    // Данные
    reports.forEach(report => {
        const row = [
            report.date || '',
            report.object || '',
            report.masterName || '',
            report.workType || '',
            report.plateNumber || '',
            '', // АвтоН (пусто)
            '', // Мер (пусто)
            report.hours || 0,
            '', // ДенДу (пусто)
            '' // ФиоДу (пусто)
        ];
        csvContent += row.join(';') + '\n';
    });

    // Создаем Blob и скачиваем
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    // Фиксированное имя файла для перезаписи
    const fileName = 'tatneft_reports.csv';

    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, fileName);
    } else {
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    showStatus('✓ Файл выгружен: ' + fileName, 'success');
    tg.HapticFeedback.notificationOccurred('success');
}

document.getElementById('exportBtn').addEventListener('click', exportToExcel);

document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('Удалить все сохраненные отчеты?')) {
        localStorage.removeItem(STORAGE_KEY);
        renderReports();
        showStatus('Все отчеты удалены', 'success');
    }
});

document.getElementById('date').value = new Date().toISOString().split('T')[0];

// Автодополнение и проверка опечаток для ФИО
const masterNameInput = document.getElementById('masterName');
const masterSuggestions = document.getElementById('masterSuggestions');

// Обновление автодополнения при вводе
masterNameInput.addEventListener('input', function() {
    const history = getMastersHistory();
    const value = this.value.toLowerCase();

    // Очищаем список подсказок
    masterSuggestions.innerHTML = '';

    if (value.length < 2) return;

    // Фильтруем историю по началу ввода
    const matches = history.filter(name =>
        name.toLowerCase().startsWith(value)
    ).slice(0, 5);

    matches.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        masterSuggestions.appendChild(option);
    });
});

// Автокапитализация при вводе
masterNameInput.addEventListener('blur', function() {
    if (this.value.trim()) {
        this.value = capitalizeName(this.value);

        // Проверка на опечатки
        const history = getMastersHistory();
        if (history.length > 0) {
            const similar = findSimilarNames(this.value, history);

            if (similar.length > 0 && similar[0].similarity > 0.75) {
                const suggestion = similar[0].name;

                // Показываем ненавязчивую подсказку
                const existingHint = document.querySelector('.name-hint');
                if (existingHint) existingHint.remove();

                const hint = document.createElement('small');
                hint.className = 'name-hint';
                hint.style.color = '#ff9500';
                hint.style.cursor = 'pointer';
                hint.textContent = `Возможно вы имели в виду: ${suggestion}?`;
                hint.onclick = () => {
                    masterNameInput.value = suggestion;
                    hint.remove();
                };

                masterNameInput.parentElement.appendChild(hint);

                setTimeout(() => hint.remove(), 5000);
            }
        }
    }
});

// Автонормализация гос. номера при вводе
const plateNumberInput = document.getElementById('plateNumber');

plateNumberInput.addEventListener('input', function() {
    const cursorPos = this.selectionStart;
    const oldValue = this.value;
    const normalized = normalizePlateNumber(oldValue);

    if (normalized !== oldValue) {
        this.value = normalized;
        // Сохраняем позицию курсора
        this.setSelectionRange(cursorPos, cursorPos);
    }
});

window.addEventListener('online', function() {
    showStatus('✓ Связь восстановлена', 'success');
});

window.addEventListener('offline', function() {
    showStatus('⚠ Нет связи. Данные сохраняются локально', 'offline');
});

renderReports();

if (!navigator.onLine) {
    showStatus('⚠ Нет связи. Работаем в офлайн-режиме', 'offline');
}
