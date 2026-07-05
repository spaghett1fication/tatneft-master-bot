const tg = window.Telegram.WebApp;

tg.expand();
tg.ready();

const STORAGE_KEY = 'tatneft_reports';

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

function validatePlateNumber(value) {
    const cleaned = value.replace(/\s+/g, ' ').trim().toUpperCase();
    // Принимаем и русские (АВЕКМНОРСТУХ), и латинские (ABEKMHOPCTYX) буквы
    const pattern = /^[АВЕКМНОРСТУХABEKMHOPCTYX]\d{3}[АВЕКМНОРСТУХABEKMHOPCTYX]{2}\s?\d{2,3}$/;
    return pattern.test(cleaned);
}

document.getElementById('reportForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = {
        date: document.getElementById('date').value,
        masterName: document.getElementById('masterName').value.trim(),
        plateNumber: document.getElementById('plateNumber').value.trim(),
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

    if (reports.length === 0) {
        showStatus('Нет данных для экспорта', 'error');
        return;
    }

    // Создаем CSV содержимое
    let csvContent = '﻿'; // BOM для корректного отображения кириллицы в Excel

    // Заголовки
    csvContent += 'Дата;Объект;Мастер;Событие;АвтоМ;АвтоН;Мер;ВремДу;ДенДу;ФиоДу\n';

    // Данные
    reports.forEach(report => {
        const row = [
            report.date,
            report.object,
            report.masterName,
            report.workType,
            report.plateNumber,
            '', // АвтоН (пусто)
            '', // Мер (пусто)
            report.hours,
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
