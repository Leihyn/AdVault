import { Context } from 'grammy';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CampaignState {
  step: string;
  title?: string;
  brief?: string;
  budgetTon?: number;
}

const userStates = new Map<number, CampaignState>();

export function isInCreateCampaignFlow(userId: number): boolean {
  return userStates.has(userId);
}

export async function startCreateCampaign(ctx: Context) {
  if (!ctx.from) return;
  userStates.set(ctx.from.id, { step: 'awaiting_title' });
  await ctx.reply(
    'Let\'s create a campaign.\n\n' +
    'First, give your campaign a title (e.g. "Promote my DeFi app"):',
  );
}

export async function handleCreateCampaignMessage(ctx: Context) {
  if (!ctx.from || !ctx.message?.text) return;

  const state = userStates.get(ctx.from.id);
  if (!state) return;

  const text = ctx.message.text.trim();

  if (state.step === 'awaiting_title') {
    state.title = text;
    state.step = 'awaiting_brief';
    await ctx.reply('Describe what you want advertised. Include your target audience and key message:');
    return;
  }

  if (state.step === 'awaiting_brief') {
    state.brief = text;
    state.step = 'awaiting_budget';
    await ctx.reply('What\'s your total budget in TON? (e.g. 100):');
    return;
  }

  if (state.step === 'awaiting_budget') {
    const budget = parseFloat(text);
    if (isNaN(budget) || budget <= 0) {
      await ctx.reply('Please enter a valid number for the budget:');
      return;
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(ctx.from.id) },
    });
    if (!user) {
      userStates.delete(ctx.from.id);
      await ctx.reply('Please /start first.');
      return;
    }

    const campaign = await prisma.campaign.create({
      data: {
        advertiserId: user.id,
        title: state.title!,
        brief: state.brief!,
        budgetTon: budget,
        status: 'ACTIVE',
      },
    });

    userStates.delete(ctx.from.id);

    await ctx.reply(
      `Campaign created!\n\n` +
      `Title: ${campaign.title}\n` +
      `Budget: ${campaign.budgetTon} TON\n\n` +
      `Channel owners can now apply to your campaign. ` +
      `You can also browse channels in the Mini App and create deals directly.`,
    );
  }
}
