import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { Home } from './pages/Home.js';
import { Channels } from './pages/Channels.js';
import { ChannelDetail } from './pages/ChannelDetail.js';
import { Campaigns } from './pages/Campaigns.js';
import { CampaignDetail } from './pages/CampaignDetail.js';
import { MyChannels } from './pages/MyChannels.js';
import { MyCampaigns } from './pages/MyCampaigns.js';
import { Deals } from './pages/Deals.js';
import { DealDetail } from './pages/DealDetail.js';
import { Profile } from './pages/Profile.js';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/channels" element={<Channels />} />
        <Route path="/channels/:id" element={<ChannelDetail />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/my-channels" element={<MyChannels />} />
        <Route path="/my-campaigns" element={<MyCampaigns />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/deals/:id" element={<DealDetail />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Layout>
  );
}
