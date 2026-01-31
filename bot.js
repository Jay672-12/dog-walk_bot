const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

// Get current date in DDMMYY format
function getCurrentDate() {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(2);
    return `${day}${month}${year}`;
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
    
    // Initialize date if not exists
    if (!dogWalks[currentDate]) {
        dogWalks[currentDate] = [];
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
/help - Show this help message

The bot automatically updates the daily summary each time you log a new walk!
    `;
    
    await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
}

// Daily reset and summary trigger
function scheduleDailyTasks() {
    // Schedule at midnight to reset and send summary
    cron.schedule('0 0 * * *', async () => {
        console.log('Running daily tasks...');
        
        // Send final summary to all active chats
        for (const chatId of Object.keys(lastDailyMessage)) {
            const previousDate = lastDailyMessage[chatId].date;
            const previousWalks = dogWalks[previousDate] || [];
            
            if (previousWalks.length > 0) {
                const summary = formatDailySummary(previousDate, previousWalks);
                try {
                    await bot.sendMessage(chatId, `📊 **Final Daily Summary:**\n\n${summary}`, { parse_mode: 'Markdown' });
                } catch (error) {
                    console.error('Error sending final summary:', error);
                }
            }
        }
        
        // Reset for new day
        lastDailyMessage = {};
    });
    
    console.log('Daily tasks scheduled');
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