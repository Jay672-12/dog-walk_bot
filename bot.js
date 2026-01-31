const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
require('dotenv').config();

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// --- Helper Functions ---
function getCurrentDate() {
    const tz = process.env.TIMEZONE || 'Asia/Singapore';
    const now = new Date();
    try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: '2-digit', month: '2-digit', year: '2-digit' })
            .formatToParts(now);
        const day = parts.find(p => p.type === 'day')?.value || '01';
        const month = parts.find(p => p.type === 'month')?.value || '01';
        const year = parts.find(p => p.type === 'year')?.value || '24';
        return `${day}${month}${year}`;
    } catch {
        const d = now.getUTCDate().toString().padStart(2, '0');
        const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
        const y = now.getUTCFullYear().toString().slice(2);
        return `${d}${m}${y}`;
    }
}

function getCurrentTime() {
    const tz = process.env.TIMEZONE || 'Asia/Singapore';
    const now = new Date();
    try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
            .formatToParts(now);
        const h = parts.find(p => p.type === 'hour')?.value || '00';
        const m = parts.find(p => p.type === 'minute')?.value || '00';
        return `${h}${m}`;
    } catch {
        const nowUTC = new Date();
        return `${String(nowUTC.getUTCHours()).padStart(2, '0')}${String(nowUTC.getUTCMinutes()).padStart(2, '0')}`;
    }
}

// Random walk emoji
const walkEmojis = ['💩', '💦', '🐶', '🐾', '🦴'];
function getRandomEmoji() {
    return walkEmojis[Math.floor(Math.random() * walkEmojis.length)];
}

// --- Data Storage ---
const dailyLogs = {}; // { chatId: { messageId, date, walks: [{time, emoji}] } }

// --- Helper: Update Message Text ---
async function updateDailyMessage(chatId) {
    const log = dailyLogs[chatId];
    if (!log || !log.walks.length) return;

    const walksText = log.walks
        .map((w, i) => `Walk ${i + 1}: ${w.time} ${w.emoji}`)
        .join('\n');

    const text = `🐕 ${log.date}\n${walksText}`;
    try {
        await bot.editMessageText(text, { chat_id: chatId, message_id: log.messageId });
    } catch (err) {
        console.error('Error editing daily message:', err);
    }
}

// --- /dog Command Handler ---
bot.onText(/\/dog/, async (msg) => {
    const chatId = msg.chat.id;
    const date = getCurrentDate();
    const time = getCurrentTime();
    const emoji = getRandomEmoji();

    if (!dailyLogs[chatId] || dailyLogs[chatId].date !== date) {
        // First walk of the day
        const text = `🐕 ${date}\nWalk 1: ${time} ${emoji}`;
        try {
            const sentMsg = await bot.sendMessage(chatId, text);
            dailyLogs[chatId] = { messageId: sentMsg.message_id, date, walks: [{ time, emoji }] };
        } catch (err) {
            console.error('Error sending initial message:', err);
        }
    } else {
        // Append new walk
        dailyLogs[chatId].walks.push({ time, emoji });
        await updateDailyMessage(chatId);
    }
});

// --- Manual Time Handler: /HHMM ---
bot.onText(/\/([0-2][0-9][0-5][0-9])/, async (msg, match) => {
    const chatId = msg.chat.id;
    const inputTime = match[1]; // HHMM
    const date = getCurrentDate();
    const emoji = getRandomEmoji();

    if (!dailyLogs[chatId] || dailyLogs[chatId].date !== date) {
        // First walk of the day
        const text = `🐕 ${date}\nWalk 1: ${inputTime} ${emoji}`;
        try {
            const sentMsg = await bot.sendMessage(chatId, text);
            dailyLogs[chatId] = { messageId: sentMsg.message_id, date, walks: [{ time: inputTime, emoji }] };
        } catch (err) {
            console.error('Error sending initial manual message:', err);
        }
    } else {
        // Append new walk
        dailyLogs[chatId].walks.push({ time: inputTime, emoji });
        await updateDailyMessage(chatId);
    }
});

// --- Daily Reset at Midnight ---
const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
cron.schedule('0 0 * * *', () => {
    console.log('Resetting daily logs for new day...');
    for (const chatId in dailyLogs) {
        dailyLogs[chatId].walks = [];
        dailyLogs[chatId].date = getCurrentDate();
        dailyLogs[chatId].messageId = null;
    }
}, { timezone: userTimezone });

console.log('Dog walking logger bot is running...');
