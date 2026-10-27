const API_URL = 'http://localhost:3000/api';
let connectionMode = 'Ninguna';
let allFiles = [];
let currentSelectedFile = null;
let currentDecryptedFile = null;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Variables para mantener el estado del filtro en cada pantalla
let currentFilterFiles = 'all';
let currentFilterPins = 'all';

function showSection(id) {
    document.querySelectorAll('.section').forEach(el => el.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    
    if(id === 'files') { 
        document.getElementById('searchFiles').value = '';
        currentFilterFiles = 'all';
        loadFiles('file-list'); 
    }
    if(id === 'pins-menu') { 
        document.getElementById('searchPins').value = '';
        currentFilterPins = 'all';
        loadFiles('pin-file-list'); 
        document.getElementById('pin-changer').classList.add('hidden'); 
    }
}

function toggleConnection() {
    connectionMode = connectionMode === 'Ninguna' ? 'WIFI' : (connectionMode === 'WIFI' ? 'USB-C' : 'Ninguna');
    document.getElementById('conn-mode-text').innerText = `(${connectionMode})`;
    const statusEl = document.getElementById('conn-status');
    statusEl.innerHTML = `Estado: <span style="color:${connectionMode!=='Ninguna'?'#4ade80':'#6b7280'}">${connectionMode!=='Ninguna'?'Conectado':'Desconectado'}</span>`;
    if(connectionMode !== 'Ninguna') fetchDeviceStatus();
}

async function fetchDeviceStatus() {
    try {
        const res = await fetch(`${API_URL}/status`);
        const data = await res.json();
        document.getElementById('battery-status').innerText = `Batería: ${data.battery}`;
        let used = data.storage.used_capacity;
        let displayUsed = used < 1024 * 1024 ? (used/1024).toFixed(2) + ' KB' : (used/(1024*1024)).toFixed(2) + ' MB';
        document.getElementById('storage-status').innerText = `Almacenamiento: ${displayUsed} / 16GB`;
    } catch (e) { console.error("No hay conexión con ESP32"); }
}

async function transferFile() {
    if(connectionMode === 'Ninguna') return alert("Conecta el dispositivo (WIFI o USB).");
    const fileInput = document.getElementById('fileInput').files[0];
    const pin = document.getElementById('filePin').value;
    if(!fileInput || !pin) return alert("Faltan datos");
    
    const btn = document.querySelector('#transfer .submit-btn');
    btn.innerText = "Procesando...";
    const reader = new FileReader();
    reader.onload = async (e) => {
        const encrypted = CryptoJS.AES.encrypt(e.target.result, pin).toString();
        await fetch(`${API_URL}/transfer`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: fileInput.name, fileType: fileInput.type, content: encrypted, pin: pin, size: new Blob([encrypted]).size, mode: connectionMode })
        });
        alert("Archivo Asegurado.");
        btn.innerText = "Encriptar y Transferir";
        document.getElementById('fileInput').value = ""; document.getElementById('filePin').value = "";
        fetchDeviceStatus();
    };
    reader.readAsDataURL(fileInput);
}

async function loadFiles(targetListId) {
    if(connectionMode === 'Ninguna') return alert("Dispositivo desconectado.");
    const res = await fetch(`${API_URL}/files`);
    allFiles = await res.json();
    renderFiles('all', targetListId);
}

// NUEVO: Filtro combinado (Tipo de archivo + Búsqueda por Nombre)
function renderFiles(filterType, targetListId) {
    if (targetListId === 'file-list') currentFilterFiles = filterType;
    if (targetListId === 'pin-file-list') currentFilterPins = filterType;
    
    const list = document.getElementById(targetListId);
    list.innerHTML = '';
    
    // Obtener texto de búsqueda según la vista activa
    const searchInput = targetListId === 'file-list' 
        ? document.getElementById('searchFiles').value.toLowerCase() 
        : document.getElementById('searchPins').value.toLowerCase();
    
    let filtered = allFiles.filter(f => {
        // Validación de Nombre
        const matchName = f.file_name.toLowerCase().includes(searchInput);
        
        // Validación de Categoría
        let matchType = false;
        if(filterType === 'all') matchType = true;
        else if(filterType === 'image') matchType = f.file_type.startsWith('image/');
        else if(filterType === 'video') matchType = f.file_type.startsWith('video/');
        else if(filterType === 'document') matchType = f.file_type.includes('pdf') || f.file_type.includes('document') || f.file_type.includes('text') || f.file_type.includes('msword') || f.file_type.includes('sheet');
        
        return matchName && matchType;
    });
    
    filtered.forEach(f => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `🔒 <strong>${f.file_name}</strong> <span>${(f.file_size/1024).toFixed(1)} KB</span>`;
        div.onclick = () => {
            currentSelectedFile = f.file_id;
            if(targetListId === 'file-list') {
                document.getElementById('file-reader').classList.remove('hidden');
            } else {
                document.getElementById('pin-changer').classList.remove('hidden');
            }
        };
        list.appendChild(div);
    });
}

