// 썬스 블로그 글 생성기 - app.js

let menuItems = []; // { name: '', photos: [{ name, dataUrl }] }
let etcPhotos = []; // [{ name, dataUrl }]
let menuIdCounter = 0;

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

// ── 사진 리사이즈 ──
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

// ── 메뉴 관리 ──
function addMenu() {
  const id = menuIdCounter++;
  menuItems.push({ id, name: '', photos: [] });
  renderMenuList();
}

function removeMenu(id) {
  menuItems = menuItems.filter(m => m.id !== id);
  renderMenuList();
}

function updateMenuName(id, name) {
  const item = menuItems.find(m => m.id === id);
  if (item) item.name = name;
}

function triggerMenuPhoto(id) {
  const input = document.getElementById(`menuPhoto_${id}`);
  if (input) input.click();
}

async function handleMenuPhoto(id, files) {
  const item = menuItems.find(m => m.id === id);
  if (!item) return;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await resizeImage(file, 800);
    item.photos.push({ name: file.name, dataUrl });
  }
  renderMenuList();
}

function removeMenuPhoto(menuId, photoIdx) {
  const item = menuItems.find(m => m.id === menuId);
  if (item) item.photos.splice(photoIdx, 1);
  renderMenuList();
}

function renderMenuList() {
  const list = document.getElementById('menuList');
  list.innerHTML = menuItems.map(m => `
    <div class="menu-block">
      <div class="menu-block-header">
        <input type="text" placeholder="메뉴명 (예: 콩국수)" value="${m.name}"
          onchange="updateMenuName(${m.id}, this.value)" />
        <button class="btn-remove" onclick="removeMenu(${m.id})" aria-label="메뉴 삭제">✕</button>
      </div>
      <div class="menu-photo-area" onclick="triggerMenuPhoto(${m.id})">
        📷 이 메뉴 사진 추가
      </div>
      <input type="file" id="menuPhoto_${m.id}" class="file-input-hidden"
        multiple accept="image/*" onchange="handleMenuPhoto(${m.id}, this.files)" />
      ${m.photos.length > 0 ? `
        <div class="menu-photo-grid">
          ${m.photos.map((p, i) => `
            <div class="photo-thumb">
              <img src="${p.dataUrl}" alt="${m.name} 사진 ${i + 1}" />
              <button class="remove" onclick="removeMenuPhoto(${m.id}, ${i})" aria-label="사진 삭제">✕</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

// ── 기타 사진 관리 ──
document.getElementById('etcPhotoInput').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    if (!file.type.startsWith('image/')) continue;
    const dataUrl = await resizeImage(file, 800);
    etcPhotos.push({ name: file.name, dataUrl });
  }
  renderEtcPhotos();
});

function removeEtcPhoto(idx) {
  etcPhotos.splice(idx, 1);
  renderEtcPhotos();
}

function renderEtcPhotos() {
  const grid = document.getElementById('etcPhotoGrid');
  grid.innerHTML = etcPhotos.map((p, i) => `
    <div class="photo-thumb">
      <img src="${p.dataUrl}" alt="기타 사진 ${i + 1}" />
      <button class="remove" onclick="removeEtcPhoto(${i})" aria-label="사진 삭제">✕</button>
    </div>
  `).join('');
}

// ── 블로그 글 생성 ──
async function generatePost() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const restaurantName = document.getElementById('restaurantName').value.trim();
  const area = document.getElementById('area').value.trim();
  const mapUrl = document.getElementById('mapUrl').value.trim();
  const impression = document.getElementById('impression').value.trim();
  const companion = document.getElementById('companion').value.trim();

  const menus = menuItems.filter(m => m.name.trim());
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
      restaurantName, area, mapUrl, menus, impression, companion
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

// ── Gemini API 호출 (2단계: 검색 → 글 작성) ──
async function callGemini(apiKey, data) {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(data);
  const model = 'gemini-2.5-flash';

  // 1단계: 식당 정보 검색
  let searchInfo = '';
  try {
    const menuNames = data.menus.map(m => m.name).join(', ');
    searchInfo = await searchRestaurant(apiKey, model, data.restaurantName, data.area, menuNames);
  } catch (e) {
    console.log('검색 실패, 검색 없이 진행:', e);
  }

  // 2단계: 블로그 글 작성
  const fullPrompt = userPrompt + (searchInfo ? `\n\n🔍 검색으로 수집한 식당 정보:\n${searchInfo}` : '');
  const parts = [{ text: fullPrompt }];

  // 메뉴별 사진 추가 (메뉴명 라벨 포함)
  data.menus.forEach((menu) => {
    if (menu.photos && menu.photos.length > 0) {
      parts.push({ text: `\n[다음은 "${menu.name}" 메뉴 사진입니다]` });
      menu.photos.forEach((photo) => {
        const base64 = photo.dataUrl.split(',')[1];
        const mimeType = photo.dataUrl.split(';')[0].split(':')[1];
        parts.push({ inlineData: { mimeType, data: base64 } });
      });
    }
  });

  // 기타 사진 추가
  if (etcPhotos.length > 0) {
    parts.push({ text: '\n[다음은 기타 사진입니다 (외관, 내부, 반찬 등)]' });
    etcPhotos.forEach((photo) => {
      const base64 = photo.dataUrl.split(',')[1];
      const mimeType = photo.dataUrl.split(';')[0].split(':')[1];
      parts.push({ inlineData: { mimeType, data: base64 } });
    });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4000,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 오류 (${response.status})`);
  }

  const json = await response.json();
  console.log('Gemini 글 작성 응답:', JSON.stringify(json, null, 2));

  if (!json.candidates || !json.candidates[0]?.content?.parts) {
    throw new Error('AI가 응답을 생성하지 못했어요. 다시 시도해주세요.');
  }

  const textParts = json.candidates[0].content.parts
    .filter(p => p.text)
    .map(p => p.text);

  if (textParts.length === 0) {
    throw new Error('텍스트 응답이 없어요. 다시 시도해주세요.');
  }

  return textParts.join('\n').trim();
}

// ── 1단계: Google Search로 식당 정보 수집 ──
async function searchRestaurant(apiKey, model, name, area, menus) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: `"${name}" ${area} 맛집에 대해 검색해서 다음 정보를 정리해줘:\n- 대표 메뉴와 특징\n- 식당 역사/스토리\n- 다른 리뷰어들의 공통 평가\n- 가격대\n- 특별한 포인트\n\n주문 메뉴: ${menus}\n\n간결하게 핵심만 정리해줘.` }]
      }],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1000,
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  });

  if (!response.ok) return '';

  const json = await response.json();
  console.log('검색 응답:', JSON.stringify(json, null, 2));

  if (!json.candidates || !json.candidates[0]?.content?.parts) return '';

  return json.candidates[0].content.parts
    .filter(p => p.text)
    .map(p => p.text)
    .join('\n')
    .trim();
}

