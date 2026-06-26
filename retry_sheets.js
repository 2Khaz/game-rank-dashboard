import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import fs from 'fs';
import path from 'path';

const SERVICE_ACCOUNT_FILE = './credentials.json';
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1ONFeWZTqMXIsWtx9xoRYxcW7lTde56yfvyKUXDi8c3c/edit?gid=1490331569#gid=1490331569';
const spreadsheetId = SPREADSHEET_URL.match(/\/d\/([a-zA-Z0-9-_]+)/)[1];

async function sendDiscordAlert(message) {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;
    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message })
        });
    } catch (e) {
        console.error("디스코드 알림 전송 실패:", e.message);
    }
}

async function writePendingData() {
    const pendingFile = path.join(process.cwd(), 'pending_sheets.json');
    if (!fs.existsSync(pendingFile)) {
        console.log("No pending data to process.");
        return;
    }

    let pendingQueue = [];
    try {
        pendingQueue = JSON.parse(fs.readFileSync(pendingFile, 'utf8'));
    } catch (e) {
        console.error("Failed to parse pending_sheets.json");
        return;
    }

    if (pendingQueue.length === 0) {
        console.log("Pending queue is empty.");
        return;
    }

    console.log(`Found ${pendingQueue.length} pending items. Attempting to write to Google Sheets...`);

    if (!fs.existsSync(SERVICE_ACCOUNT_FILE)) {
        console.error("credentials.json not found.");
        return;
    }

    const credsRaw = fs.readFileSync(SERVICE_ACCOUNT_FILE, 'utf8');
    const creds = JSON.parse(credsRaw);
    const jwt = new JWT({
        email: creds.client_email,
        key: creds.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
    });

    const doc = new GoogleSpreadsheet(spreadsheetId, jwt);
    
    try {
        await doc.loadInfo();
    } catch (e) {
        console.error("Failed to connect to Google Sheets:", e.message);
        return; 
    }

    let successCount = 0;
    const remainingQueue = [];

    for (let item of pendingQueue) {
        const { timestamp, steamGlobal, playKr } = item;
        const sheetTitle = timestamp; // 기존 탭이름 규칙 동일 (예: 2026-06-26 10)
        
        try {
            let sheet = doc.sheetsByTitle[sheetTitle];
            
            // 기존 시트가 없을 때만 새로 생성
            if (!sheet) {
                console.log(`새 시트 생성 중: ${sheetTitle}`);
                
                const titles = doc.sheetsByIndex.map(s => s.title);
                titles.push(sheetTitle);
                titles.sort(); // 오름차순 정렬
                const correctIndex = titles.indexOf(sheetTitle);
                
                sheet = await doc.addSheet({ 
                    title: sheetTitle, 
                    headerValues: ['스팀순위', '스팀게임명', '스팀제작사', '플레이스토어순위', '플레이게임명', '플레이제작사'],
                    gridProperties: { rowCount: 105, columnCount: 10 },
                    index: correctIndex
                });
                
                await doc.loadInfo(); 
                const currentSheet = doc.sheetsByTitle[sheetTitle];
                if (currentSheet && currentSheet.index !== correctIndex) {
                    await currentSheet.updateProperties({ index: correctIndex });
                }
            }

            // [수정된 부분] 범위를 넉넉히 잡아서 에러 방지 후, 기존 데이터를 빈칸('')으로 깔끔하게 지우기
            await sheet.loadCells('A1:F105');
            for(let c=0; c<6; c++) {
                for(let r=1; r<=100; r++) {
                    const cell = sheet.getCell(r, c);
                    if (cell.value !== null && cell.value !== '') cell.value = '';
                }
            }

            // 새로운 데이터로 덮어쓰기
            const maxRows = Math.max(steamGlobal.length, playKr.length);
            for (let i = 0; i < maxRows; i++) {
                const rowIdx = i + 1; 
                if (i < steamGlobal.length) {
                    sheet.getCell(rowIdx, 0).value = i + 1;
                    sheet.getCell(rowIdx, 1).value = steamGlobal[i].name || '';
                    sheet.getCell(rowIdx, 2).value = steamGlobal[i].publisher || '';
                }
                if (i < playKr.length) {
                    sheet.getCell(rowIdx, 4).value = i + 1;
                    sheet.getCell(rowIdx, 5).value = playKr[i].title || '';
                    sheet.getCell(rowIdx, 6).value = playKr[i].developer || '';
                }
            }

            console.log(`데이터 기록 중: ${sheetTitle}`);
            await sheet.saveUpdatedCells();
            console.log(`✅ [${sheetTitle}] 구글 시트 복구 완료!`);
            successCount++;
        } catch (e) {
            console.error(`❌ [${sheetTitle}] 구글 시트 복구 실패:`, e.message);
            remainingQueue.push(item);
        }
    }

    // 성공한 데이터는 지워주고 실패한 데이터만 남김
    if (successCount > 0 || remainingQueue.length !== pendingQueue.length) {
        fs.writeFileSync(pendingFile, JSON.stringify(remainingQueue, null, 2), 'utf8');
    }
    
    if (successCount > 0) {
        await sendDiscordAlert(`✅ **밀린 구글 시트 데이터 복구 완료!**\n총 ${successCount}건의 데이터가 성공적으로 구글 시트에 기록되었습니다.`);
    }
}

writePendingData().catch(console.error);