async function readFile() {
    const pin = document.getElementById('readPin').value;
    const res = await fetch(`${API_URL}/read-file`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: currentSelectedFile, pin: pin })
    });
    const data = await res.json();
    if(data.success) {
        try {
            const bytes = CryptoJS.AES.decrypt(data.file.encrypted_content, pin);
            const decryptedBase64 = bytes.toString(CryptoJS.enc.Utf8);
            if(!decryptedBase64) throw new Error();
            currentDecryptedFile = { name: data.file.file_name, type: data.file.file_type, dataUrl: decryptedBase64 };
            showPreview(currentDecryptedFile);
        } catch(e) { alert("PIN Incorrecto."); }
    } else { alert("PIN Incorrecto."); }
}

async function changePin() {
    const oldPin = document.getElementById('oldPin').value;
    const newPin = document.getElementById('newPin').value;
    if(!oldPin || !newPin) return alert("Ingresa ambos PINs");

    const res = await fetch(`${API_URL}/read-file`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: currentSelectedFile, pin: oldPin })
    });
    const data = await res.json();
    
    if(data.success) {
        try {
            const bytes = CryptoJS.AES.decrypt(data.file.encrypted_content, oldPin);
            const rawData = bytes.toString(CryptoJS.enc.Utf8);
            if(!rawData) throw new Error();
            const newEncrypted = CryptoJS.AES.encrypt(rawData, newPin).toString();
            await fetch(`${API_URL}/files/${currentSelectedFile}/pin`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ new_pin: newPin, new_content: newEncrypted, new_size: new Blob([newEncrypted]).size })
            });
            alert("PIN actualizado.");
            document.getElementById('oldPin').value = ''; document.getElementById('newPin').value = '';
            document.getElementById('pin-changer').classList.add('hidden');
        } catch(e) { alert("PIN actual incorrecto."); }
    } else { alert("PIN actual incorrecto."); }
}

async function formatDevice() {
    if(connectionMode === 'Ninguna') return alert("Conecta el dispositivo primero.");
    
    const secretPrompt = prompt("🔒 Introduce la contraseña super secreta para autorizar el formateo:");
    if(!secretPrompt) return; 

    // Encripta lo que el usuario ingresa
    const inputHash = CryptoJS.SHA256(secretPrompt).toString();
    
    // Genera el hash real exacto de la contraseña secreta
    const targetHash = CryptoJS.SHA256("951490227973720404").toString(); 

    if(inputHash !== targetHash) {
        return alert("❌ Contraseña secreta incorrecta. Operación bloqueada.");
    }

    if(confirm("⚠️ ¿Estás totalmente seguro? Esto eliminará todos los archivos en la SD de forma irrecuperable.")) {
        await fetch(`${API_URL}/format`, { method: 'DELETE' });
        alert("✅ Dispositivo formateado con éxito."); 
        fetchDeviceStatus();
        showSection('main-menu');
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
}

// Utilidades
function showPreview(file) {
    document.getElementById('files').classList.add('hidden');
    document.getElementById('preview-modal').classList.remove('hidden');
    const container = document.getElementById('preview-container');
    if(file.type.startsWith('image/')) container.innerHTML = `<img src="${file.dataUrl}" alt="Preview">`;
    else if(file.type === 'application/pdf') container.innerHTML = `<iframe src="${file.dataUrl}" width="100%" height="300px"></iframe>`;
    else if(file.type.startsWith('video/')) container.innerHTML = `<video src="${file.dataUrl}" controls width="100%"></video>`;
    else container.innerHTML = `<p style="padding: 20px;">📄 Formato no previsualizable.</p>`;
}

function closePreview() {
    document.getElementById('preview-modal').classList.add('hidden');
    document.getElementById('files').classList.remove('hidden');
    document.getElementById('readPin').value = ''; document.getElementById('file-reader').classList.add('hidden');
}

function triggerDownload() {
    const a = document.createElement("a"); a.href = currentDecryptedFile.dataUrl; a.download = currentDecryptedFile.name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}
function copyFile() { triggerDownload(); }
async function deleteFile() {
    if(confirm("¿Eliminar archivo?")) {
        await fetch(`${API_URL}/files/${currentSelectedFile}`, { method: 'DELETE' });
        alert("Archivo eliminado."); fetchDeviceStatus(); closePreview(); loadFiles('file-list');
    }
}
async function cutFile() { triggerDownload(); await deleteFile(); }

async function activateBuzzer() {
    if(connectionMode === 'Ninguna') return alert("Dispositivo desconectado.");
    await fetch(`${API_URL}/buzzer`, { method: 'POST' });
    const oscillator = audioCtx.createOscillator(); const gainNode = audioCtx.createGain();
    oscillator.type = 'square'; oscillator.frequency.setValueAtTime(2500, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime); gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(1, audioCtx.currentTime + 0.2); gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 0.3);
    oscillator.connect(gainNode); gainNode.connect(audioCtx.destination);
    oscillator.start(); oscillator.stop(audioCtx.currentTime + 0.4);
}