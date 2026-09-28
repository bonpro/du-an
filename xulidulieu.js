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
// 1. PHÁT GIỌNG NÓI TIẾNG VIỆT
// ==========================================
// ==========================================
// BỘ PHÁT GIỌNG NÓI TIẾNG VIỆT CHUẨN TỰ NHIÊN
// ==========================================
function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // Dừng câu đang đọc cũ

    // Làm sạch văn bản: Bỏ ký tự đặc biệt, dấu câu Markdown để tránh AI đọc vấp
    let cleanText = text
        .replace(/\(.*?\)/g, '')
        .replace(/[*#_\-`~>]/g, '')
        .replace(/https?:\/\/\S+/g, '')
        .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 0.95; // Tốc độ đọc vừa phải, không bị nuốt chữ
    utterance.pitch = 1.0;  // Tông giọng tự nhiên

    const voices = window.speechSynthesis.getVoices();
    
    // Ưu tiên chọn giọng đọc chuẩn tiếng Việt của Microsoft hoặc Google
    const bestVoice = voices.find(v => 
        (v.lang === 'vi-VN' || v.lang === 'vi_VN') && 
        (v.name.includes('HoaiMy') || v.name.includes('NamMinh') || v.name.includes('Google') || v.name.includes('Natural'))
    ) || voices.find(v => v.lang.startsWith('vi'));

    if (bestVoice) {
        utterance.voice = bestVoice;
    }

    window.speechSynthesis.speak(utterance);
}

// Đảm bảo danh sách giọng đọc luôn được load sẵn khi vào trang
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

// ==========================================
// 2. NHẬN DIỆN GIỌNG NÓI (NÚT NÓI / MIC)
// ==========================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
        if (micBtn) {
            micBtn.style.background = '#ff0055';
            micBtn.innerText = '🔴 ĐANG NGHE...';
        }
    };

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (userQuestion) userQuestion.value = transcript;
        stopMic();
        handleUserQuestion();
    };

    recognition.onerror = () => { stopMic(); };
    recognition.onend = () => { stopMic(); };
}

function stopMic() {
    if (micBtn) {
        micBtn.style.background = '';
        micBtn.innerText = '🎤 NÓI';
    }
}

if (micBtn) {
    micBtn.addEventListener('click', () => {
        if (recognition) {
            try { recognition.start(); } catch (e) { recognition.stop(); }
        } else {
            alert("Trình duyệt của bạn không hỗ trợ Micro!");
        }
    });
}

// ==========================================
// 3. TẠO OVERLAY TRÊN CAMERA
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
        
        if (video.parentElement) {
            video.parentElement.style.position = 'relative';
            video.parentElement.appendChild(overlay);
        }
    }
    return overlay;
}

// ==========================================
// 4. QUÉT 3D SIÊU NHANH (TỰ ĐỘNG KHÔNG ĐẾM GIÂY)
// ==========================================
async function captureVideoFaceID() {
    if (!video.srcObject) {
        alert("Vui lòng bấm 'CAMERA ACTIVE' trước!");
        return;
    }

    const overlay = createCamOverlay();
    if (scanLine) scanLine.style.display = 'block';
    if (loading) loading.style.display = 'flex';

    video.style.display = 'block';
    if (imagePreview) imagePreview.style.display = 'none';

    overlay.innerHTML = `
        <div style="background: rgba(0,0,0,0.8); padding: 15px 25px; border-radius: 12px; border: 2px solid #00f3ff;">
            <h2 style="color:#00f3ff; margin:0;">🌀 ĐANG QUÉT 3D...</h2>
        </div>
    `;

    speakText("Đang quét 3D");

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const capturedFrames = [];

    // Chụp nhanh 4 khung hình liên tiếp trong 1.2 giây
    for (let i = 0; i < 4; i++) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        capturedFrames.push(base64Image);

        if (i === 3) {
            currentBase64Image = base64Image.split(',')[1];
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    overlay.innerHTML = `
        <div style="background: rgba(0,0,0,0.8); padding: 15px 25px; border-radius: 12px; border: 2px solid #00f3ff;">
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
            
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.85); padding: 15px 25px; border-radius: 15px; text-align: center; border: 3px solid #00ff88;">
                    <h1 style="color:#00ff88; font-size: 2.5rem; margin:0;">✅</h1>
                    <p style="font-size: 1rem; color: #fff; margin-top: 5px; font-weight:bold;">${resultText}</p>
                </div>
            `;
            
            if (typeof marked !== 'undefined') {
                resultContent.innerHTML = marked.parse(`### KẾT QUẢ QUÉT 3D:\n${resultText}`);
            } else {
                resultContent.innerHTML = `<p><strong>KẾT QUẢ QUÉT 3D:</strong> ${resultText}</p>`;
            }

            speakText(resultText);
        } else {
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.85); padding: 15px; border-radius: 12px; border: 2px solid #ff4444;">
                    <h1 style="color:#ff4444; font-size: 2.5rem; margin:0;">❌</h1>
                    <p style="color:#fff; margin:0;">Lỗi nhận diện. Thử lại!</p>
                </div>
            `;
        }
    } catch (err) {
        overlay.innerHTML = `
            <div style="background: rgba(0,0,0,0.85); padding: 10px; border-radius: 8px; border: 2px solid #ff4444;">
                <h3 style="color:#ff4444; margin:0;">❌ LỖI KẾT NỐI</h3>
            </div>
        `;
    } finally {
        if (scanLine) scanLine.style.display = 'none';
        if (loading) loading.style.display = 'none';

        setTimeout(() => {
            if (overlay) overlay.innerHTML = '';
        }, 3000);
    }
}

// ==========================================
// 5. CAMERA & TẢI ÁNH
// ==========================================
startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        video.srcObject = stream;
        video.style.display = 'block';
        if (imagePreview) imagePreview.style.display = 'none';
        if (placeholder) placeholder.style.display = 'none';
        captureBtn.disabled = false;
        startBtn.innerText = 'CAMERA ACTIVE';
        
        speakText("Máy ảnh sẵn sàng.");
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
            if (placeholder) placeholder.style.display = 'none';
            currentBase64Image = event.target.result.split(',')[1];
        };
        reader.readAsDataURL(file);
    }
});

// ==========================================
// 6. GỬI CÂU HỎI VÀ XỬ LÝ NÚT GỬI
// ==========================================
async function handleUserQuestion() {
    const question = userQuestion.value.trim();
    if (!question) return;

    if (loading) loading.style.display = 'flex';

    const parts = [{ text: `Trả lời ngắn gọn bằng tiếng Việt dưới 50 từ: ${question}` }];
    if (currentBase64Image) {
        parts.push({ inline_data: { mime_type: "image/jpeg", data: currentBase64Image } });
    }

    try {
        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: "user", parts: parts }] })
        });
        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const answer = data.candidates[0].content.parts[0].text.trim();
            const answerHTML = typeof marked !== 'undefined' ? marked.parse(answer) : answer;
            
            resultContent.innerHTML += `<hr><p><strong>🗣️ Hỏi:</strong> ${question}</p><p><strong>🤖 AI:</strong> ${answerHTML}</p>`;
            resultContent.scrollTop = resultContent.scrollHeight;

            speakText(answer);
            userQuestion.value = '';
        }
    } catch (err) {
        alert("Lỗi gửi câu hỏi: " + err.message);
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

askBtn.addEventListener('click', handleUserQuestion);
userQuestion.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserQuestion();
});

// Đảm bảo các ô nhập liệu luôn luôn mở
userQuestion.disabled = false;
askBtn.disabled = false;
if (micBtn) micBtn.disabled = false;
