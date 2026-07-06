const tg = window.Telegram.WebApp;

tg.expand();
tg.ready();

const STORAGE_KEY = 'tatneft_reports';
const MASTERS_KEY = 'tatneft_masters_history';

// Получаем ID текущего пользователя Telegram
const currentUserId = tg.initDataUnsafe?.user?.id || 'demo_user';
const currentUserName = tg.initDataUnsafe?.user?.first_name || 'Демо';

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
        // Добавляем userId к каждому отчету
        const reportsWithUser = reports.map(report => ({
            ...report,
            userId: report.userId || currentUserId
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reportsWithUser));
        return true;
    } catch (e) {
        console.error('Ошибка сохранения данных:', e);
        return false;
    }
}

// Получить только отчеты текущего пользователя
function getMyReports() {
    const allReports = loadReports();

    // Если нет userId у отчетов (старые данные) - показываем все и присваиваем текущему пользователю
    const hasUserId = allReports.some(report => report.userId);

    if (!hasUserId && allReports.length > 0) {
        // Миграция: присваиваем все старые отчеты текущему пользователю
        const migratedReports = allReports.map(report => ({
            ...report,
            userId: currentUserId
        }));
        saveReports(migratedReports);
        return migratedReports;
    }

    return allReports.filter(report => report.userId === currentUserId);
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
    const myReports = getMyReports(); // Только свои отчеты
    const reportsList = document.getElementById('reportsList');
    const reportCount = document.getElementById('reportCount');

    reportCount.textContent = myReports.length;

    if (myReports.length === 0) {
        reportsList.innerHTML = '<p style="color: #888; text-align: center;">Нет сохраненных отчетов</p>';
        return;
    }

    reportsList.innerHTML = myReports.map((report, index) => `
        <div class="report-item" onclick="editReport(${index})">
            <strong>${report.date} - ${report.masterName}</strong>
            <div>Гос. номер: ${report.plateNumber}</div>
            <div>Часы: ${report.hours}</div>
            <div>Объект: ${report.object}</div>
            <div>Работы: ${report.workType}</div>
            <small>Сохранено: ${new Date(report.timestamp).toLocaleString('ru-RU')}</small>
            <div class="report-actions">
                <button class="btn-edit" onclick="event.stopPropagation(); editReport(${index})">✏️ Редактировать</button>
                <button class="btn-delete" onclick="event.stopPropagation(); deleteReport(${index})">🗑️ Удалить</button>
            </div>
        </div>
    `).join('');
}

// Редактирование отчета
function editReport(index) {
    const myReports = getMyReports();
    const report = myReports[index];

    if (!report) return;

    // Заполняем форму данными из отчета
    document.getElementById('date').value = report.date;
    document.getElementById('masterName').value = report.masterName;
    document.getElementById('plateNumber').value = report.plateNumber;
    document.getElementById('hours').value = report.hours;
    document.getElementById('object').value = report.object;
    document.getElementById('workType').value = report.workType;

    // Прокручиваем к форме
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Сохраняем индекс редактируемого отчета
    const form = document.getElementById('reportForm');
    form.dataset.editIndex = index;
    form.dataset.editTimestamp = report.timestamp;

    // Меняем текст кнопки
    const submitBtn = form.querySelector('.btn-submit');
    submitBtn.textContent = '💾 Сохранить изменения';
    submitBtn.style.background = '#ff9500';

    showStatus('📝 Режим редактирования', 'success');
    tg.HapticFeedback.impactOccurred('light');
}

