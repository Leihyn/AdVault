import { Bot } from 'grammy';

/**
 * Global bot instance reference.
 * Set once during startup, used by services to send notifications
 * without threading the bot through every function call.
 */
let botInstance: Bot | null = null;

export function setBotInstance(bot: Bot) {
  botInstance = bot;
}

export function getBotInstance(): Bot | null {
  return botInstance;
}
