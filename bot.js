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

// Get current time in HHMM format - Fixed for Singapore timezone
function getCurrentTime() {
    const now = new Date();
    
    // Get current UTC hour
    const utcHours = now.getUTCHours();
    
    // Singapore is UTC+8, so add 8 hours
    let singaporeHours = utcHours + 8;
    
    // Handle day rollover (if UTC+8 >= 24)
    if (singaporeHours >= 24) {
        singaporeHours -= 24;
    }
    
    const hours = String(singaporeHours).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    
    const result = `${hours}${minutes}`;
    
    console.log('UTC time:', now.toISOString());
    console.log('Singapore time (UTC+8):', result);
    
    return result;
}

// Parse time from command (format: /dogHHMM)
function parseTimeFromCommand(commandText) {
    const match = commandText.match(/^\/dog(\d{3,4})$/);
    if (!match) {
        return null;
    }
    
    const time = match[1];
    const hours = parseInt(time.substring(0, 2));
    const minutes = parseInt(time.substring(2));
    
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

// Edit existing walk time
function editWalkTime(currentDate, oldTime, newTime) {
    const walks = dogWalks[currentDate] || [];
    const walkIndex = walks.findIndex(walk => walk.time === oldTime);
    
    if (walkIndex !== -1) {
        walks[walkIndex].time = newTime;
        walks[walkIndex].timestamp = new Date().toISOString();
        console.log(`✅ Edited walk from ${oldTime} to ${newTime}`);
        saveData();
        return true;
    }
    
    return false;
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

// Handle /dog command with time parameter or edit
async function handleDogWalk(msg, timeData = null) {
    try {
        const chatId = msg.chat.id;
        const currentDate = getCurrentDate();
        
        let walkTime;
        
        if (timeData) {
            // Edit existing walk
            if (editWalkTime(currentDate, timeData.oldTime, timeData.newTime)) {
                await bot.sendMessage(chatId, `✅ Successfully changed walk ${timeData.oldTime} to ${timeData.newTime}!`);
                return;
            } else {
                await bot.sendMessage(chatId, `❌ Walk ${timeData.oldTime} not found for editing.`);
                return;
            }
        } else {
            // Parse time from command
            const parsedTime = parseTimeFromCommand(msg.text);
            if (!parsedTime) {
                await bot.sendMessage(chatId, '❌ Invalid time format. Use /dogHHMM (e.g., /dog1330)');
                return;
            }
            
            walkTime = parsedTime.formatted;
            
            // Check if walk already exists
            const existingWalk = findWalkByTime(currentDate, walkTime);
            if (existingWalk) {
                await bot.sendMessage(chatId, `❌ A walk at ${walkTime} already exists today. Use /edit${walkTime}${walkTime} to change it.`);
                return;
            }
        }
        
        // Initialize date if not exists
        if (!dogWalks[currentDate]) {
            dogWalks[currentDate] = [];
        }
        
        // Add new walk
        dogWalks[currentDate].push({
            time: walkTime,
            timestamp: new Date().toISOString(),
            user: msg.from.first_name || msg.from.username
        });
        
        saveData();
        
        // Send/chain daily summary
        await sendDailySummary(chatId);
        
        // Confirm to user
        await bot.sendMessage(chatId, `✅ Dog walk recorded at ${walkTime}!`);
        console.log('✅ Dog walk recorded successfully at', walkTime);
    } catch (error) {
        console.error('💥 Error in handleDogWalk:', error.message);
        if (msg && msg.chat) {
            await bot.sendMessage(msg.chat.id, '❌ Sorry, there was an error. Please try again.');
        }
    }
}

// Handle /edit command for changing walk times
async function handleEdit(msg) {
    try {
        const chatId = msg.chat.id;
        const text = msg.text.trim();
        
        // Parse /editHHMMHHMM format
        const match = text.match(/^\/edit(\d{3,4})(\d{3,4})$/);
        
        if (!match) {
            await bot.sendMessage(chatId, '❌ Invalid format. Use /editHHMMNEWTIME (e.g., /edit13301400)');
            return;
        }
        
        const oldTime = `${String(match[1]).padStart(2, '0')}${String(match[2]).padStart(2, '0')}`;
        const newTime = `${String(match[3]).padStart(2, '0')}${String(match[4]).padStart(2, '0')}`;
        
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

/dog[HHMM] - Record a dog walk at specific time (e.g., /dog1330)
/edit[OLD]NEWT] - Change walk time (e.g., /edit13301400)
/summary - Show today's walk summary
/help - Show this help message

**Examples:**
/dog0830 - Add walk at 08:30
/dog1405 - Add walk at 16:05  
/edit08301400 - Change 08:30 walk to 14:00

The bot automatically updates the daily summary each time you add a new walk!
    `;
        
        await bot.sendMessage(msg.chat.id, helpText, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('💥 Error in handleHelp:', error.message);
    }
}

// Setup daily tasks
function setupCronJob() {
    try {
        // Schedule at midnight Singapore time
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
                case '/dog':
                    // Handle /dog with optional time parameter
                    const timeData = parseTimeFromCommand(text);
                    await handleDogWalk(msg, timeData);
                    break;
                case '/edit':
                    await handleEdit(msg);
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
console.log('🎯 Available commands: /dog[HHMM], /edit[OLD][NEWT], /summary, /help');

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