// ── 시스템 프롬프트 ──
function buildSystemPrompt() {
  return `당신은 네이버 블로그에 맛집 리뷰를 작성하는 블로거 "썬스(Suns)"입니다.
아래 스타일 가이드를 철저히 따라 블로그 글을 작성하세요.

## 글 구조 (이 순서를 따르세요)
1. **제목**: [지역 맛집] 캐치프레이즈 + '식당명' + 핵심 키워드 + 이모지
2. **인사**: "안녕하세요! 맛있는 발견을 즐기는 썬스(Suns)입니다. 😊"
3. **인트로**: 계절/날씨/상황 연결 → 맛집 소개 티저 → 개인 에피소드
4. **외관/첫인상**: 가게 외관 묘사 + [외관 사진 위치] 표시
5. **네이버 지도**: [네이버 지도 삽입] 표시 (URL이 제공된 경우만)
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

## 사진 배치 규칙
- 메뉴 사진은 해당 메뉴 리뷰 섹션에 배치
- 기타 사진(외관, 내부, 반찬)은 사진 내용을 분석하여 적절한 섹션에 배치
- 사진 위치를 [사진N: 설명] 형태로 표시 (N은 사진 번호)
- 사진 캡션은 따옴표 스타일: "설명 문구 + 이모지"

## 중요
- 네이버 블로그에 바로 붙여넣기 할 수 있는 형태로 작성
- 해시태그는 반드시 마지막에, #썬스의맛있는발견 으로 끝내기
- 글 분량은 1500~2500자 사이
- 검색으로 수집한 식당 정보가 제공되면, 그 정보를 자연스럽게 녹여서 작성하세요
- 식당의 특별한 포인트를 자연스럽게 활용하되, 썬스의 직접 경험처럼 표현하세요`;
}

// ── 사용자 프롬프트 ──
function buildUserPrompt(data) {
  const menuNames = data.menus.map(m => m.name).join(', ');
  let prompt = `다음 정보로 썬스 스타일의 맛집 블로그 글을 작성해주세요.

📍 식당 정보
- 식당명: ${data.restaurantName}
- 지역: ${data.area}
- 주문 메뉴: ${menuNames}`;

  if (data.mapUrl) prompt += `\n- 네이버 지도: ${data.mapUrl}`;
  if (data.companion) prompt += `\n- 동행: ${data.companion}`;

  prompt += `\n\n💬 나의 소감\n${data.impression || '(소감 없음 - 자연스럽게 작성해주세요)'}`;

  // 메뉴별 사진 정보
  const menusWithPhotos = data.menus.filter(m => m.photos && m.photos.length > 0);
  if (menusWithPhotos.length > 0) {
    prompt += '\n\n📸 메뉴별 사진 정보';
    menusWithPhotos.forEach(m => {
      prompt += `\n- "${m.name}": ${m.photos.length}장 첨부됨 → 이 메뉴 리뷰 섹션에 배치하고 사진 내용에 맞는 설명 작성`;
    });
  }

  if (etcPhotos.length > 0) {
    prompt += `\n\n📸 기타 사진 ${etcPhotos.length}장 (외관/내부/반찬 등)`;
    prompt += '\n→ 사진 내용을 분석하여 적절한 섹션(외관, 분위기, 밑반찬 등)에 배치하고 설명 작성';
  }

  if (menusWithPhotos.length === 0 && etcPhotos.length === 0) {
    prompt += '\n\n📸 사진 없음 - [사진: 설명] 형태로 사진이 들어갈 위치만 표시해주세요.';
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

// ── 초기 메뉴 1개 추가 ──
addMenu();
