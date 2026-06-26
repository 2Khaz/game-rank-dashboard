import fs from 'fs';

console.log("=== 13시 삭제, 14시 순위 롤백 및 연속 11일 수정 스크립트 ===");

// 1. 13시 파일 삭제
const history13Path = './history/2026-06-26_13.json';
if (fs.existsSync(history13Path)) {
    fs.unlinkSync(history13Path);
    console.log("🗑️ 2026-06-26_13.json 삭제 완료.");
}

// 2. history_list.json에서 13시 기록 제거
const listPath = './history/history_list.json';
if (fs.existsSync(listPath)) {
    let list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    list = list.filter(item => item !== "2026-06-26_13");
    fs.writeFileSync(listPath, JSON.stringify(list, null, 2), 'utf8');
    console.log("🗑️ history_list.json에서 13시 제거 완료.");
}

// 3. 14시 데이터와 25일 장부 불러오기
const prevPath = './history/2026-06-25_08.json';
const currentPath = './history/2026-06-26_14.json';
const streaksPath = './history/game_streaks.json';

if (fs.existsSync(prevPath) && fs.existsSync(currentPath)) {
    const prevData = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
    
    // 4. 연속 일수(streak) 장부를 모두 +1일씩 강제 증가시키기
    let streaks = {};
    if (fs.existsSync(streaksPath)) {
        streaks = JSON.parse(fs.readFileSync(streaksPath, 'utf8'));
        for (let key in streaks) {
            streaks[key] += 1; // 10일 -> 11일로 모두 업데이트!
        }
        fs.writeFileSync(streaksPath, JSON.stringify(streaks, null, 2), 'utf8');
    }

    // 5. 순위 변동 수치 및 연속 일수 적용 함수
    function enrichData(currentList, previousData, platform) {
        const previousRanks = {};
        previousData.forEach((g, index) => {
            const id = g.appId || g.title || g.name;
            previousRanks[id] = index + 1;
        });

        currentList.forEach((game, index) => {
            const id = game.appId || game.title || game.name;
            
            // 순위 변동 롤백 (25일 기준)
            const currentRank = index + 1;
            game.rankChange = previousRanks[id] ? previousRanks[id] - currentRank : 'new';
            
            // 방금 +1 더해준 연속 일수를 데이터에 적용
            const streakKey = `${platform}_${id}`;
            game.streak = streaks[streakKey] || 1;
        });
    }

    enrichData(currentData.steamGlobal, prevData.steamGlobal, 'steam');
    enrichData(currentData.playKr, prevData.playKr, 'play');

    // 6. 예쁘게 완성된 14시 데이터를 덮어쓰기
    fs.writeFileSync(currentPath, JSON.stringify(currentData, null, 2), 'utf8');
    fs.writeFileSync('./data.json', JSON.stringify(currentData, null, 2), 'utf8');
    console.log("✅ 14시 순위 변동 롤백 및 연속 11일 수정 완벽 반영되었습니다!");
} else {
    console.log("⚠️ 이전 데이터 파일이 없어 처리를 건너뜁니다.");
}