// Удаление отчета
function deleteReport(index) {
    if (!confirm('Удалить этот отчет?')) return;

    const allReports = loadReports();
    const myReports = getMyReports();
    const reportToDelete = myReports[index];

    // Находим индекс в общем массиве
    const globalIndex = allReports.findIndex(r => r.timestamp === reportToDelete.timestamp);

    if (globalIndex !== -1) {
        allReports.splice(globalIndex, 1);
        saveReports(allReports);
        renderReports();
        showStatus('✓ Отчет удален', 'success');
        tg.HapticFeedback.notificationOccurred('success');
    }
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
        userId: currentUserId
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

    const allReports = loadReports();

    // Проверяем режим редактирования
    const isEditMode = this.dataset.editIndex !== undefined;

    if (isEditMode) {
        // Режим редактирования
        const myReports = getMyReports();
        const editIndex = parseInt(this.dataset.editIndex);
        const oldReport = myReports[editIndex];

        // Находим в общем массиве и обновляем
        const globalIndex = allReports.findIndex(r => r.timestamp === oldReport.timestamp);

        if (globalIndex !== -1) {
            formData.timestamp = oldReport.timestamp; // Сохраняем старый timestamp
            allReports[globalIndex] = formData;
        }

        // Сбрасываем режим редактирования
        delete this.dataset.editIndex;
        delete this.dataset.editTimestamp;

        const submitBtn = this.querySelector('.btn-submit');
        submitBtn.textContent = 'Отправить отчет';
        submitBtn.style.background = '';

        showStatus('✓ Отчет обновлен', 'success');
    } else {
        // Режим создания нового отчета
        formData.timestamp = new Date().toISOString();
        allReports.push(formData);
        showStatus('✓ Отчет сохранен локально', 'success');
    }

    if (saveReports(allReports)) {
        // Сохраняем мастера в историю
        saveMasterToHistory(formData.masterName);

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
    const myReports = getMyReports(); // Только свои отчеты

    if (!myReports || myReports.length === 0) {
        showStatus('Нет данных для экспорта', 'error');
        tg.HapticFeedback.notificationOccurred('error');
        return;
    }

    // Создаем CSV содержимое с расширенным набором полей
    let csvContent = '﻿'; // BOM для корректного отображения кириллицы в Excel

    // Заголовки (можно легко добавить/убрать столбцы завтра)
    const headers = [
        'Дата',
        'ФИО мастера',
        'Объект',
        'Вид работ',
        'Гос. номер',
        'Часы работы',
        'Марка авто',
        'Номер водителя',
        'Мерзлотчик',
        'Время работы ДУ',
        'День работы ДУ',
        'ФИО водителя ДУ',
        'Примечание',
        'Время создания отчета'
    ];

    csvContent += headers.join(';') + '\n';

    // Данные
    myReports.forEach(report => {
        const row = [
            report.date || '',
            report.masterName || '',
            report.object || '',
            report.workType || '',
            report.plateNumber || '',
            report.hours || '',
            report.carBrand || '', // Пока пусто, добавим завтра
            report.driverPhone || '', // Пока пусто
            report.merzlotchik || '', // Пока пусто
            report.duTime || '', // Пока пусто
            report.duDay || '', // Пока пусто
            report.duDriver || '', // Пока пусто
            report.note || '', // Пока пусто
            new Date(report.timestamp).toLocaleString('ru-RU')
        ];
        csvContent += row.join(';') + '\n';
    });

    // Проверяем, где запущено приложение
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // На телефоне - копируем в буфер обмена и показываем инструкцию
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(csvContent).then(() => {
                showMobileExportInstructions(myReports.length);
                tg.HapticFeedback.notificationOccurred('success');
            }).catch(() => {
                // Если не получилось скопировать - показываем текст для ручного копирования
                showManualCopyDialog(csvContent, myReports.length);
            });
        } else {
            // Старые браузеры - показываем текст
            showManualCopyDialog(csvContent, myReports.length);
        }
    } else {
        // На компьютере скачиваем напрямую
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');

        const fileName = `tatneft_reports_${new Date().toISOString().split('T')[0]}.csv`;

        if (navigator.msSaveBlob) {
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

        showStatus('✓ Файл скачан: ' + fileName, 'success');
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function showMobileExportInstructions(count) {
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `
        <div class="export-modal-content">
            <h3>✓ Данные скопированы!</h3>
            <p><strong>${count} отчет(ов)</strong> готовы к экспорту</p>
            <div class="export-instructions">
                <p><strong>Как сохранить:</strong></p>
                <ol>
                    <li>Откройте "Сохраненные сообщения" в Telegram</li>
                    <li>Вставьте текст (долгое нажатие → Вставить)</li>
                    <li>Отправьте сообщение</li>
                    <li>Скопируйте файл на компьютер</li>
                    <li>Откройте в Excel</li>
                </ol>
                <p style="font-size: 13px; color: var(--tg-theme-hint-color, #888); margin-top: 12px;">
                    💡 Все ${count} отчетов в одном файле
                </p>
            </div>
            <button class="modal-close-btn" onclick="this.parentElement.parentElement.remove()">
                Понятно
            </button>
        </div>
    `;
    document.body.appendChild(modal);
}

function showManualCopyDialog(csvContent, count) {
    const modal = document.createElement('div');
    modal.className = 'export-modal';
    modal.innerHTML = `
        <div class="export-modal-content">
            <h3>Экспорт данных (${count} отчетов)</h3>
            <p>Скопируйте текст ниже:</p>
            <textarea class="export-textarea" readonly>${csvContent}</textarea>
            <div class="export-instructions">
                <p><strong>Как сохранить:</strong></p>
                <ol>
                    <li>Скопируйте текст выше</li>
                    <li>Создайте файл .csv на компьютере</li>
                    <li>Вставьте текст в файл</li>
                    <li>Откройте в Excel</li>
                </ol>
            </div>
            <button class="modal-close-btn" onclick="this.parentElement.parentElement.remove()">
                Закрыть
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    // Автовыделение текста при клике
    const textarea = modal.querySelector('.export-textarea');
    textarea.onclick = function() {
        this.select();
        document.execCommand('copy');
        showStatus('✓ Текст скопирован', 'success');
    };
}

document.getElementById('exportBtn').addEventListener('click', exportToExcel);

document.getElementById('clearBtn').addEventListener('click', function() {
    if (confirm('Удалить все сохраненные отчеты?')) {
        localStorage.removeItem(STORAGE_KEY);
        renderReports();
        showStatus('Все отчеты удалены', 'success');
    }
});

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    // Устанавливаем текущую дату
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
});

// Также устанавливаем дату сразу (на случай если DOMContentLoaded уже прошел)
const dateInput = document.getElementById('date');
if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
}

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

// Автоматически устанавливаем текущую дату при загрузке и каждый день
function updateCurrentDate() {
    const dateInput = document.getElementById('date');
    const today = new Date().toISOString().split('T')[0];
    if (!dateInput.value || dateInput.value !== today) {
        dateInput.value = today;
    }
}

updateCurrentDate();

// Обновляем дату каждую минуту (на случай если приложение открыто долго)
setInterval(updateCurrentDate, 60000);
