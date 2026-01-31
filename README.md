# Telegram Dog Walk Bot

A Telegram bot that tracks daily dog walks and provides automatic summaries.

## Features

- 🐕 Track dog walks with `/dogwalk` command
- 📅 Automatic daily summaries
- ⏰ Real-time walk counting
- 📊 Message chaining for same-day walks
- 🔄 Daily reset and automatic triggers

## Setup

1. Clone this repository
2. Install dependencies: `npm install`
3. Create `.env` file with your bot token
4. Run the bot: `npm start`

## Environment Variables

Create a `.env` file with:

```
TELEGRAM_BOT_TOKEN=your_bot_token_here
GROUP_CHAT_ID=your_group_chat_id_here
```

## Commands

- `/dogwalk` - Log a dog walk
- `/summary` - Show today's walk summary
- `/help` - Show available commands

## Message Format

The bot automatically formats daily summaries like:

```
31012026
Walk 1: 0900
Walk 2: 1100
Walk 3: 1400
Walk 4: 1800
Walk 5: 1900
```