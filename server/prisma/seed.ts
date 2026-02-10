import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test user
  const owner = await prisma.user.upsert({
    where: { telegramId: 123456789n },
    update: {},
    create: {
      telegramId: 123456789n,
      username: 'testowner',
      firstName: 'Test Owner',
      role: 'BOTH',
    },
  });

  const advertiser = await prisma.user.upsert({
    where: { telegramId: 987654321n },
    update: {},
    create: {
      telegramId: 987654321n,
      username: 'testadvertiser',
      firstName: 'Test Advertiser',
      role: 'ADVERTISER',
    },
  });

  // Create test channel
  const channel = await prisma.channel.upsert({
    where: { telegramChatId: -1001234567890n },
    update: {},
    create: {
      telegramChatId: -1001234567890n,
      ownerId: owner.id,
      title: 'Test Channel',
      description: 'A test channel for development',
      username: 'test_channel',
      subscribers: 10000,
      avgViews: 2500,
      avgReach: 5000,
      language: 'en',
      category: 'tech',
      botIsAdmin: true,
      isVerified: true,
    },
  });

  // Create ad formats
  await prisma.adFormat.createMany({
    data: [
      {
        channelId: channel.id,
        formatType: 'POST',
        label: '1/24 Post',
        description: 'Single post, stays for 24 hours at top',
        priceTon: 50,
      },
      {
        channelId: channel.id,
        formatType: 'FORWARD',
        label: 'Forward from your channel',
        description: 'We forward your post to our audience',
        priceTon: 30,
      },
      {
        channelId: channel.id,
        formatType: 'STORY',
        label: 'Channel Story',
        description: 'Story post visible for 24h',
        priceTon: 20,
      },
    ],
    skipDuplicates: true,
  });

  // Create test campaign
  await prisma.campaign.upsert({
    where: { id: 1 },
    update: {},
    create: {
      advertiserId: advertiser.id,
      title: 'Promote our DeFi app',
      brief: 'Looking for crypto/tech channels to promote our new DeFi application. Target audience: crypto enthusiasts.',
      budgetTon: 200,
      targetSubscribersMin: 5000,
      targetLanguage: 'en',
      targetCategory: 'tech',
      status: 'ACTIVE',
    },
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
