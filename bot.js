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

// Get current time in HHMM format - Fixed for Singapore timezone
function getCurrentTime() {
    const now = new Date();
    
    // Simple Singapore time fix (UTC+8)
    const utcHours = now.getUTCHours();
    let singaporeHours = utcHours + 8;
    
    // Handle day rollover
    if (singaporeHours >= 24) {
        singaporeHours -= 24;
    }
    
    const hours = String(singaporeHours).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    
    const result = `${hours}${minutes}`;
    
    console.log('UTC time:', now.toISOString());
    console.log('Singapore time:', result);
    
    return result;
}

// Parse time from command (format: /dogHHMM)
function parseTimeFromCommand(commandText) {
    const match = commandText.match(/^\/dog(\d{1,4})(\d{2})$/);
    if (!match) {
        return null;
    }
    
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    
    // Validate time
    if (hours > 23 || minutes > 59) {
        return null;
    }
    
    return {
        hours,
        minutes,
        formatted: `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`
    };
}

// Find specific walk by its time
function findWalkByTime(currentDate, targetTime) {
    const walks = dogWalks[currentDate] || [];
    return walks.find(walk => walk.time === targetTime);
}

// Format daily summary
function formatDailySummary(date, walks) {
    if (walks.length === 0) {
        return `${date}\nNo walks recorded today.`;
    }
    
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
    
    if (lastDailyMessage[chatId] && lastDailyMessage[chatId].date === currentDate && !forceNew) {
        try {
            await bot.editMessageText(summary, {
                chat_id: chatId,
                message_id: lastDailyMessage[chatId].messageId
            });
            console.log('✅ Edited daily summary for chat', chatId);
        } catch (error) {
            console.error('💥 Error editing message:', error.message);
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

// Handle /dog command with auto-time feature
async function handleDogWalk(msg, timeData = null) {
    try {
        if (!msg || !msg.chat || !msg.text) {
            return;
        }
        
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        
        // Auto-time feature: /dog uses current time
        if (text === '/dog') {
            const currentTime = getCurrentTime();
            console.log('🕐 Using auto current time:', currentTime);
            
            // Check for duplicate
            const existingWalk = findWalkByTime(getCurrentDate(), currentTime);
            if (existingWalk) {
                await bot.sendMessage(chatId, `❌ A walk at ${currentTime} already exists today. Use /edit${currentTime} to change it.`);
                return;
            }
            
            const currentDate = getCurrentDate();
            
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
            await bot.sendMessage(chatId, `✅ Dog walk recorded at ${currentTime} (auto-time)!`);
            
            console.log('✅ Dog walk recorded successfully at', currentTime);
            return;
        }
        
        // Handle /dog with time parameter
        if (text.startsWith('/dog ') && !text.startsWith('/dog[')) {
            const timeFromCommand = parseTimeFromCommand(text);
            if (timeFromCommand) {
                await handleDogWalk(msg, { oldTime: null, newTime: timeFromCommand.formatted });
                return;
            }
        }
        
        // Handle other commands
        if (text.startsWith('/')) {
            const command = text.toLowerCase();
            
            switch (command) {
                case '/dogwalk':
                    await handleDogWalk(msg);
                    break;
                case '/dog':
                case '/edit':
                    await handleEdit(msg);
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
    } catch (error) {
        console.error('💥 Error in handleDogWalk:', error.message);
        if (msg && msg.chat) {
            await bot.sendMessage(msg.chat.id, '❌ Sorry, there was an error recording your walk. Please try again.');
        }
    }
}

// Handle /edit command for changing walk times
async function handleEdit(msg) {
    try {
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        
        // Parse /edit[OLD][NEWT] format
        const match = text.match(/^\/edit(\d{1,4})(\d{2})(\d{3,4})$/);
        
        if (!match) {
            await bot.sendMessage(chatId, '❌ Invalid format. Use /edit[OLD][NEWT] (e.g., /edit13301400)');
            return;
        }
        
        const oldTime = `${String(match[1]).padStart(2, '0')}${String(match[2]).padStart(2, '0')}`;
        const newTime = `${String(match[3]).padStart(2, '0')}${String(match[4]).padStart(2, '0')}`;
        
        console.log('🕐 Edit requested:', oldTime, '→', newTime);
        
        // Try to edit the walk
        if (editWalkTime(getCurrentDate(), oldTime, newTime)) {
            await sendDailySummary(chatId);
        } else {
            await bot.sendMessage(chatId, `❌ Walk at ${oldTime} not found for editing.`);
        }
    } catch (error) {
        console.error('💥 Error in handleEdit:', error.message);
    }
}

// Handle /help command
async function handleHelp(msg) {
    try {
        const helpText = `
🐕 **Dog Walk Bot Commands:**

📝 **Recording Walks:**
/dog - Record a dog walk at CURRENT time (auto-time)
/dog0830 - Record at 8:30 AM
/dog1945 - Record at 7:45 PM

⏰ **Editing Walks:**
/edit[OLD][NEWT] - Change existing walk time (e.g., /edit13301400)

⚡ **Auto-Time Feature:**
/dog - Record walk at CURRENT time (most convenient!)
Just type: /dog and bot automatically uses the current time!

📊 **Viewing & Managing:**
/summary - Show today's complete schedule
/time - Check bot's current time and timezone

/help - Show this help message

**Examples:**
Morning routine:
/dog0830    # 8:30 AM
/dog0930    # 9:30 AM
/dog1030    # 10:00 AM

Time editing:
/edit13301400   # Move 1:30 PM to 2:00 PM
/edit09151400   # Move 9:15 AM to 2:00 PM

The bot automatically updates daily summary each time you log a new walk! 🚀✨
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

// Setup cron job
function setupCronJob() {
    try {
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
                            console.log('✅ Final summary sent to chat', chatId);
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
console.log('🎯 Available commands: /dog (auto-time), /dog[HHMM], /edit[OLD][NEWT], /summary, /time, /help');

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
