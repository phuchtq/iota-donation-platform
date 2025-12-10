import React, { useState, useEffect, use } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createNetworkConfig,
  IotaClientProvider,
  WalletProvider,
  ConnectButton,
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from '@iota/dapp-kit';
import '@iota/dapp-kit/dist/index.css';
import { Transaction } from '@iota/iota-sdk/transactions';

import { WalletAccount } from '@iota/wallet-standard';
import Button from './Button';
import { fromBase64, toBase64 } from "@iota/iota-sdk/utils";
import { request, gql } from 'graphql-request';
import { IotaGraphQLClient } from '@iota/iota-sdk/graphql';
import { graphql } from '@iota/iota-sdk/graphql/schemas/2025.2';
import { getFullnodeUrl, IotaClient } from '@iota/iota-sdk/client';

const queryClient = new QueryClient();
const client = new IotaClient({ url: getFullnodeUrl("testnet") });

// Smart contract package ID
const PACKAGE_ID = '0x5766fdcf2ce2163c2ea0850cdd5b5f7199a5f3afdc850d5ec7c9305ef7ebf5d1';

const { networkConfig, useNetworkVariable, useNetworkVariables } =
  createNetworkConfig({
    testnet: {
      url: getFullnodeUrl('testnet')
    },
    mainnet: {
      url: getFullnodeUrl('mainnet')
    },
  });

// Types TypeScript
interface Campaign {
  id: string;
  name: string;
  description: string;
  creator: string;
  totalDonated: number;
  isActive: boolean;
}

interface Donation {
  id: string;
  campaign_id: string;
  amount: number;
  donor: string;
  timestamp: number;
}

