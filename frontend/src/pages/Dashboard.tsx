import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  UsersIcon, 
  DocumentTextIcon, 
  SpeakerWaveIcon,
  ChatBubbleLeftRightIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';
import { formatNumber, formatPercentage } from '@/utils/format';

export default function Dashboard() {
  const { data: contactStats } = useQuery({
    queryKey: ['contact-stats'],
    queryFn: () => apiService.getContactStats(),
  });

  const { data: templateStats } = useQuery({
    queryKey: ['template-stats'],
    queryFn: () => apiService.getTemplateStats(),
  });

  const { data: campaignStats } = useQuery({
    queryKey: ['campaign-stats'],
    queryFn: () => apiService.getCampaignStats(),
  });

  const { data: messageStats } = useQuery({
    queryKey: ['message-stats'],
    queryFn: () => apiService.getMessageLogStats(),
  });

  const stats = [
    {
      name: 'Contatos Ativos',
      stat: formatNumber(contactStats?.data?.active || 0),
      icon: UsersIcon,
      change: '+4.75%',
      changeType: 'increase',
    },
    {
      name: 'Templates',
      stat: formatNumber(templateStats?.data?.active || 0),
      icon: DocumentTextIcon,
      change: '+2.02%',
      changeType: 'increase',
    },
    {
      name: 'Campanhas',
      stat: formatNumber(campaignStats?.data?.total || 0),
      icon: SpeakerWaveIcon,
      change: '+12.05%',
      changeType: 'increase',
    },
    {
      name: 'Mensagens Enviadas',
      stat: formatNumber(messageStats?.data?.total || 0),
      icon: ChatBubbleLeftRightIcon,
      change: `${formatPercentage(messageStats?.data?.successRate || 0)} sucesso`,
      changeType: 'increase',
    },
  ];

  return (
    <div>
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-gray-700">
          Visão geral das suas campanhas e estatísticas
        </p>
      </div>

      <div className="mt-8">
        <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((item) => (
            <div
              key={item.name}
              className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow sm:px-6 sm:py-6"
            >
              <dt>
                <div className="absolute rounded-md bg-blue-500 p-3">
                  <item.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500">
                  {item.name}
                </p>
              </dt>
              <dd className="ml-16 flex items-baseline pb-6 sm:pb-7">
                <p className="text-2xl font-semibold text-gray-900">{item.stat}</p>
                <p
                  className={`ml-2 flex items-baseline text-sm font-semibold ${
                    item.changeType === 'increase'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  <ArrowTrendingUpIcon
                    className="h-5 w-5 flex-shrink-0 self-center text-green-500"
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    {item.changeType === 'increase' ? 'Increased' : 'Decreased'} by
                  </span>
                  {item.change}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Recent Campaigns */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Campanhas Recentes
            </h3>
            <div className="mt-6 flow-root">
              <div className="text-sm text-gray-500">
                Dados serão carregados em breve...
              </div>
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Performance de Mensagens
            </h3>
            <div className="mt-6">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Taxa de Entrega</span>
                    <span>{formatPercentage(messageStats?.data?.deliveryRate || 0)}</span>
                  </div>
                  <div className="mt-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${messageStats?.data?.deliveryRate || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Taxa de Leitura</span>
                    <span>{formatPercentage(messageStats?.data?.readRate || 0)}</span>
                  </div>
                  <div className="mt-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${messageStats?.data?.readRate || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm">
                    <span>Taxa de Sucesso</span>
                    <span>{formatPercentage(messageStats?.data?.successRate || 0)}</span>
                  </div>
                  <div className="mt-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${messageStats?.data?.successRate || 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}