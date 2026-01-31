const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
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

// Data storage
const DATA_FILE = path.join(__dirname, 'dogwalks.json');
let dogWalks = {};
let lastDailyMessage = {};

// Load existing data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(data);
            dogWalks = parsed.dogWalks || {};
            lastDailyMessage = parsed.lastDailyMessage || {};
        }
    } catch (error) {
        console.error('Error loading data:', error);
        dogWalks = {};
        lastDailyMessage = {};
    }
}

// Save data
function saveData() {
    try {
        const data = {
            dogWalks,
            lastDailyMessage
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Error saving data:', error);
    }
}

// Get current date in DDMMYY format with timezone support
function getCurrentDate() {
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    const now = new Date();
    
    try {
        // Create date in user's timezone
        const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
        
        // Format as DDMMYY
        const day = String(userTime.getDate()).padStart(2, '0');
        const month = String(userTime.getMonth() +1).padStart(2, '0');
        const year = String(userTime.getFullYear()).slice(2);
        
        const result = `${day}${month}${year}`;
        
        console.log('UTC time:', now.toISOString());
        console.log('Local time in', userTimezone + ':', userTime.toDateString());
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
    
    try {
        // Create time in user's timezone
        const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
        
        // Format as HHMM in 24-hour format
        const hours = String(userTime.getHours()).padStart(2, '0');
        const minutes = String(userTime.getMinutes()).padStart(2, '0');
        const result = `${hours}${minutes}`;
        
        console.log('UTC time:', now.toISOString());
        console.log('Local time in', userTimezone + ':', userTime.toTimeString());
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
function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}${minutes}`;
}

// Format daily summary
function formatDailySummary(date, walks) {
    let summary = `${date}\n`;
    walks.forEach((walk, index) => {
        summary += `Walk ${index + 1}: ${walk.time}\n`;
    });
    return summary.trim();
}

// Send message with chaining logic
async function sendDailySummary(chatId, forceNew = false) {
    const currentDate = getCurrentDate();
    const walks = dogWalks[currentDate] || [];
    
    if (walks.length === 0) {
        return; // No walks to summarize
    }

    const summary = formatDailySummary(currentDate, walks);
    
    // Check if we should send new message or edit existing one
    if (lastDailyMessage[chatId] && lastDailyMessage[chatId].date === currentDate && !forceNew) {
        try {
            // Edit existing message
            await bot.editMessageText(summary, {
                chat_id: chatId,
                message_id: lastDailyMessage[chatId].messageId
            });
            console.log(`Edited daily summary for chat ${chatId}`);
        } catch (error) {
            console.error('Error editing message:', error);
            // If editing fails, send new message
            await sendNewMessage(chatId, summary);
        }
    } else {
        await sendNewMessage(chatId, summary);
    }
}

// Send new message and store details
async function sendNewMessage(chatId, summary) {
    try {
        const message = await bot.sendMessage(chatId, summary);
        const currentDate = getCurrentDate();
        
        // Store message details for chaining
        lastDailyMessage[chatId] = {
            messageId: message.message_id,
            date: currentDate
        };
        
        saveData();
        console.log(`Sent new daily summary for chat ${chatId}`);
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Handle /dogwalk command
async function handleDogWalk(msg) {
    const chatId = msg.chat.id;
    const currentDate = getCurrentDate();
    const currentTime = getCurrentTime();
    
    // Debug logging
    const now = new Date();
    console.log('=== Dog Walk Recorded ===');
    console.log('Message time (UTC):', now.toISOString());
    console.log('Formatted date (DDMMYY):', currentDate);
    console.log('Formatted time (HHMM):', currentTime);
    console.log('User timezone:', process.env.TIMEZONE || 'Asia/Singapore');
    
    // Initialize date if not exists
    if (!dogWalks[currentDate]) {
        dogWalks[currentDate] = [];
    }
    
    // Add new walk with both local and UTC timestamps
    dogWalks[currentDate].push({
        time: currentTime,
        timestamp: now.toISOString(),
        user: msg.from.first_name || msg.from.username,
        timezone: process.env.TIMEZONE || 'Asia/Singapore'
    });
    
    saveData();
    
    // Send/chain daily summary
    await sendDailySummary(chatId);
    
    // Confirm to user with timezone info
    await bot.sendMessage(chatId, `✅ Dog walk recorded at ${currentTime} (${process.env.TIMEZONE || 'Asia/Singapore'})!`);
}
    
    // Add new walk
    dogWalks[currentDate].push({
        time: currentTime,
        timestamp: new Date().toISOString(),
        user: msg.from.first_name || msg.from.username
    });
    
    saveData();
    
    // Send/chain the daily summary
    await sendDailySummary(chatId);
    
    // Confirm to user
    await bot.sendMessage(chatId, `✅ Dog walk recorded at ${currentTime}!`);
}

// Handle /summary command
async function handleSummary(msg) {
    const chatId = msg.chat.id;
    const currentDate = getCurrentDate();
    const walks = dogWalks[currentDate] || [];
    
    if (walks.length === 0) {
        await bot.sendMessage(chatId, '🐕 No dog walks recorded today yet!');
    } else {
        const summary = formatDailySummary(currentDate, walks);
        await bot.sendMessage(chatId, summary);
    }
}

// Handle /help command
async function handleHelp(msg) {
    const helpText = `
🐕 **Dog Walk Bot Commands:**

/dogwalk - Record a dog walk
/summary - Show today's walk summary
/time - Check current time and timezone
/help - Show this help message

The bot automatically updates the daily summary each time you log a new walk!
    `;
    
    await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
}

// Handle /time command for debugging
async function handleTime(msg) {
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    const now = new Date();
    
    // Get local time
    const localTime = now.toLocaleTimeString('en-US', {
        timeZone: userTimezone,
        hour12: false
    });
    
    // Get local date
    const localDate = now.toLocaleDateString('en-US', {
        timeZone: userTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    // Get UTC time for comparison
    const utcTime = now.toTimeString('en-US', { 
        timeZone: 'UTC', 
        hour12: false 
    });
    
    const timeInfo = `🕐 **Current Time Information:**

🌍 **Your Timezone:** ${userTimezone}
📅 **Local Date:** ${localDate}
🕰 **Local Time:** ${localTime}
🌐 **UTC Time:** ${utcTime}
📝 **Bot Time Format:** ${getCurrentDate()} ${getCurrentTime()}

**Time Format Used:** DDMMYY HHMM (24-hour)`;
    
    await bot.sendMessage(msg.chat.id, timeInfo, { parse_mode: 'Markdown' });
}

// Daily reset and summary trigger
function scheduleDailyTasks() {
    // Better timezone handling for Railway
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    console.log(`Using timezone: ${userTimezone}`);
    
    // Schedule at midnight in user's timezone
    cron.schedule('0 0 * * *', async () => {
        console.log('=== Running Daily Tasks ===');
        console.log('Scheduled timezone:', userTimezone);
        
        const now = new Date();
        console.log('Current UTC time:', now.toISOString());
        
        // Show what time it is in user's timezone
        const localTime = now.toLocaleTimeString('en-US', {
            timeZone: userTimezone,
            hour12: false
        });
        console.log('Local time in timezone:', localTime);
        
        // Send final summary to all active chats
        for (const chatId of Object.keys(lastDailyMessage)) {
            const previousDate = lastDailyMessage[chatId].date;
            const previousWalks = dogWalks[previousDate] || [];
            
            if (previousWalks.length > 0) {
                const summary = formatDailySummary(previousDate, previousWalks);
                try {
                    await bot.sendMessage(chatId, `📊 **Final Daily Summary:**\n\n${summary}`, { parse_mode: 'Markdown' });
                    console.log(`Sent final summary to chat ${chatId}`);
                } catch (error) {
                    console.error('Error sending final summary:', error);
                }
            }
        }
        
        // Reset for new day
        lastDailyMessage = {};
    }, {
        timezone: userTimezone
    });
    
    console.log('Daily tasks scheduled for timezone:', userTimezone);
}

// Message handler
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim();
    
    // Ignore messages without text
    if (!text) return;
    
    // Handle commands
    if (text.startsWith('/')) {
        const command = text.toLowerCase();
        
        switch (command) {
            case '/dogwalk':
                await handleDogWalk(msg);
                break;
            case '/summary':
                await handleSummary(msg);
                break;
            case '/time':
                await handleTime(msg);
                break;
            case '/help':
            case '/start':
                await handleHelp(msg);
                break;
            default:
                // Unknown command
                break;
        }
    }
});

// Error handler
bot.on('polling_error', (error) => {
    console.error('Telegram bot polling error:', error);
});

// Initialize
console.log('🐕 Starting Dog Walk Bot...');
loadData();
scheduleDailyTasks();
console.log('✅ Dog Walk Bot is ready!');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down gracefully...');
    saveData();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Shutting down gracefully...');
    saveData();
    process.exit(0);
});