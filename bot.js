const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 Starting Dog Walk Bot...');

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Data storage
const DATA_FILE = path.join(__dirname, 'dogwalks.json');
let dogWalks = {};
let lastDailyMessage = {};
let autoProgressTimer = null;

// Load existing data
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(data);
            dogWalks = parsed.dogWalks || {};
            lastDailyMessage = parsed.lastDailyMessage || {};
            console.log('✅ Data loaded successfully');
        } else {
            console.log('📝 No existing data, starting fresh');
            dogWalks = {};
            lastDailyMessage = {};
        }
    } catch (error) {
        console.error('💥 Error loading data:', error.message);
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
        console.log('💾 Data saved successfully');
    } catch (error) {
        console.error('💥 Error saving data:', error.message);
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
        console.log('ℹ️ No walks to summarize for chat', chatId);
        return;
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
            console.log('✅ Edited daily summary for chat', chatId);
        } catch (error) {
            console.error('💥 Error editing message:', error.message);
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
        console.log('✅ Sent new daily summary for chat', chatId);
    } catch (error) {
        console.error('💥 Error sending message:', error.message);
    }
}

// Handle /dogwalk command
async function handleDogWalk(msg) {
    try {
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
        
        // Send/chain daily summary
        await sendDailySummary(chatId);
        
        // Confirm to user
        await bot.sendMessage(chatId, `✅ Dog walk recorded at ${currentTime}!`);
        console.log('✅ Dog walk recorded successfully');
    } catch (error) {
        console.error('💥 Error in handleDogWalk:', error.message);
        if (msg && msg.chat) {
            await bot.sendMessage(msg.chat.id, '❌ Sorry, there was an error recording your walk. Please try again.');
        }
    }
}

// Handle /summary command
async function handleSummary(msg) {
    try {
        const chatId = msg.chat.id;
        const currentDate = getCurrentDate();
        const walks = dogWalks[currentDate] || [];
        
        if (walks.length === 0) {
            await bot.sendMessage(chatId, '🐕 No dog walks recorded today yet!');
        } else {
            const summary = formatDailySummary(currentDate, walks);
            await bot.sendMessage(chatId, summary);
        }
    } catch (error) {
        console.error('💥 Error in handleSummary:', error.message);
    }
}

// Handle /help command
async function handleHelp(msg) {
    try {
        const helpText = `
🐕 **Dog Walk Bot Commands:**

/dogwalk - Record a dog walk
/summary - Show today's walk summary
/help - Show this help message

The bot automatically updates the daily summary each time you log a new walk!
    `;
        
        await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('💥 Error in handleHelp:', error.message);
    }
}

// Setup daily tasks
function setupCronJob() {
    try {
        // Schedule at midnight to reset and send summary
        cron.schedule('0 0 * * *', async () => {
            console.log('🌙 Running daily tasks...');
            
            try {
                // Send final summary to all active chats
                for (const chatId of Object.keys(lastDailyMessage)) {
                    const previousDate = lastDailyMessage[chatId].date;
                    const previousWalks = dogWalks[previousDate] || [];
                    
                    if (previousWalks.length > 0) {
                        const summary = formatDailySummary(previousDate, previousWalks);
                        try {
                            await bot.sendMessage(chatId, `📊 **Final Daily Summary:**\n\n${summary}`, { parse_mode: 'Markdown' });
                        } catch (error) {
                            console.error('💥 Error sending final summary to chat', chatId, ':', error.message);
                        }
                    }
                }
                
                // Reset for new day
                lastDailyMessage = {};
                console.log('✅ Daily tasks completed successfully');
            } catch (error) {
                console.error('💥 Error in daily tasks:', error.message);
            }
        });
        
        console.log('✅ Daily tasks scheduled successfully');
    } catch (error) {
        console.error('💥 Error setting up cron job:', error.message);
    }
}

// Message handler
bot.on('message', async (msg) => {
    try {
        if (!msg || !msg.chat || !msg.text) {
            return;
        }
        
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        
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
    } catch (error) {
        console.error('💥 Error in message handler:', error.message);
    }
});

// Error handler
bot.on('polling_error', (error) => {
    console.error('💥 Telegram bot polling error:', error.message);
});

// Initialize
console.log('🔄 Loading existing data...');
loadData();
console.log('⏰ Setting up daily tasks...');
setupCronJob();
console.log('✅ Dog Walk Bot is ready!');
console.log('🎯 Available commands: /dogwalk, /summary, /help');
