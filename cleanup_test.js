import fs from 'fs';
import path from 'path';

const targetTime = process.argv[2];
if (!targetTime) {
    console.error("지울 시간을 입력해주세요. (예: 2026-06-30_09)");
    process.exit(1);
}

const historyDir = path.join(process.cwd(), 'history');
const targetFile = path.join(historyDir, `${targetTime}.json`);

// 1. 해당 json 파일 삭제
if (fs.existsSync(targetFile)) {
    fs.unlinkSync(targetFile);
    console.log(`🗑️ [1/5] ${targetTime}.json 파일이 안전하게 삭제되었습니다.`);
} else {
    console.log(`⚠️ [1/5] ${targetTime}.json 파일이 이미 존재하지 않습니다. 계속 진행합니다.`);
}

// 2. 남은 파일들을 시간순(오름차순)으로 정렬하여 찌꺼기 기록 교정 및 Streak 전면 재계산
console.log("🛠️ [2/5] 남은 데이터들을 연대순으로 정렬하여 Streak(연속 일수)를 오차 없이 재계산합니다...");
const files = fs.readdirSync(historyDir).filter(f => f.endsWith('.json') && f !== 'game_streaks.json' && f !== 'history_list.json');
files.sort((a, b) => new Date(a.replace('.json', '').replace('_', 'T') + ':00') - new Date(b.replace('.json', '').replace('_', 'T') + ':00'));

let streaks = {};
let previousSteam = [];
let previousPlay = [];

function enrichDataWithRankAndStreak(currentList, platformName, previousData, streaks) {
    const previousRanks = {};
    if (previousData) {
        previousData.forEach((g, index) => {
            const id = g.appId || g.title || g.name;
            previousRanks[id] = index + 1;
        });
    }

    currentList.forEach((game, index) => {
        const id = game.appId || game.title || game.name;
        const currentRank = index + 1;
        
        if (previousRanks[id]) {
            game.rankChange = previousRanks[id] - currentRank;
        } else {
            game.rankChange = 'new';
        }

        const newStreakKey = `${platformName}_${id}`;
        const oldStreakKey = `${platformName}_${game.title || game.name}`;

        if (streaks[oldStreakKey] !== undefined && newStreakKey !== oldStreakKey) {
            streaks[newStreakKey] = streaks[oldStreakKey];
            delete streaks[oldStreakKey];
        }

        if (streaks[newStreakKey]) {
            streaks[newStreakKey] += 1;
        } else {
            streaks[newStreakKey] = 1;
        }
        game.streak = streaks[newStreakKey];
    });

    return currentList;
}

function cleanupStreaks(currentSteam, currentPlay, streaks) {
    const activeKeys = new Set();
    currentSteam.forEach(g => activeKeys.add(`steam_${g.appId || g.name}`));
    currentPlay.forEach(g => activeKeys.add(`play_${g.appId || g.title}`));

    for (let key in streaks) {
        if (!activeKeys.has(key)) {
            delete streaks[key];
        }
    }
}

let latestData = null;
let historyList = [];

for (const file of files) {
    const filePath = path.join(historyDir, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const currentSteam = data.steamGlobal || [];
    const currentPlay = data.playKr || [];

    enrichDataWithRankAndStreak(currentSteam, 'steam', previousSteam, streaks);
    enrichDataWithRankAndStreak(currentPlay, 'play', previousPlay, streaks);
    cleanupStreaks(currentSteam, currentPlay, streaks);

    previousSteam = currentSteam;
    previousPlay = currentPlay;
    
    // 교정된 Streak 값으로 파일 덮어쓰기 (과거 파일 내부의 잘못된 상승/하락 기록 자가 치유)
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    latestData = data;
    historyList.push(file.replace('.json', ''));
}

// 3. history_list.json 최신화 (내림차순)
console.log("📝 [3/5] history_list.json 갱신 중...");
historyList.sort((a, b) => new Date(b.replace('_', 'T') + ':00') - new Date(a.replace('_', 'T') + ':00'));
fs.writeFileSync(path.join(historyDir, 'history_list.json'), JSON.stringify(historyList, null, 2), 'utf8');

// 4. game_streaks.json 최신화
console.log("📝 [4/5] game_streaks.json 복구 중...");
fs.writeFileSync(path.join(historyDir, 'game_streaks.json'), JSON.stringify(streaks, null, 2), 'utf8');

// 5. data.json 복구 (메인 대시보드 롤백)
console.log("🔄 [5/5] 메인 대시보드 화면(data.json) 롤백 중...");
if (latestData) {
    fs.writeFileSync(path.join(process.cwd(), 'data.json'), JSON.stringify(latestData, null, 2), 'utf8');
    console.log(`✅ 대시보드가 성공적으로 ${historyList[0]} 시점 기준으로 완벽하게 롤백되었습니다.`);
}

console.log("🚀 테스트 데이터 클린업 및 시스템 롤백 작업이 모두 완료되었습니다!");
