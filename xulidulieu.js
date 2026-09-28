// ==========================================
// CẤU HÌNH PROXY WORKER
// ==========================================
const PROXY_URL = 'https://lively-glade-ec31.lacvantieu95.workers.dev';

const video = document.getElementById('webcam');
const imagePreview = document.getElementById('image-preview');
const placeholder = document.getElementById('screen-placeholder');
const scanLine = document.getElementById('scan-line');
const startBtn = document.getElementById('start-btn');
const captureBtn = document.getElementById('capture-btn');
const fileInput = document.getElementById('file-input');
const resultContent = document.getElementById('result-content');
const loading = document.getElementById('loading');
const userQuestion = document.getElementById('user-question');
const askBtn = document.getElementById('ask-btn');
const micBtn = document.getElementById('mic-btn');
const voiceStatus = document.getElementById('voice-status');

let currentBase64Image = null;

// ==========================================
// HÀM QUÉT FACE ID VỚI MŨI TÊN HƯỚNG DẪN & TÍCH XANH
// ==========================================
async function captureVideoFaceID() {
    if (!video.srcObject) {
        alert("Vui lòng bấm 'CAMERA ACTIVE' trước!");
        return;
    }

    scanLine.style.display = 'block';
    loading.style.display = 'flex';
    toggleInputs(false);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const capturedFrames = [];
    
    // 4 Bước quét mô phỏng Face ID
    const steps = [
        { arrow: "⬆️ HƯỚNG LÊN TRÊN", delay: 700 },
        { arrow: "⬇️ HƯỚNG XUỐNG DƯỚI", delay: 700 },
        { arrow: "⬅️ XOAY SANG TRÁI", delay: 700 },
        { arrow: "➡️ XOAY SANG PHẢI", delay: 700 }
    ];

    for (let i = 0; i < steps.length; i++) {
        resultContent.innerHTML = `<div style="text-align:center; padding:20px;">
            <h2 style="color:#00f3ff; font-size: 2rem;">QUÉT FACE ID</h2>
            <h1 style="color:#ff007f; font-size: 2.5rem; margin: 15px 0;">${steps[i].arrow}</h1>
            <p>Bước ${i+1}/4 - Giữ vật thể trong khung hình...</p>
        </div>`;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        capturedFrames.push(base64Image);

        if (i === steps.length - 1) {
            imagePreview.src = base64Image;
            imagePreview.style.display = 'block';
            video.style.display = 'none';
            currentBase64Image = base64Image.split(',')[1];
        }

        await new Promise(resolve => setTimeout(resolve, steps[i].delay));
    }

    resultContent.innerHTML = `<div style="text-align:center; padding:20px;">
        <h2 style="color:#00f3ff;">⏳ ĐANG PHÂN TÍCH DỮ LIỆU...</h2>
    </div>`;

    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: capturedFrames })
        });
        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const resultText = data.candidates[0].content.parts[0].text.trim();
            
            // Hiển thị TÍCH XANH NẾU THÀNH CÔNG
            resultContent.innerHTML = `
                <div style="text-align:center; border: 2px solid #00ff88; padding: 15px; border-radius: 10px; background: rgba(0,255,136,0.1);">
                    <h1 style="color:#00ff88; font-size: 3rem; margin:0;">✅ THÀNH CÔNG</h1>
                    <p style="font-size: 1.1rem; color: #fff; margin-top: 10px;">${resultText}</p>
                </div>
            `;
            speakText(resultText);
            toggleInputs(true);
        } else {
            // Hiển thị DẤU X ĐỎ NẾU LỖI
            resultContent.innerHTML = `
                <div style="text-align:center; border: 2px solid #ff4444; padding: 15px; border-radius: 10px; background: rgba(255,68,68,0.1);">
                    <h1 style="color:#ff4444; font-size: 3rem; margin:0;">❌ LỖI NHẬN DẠNG</h1>
                    <p style="color:#fff;">Không nhận diện được. Vui lòng quét lại!</p>
                </div>
            `;
        }
    } catch (err) {
        resultContent.innerHTML = `
            <div style="text-align:center; border: 2px solid #ff4444; padding: 15px; border-radius: 10px;">
                <h1 style="color:#ff4444; font-size: 3rem; margin:0;">❌ LỖI KẾT NỐI</h1>
                <p style="color:#fff;">${err.message}</p>
            </div>
        `;
    } finally {
        scanLine.style.display = 'none';
        loading.style.display = 'none';
    }
}

// ==========================================
// CÁC HÀM XỬ LÝ KHÁC (GIỮ NGUYÊN)
// ==========================================
function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    let cleanText = text.replace(/\(.*?\)/g, '').replace(/[*#_\-`]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    window.speechSynthesis.speak(utterance);
}

startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        video.srcObject = stream;
        video.style.display = 'block';
        imagePreview.style.display = 'none';
        placeholder.style.display = 'none';
        captureBtn.disabled = false;
        startBtn.innerText = 'CAMERA ACTIVE';
    } catch (err) {
        alert('Không thể mở Camera: ' + err.message);
    }
});

captureBtn.addEventListener('click', captureVideoFaceID);

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            imagePreview.src = event.target.result;
            imagePreview.style.display = 'block';
            video.style.display = 'none';
            placeholder.style.display = 'none';
            currentBase64Image = event.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
});

function toggleInputs(enable) {
    userQuestion.disabled = !enable;
    askBtn.disabled = !enable;
    if (micBtn) micBtn.disabled = !enable;
}
