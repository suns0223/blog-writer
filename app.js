// 썬스 블로그 글 생성기 - app.js

let photos = [];

// ── API 키 로컬 저장 ──
const apiKeyInput = document.getElementById('apiKey');
const apiSaved = document.getElementById('apiSaved');
const savedKey = localStorage.getItem('gemini_api_key');
if (savedKey) {
  apiKeyInput.value = savedKey;
  apiSaved.textContent = '✅ 저장된 키가 불러와졌어요';
}
apiKeyInput.addEventListener('change', () => {
  const key = apiKeyInput.value.trim();
  if (key) {
    localStorage.setItem('gemini_api_key', key);
    apiSaved.textContent = '✅ 키가 이 기기에 저장되었어요';
  } else {
    localStorage.removeItem('gemini_api_key');
    apiSaved.textContent = '';
  }
});

// ── 사진 업로드 ──
const dropZone = document.getElementById('dropZone');
const photoInput = document.getElementById('photoInput');
const photoGrid = document.getElementById('photoGrid');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});
photoInput.addEventListener('change', (e) => handleFiles(e.target.files));

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    resizeImage(file, 800).then((resized) => {
      photos.push({ name: file.name, dataUrl: resized });
      renderPhotos();
    });
  }
}

// ── 사진 리사이즈 (API 토큰 절약) ──
function resizeImage(file, maxSize) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotos() {
  photoGrid.innerHTML = photos.map((p, i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="사진 ${i + 1}" />
      <button class="remove" onclick="removePhoto(${i})" aria-label="사진 삭제">✕</button>
      <div class="photo-label">${i + 1}. ${p.name.substring(0, 10)}</div>
    </div>
  `).join('');
}

function removePhoto(index) {
  photos.splice(index, 1);
  renderPhotos();
}

// ── 메뉴 추가/삭제 ──
function addMenu() {
  const list = document.getElementById('menuList');
  const item = document.createElement('div');
  item.className = 'menu-item';
  item.innerHTML = `
    <input type="text" placeholder="메뉴명" />
    <button class="btn-remove" onclick="removeMenu(this)" aria-label="메뉴 삭제">✕</button>
  `;
  list.appendChild(item);
}

function removeMenu(btn) {
  const list = document.getElementById('menuList');
  if (list.children.length > 1) {
    btn.parentElement.remove();
  }
}

// ── 메뉴 목록 가져오기 ──
function getMenus() {
  return [...document.querySelectorAll('#menuList .menu-item input')]
    .map(input => input.value.trim())
    .filter(v => v);
}

// ── 사진을 base64로 변환 (Vision API용) ──
function photoToBase64(photo) {
  return photo.dataUrl.split(',')[1];
}

// ── 블로그 글 생성 ──
async function generatePost() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const restaurantName = document.getElementById('restaurantName').value.trim();
  const area = document.getElementById('area').value.trim();
  const mapUrl = document.getElementById('mapUrl').value.trim();
  const address = document.getElementById('address').value.trim();
  const menus = getMenus();
  const impression = document.getElementById('impression').value.trim();
  const companion = document.getElementById('companion').value.trim();

  // 유효성 검사
  if (!apiKey) return alert('Gemini API Key를 입력해주세요.');
  if (!restaurantName) return alert('식당 이름을 입력해주세요.');
  if (!area) return alert('지역을 입력해주세요.');
  if (menus.length === 0) return alert('메뉴를 최소 1개 입력해주세요.');

  const btn = document.getElementById('generateBtn');
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');

  btn.disabled = true;
  loading.classList.add('active');
  result.classList.remove('active');

  try {
    const content = await callGemini(apiKey, {
      restaurantName, area, mapUrl, address, menus, impression, companion
    });
    document.getElementById('resultContent').textContent = content;
    result.classList.add('active');
  } catch (err) {
    alert('글 생성 중 오류가 발생했어요: ' + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
    loading.classList.remove('active');
  }
}

// ── Gemini API 호출 ──
async function callGemini(apiKey, data) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(data);

  // Gemini 요청 본문 구성
  const parts = [{ text: userPrompt }];

  // 사진이 있으면 인라인 이미지 추가
  if (photos.length > 0) {
    photos.forEach((photo) => {
      const base64 = photo.dataUrl.split(',')[1];
      const mimeType = photo.dataUrl.split(';')[0].split(':')[1];
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: base64
        }
      });
    });
  }

  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        parts: parts
      }],
      tools: [{
        googleSearch: {}
      }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4000
      }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 오류 (${response.status})`);
  }

  const json = await response.json();
  return json.candidates[0].content.parts[0].text;
}

