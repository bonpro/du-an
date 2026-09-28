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
// BỘ PHÁT GIỌNG NÓI NỮ TIẾNG VIỆT
// ==========================================
function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // Dừng câu đọc trước đó

    let cleanText = text.replace(/\(.*?\)/g, '').replace(/[*#_\-`]/g, '').trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.2; // Tăng pitch nhẹ để giọng nữ tự nhiên hơn

    const voices = window.speechSynthesis.getVoices();
    // Ưu tiên chọn giọng nữ tiếng Việt (HoaiMy, Linh, Google Tiếng Việt...)
    const femaleVoice = voices.find(v => 
        (v.lang.includes('vi') || v.lang.includes('VI')) && 
        (v.name.includes('HoaiMy') || v.name.includes('Linh') || v.name.includes('Female') || v.name.includes('Google'))
    ) || voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));

    if (femaleVoice) utterance.voice = femaleVoice;

    window.speechSynthesis.speak(utterance);
}

// Tải danh sách giọng nói
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
}

// ==========================================
// TẠO LỚP PHỦ OVERLAY TRÊN CAMERA
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
        overlay.style.background = 'rgba(0, 0, 0, 0.25)';
        
        if (video.parentElement) {
            video.parentElement.style.position = 'relative';
            video.parentElement.appendChild(overlay);
        }
    }
    return overlay;
}

// ==========================================
// QUÉT FACE ID CÓ ÂM THANH NỮ HƯỚNG DẪN
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

    video.style.display = 'block';
    imagePreview.style.display = 'none';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const capturedFrames = [];
    
    // 4 Góc quét Face ID kèm giọng nói hướng dẫn
    const steps = [
        { arrow: "⬆️ HƯỚNG LÊN TRÊN", speak: "Hãy hướng vật thể lên trên", text: "Góc 1/4" },
        { arrow: "⬇️ HƯỚNG XUỐNG DƯỚI", speak: "Hãy hướng vật thể xuống dưới", text: "Góc 2/4" },
        { arrow: "⬅️ XOAY SANG TRÁI", speak: "Xoay nhẹ sang trái", text: "Góc 3/4" },
        { arrow: "➡️ XOAY SANG PHẢI", speak: "Xoay nhẹ sang phải", text: "Góc 4/4" }
    ];

    for (let i = 0; i < steps.length; i++) {
        // Đọc giọng nữ hướng dẫn từng góc
        speakText(steps[i].speak);

        // Đếm ngược 3 giây cho mỗi góc
        for (let countdown = 3; countdown > 0; countdown--) {
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.75); padding: 20px 30px; border-radius: 20px; text-align: center; border: 2px solid #00f3ff; backdrop-filter: blur(4px);">
                    <h1 style="color:#ff007f; font-size: 2.3rem; margin: 0; text-shadow: 0 0 10px #ff007f;">${steps[i].arrow}</h1>
                    <p style="color:#00f3ff; font-weight:bold; margin: 8px 0;">${steps[i].text} - Giữ cố định góc này</p>
                    <div style="font-size: 2.8rem; color: #fff; font-weight: bold; margin-top: 5px;">${countdown}</div>
                </div>
            `;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Chụp ảnh góc đó
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        capturedFrames.push(base64Image);

        // Thông báo đã xong góc
        overlay.innerHTML = `
            <div style="background: rgba(0,0,0,0.8); padding: 15px 25px; border-radius: 15px; border: 2px solid #00ff88;">
                <h2 style="color:#00ff88; margin:0;">📸 ĐÃ GHI NHẬN ${steps[i].text}!</h2>
            </div>
        `;
        await new Promise(resolve => setTimeout(resolve, 600));

        if (i === steps.length - 1) {
            currentBase64Image = base64Image.split(',')[1];
        }
    }

    // Đang xử lý
    speakText("Đang phân tích dữ liệu, vui lòng đợi trong giây lát");
    overlay.innerHTML = `
        <div style="background: rgba(0,0,0,0.8); padding: 20px; border-radius: 15px; text-align: center; border: 2px solid #00f3ff;">
            <h2 style="color:#00f3ff; margin:0;">⏳ ĐANG PHÂN TÍCH ĐA GÓC...</h2>
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
            
            // Hiện TÍCH XANH
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.85); padding: 20px; border-radius: 15px; text-align: center; border: 3px solid #00ff88; box-shadow: 0 0 20px #00ff88; max-width: 80%;">
                    <h1 style="color:#00ff88; font-size: 3.5rem; margin:0;">✅</h1>
                    <p style="font-size: 1.1rem; color: #fff; margin-top: 10px; font-weight:bold;">${resultText}</p>
                </div>
            `;
            
            resultContent.innerHTML = `### KẾT QUẢ QUÉT:\n${resultText}`;
            speakText(resultText); // Đọc kết quả bằng giọng nữ
            toggleInputs(true);
        } else {
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.85); padding: 20px; border-radius: 15px; text-align: center; border: 3px solid #ff4444;">
                    <h1 style="color:#ff4444; font-size: 3.5rem; margin:0;">❌</h1>
                    <p style="color:#fff; margin-top:5px;">Không nhận diện được. Hãy quét lại!</p>
                </div>
            `;
            speakText("Không nhận diện được, vui lòng quét lại.");
        }
    } catch (err) {
        overlay.innerHTML = `
            <div style="background: rgba(0,0,0,0.85); padding: 15px; border-radius: 10px; border: 2px solid #ff4444;">
                <h2 style="color:#ff4444; margin:0;">❌ LỖI KẾT NỐI</h2>
            </div>
        `;
        speakText("Lỗi kết nối máy chủ.");
    } finally {
        scanLine.style.display = 'none';
        loading.style.display = 'none';
        
        setTimeout(() => {
            if (overlay) overlay.innerHTML = '';
        }, 5000);
    }
}

// ==========================================
// CÁC SỰ KIỆN NÚT BẤM (GIỮ NGUYÊN)
// ==========================================
startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        video.srcObject = stream;
        video.style.display = 'block';
        imagePreview.style.display = 'none';
        placeholder.style.display = 'none';
        captureBtn.disabled = false;
        startBtn.innerText = 'CAMERA ACTIVE';
        
        // Kích hoạt giọng nói khi người dùng tương tác mở Camera
        speakText("Máy ảnh đã sẵn sàng.");
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
