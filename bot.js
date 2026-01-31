const path = require('path');
require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');

// Log environment for debugging
console.log('=== Bot Environment ===');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing');
console.log('GROUP_CHAT_ID:', process.env.GROUP_CHAT_ID ? '✅ Set' : '❌ Missing');
console.log('TIMEZONE:', process.env.TIMEZONE || '❌ Not set (will use default)');
console.log('NODE_ENV:', process.env.NODE_ENV || '❌ Not set');
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || '❌ Not set');
console.log('==========================');

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Placeholder for storing last daily messages per chat
let lastDailyMessage = {};

// --- Helper Functions ---

// Get current date in DDMMYY format with timezone support
function getCurrentDate() {
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    const now = new Date();

    try {
        const options = { timeZone: userTimezone, year: '2-digit', month: '2-digit', day: '2-digit' };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);

        const day = parts.find(p => p.type === 'day')?.value || '01';
        const month = parts.find(p => p.type === 'month')?.value || '01';
        const year = parts.find(p => p.type === 'year')?.value || '24';

        const result = `${day}${month}${year}`;
        console.log('Formatted date (DDMMYY):', result);
        return result;
    } catch (error) {
        console.error('Error formatting date:', error);
        const fallbackNow = new Date();
        const day = String(fallbackNow.getUTCDate()).padStart(2, '0');
        const month = String(fallbackNow.getUTCMonth() + 1).padStart(2, '0');
        const year = String(fallbackNow.getUTCFullYear()).slice(2);
        return `${day}${month}${year}`;
    }
}

// Get current time in HHMM format with timezone support
function getCurrentTime() {
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    const now = new Date();

    try {
        const options = { timeZone: userTimezone, hour: '2-digit', minute: '2-digit', hour12: false };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);

        const hours = parts.find(p => p.type === 'hour')?.value || '00';
        const minutes = parts.find(p => p.type === 'minute')?.value || '00';

        const result = `${hours}${minutes}`;
        console.log('Formatted time (HHMM):', result);
        return result;
    } catch (error) {
        console.error('Error formatting time:', error);
        const fallbackNow = new Date();
        const hours = String(fallbackNow.getUTCHours()).padStart(2, '0');
        const minutes = String(fallbackNow.getUTCMinutes()).padStart(2, '0');
        return `${hours}${minutes}`;
    }
}

// Example function to format daily summary
function formatDailySummary(date, walks) {
    return walks.map((w, i) => `${i + 1}. ${w}`).join('\n') || 'No walks recorded today.';
}

// --- Daily Reset and Summary Task ---
function scheduleDailyTasks() {
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    console.log('Scheduling daily tasks for timezone:', userTimezone);

    // Runs at midnight in user's timezone
    cron.schedule('0 0 * * *', async () => {
        console.log('Running daily tasks at midnight...');
        console.log('User timezone:', userTimezone);

        const previousDate = getCurrentDate();
        const previousWalks = ['Example walk 1', 'Example walk 2']; // Replace with actual walk data

        // Send final summary to all active chats
        for (const chatId of Object.keys(lastDailyMessage)) {
            const summary = formatDailySummary(previousDate, previousWalks);
            try {
                await bot.sendMessage(chatId, `📊 **Final Daily Summary:**\n\n${summary}`, { parse_mode: 'Markdown' });
                console.log(`Sent final summary to chat ${chatId}`);
            } catch (error) {
                console.error('Error sending final summary:', error);
            }
        }

        // Reset for new day
        lastDailyMessage = {};
        console.log('Daily messages reset for new day');
    }, {
        timezone: userTimezone
    });

    console.log('Daily tasks scheduled successfully.');
}

// --- Message Handler ---
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    console.log(`Received message from chat ${chatId}: ${msg.text}`);

    // Example: store last message
    lastDailyMessage[chatId] = msg.text;

    bot.sendMessage(chatId, `Received your message at ${getCurrentTime()} on ${getCurrentDate()}`);
});

// --- Start Daily Tasks ---
scheduleDailyTasks();