function DonationApp() {
  const currentAccount = useCurrentAccount();
  const account = currentAccount || null;
  const { mutateAsync: executeTransaction } = useSignAndExecuteTransaction();
  const iotaClient = new IotaClient({ url: getFullnodeUrl("testnet") })
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [userCampaigns, setUserCampaigns] = useState<Campaign[]>([]);
  const [userDonations, setUserDonations] = useState<Donation[]>([]);
  const [activeTab, setActiveTab] = useState<'browse' | 'create' | 'my-campaigns' | 'my-donations'>('browse');

  const [newCampaign, setNewCampaign] = useState({ name: '', description: '' });
  const [donationAmount, setDonationAmount] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [walletTotalContributed, setwalletTotalContributed] = useState(0);

  const gqlClient = new IotaGraphQLClient({
    url: 'https://graphql.testnet.iota.cafe/',
  });

  const toDateTime = (number: number): String => {
    return new Date(number).toLocaleDateString();
  }

  const decodeVectorU8 = (data: any): string => {
    if (typeof data === 'string' && !data.match(/^[A-Za-z0-9+/=]+$/)) {
      return data;
    }

    if (typeof data === 'string') {
      try {
        return atob(data);
      } catch (e) {
        return data;
      }
    }
    const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
    return new TextDecoder().decode(uint8);
  };

  const fetchWalletDonations = async () => {
    if (!iotaClient || !account) return;
    const query = graphql(`
  query getCampaigns($donationType: String!) {
    objects(
      filter: { type: $donationType }, 
    ) {
      nodes {
        address
        digest
        asMoveObject {
          contents { json }
        }
      }
    }}
`);

    try {
      const donationType = `${PACKAGE_ID}::fundraising::Donation`
      const data: any = await gqlClient.query({
        query: query,
        variables: { donationType },
      });

      const donations: Donation[] = await Promise.all(
        data.data?.objects.nodes.map(async (node: any) => {
          const json = node.asMoveObject.contents.json;
          let obj: any
          await iotaClient.getObject({
            id: json.id,
            options: {
              showContent: true,
            }
          }).then((result: any) => {
            obj = result.data?.content.fields;
          })

          return {
            id: obj.id.id,
            donor: obj.donor,
            amount: Number(obj.amount) / 1_000_000_000,
            campaign_id: obj.campaign_id,
            timestamp: toDateTime(obj.timestamp),
          };
        })
      );

      const walletDonations = donations.filter((donation: any) => {
        return donation.donor === account.address;
      });

      // Calculate total from walletDonations directly (not from state)
      const total = walletDonations.reduce((sum, donation: any) => {
        return sum + donation.amount;
      }, 0);

      setUserDonations(walletDonations);
      setwalletTotalContributed(total);

    } catch (err) {
      console.log('Error while fetching donations:', err);
    }
  };

  const fetchCampaignsByGraphQL = async () => {
    if (!iotaClient || !account) return;
    const query = graphql(`
  query getCampaigns($campaignType: String!) {
    objects(
      filter: { type: $campaignType }, 
    ) {
      nodes {
        address
        digest
        asMoveObject {
          contents { json }
        }
      }
    }}
`);
    try {
      const campaignType = `${PACKAGE_ID}::fundraising::Campaign`
      const data: any = await gqlClient.query({
        query: query,
        variables: { campaignType },
      });

      const campaigns: Campaign[] = await Promise.all(
        data.data?.objects.nodes.map(async (node: any) => {
          const json = node.asMoveObject.contents.json;
          const res = {
            id: json.id,
            name: decodeVectorU8(json.name),
            description: decodeVectorU8(json.description),
            creator: json.admin,
            totalDonated: Number(json.total_donated) / 1_000_000_000,
            isActive: json.active,
          };

          let obj: any
          await iotaClient.getObject({
            id: json.id,
            options: {
              showContent: true,
            }
          }).then((result: any) => {
            obj = result.data?.content.fields;
          })

          console.log('Data campaign after call getObject():', obj)
          return {
            id: obj.id.id,
            name: decodeVectorU8(obj.name),
            description: decodeVectorU8(obj.description),
            creator: obj.admin,
            totalDonated: Number(obj.total_donated) / 1_000_000_000,
            isActive: obj.active,
          };
        })
      );

      const uniqueCampaigns = campaigns.filter((campaign, index, self) =>
        index === self.findIndex((c) => c.id === campaign.id)
      );

      const userCampaigns = campaigns.filter((campaign: any) => {
        return campaign.creator === account.address;
      });

      setUserCampaigns(userCampaigns);
      setCampaigns(uniqueCampaigns);
    } catch (err) {
      console.log('Error while fetching campaigns:', err);
    }
  };

  useEffect(() => {
    fetchCampaignsByGraphQL();
    fetchWalletDonations();
  }, [account]);

  const handleCreateCampaign = async () => {
    if (!account || !newCampaign.name || !newCampaign.description) return;

    setLoading(true);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::fundraising::create_campaign`,
        arguments: [
          tx.pure.string(newCampaign.name),
          tx.pure.string(newCampaign.description),
        ],
      });

      await executeTransaction({
        transaction: tx as any,
      });

      setNewCampaign({ name: newCampaign.name, description: newCampaign.description });

      await fetchCampaignsByGraphQL();
      await fetchWalletDonations();
      alert('Campaign created successfully!');

    } catch (error: any) {
      console.error('Error creating campaign:', error);
      console.error('Error details:', {
        message: error.message,
        cause: error.cause,
        stack: error.stack
      });
      alert('Error creating campaign');
    }
    setLoading(false);
  };

  const handleDonate = async (campaignId: string) => {
    if (!account || !donationAmount) return;

    setLoading(true);
    try {
      const tx = new Transaction();
      const amountInMist = BigInt(parseFloat(donationAmount) * 1_000_000_000);
      const [donationCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::fundraising::donate`,
        arguments: [
          tx.object(campaignId),
          donationCoin,
        ],
      });

      await executeTransaction({
        transaction: tx as any,
      });

      await fetchCampaignsByGraphQL();
      await fetchWalletDonations();

      setDonationAmount('');
      setSelectedCampaign('');

      alert('Donation successful!');

    } catch (error) {
      console.error('Error during donation:', error);

      alert('Error during donation');
    }
    setLoading(false);
  };

  const handleCloseCampaign = async (campaignId: string) => {
    if (!account) return;

    setLoading(true);
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::fundraising::close_campaign`,
        arguments: [
          tx.object(campaignId),
        ],
      });

      await executeTransaction({
        transaction: tx as any,
      });

      await fetchCampaignsByGraphQL();
      await fetchWalletDonations();

      alert('Campaign closed successfully!');

    } catch (error) {
      console.error('Error closing campaign:', error);
      alert('Error closing campaign');
    }
    setLoading(false);
  };

  const WalletConnection = () => (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-8 mb-6 border border-blue-100">
      {account ? (
        // Connected State
        <div className="space-y-4">
          <div
            className="pt-4 border-t border-blue-200 relative z-[9999]"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ConnectButton className="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-300" />
          </div>
        </div>
      ) : (
        // Disconnected State
        <div className="space-y-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Connect Your Wallet</h2>
            <p className="text-gray-600">Choose your preferred connection method</p>
          </div>

          <div className="grid gap-4">
            <div
              className="pt-4 border-t border-blue-200 relative z-[9999]"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <ConnectButton className="w-full py-3 px-4 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md hover:shadow-lg transition-all duration-300" />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const NavigationTabs = () => (
    <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-6">
      {[
        { key: 'browse', label: '🔍 Browse' },
        { key: 'create', label: '➕ Create' },
        { key: 'my-campaigns', label: '📋 My Campaigns' },
        { key: 'my-donations', label: '💝 My Donations' },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key as any)}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-600 hover:text-gray-800'
            }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  const BrowseCampaigns = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-800 flex items-center space-x-2">
          <span className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </span>
          <span>Active Campaigns</span>
        </h3>
        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
          {campaigns.filter(c => c.isActive).length} Live
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {campaigns.filter(c => c.isActive).map(campaign => (
          <div
            key={campaign.id}
            className="group bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-blue-400 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
          >
            {/* Header Section */}
            <div className="mb-4">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                  ACTIVE
                </div>
              </div>

              <h4 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                {campaign.name}
              </h4>

              <p className="text-gray-600 text-sm leading-relaxed line-clamp-3">
                {campaign.description}
              </p>
            </div>

            {/* Stats Section */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4 border border-blue-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Total Raised
                </span>
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-xs text-green-600 font-medium">Live</span>
                </div>
              </div>

              <div className="flex items-baseline space-x-2 mb-3">
                <span className="text-3xl font-bold text-gray-800">
                  {campaign.totalDonated}
                </span>
                <span className="text-lg font-semibold text-gray-500">IOTA</span>
              </div>

              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <div className="flex items-center space-x-1 bg-white px-2 py-1 rounded-md">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-mono">{campaign.creator.slice(0, 6)}...{campaign.creator.slice(-4)}</span>
                </div>
              </div>
            </div>

            {/* Donation Section */}
            {account ? (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="number"
                    placeholder="Enter amount"
                    value={selectedCampaign === campaign.id ? donationAmount : ''}
                    onChange={(e) => {
                      setSelectedCampaign(campaign.id);
                      setDonationAmount(e.target.value);
                    }}
                    className="w-full px-4 py-3 pl-10 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 font-semibold">
                    💰
                  </div>
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium text-sm">
                    IOTA
                  </div>
                </div>

                <button
                  onClick={() => handleDonate(campaign.id)}
                  disabled={loading || !donationAmount}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:shadow-xl disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 transform hover:scale-[1.02] active:scale-95 disabled:transform-none flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>💝</span>
                      <span>Donate Now</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 text-center">
                <p className="text-sm text-yellow-800 font-medium">
                  🔒 Connect your wallet to donate
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {campaigns.filter(c => c.isActive).length === 0 && (
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">📭</span>
          </div>
          <h4 className="text-xl font-bold text-gray-600 mb-2">No Active Campaigns</h4>
          <p className="text-gray-500">Check back later for new campaigns!</p>
        </div>
      )}
    </div>
  );

  const CreateCampaign = () => (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border-2 border-gray-200 p-8">
      {/* Header Section */}
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <div>
          <h3 className="text-2xl font-bold text-gray-800">Create a New Campaign</h3>
          <p className="text-sm text-gray-600">Launch your fundraising campaign in minutes</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Campaign Name Input */}
        <div className="group">
          <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <span>Campaign Name</span>
            <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={newCampaign.name}
              onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
              className="w-full px-4 py-3 pl-12 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 group-hover:border-gray-400"
              placeholder="Ex: IOTA First Donation Campaign"
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
          </div>
          {!newCampaign.name && (
            <p className="mt-2 text-xs text-gray-500 flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Give your campaign a catchy, memorable name</span>
            </p>
          )}
        </div>

        {/* Description Textarea */}
        <div className="group">
          <label className="flex items-center space-x-2 text-sm font-semibold text-gray-700 mb-3">
            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span>Campaign Description</span>
            <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <textarea
              value={newCampaign.description}
              onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200 resize-none group-hover:border-gray-400"
              rows={5}
              placeholder="Describe your campaign and its goal...&#10;&#10;• What is your cause?&#10;• Who will benefit?&#10;• How will funds be used?"
            />
            <div className="absolute bottom-3 right-3 text-xs text-gray-400">
              {newCampaign.description.length} characters
            </div>
          </div>
          {!newCampaign.description && (
            <p className="mt-2 text-xs text-gray-500 flex items-center space-x-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Share your story to inspire potential donors</span>
            </p>
          )}
        </div>

        {/* Warning if not connected */}
        {!account && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-amber-800">Wallet Connection Required</h4>
              <p className="text-xs text-amber-700 mt-1">Please connect your wallet to create a campaign</p>
            </div>
          </div>
        )}

        {/* Success Preview */}
        {newCampaign.name && newCampaign.description && account && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 flex items-start space-x-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-green-800">Ready to Launch! 🎉</h4>
              <p className="text-xs text-green-700 mt-1">Your campaign details look great. Click below to publish.</p>
            </div>
          </div>
        )}

        {/* Create Button */}
        <Button
          onClick={handleCreateCampaign}
          disabled={loading || !newCampaign.name || !newCampaign.description || !account}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-200 transform hover:scale-[1.02] active:scale-95 disabled:transform-none"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-3">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-lg">Creating Campaign...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center space-x-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-lg">Launch Campaign</span>
            </div>
          )}
        </Button>

        {/* Helper text */}
        <p className="text-xs text-center text-gray-500">
          By creating a campaign, you agree to our terms and conditions
        </p>
      </div>
    </div>
  );

  const MyCampaigns = () => (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">My Campaigns</h3>
            <p className="text-sm text-gray-600">Manage and track your fundraising campaigns</p>
          </div>
        </div>
        {userCampaigns.length > 0 && (
          <div className="flex items-center space-x-2 bg-indigo-100 px-4 py-2 rounded-full">
            <span className="text-sm font-semibold text-indigo-700">Total:</span>
            <span className="text-lg font-bold text-indigo-900">{userCampaigns.length}</span>
          </div>
        )}
      </div>

      {userCampaigns.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border-2 border-dashed border-gray-300">
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h4 className="text-2xl font-bold text-gray-700 mb-3">No Campaigns Yet</h4>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Start making a difference today! Create your first campaign and begin raising funds for your cause.
          </p>
          <button
            onClick={() => setActiveTab('create')}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Create Your First Campaign</span>
          </button>
        </div>
      ) : (
        /* Campaign List */
        <div className="grid gap-6">
          {userCampaigns.map(campaign => (
            <div
              key={campaign.id}
              className="group bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-indigo-300 rounded-xl p-6 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-4">
                {/* Campaign Info */}
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">
                        {campaign.name}
                      </h4>
                      <div className="flex items-center space-x-2 mt-1">
                        {campaign.isActive ? (
                          <span className="flex items-center space-x-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span>ACTIVE</span>
                          </span>
                        ) : (
                          <span className="flex items-center space-x-1 bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs font-bold">
                            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            <span>CLOSED</span>
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          ID: {campaign.id.slice(0, 8)}...
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-600 leading-relaxed mb-4">
                    {campaign.description}
                  </p>

                  {/* Stats Section */}
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                          Total Raised
                        </span>
                        <div className="flex items-baseline space-x-2">
                          <span className="text-3xl font-bold text-gray-800">
                            {campaign.totalDonated}
                          </span>
                          <span className="text-lg font-semibold text-gray-500">IOTA</span>
                        </div>
                      </div>
                      <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                {campaign.isActive && (
                  <button
                    onClick={() => handleCloseCampaign(campaign.id)}
                    className="ml-6 group/btn relative overflow-hidden bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
                  >
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>Close Campaign</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Campaign Closed Notice */}
              {!campaign.isActive && (
                <div className="mt-4 bg-gray-100 border border-gray-300 rounded-lg p-3 flex items-center space-x-2">
                  <svg className="w-5 h-5 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-gray-700">
                    This campaign has been closed and is no longer accepting donations.
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const MyDonations = () => (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">My Donations</h3>
            <p className="text-sm text-gray-600">Track your generous contributions</p>
          </div>
        </div>
        {userDonations.length > 0 && (
          <div className="text-right">
            <div className="flex items-center space-x-2 bg-pink-100 px-4 py-2 rounded-full mb-1">
              <span className="text-sm font-semibold text-pink-700">Total Donations:</span>
              <span className="text-lg font-bold text-pink-900">{walletTotalContributed} IOTA</span>
            </div>
            <p className="text-xs text-gray-500">
              {userDonations.reduce((sum, d: any) => sum + parseFloat(d.amount), 0).toFixed(2)} IOTA contributed
            </p>
          </div>
        )}
      </div>

      {userDonations.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl border-2 border-dashed border-pink-300">
          <div className="w-24 h-24 bg-gradient-to-br from-pink-100 to-rose-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg className="w-12 h-12 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
          </div>
          <h4 className="text-2xl font-bold text-gray-700 mb-3">No Donations Yet</h4>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Make your first donation today and start making a positive impact! Every contribution counts.
          </p>
          <button
            onClick={() => setActiveTab('browse')}
            className="inline-flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span>Discover Campaigns</span>
          </button>
        </div>
      ) : (
        /* Donation List */
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold opacity-90 mb-1">Total Impact</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-4xl font-bold">
                    {walletTotalContributed}
                  </span>
                  <span className="text-xl font-semibold opacity-90">IOTA</span>
                </div>
                <p className="text-sm opacity-75 mt-2">
                  Across {userDonations.length} {userDonations.length === 1 ? 'donation' : 'donations'}
                </p>
              </div>
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Donation History */}
          <div className="space-y-3">
            {userDonations.map((donation: any, index) => {
              // Find the campaign details for this donation
              const campaign: any = campaigns.find(c => c.id === donation.campaign_id);
              return (
                <div
                  key={index}
                  className="group bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 hover:border-pink-300 rounded-xl p-5 shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start justify-between">
                    {/* Left Side - Campaign Info */}
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-14 h-14 bg-gradient-to-br from-pink-400 to-rose-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                        <span className="text-2xl">💝</span>
                      </div>
                      <div className="flex-1">
                        {/* Campaign Name */}
                        <div className="mb-2">
                          <h4 className="font-bold text-lg text-gray-800 group-hover:text-pink-600 transition-colors mb-1">
                            {campaign ? campaign.name : 'Campaign'}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {campaign ? campaign.description : 'Campaign details'}
                          </p>
                        </div>

                        {/* Campaign Details */}
                        <div className="space-y-2">
                          {/* Campaign ID */}
                          <div className="flex items-center space-x-2">
                            <span className="bg-pink-100 text-pink-700 px-2 py-1 rounded-md text-xs font-bold flex items-center space-x-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                              </svg>
                            </span>
                            {campaign && (
                              <span className={`px-2 py-1 rounded-md text-xs font-bold ${campaign.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                                }`}>
                                {campaign.isActive ? '✓ Active' : '✕ Closed'}
                              </span>
                            )}
                          </div>

                          {/* Campaign Creator */}
                          {campaign && (
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              <span className="font-medium">Creator:</span>
                              <span className="font-mono">{campaign.creator.slice(0, 6)}...{campaign.creator.slice(-4)}</span>
                            </div>
                          )}

                          {/* Campaign Total Raised */}
                          {campaign && (
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              <span className="font-medium">Campaign Total:</span>
                              <span className="font-bold text-gray-700">{campaign.totalDonated} IOTA</span>
                            </div>
                          )}

                          {/* Donation Date & Time */}
                          <div className="flex items-center space-x-3 text-xs text-gray-500 pt-2 border-t border-gray-200">
                            <div className="flex items-center space-x-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{new Date(donation.timestamp).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              })}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center space-x-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{new Date(donation.timestamp).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Side - Amount */}
                    <div className="text-right ml-4">
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg px-4 py-3 min-w-[120px]">
                        <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">
                          Your Donation
                        </p>
                        <div className="flex items-baseline justify-center space-x-1">
                          <span className="text-2xl font-bold text-green-700">
                            {donation.amount}
                          </span>
                          <span className="text-sm font-semibold text-green-600">IOTA</span>
                        </div>
                        {campaign && (
                          <p className="text-xs text-gray-500 mt-1">
                            {((parseFloat(donation.amount) / parseFloat(campaign.totalDonated)) * 100).toFixed(1)}% of total
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Transaction Footer */}
                  <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs">
                      <div className="flex items-center space-x-1 text-green-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">Transaction Confirmed</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400 font-mono">
                        TX: {index.toString().padStart(4, '0')}
                      </span>
                      {!campaign && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                          Campaign data unavailable
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Thank You Message */}
          <div className="bg-gradient-to-r from-pink-50 to-rose-50 border-2 border-pink-200 rounded-xl p-5 text-center">
            <p className="text-pink-800 font-semibold mb-1">🙏 Thank you for your generosity!</p>
            <p className="text-sm text-pink-600">
              Your contributions are making a real difference in people's lives.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            🤝 IOTA Donation Platform
          </h1>
          <p className="text-gray-600">
            Create and support donation campaigns with the IOTA blockchain
          </p>
        </div>

        <WalletConnection />
        {account && (
          <>
            {/* Navigation */}
            <NavigationTabs />

            <div className="bg-gray-50 rounded-lg">
              {activeTab === 'browse' && <BrowseCampaigns />}
              {activeTab === 'create' && <CreateCampaign />}
              {activeTab === 'my-campaigns' && <MyCampaigns />}
              {activeTab === 'my-donations' && <MyDonations />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <IotaClientProvider defaultNetwork='testnet' networks={networkConfig}>
        <WalletProvider autoConnect>
          <DonationApp />
        </WalletProvider>
      </IotaClientProvider>
    </QueryClientProvider>
  );
}