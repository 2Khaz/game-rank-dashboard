import fs from 'fs';
import gplay from 'google-play-scraper';

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function patchGenres() {
    console.log('=== 장르 업데이트 스크립트 시작 ===');
    const dataPath = 'data.json';
    const histPath = 'history/2026-06-26_14.json';
    
    if (!fs.existsSync(dataPath) || !fs.existsSync(histPath)) return;

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const playGames = data.playKr;
    
    console.log('플레이스토어 장르 조회 중...');
    const batchSize = 5; // 한 번에 5개씩만 조회해서 구글 차단 방지
    for (let i = 0; i < playGames.length; i += batchSize) {
        const batch = playGames.slice(i, i + batchSize);
        await Promise.all(batch.map(async (game) => {
            if (game.genre === '기타' || game.genre === '???') {
                try {
                    const detail = await gplay.app({ appId: game.appId, country: 'kr', lang: 'ko' });
                    if (detail && detail.genre) {
                        game.genre = detail.genre;
                    }
                } catch(e) {}
            }
        }));
        await delay(500); // 0.5초 딜레이
    }

    // 장르가 채워진 데이터를 다시 덮어쓰기
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    fs.writeFileSync(histPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('✅ 장르 업데이트 완료!');
}
patchGenres();
