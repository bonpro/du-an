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

let currentBase64Image = null;

// ==========================================
// TẠO LỚP PHỦ HƯỚNG DẪN TRÊN CAMERA (OVERLAY)
// ==========================================
function createCamOverlay() {
    let overlay = document.getElementById('cam-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'cam-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '10';
        overlay.style.background = 'rgba(0, 0, 0, 0.2)';
        
        // Đảm bảo thẻ chứa video có position relative để overlay đè đúng vị trí
        if (video.parentElement) {
            video.parentElement.style.position = 'relative';
            video.parentElement.appendChild(overlay);
        }
    }
    return overlay;
}

// ==========================================
// QUÉT FACE ID MÔ PHỎNG TRỰC TIẾP TRÊN CAMERA
// ==========================================
async function captureVideoFaceID() {
    if (!video.srcObject) {
        alert("Vui lòng bấm 'CAMERA ACTIVE' trước!");
        return;
    }

    const overlay = createCamOverlay();
    scanLine.style.display = 'block';
    loading.style.display = 'flex';
    toggleInputs(false);

    // Đảm bảo video đang hiện và xem trước ẩn đi để camera không bị đứng hình
    video.style.display = 'block';
    imagePreview.style.display = 'none';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const capturedFrames = [];
    
    // Các bước quét Face ID hiển thị trực tiếp lên Camera
    const steps = [
        { arrow: "⬆️ HƯỚNG LÊN TRÊN", text: "Bước 1/4" },
        { arrow: "⬇️ HƯỚNG XUỐNG DƯỚI", text: "Bước 2/4" },
        { arrow: "⬅️ XOAY SANG TRÁI", text: "Bước 3/4" },
        { arrow: "➡️ XOAY SANG PHẢI", text: "Bước 4/4" }
    ];

    for (let i = 0; i < steps.length; i++) {
        // Cập nhật giao diện đè lên Camera
        overlay.innerHTML = `
            <div style="background: rgba(0,0,0,0.65); padding: 15px 25px; border-radius: 15px; text-align: center; border: 2px solid #00f3ff; backdrop-filter: blur(4px);">
                <h1 style="color:#ff007f; font-size: 2.2rem; margin: 0 0 5px 0; text-shadow: 0 0 10px #ff007f;">${steps[i].arrow}</h1>
                <p style="color:#00f3ff; margin:0; font-weight:bold;">${steps[i].text} - Giữ chuyển động...</p>
            </div>
        `;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        capturedFrames.push(base64Image);

        if (i === steps.length - 1) {
            currentBase64Image = base64Image.split(',')[1];
        }

        await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Hiển thị trạng thái đang xử lý trên Camera
    overlay.innerHTML = `
        <div style="background: rgba(0,0,0,0.7); padding: 15px 25px; border-radius: 15px; text-align: center; border: 2px solid #00f3ff;">
            <h2 style="color:#00f3ff; margin:0;">⏳ ĐANG PHÂN TÍCH...</h2>
        </div>
    `;

    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: capturedFrames })
        });
        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const resultText = data.candidates[0].content.parts[0].text.trim();
            
            // Hiển thị TÍCH XANH đè trực tiếp lên Camera
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.8); padding: 20px; border-radius: 15px; text-align: center; border: 3px solid #00ff88; box-shadow: 0 0 20px #00ff88;">
                    <h1 style="color:#00ff88; font-size: 3.5rem; margin:0;">✅</h1>
                    <p style="font-size: 1.1rem; color: #fff; margin-top: 10px; font-weight:bold;">${resultText}</p>
                </div>
            `;
            
            resultContent.innerHTML = `### KẾT QUẢ QUÉT:\n${resultText}`;
            speakText(resultText);
            toggleInputs(true);
        } else {
            // Hiển thị DẤU X ĐỎ đè lên Camera
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.8); padding: 20px; border-radius: 15px; text-align: center; border: 3px solid #ff4444;">
                    <h1 style="color:#ff4444; font-size: 3.5rem; margin:0;">❌</h1>
                    <p style="color:#fff; margin-top:5px;">Lỗi nhận diện. Hãy thử lại!</p>
                </div>
            `;
        }
    } catch (err) {
        overlay.innerHTML = `
            <div style="background: rgba(0,0,0,0.8); padding: 15px; border-radius: 10px; border: 2px solid #ff4444;">
                <h2 style="color:#ff4444; margin:0;">❌ LỖI KẾT NỐI</h2>
            </div>
        `;
    } finally {
        scanLine.style.display = 'none';
        loading.style.display = 'none';
        
        // Tự động ẩn lớp phủ hướng dẫn sau 4 giây để xem lại camera bình thường
        setTimeout(() => {
            if (overlay) overlay.innerHTML = '';
        }, 4000);
    }
}

// ==========================================
// CÁC BỘ PHẬN KHÁC (GIỮ NGUYÊN)
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
