import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChartBarIcon,
  EyeIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import apiService from '@/services/api';
import { MessageLog, Campaign } from '@/types';
import { formatDateTime, formatPhone, truncateText } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { DonutChart, BarChart, LineChart } from '@/components/Charts';

const statusLabels = {
  pending: 'Pendente',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falhou',
};

const statusColors = {
  pending: 'warning' as const,
  sent: 'info' as const,
  delivered: 'success' as const,
  read: 'success' as const,
  failed: 'error' as const,
};

export default function MessageLogs() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<MessageLog | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: ['message-logs', { search, status, campaignId, startDate, endDate, page }],
    queryFn: () => apiService.getMessageLogs({ 
      phone: search,
      status,
      campaign_id: campaignId,
      start_date: startDate,
      end_date: endDate,
      page,
      limit: 15 
    }),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const { data: campaignsData } = useQuery({
    queryKey: ['campaigns-list'],
    queryFn: () => apiService.getCampaigns({ limit: 100 }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['message-stats', { campaignId, startDate, endDate }],
    queryFn: () => apiService.getMessageLogStats({
      campaign_id: campaignId,
      start_date: startDate,
      end_date: endDate,
    }),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const handleViewDetails = (log: MessageLog) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('');
    setCampaignId('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const logs = logsData?.data || [];
  const pagination = logsData?.pagination;
  const campaigns = campaignsData?.data || [];
  const stats = statsData?.data || {};

  // Prepare chart data
  const statusChartData = stats.byStatus ? Object.entries(stats.byStatus).map(([status, count]) => ({
    label: statusLabels[status as keyof typeof statusLabels],
    value: count as number,
    color: status === 'delivered' ? '#10b981' : 
           status === 'sent' ? '#3b82f6' : 
           status === 'read' ? '#8b5cf6' : 
           status === 'failed' ? '#ef4444' : '#f59e0b'
  })) : [];

  const campaignChartData = stats.byCampaign ? Object.entries(stats.byCampaign).map(([campaignName, count]) => ({
    label: campaignName || 'Mensagem Avulsa',
    value: count as number,
    color: '#6366f1'
  })) : [];

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
            Logs de Mensagens
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            Visualize o histórico de todas as mensagens enviadas
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none flex items-center space-x-2">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <ClockIcon className="h-4 w-4 text-gray-500" />
            <span className="text-gray-700">Auto-atualizar</span>
          </label>
          <Button
            variant="outline"
            onClick={() => setIsStatsModalOpen(true)}
          >
            <ChartBarIcon className="h-4 w-4 mr-2" />
            Estatísticas
          </Button>
          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-8 bg-white p-6 rounded-lg shadow">
        <div className="flex items-center mb-4">
          <FunnelIcon className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por telefone..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="pending">Pendente</option>
            <option value="sent">Enviada</option>
            <option value="delivered">Entregue</option>
            <option value="read">Lida</option>
            <option value="failed">Falhou</option>
          </select>

          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
          >
            <option value="">Todas as campanhas</option>
            {campaigns.map((campaign: Campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>

          <input
            type="date"
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Data inicial"
          />

          <input
            type="date"
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Data final"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={handleClearFilters}>
            Limpar Filtros
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {Object.keys(stats).length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total de Mensagens
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stats.total?.toLocaleString() || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Taxa de Sucesso
                    </dt>
                    <dd className="text-lg font-medium text-green-600">
                      {stats.successRate?.toFixed(1) || 0}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Taxa de Entrega
                    </dt>
                    <dd className="text-lg font-medium text-blue-600">
                      {stats.deliveryRate?.toFixed(1) || 0}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Taxa de Leitura
                    </dt>
                    <dd className="text-lg font-medium text-purple-600">
                      {stats.readRate?.toFixed(1) || 0}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="mt-8">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telefone</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: MessageLog) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {formatPhone(log.phone)}
                  </TableCell>
                  <TableCell>{log.contact_name || '-'}</TableCell>
                  <TableCell>{log.campaign_name || 'Mensagem Avulsa'}</TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      {truncateText(log.message_content, 50)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusColors[log.status]}>
                      {statusLabels[log.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {log.sent_at ? formatDateTime(log.sent_at) : 
                     log.created_at ? formatDateTime(log.created_at) : '-'}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleViewDetails(log)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Ver detalhes"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {pagination && pagination.pages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Mostrando {(pagination.page - 1) * pagination.limit + 1} a{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
              {pagination.total} resultados
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.pages}
                onClick={() => setPage(page + 1)}
              >
                Próximo
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Message Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLog(null);
        }}
        title="Detalhes da Mensagem"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Telefone</h4>
                <p className="mt-1 text-sm text-gray-900">{formatPhone(selectedLog.phone)}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Contato</h4>
                <p className="mt-1 text-sm text-gray-900">{selectedLog.contact_name || '-'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Campanha</h4>
                <p className="mt-1 text-sm text-gray-900">{selectedLog.campaign_name || 'Mensagem Avulsa'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500">Status</h4>
                <div className="mt-1">
                  <Badge variant={statusColors[selectedLog.status]}>
                    {statusLabels[selectedLog.status]}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-500">Conteúdo da Mensagem</h4>
              <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {selectedLog.message_content}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Criado em</h4>
                <p className="mt-1 text-sm text-gray-900">
                  {formatDateTime(selectedLog.created_at)}
                </p>
              </div>
              {selectedLog.sent_at && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Enviado em</h4>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatDateTime(selectedLog.sent_at)}
                  </p>
                </div>
              )}
              {selectedLog.delivered_at && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Entregue em</h4>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatDateTime(selectedLog.delivered_at)}
                  </p>
                </div>
              )}
            </div>

            {selectedLog.whatsapp_message_id && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">ID da Mensagem WhatsApp</h4>
                <p className="mt-1 text-sm text-gray-900 font-mono">
                  {selectedLog.whatsapp_message_id}
                </p>
              </div>
            )}

            {selectedLog.error_message && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Erro</h4>
                <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-900">{selectedLog.error_message}</p>
                </div>
              </div>
            )}

            {selectedLog.evolution_api_response && (
              <div>
                <h4 className="text-sm font-medium text-gray-500">Resposta da API</h4>
                <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                  <pre className="text-xs text-gray-900 whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.evolution_api_response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Stats Modal */}
      <Modal
        isOpen={isStatsModalOpen}
        onClose={() => setIsStatsModalOpen(false)}
        title="Estatísticas Detalhadas"
        size="xl"
      >
        {stats && (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg">
                <div className="text-2xl font-bold">{stats.total?.toLocaleString() || 0}</div>
                <div className="text-sm opacity-90">Total de Mensagens</div>
              </div>
              <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 rounded-lg">
                <div className="text-2xl font-bold">{stats.successRate?.toFixed(1) || 0}%</div>
                <div className="text-sm opacity-90">Taxa de Sucesso</div>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 rounded-lg">
                <div className="text-2xl font-bold">{stats.deliveryRate?.toFixed(1) || 0}%</div>
                <div className="text-sm opacity-90">Taxa de Entrega</div>
              </div>
              <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4 rounded-lg">
                <div className="text-2xl font-bold">{stats.readRate?.toFixed(1) || 0}%</div>
                <div className="text-sm opacity-90">Taxa de Leitura</div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Status Distribution Chart */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Distribuição por Status</h4>
                <div className="flex items-center justify-center">
                  <DonutChart data={statusChartData} size={160} />
                </div>
                <div className="mt-4 space-y-2">
                  {statusChartData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-gray-700">{item.label}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {item.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Campaign Performance Chart */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-lg font-medium text-gray-900 mb-4">Mensagens por Campanha</h4>
                <div className="h-64">
                  <BarChart data={campaignChartData.slice(0, 10)} height={240} />
                </div>
              </div>
            </div>

            {/* Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Detalhamento por Status</h4>
                <div className="space-y-2">
                  {stats.byStatus && Object.entries(stats.byStatus).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center space-x-2">
                        <Badge variant={statusColors[status as keyof typeof statusColors]}>
                          {statusLabels[status as keyof typeof statusLabels]}
                        </Badge>
                      </div>
                      <span className="font-medium">{count?.toLocaleString() || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border rounded-lg p-4">
                <h4 className="text-lg font-medium text-gray-900 mb-3">Performance Resumo</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Enviadas com Sucesso:</span>
                    <span className="font-medium text-green-600">
                      {((stats.byStatus?.sent || 0) + (stats.byStatus?.delivered || 0) + (stats.byStatus?.read || 0)).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Falharam:</span>
                    <span className="font-medium text-red-600">
                      {(stats.byStatus?.failed || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pendentes:</span>
                    <span className="font-medium text-yellow-600">
                      {(stats.byStatus?.pending || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}