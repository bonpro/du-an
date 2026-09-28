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
// 1. BỘ PHÁT GIỌNG NÓI TIẾNG VIỆT CHUẨN NỮ
// ==========================================
function speakText(text) {
    if (!('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel(); // Dừng âm thanh cũ

    let cleanText = text.replace(/\(.*?\)/g, '').replace(/[*#_\-`]/g, '').trim();
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'vi-VN';
    utterance.rate = 1.0;
    utterance.pitch = 1.1;

    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v => 
        (v.lang.includes('vi') || v.lang.includes('VI')) && 
        (v.name.includes('HoaiMy') || v.name.includes('Linh') || v.name.includes('Female') || v.name.includes('Google'))
    ) || voices.find(v => v.lang.includes('vi') || v.lang.includes('VI'));

    if (femaleVoice) utterance.voice = femaleVoice;

    window.speechSynthesis.speak(utterance);
}

if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.getVoices(); };
}

// ==========================================
// 2. NHẬN DIỆN GIỌNG NÓI (STT)
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
        }
    });
}

// ==========================================
// 3. TẠO LỚP PHỦ HƯỚNG DẪN TRÊN CAMERA
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
// 4. QUÉT FACE ID ĐA GÓC (CÓ GIỌNG NÓI HƯỚNG DẪN)
// ==========================================
async function captureVideoFaceID() {
    if (!video.srcObject) {
        alert("Vui lòng bấm 'CAMERA ACTIVE' trước!");
        return;
    }

    const overlay = createCamOverlay();
    if (scanLine) scanLine.style.display = 'block';
    if (loading) loading.style.display = 'flex';
    toggleInputs(false);

    video.style.display = 'block';
    if (imagePreview) imagePreview.style.display = 'none';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const capturedFrames = [];
    const steps = [
        { arrow: "⬆️ HƯỚNG LÊN TRÊN", speak: "Hãy hướng vật thể lên trên", text: "Góc 1/4" },
        { arrow: "⬇️ HƯỚNG XUỐNG DƯỚI", speak: "Hãy hướng vật thể xuống dưới", text: "Góc 2/4" },
        { arrow: "⬅️ XOAY SANG TRÁI", speak: "Xoay nhẹ sang trái", text: "Góc 3/4" },
        { arrow: "➡️ XOAY SANG PHẢI", speak: "Xoay nhẹ sang phải", text: "Góc 4/4" }
    ];

    try {
        for (let i = 0; i < steps.length; i++) {
            speakText(steps[i].speak);

            for (let countdown = 3; countdown > 0; countdown--) {
                overlay.innerHTML = `
                    <div style="background: rgba(0,0,0,0.75); padding: 15px 25px; border-radius: 15px; text-align: center; border: 2px solid #00f3ff;">
                        <h1 style="color:#ff007f; font-size: 2rem; margin: 0;">${steps[i].arrow}</h1>
                        <p style="color:#00f3ff; font-weight:bold; margin: 5px 0;">${steps[i].text} - Giữ vật thể cố định</p>
                        <div style="font-size: 2.5rem; color: #fff; font-weight: bold;">${countdown}</div>
                    </div>
                `;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const base64Image = canvas.toDataURL('image/jpeg', 0.7);
            capturedFrames.push(base64Image);

            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.8); padding: 10px 20px; border-radius: 10px; border: 2px solid #00ff88;">
                    <h3 style="color:#00ff88; margin:0;">📸 ĐÃ GHI NHẬN ${steps[i].text}!</h3>
                </div>
            `;
            await new Promise(resolve => setTimeout(resolve, 500));

            if (i === steps.length - 1) {
                currentBase64Image = base64Image.split(',')[1];
            }
        }

        speakText("Đang phân tích dữ liệu, vui lòng đợi.");
        overlay.innerHTML = `
            <div style="background: rgba(0,0,0,0.8); padding: 15px; border-radius: 10px; border: 2px solid #00f3ff;">
                <h3 style="color:#00f3ff; margin:0;">⏳ ĐANG PHÂN TÍCH...</h3>
            </div>
        `;

        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: capturedFrames })
        });
        const data = await response.json();

        if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
            const resultText = data.candidates[0].content.parts[0].text.trim();
            
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.85); padding: 15px; border-radius: 12px; text-align: center; border: 3px solid #00ff88;">
                    <h1 style="color:#00ff88; font-size: 2.5rem; margin:0;">✅</h1>
                    <p style="font-size: 1rem; color: #fff; margin-top: 5px; font-weight:bold;">${resultText}</p>
                </div>
            `;
            
            if (typeof marked !== 'undefined') {
                resultContent.innerHTML = marked.parse(`### KẾT QUẢ QUÉT:\n${resultText}`);
            } else {
                resultContent.innerHTML = `<p><strong>KẾT QUẢ QUÉT:</strong> ${resultText}</p>`;
            }

            speakText(resultText);
        } else {
            overlay.innerHTML = `
                <div style="background: rgba(0,0,0,0.85); padding: 15px; border-radius: 10px; border: 2px solid #ff4444;">
                    <h1 style="color:#ff4444; font-size: 2.5rem; margin:0;">❌</h1>
                    <p style="color:#fff; margin:0;">Không nhận diện được!</p>
                </div>
            `;
            speakText("Không nhận diện được, vui lòng thử lại.");
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
        toggleInputs(true); // Luôn mở lại khung nhập liệu/nút bấm

        setTimeout(() => {
            if (overlay) overlay.innerHTML = '';
        }, 4000);
    }
}

// ==========================================
// 5. MỞ CAMERA & XỬ LÝ SỰ KIỆN
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
        
        speakText("Máy ảnh đã mở.");
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
// 6. GỬI CÂU HỎI VÀ TRẢ LỜI
// ==========================================
async function handleUserQuestion() {
    const question = userQuestion.value.trim();
    if (!question) return;

    if (loading) loading.style.display = 'flex';
    toggleInputs(false);

    const parts = [{ text: `Trả lời ngắn gọn cô đọng bằng tiếng Việt (dưới 50 từ): ${question}` }];
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
        toggleInputs(true);
    }
}

function toggleInputs(enable) {
    if (userQuestion) userQuestion.disabled = !enable;
    if (askBtn) askBtn.disabled = !enable;
    if (micBtn) micBtn.disabled = !enable;
}

askBtn.addEventListener('click', handleUserQuestion);
userQuestion.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserQuestion();
});

// Bật lại input mặc định khi tải trang
toggleInputs(true);
