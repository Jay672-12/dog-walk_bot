const path = require('path');
require('dotenv').config();

// Log environment for debugging
console.log('=== Bot Environment ===');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TEGRAM_BOT_TOKEN ? '✅ Set' : '❌ Missing');
console.log('GROUP_CHAT_ID:', process.env.GROUP_CHAT_ID ? '✅ Set' : '❌ Missing');
console.log('TIMEZONE:', process.env.TIMEZONE || '❌ Not set (will use default)');
console.log('NODE_ENV:', process.env.NODE_ENV || '❌ Not set');
console.log('RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT || '❌ Not set');
console.log('==========================');

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

@@ -41,13 +50,77 @@ function saveData() {
}
}

// Get current date in DDMMYY format
// Get current date in DDMMYY format with timezone support
function getCurrentDate() {
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    const now = new Date();
    
    console.log('Current UTC time:', now.toISOString());
    console.log('Using timezone:', userTimezone);
    
    try {
        // Format date in user's timezone
        const options = {
            timeZone: userTimezone,
            year: '2-digit',
            month: '2-digit',
            day: '2-digit'
        };
        
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);
        
        const day = parts.find(part => part.type === 'day')?.value || '01';
        const month = parts.find(part => part.type === 'month')?.value || '01';
        const year = parts.find(part => part.type === 'year')?.value || '24';
        
        const result = `${day}${month}${year}`;
        console.log('Formatted date (DDMMYY):', result);
        
        return result;
    } catch (error) {
        console.error('Error formatting date:', error);
        // Fallback to UTC
        const fallbackNow = new Date();
        const day = String(fallbackNow.getDate()).padStart(2, '0');
        const month = String(fallbackNow.getMonth() +1).padStart(2, '0');
        const year = String(fallbackNow.getFullYear()).slice(2);
        return `${day}${month}${year}`;
    }
}

// Get current time in HHMM format with timezone support
function getCurrentTime() {
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(2);
    return `${day}${month}${year}`;
    
    try {
        // Format time in user's timezone
        const options = {
            timeZone: userTimezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);
        
        const hours = parts.find(part => part.type === 'hour')?.value || '00';
        const minutes = parts.find(part => part.type === 'minute')?.value || '00';
        
        const result = `${hours}${minutes}`;
        console.log('Formatted time (HHMM):', result);
        
        return result;
    } catch (error) {
        console.error('Error formatting time:', error);
        // Fallback to UTC
        const fallbackNow = new Date();
        const hours = String(fallbackNow.getHours()).padStart(2, '0');
        const minutes = String(fallbackNow.getMinutes()).padStart(2, '0');
        return `${hours}${minutes}`;
    }
}

// Get current time in HHMM format
@@ -174,9 +247,17 @@ The bot automatically updates the daily summary each time you log a new walk!

// Daily reset and summary trigger
function scheduleDailyTasks() {
    // Schedule at midnight to reset and send summary
    // Better timezone handling for Railway
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    console.log(`Using timezone: ${userTimezone}`);
    
    // Schedule at midnight in user's timezone
cron.schedule('0 0 * * *', async () => {
        console.log('Running daily tasks...');
        console.log('Running daily tasks at midnight..._timezone:', userTimezone);
        
        // Get current date in user's timezone
        const now = new Date();
        console.log('Current time (UTC):', now.toISOString());

// Send final summary to all active chats
for (const chatId of Object.keys(lastDailyMessage)) {
@@ -187,6 +268,7 @@ function scheduleDailyTasks() {
const summary = formatDailySummary(previousDate, previousWalks);
try {
await bot.sendMessage(chatId, `📊 **Final Daily Summary:**\n\n${summary}`, { parse_mode: 'Markdown' });
                    console.log(`Sent final summary to chat ${chatId}`);
} catch (error) {
console.error('Error sending final summary:', error);
}
@@ -195,9 +277,11 @@ function scheduleDailyTasks() {

// Reset for new day
lastDailyMessage = {};
    }, {
        timezone: userTimezone
});

    console.log('Daily tasks scheduled');
    console.log('Daily tasks scheduled for timezone:', userTimezone);
}

// Message handler
