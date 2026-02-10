import { Job } from 'bullmq';
import { Bot } from 'grammy';
import { getScheduledDeals } from '../services/deal.service.js';
import { markAsPosted } from '../services/posting.service.js';
import { getDecryptedCreativeForPosting } from '../services/creative.service.js';
import { sendChannelMessage } from '../services/telegram.service.js';
import { notifyDealStatusChange } from '../services/notification.service.js';

/**
 * Auto-posts scheduled ads to channels.
 * Checks for deals where scheduledPostAt has passed.
 *
 * Creative content is encrypted at rest — the worker decrypts it
 * just before posting, keeping plaintext exposure minimal.
 */
export function createPostingProcessor(bot: Bot) {
  return async function processPosting(_job: Job) {
    const deals = await getScheduledDeals();
    let posted = 0;

    for (const deal of deals) {
      try {
        // Decrypt creative content for posting
        const creative = await getDecryptedCreativeForPosting(deal.id);
        if (!creative) {
          console.error(`Deal ${deal.id}: no approved creative found`);
          continue;
        }

        const messageId = await sendChannelMessage(
          bot,
          deal.channel.telegramChatId,
          creative.contentText || '',
          creative.mediaUrl || undefined,
          creative.mediaType || undefined,
        );

        await markAsPosted(deal.id, messageId);
        await notifyDealStatusChange(bot, deal.id, 'POSTED');
        posted++;
      } catch (error) {
        console.error(`Failed to post deal ${deal.id}:`, error);
      }
    }

    return { posted };
  };
}
