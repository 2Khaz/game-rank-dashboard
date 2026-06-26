import fs from 'fs';
import path from 'path';

console.log("=== 13시 쓰레기 데이터 삭제 및 14시 순위 롤백 스크립트 ===");

// 1. 13시 파일 삭제
const history13Path = './history/2026-06-26_13.json';
if (fs.existsSync(history13Path)) {
    fs.unlinkSync(history13Path);
    console.log("🗑️ 2026-06-26_13.json 파일 삭제 완료.");
}

// 2. history_list.json에서 13시 기록 제거
const listPath = './history/history_list.json';
if (fs.existsSync(listPath)) {
    let list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
    list = list.filter(item => item !== "2026-06-26_13");
    fs.writeFileSync(listPath, JSON.stringify(list, null, 2), 'utf8');
    console.log("🗑️ history_list.json에서 13시 기록 제거 완료.");
}

// 3. 14시 데이터를 25일 08시 기준으로 순위 변동 재계산
const prevPath = './history/2026-06-25_08.json';
const currentPath = './history/2026-06-26_14.json';

if (fs.existsSync(prevPath) && fs.existsSync(currentPath)) {
    const prevData = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
    const currentData = JSON.parse(fs.readFileSync(currentPath, 'utf8'));

    function enrichDataWithRankChange(currentList, previousData) {
        const previousRanks = {};
        previousData.forEach((g, index) => {
            const id = g.appId || g.title || g.name;
            previousRanks[id] = index + 1;
        });

        currentList.forEach((game, index) => {
            const id = game.appId || game.title || game.name;
            const currentRank = index + 1;
            game.rankChange = previousRanks[id] ? previousRanks[id] - currentRank : 'new';
        });
    }

    enrichDataWithRankChange(currentData.steamGlobal, prevData.steamGlobal);
    enrichDataWithRankChange(currentData.playKr, prevData.playKr);

    fs.writeFileSync(currentPath, JSON.stringify(currentData, null, 2), 'utf8');
    fs.writeFileSync('./data.json', JSON.stringify(currentData, null, 2), 'utf8');
    console.log("✅ 14시 데이터 순위 변동 수치(25일 기준) 롤백 및 덮어쓰기 완료.");
} else {
    console.log("⚠️ 이전 데이터 파일이 없어 순위 롤백을 건너뜁니다.");
}
