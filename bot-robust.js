const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 Starting Dog Walk Bot...');

// Graceful error handling
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Initialize bot with error handling
let bot = null;
try {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
        console.error('❌ FATAL: No TELEGRAM_BOT_TOKEN provided');
        process.exit(1);
    }
    
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
        polling: true,
        request: {
            agentOptions: {
                timeout: 10000,
                keepAlive: true
            }
        }
    });
    console.log('✅ Telegram bot initialized successfully');
} catch (error) {
    console.error('❌ FATAL: Failed to initialize Telegram bot:', error.message);
    process.exit(1);
}

// Data storage
const DATA_FILE = path.join(__dirname, 'dogwalks.json');
let dogWalks = {};
let lastDailyMessage = {};
let autoProgressTimer = null;

// Load existing data with error handling
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            console.log('📄 Loading data from:', DATA_FILE);
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(data);
            dogWalks = parsed.dogWalks || {};
            lastDailyMessage = parsed.lastDailyMessage || {};
            console.log('✅ Data loaded successfully');
            console.log(`📊 Total days stored: ${Object.keys(dogWalks).length}`);
        } else {
            console.log('📝 No existing data file, starting fresh');
            dogWalks = {};
            lastDailyMessage = {};
        }
    } catch (error) {
        console.error('💥 Error loading data:', error.message);
        console.log('🔄 Starting with empty data...');
        dogWalks = {};
        lastDailyMessage = {};
    }
}

// Save data with error handling
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

// Get current date in DDMMYY format with timezone support
function getCurrentDate() {
    const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
    const now = new Date();
    
    try {
        // Create date in user's timezone
        const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
        
        // Format as DDMMYY
        const day = String(userTime.getDate()).padStart(2, '0');
        const month = String(userTime.getMonth() + 1).padStart(2, '0');
        const year = String(userTime.getFullYear()).slice(2);
        
        const result = `${day}${month}${year}`;
        console.log('📅 Date - UTC:', now.toISOString());
        console.log('📅 Date - Local:', userTime.toISOString());
        console.log('📅 Formatted (DDMMYY):', result);
        
        return result;
    } catch (error) {
        console.error('💥 Error formatting date:', error.message);
        
        // Fallback to UTC
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear()).slice(2);
        
        const result = `${day}${month}${year}`;
        console.log('🔄 Using UTC fallback date:', result);
        
        return result;
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
        console.log('⏰ Time - UTC:', now.toISOString());
        console.log('⏰ Time - Local:', userTime.toTimeString());
        console.log('⏰ Formatted (HHMM):', result);
        
        return result;
    } catch (error) {
        console.error('💥 Error formatting time:', error.message);
        
        // Fallback to UTC
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        
        const result = `${hours}${minutes}`;
        console.log('🔄 Using UTC fallback time:', result);
        
        return result;
    }
}

// Format daily summary
function formatDailySummary(date, walks) {
    let summary = `${date}\n`;
    walks.forEach((walk, index) => {
        summary += `Walk ${index + 1}: ${walk.time}\n`;
    });
    return summary.trim();
}

// Send message with chaining logic and error handling
async function sendDailySummary(chatId, forceNew = false) {
    try {
        const currentDate = getCurrentDate();
        const walks = dogWalks[currentDate] || [];
        
        if (walks.length === 0) {
            console.log('ℹ️ No walks to summarize for chat', chatId);
            return;
        }

        const summary = formatDailySummary(currentDate, walks);
        console.log('📝 Sending summary to chat', chatId, ':', summary);
        
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
    } catch (error) {
        console.error('💥 Error in sendDailySummary:', error.message);
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

// Handle /dogwalk command with error handling
async function handleDogWalk(msg) {
    try {
        if (!msg || !msg.chat) {
            console.error('💥 Invalid message object in handleDogWalk');
            return;
        }
        
        const chatId = msg.chat.id;
        const currentDate = getCurrentDate();
        const currentTime = getCurrentTime();
        
        console.log('🐕 Processing dog walk for chat', chatId);
        
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
/time - Check current time and timezone
/help - Show this help message

The bot automatically updates the daily summary each time you log a new walk!
        `;
        
        await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('💥 Error in handleHelp:', error.message);
    }
}

// Handle /time command for debugging
async function handleTime(msg) {
    try {
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
📝 **Bot Time Format:** ${getCurrentDate()} ${getCurrentTime()}`;
        
        await bot.sendMessage(msg.chat.id, timeInfo, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('💥 Error in handleTime:', error.message);
    }
}

// Setup cron job with error handling
function setupCronJob() {
    try {
        const userTimezone = process.env.TIMEZONE || 'Asia/Singapore';
        console.log('⏰ Setting up daily tasks for timezone:', userTimezone);
        
        // Schedule at midnight in user's timezone
        cron.schedule('0 0 * * *', async () => {
            console.log('🌙 Running daily tasks...');
            console.log('⏰ Scheduled timezone:', userTimezone);
            
            try {
                // Send final summary to all active chats
                for (const chatId of Object.keys(lastDailyMessage)) {
                    const previousDate = lastDailyMessage[chatId].date;
                    const previousWalks = dogWalks[previousDate] || [];
                    
                    if (previousWalks.length > 0) {
                        const summary = formatDailySummary(previousDate, previousWalks);
                        try {
                            await bot.sendMessage(chatId, `📊 **Final Daily Summary:**\n\n${summary}`, { parse_mode: 'Markdown' });
                            console.log('✅ Final summary sent to chat', chatId);
                        } catch (error) {
                            console.error('💥 Error sending final summary to chat', chatId, ':', error.message);
                        }
                    }
                }
                
                // Reset for new day
                lastDailyMessage = {};
                console.log('🔄 Reset for new day');
            } catch (error) {
                console.error('💥 Error in daily tasks:', error.message);
            }
        }, {
            timezone: userTimezone
        });
        
        console.log('✅ Daily tasks scheduled successfully');
    } catch (error) {
        console.error('💥 Error setting up cron job:', error.message);
    }
}

// Message handler with comprehensive error handling
bot.on('message', async (msg) => {
    try {
        if (!msg || !msg.chat || !msg.text) {
            console.log('ℹ️ Ignoring invalid message');
            return;
        }
        
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        
        console.log('📨 Received message:', text, 'from chat:', chatId);
        
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
                    console.log('ℹ️ Unknown command:', command);
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

// Success handler
bot.on('polling_stop', () => {
    console.log('🛑 Bot polling stopped');
});

// Initialize
console.log('🔄 Loading existing data...');
loadData();
console.log('⏰ Setting up scheduled tasks...');
setupCronJob();
console.log('✅ Dog Walk Bot is ready!');
console.log('🎯 Bot commands: /dogwalk, /summary, /time, /help');

// Graceful shutdown handlers
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    if (autoProgressTimer) {
        clearTimeout(autoProgressTimer);
    }
    saveData();
    if (bot) {
        bot.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    if (autoProgressTimer) {
        clearTimeout(autoProgressTimer);
    }
    saveData();
    if (bot) {
        bot.stop();
    }
    process.exit(0);
});