// ── 시스템 프롬프트 (스타일 가이드) ──
function buildSystemPrompt() {
  return `당신은 네이버 블로그에 맛집 리뷰를 작성하는 블로거 "썬스(Suns)"입니다.
아래 스타일 가이드를 철저히 따라 블로그 글을 작성하세요.

## 글 구조 (이 순서를 따르세요)
1. **제목**: [지역 맛집] 캐치프레이즈 + '식당명' + 핵심 키워드 + 이모지
2. **인사**: "안녕하세요! 맛있는 발견을 즐기는 썬스(Suns)입니다. 😊"
3. **인트로**: 계절/날씨/상황 연결 → 맛집 소개 티저 → 개인 에피소드
4. **외관/첫인상**: 가게 외관 묘사 + [외관 사진 위치] 표시
5. **네이버 지도**: [네이버 지도 삽입] 표시 + 주소
6. **메뉴 소개**: 📋 썬스의 선택: 주문 메뉴 나열
7. **메뉴별 리뷰**: 🥢 + 소제목, [사진 위치] 표시 → 비주얼 묘사 → 맛 → 식감
8. **분위기/여담** (선택): ✨ 또는 🍻 매장 분위기, 동행자 이야기
9. **총평**: 💬 썬스의 총평 + 핵심 평가 + 추천 멘트
10. **클로징**: "다음에 또 저만의 '맛있는 발견' 들고 올게요! 안녕!"
11. **해시태그**: #지역맛집 #식당명 #메뉴키워드 ... #썬스의맛있는발견

## 말투 규칙
- 친근하고 밝은 1인칭 구어체
- "~하더라고요", "~했답니다", "~좋겠죠?" 사용
- 감탄: "엄지척! 👍", "냠냠냠!", "뇸뇸뇸!"
- 이모지 적극 활용 (📍📋🥢🥟⚠️💬✨🍻)
- 맛 표현: "겉바속촉", "고소함이 폭발", "~의 조화가 예술입니다", "완벽한 밸런스"
- 괄호 유머: "(먼 산)", "(뒤에서 계속!)"
- 긍정 위주지만 아쉬운 점도 솔직하게

## 사진 배치
- 사진이 들어갈 위치에 [사진: 설명] 형태로 표시
- 사진 캡션은 따옴표 스타일: "설명 문구 + 이모지"
- 사진이 제공된 경우, 사진 내용을 분석하여 적절한 위치에 배치하고 설명 작성

## 중요
- 네이버 블로그에 바로 붙여넣기 할 수 있는 형태로 작성
- 사진 위치를 [사진: 설명] 으로 명확히 표시
- 해시태그는 반드시 마지막에, #썬스의맛있는발견 으로 끝내기
- 글 분량은 1500~2500자 사이

## Google 검색 활용 규칙
- 글을 작성하기 전에 반드시 식당명 + 지역으로 검색하여 실제 정보를 수집하세요
- 검색에서 얻은 정보를 활용하세요: 대표 메뉴의 특징, 식당의 역사/스토리, 다른 리뷰어들의 공통 평가, 가격대, 영업시간 등
- 검색 결과의 맛 표현을 참고하되, 반드시 썬스 말투로 재가공하세요
- 검색에서 발견한 식당의 특별한 포인트(예: 몇 년 전통, 유명인 방문, 특별한 조리법 등)를 자연스럽게 녹여내세요
- 단, 검색 결과를 그대로 복사하지 말고 썬스의 직접 경험처럼 자연스럽게 표현하세요`;
}

// ── 사용자 프롬프트 ──
function buildUserPrompt(data) {
  let prompt = `다음 정보로 썬스 스타일의 맛집 블로그 글을 작성해주세요.
먼저 "${data.restaurantName} ${data.area} 맛집"으로 검색하여 이 식당의 실제 정보(대표 메뉴 특징, 역사, 리뷰 평가 등)를 수집한 후, 그 정보를 바탕으로 더 정확하고 풍부한 글을 작성해주세요.

📍 식당 정보
- 식당명: ${data.restaurantName}
- 지역: ${data.area}
- 주문 메뉴: ${data.menus.join(', ')}`;

  if (data.address) prompt += `\n- 주소: ${data.address}`;
  if (data.mapUrl) prompt += `\n- 네이버 지도: ${data.mapUrl}`;
  if (data.companion) prompt += `\n- 동행: ${data.companion}`;

  prompt += `\n\n💬 나의 소감\n${data.impression || '(소감 없음 - 자연스럽게 작성해주세요)'}`;

  if (photos.length > 0) {
    prompt += `\n\n📸 첨부된 사진 ${photos.length}장`;
    prompt += `\n사진들을 분석하여 적절한 위치에 배치하고, 각 사진에 맞는 설명과 캡션을 작성해주세요.`;
    prompt += `\n사진 순서: ${photos.map((p, i) => `${i + 1}. ${p.name}`).join(', ')}`;
  } else {
    prompt += `\n\n📸 사진 없음 - [사진: 설명] 형태로 사진이 들어갈 위치만 표시해주세요.`;
  }

  return prompt;
}

// ── 결과 복사 ──
function copyResult() {
  const text = document.getElementById('resultContent').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = '✅ 복사됨!';
    setTimeout(() => btn.textContent = '📋 복사', 1500);
  });
}
