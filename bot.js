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

// --- Data Storage ---
const dailyLogs = {}; // { chatId: { messageId, date, walks: [] } }

// --- /dog Command Handler ---
bot.onText(/\/dog/, async (msg) => {
    const chatId = msg.chat.id;
    const date = getCurrentDate();
    const time = getCurrentTime();

    if (!dailyLogs[chatId] || dailyLogs[chatId].date !== date) {
        // First walk of the day or new day, create new entry
        const text = `${date}\nWalk 1: ${time}`;
        try {
            const sentMsg = await bot.sendMessage(chatId, text);
            dailyLogs[chatId] = { messageId: sentMsg.message_id, date, walks: [time] };
        } catch (err) {
            console.error('Error sending initial message:', err);
        }
    } else {
        // Existing message for today, append new walk
        dailyLogs[chatId].walks.push(time);
        const walksText = dailyLogs[chatId].walks.map((t, i) => `Walk ${i + 1}: ${t}`).join('\n');
        const text = `${date}\n${walksText}`;
        try {
            await bot.editMessageText(text, { chat_id: chatId, message_id: dailyLogs[chatId].messageId });
        } catch (err) {
            console.error('Error editing message:', err);
        }
    }
});

// --- Daily Reset at Midnight ---
const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
cron.schedule('0 0 * * *', () => {
    console.log('Resetting daily logs for new day...');
    for (const chatId in dailyLogs) {
        dailyLogs[chatId].walks = [];
        dailyLogs[chatId].date = getCurrentDate(); // Update to new day
        dailyLogs[chatId].messageId = null; // Will create new message on next /dog
    }
}, { timezone: userTimezone });

console.log('Dog walking logger bot is running...');
