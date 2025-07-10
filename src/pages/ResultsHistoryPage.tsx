import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/redux';
import { Layout } from '../components/Layout';
import { resultsService, type ResultsIndexEntry, type WorkshopResults } from '../services/resultsService';
import { 
  FiClock, 
  FiTrash2, 
  FiExternalLink, 
  FiDownload,
  FiRefreshCw,
  FiShare2,
  FiAlertCircle,
  FiFilter,
  FiCalendar
} from 'react-icons/fi';
import { 
  BarChart3, 
  Brain, 
  Users, 
  Target, 
  Sparkles, 
  Zap,
  TrendingUp
} from 'lucide-react';

interface FilterOptions {
  archetype: string;
  dateRange: 'all' | '7days' | '30days' | '90days';
  sortBy: 'date' | 'archetype';
}

export const ResultsHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [results, setResults] = useState<WorkshopResults[]>([]);
  const [recentResults, setRecentResults] = useState<ResultsIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterOptions>({
    archetype: 'all',
    dateRange: 'all',
    sortBy: 'date'
  });
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    loadResults();
    loadStatistics();
  }, [user?.id]);

  const loadResults = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load recent results from index
      const recent = resultsService.getRecentResults(50);
      setRecentResults(recent);

      // If user is logged in, load their specific results
      if (user?.id) {
        const userResults = await resultsService.getUserResults(user.id);
        setResults(userResults);
      }
    } catch (error) {
      console.error('Failed to load results:', error);
      setError('Failed to load your results history. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = () => {
    const stats = resultsService.getResultsStatistics();
    setStatistics(stats);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getArchetypeIcon = (archetype: string) => {
    const lowerArchetype = archetype.toLowerCase();
    if (lowerArchetype.includes('innovative')) return Zap;
    if (lowerArchetype.includes('empathetic')) return Users;
    if (lowerArchetype.includes('strategic')) return Target;
    if (lowerArchetype.includes('authentic')) return Sparkles;
    return Brain;
  };

  const getArchetypeColor = (archetype: string) => {
    const lowerArchetype = archetype.toLowerCase();
    if (lowerArchetype.includes('innovative')) return 'text-blue-600';
    if (lowerArchetype.includes('empathetic')) return 'text-green-600';
    if (lowerArchetype.includes('strategic')) return 'text-purple-600';
    if (lowerArchetype.includes('authentic')) return 'text-orange-600';
    return 'text-gray-600';
  };

  const handleDelete = async (resultId: string) => {
    if (!confirm('Are you sure you want to delete this result?')) {
      return;
    }

    try {
      setDeletingId(resultId);
      await resultsService.deleteResult(resultId, user?.id);
      
      // Reload results
      await loadResults();
      loadStatistics();
    } catch (error) {
      console.error('Failed to delete result:', error);
      setError('Failed to delete result. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleViewResult = (resultId: string) => {
    navigate(`/workshop/results?id=${resultId}`);
  };

  const getFilteredResults = () => {
    let filtered = [...recentResults];

    // Filter by archetype
    if (filters.archetype !== 'all') {
      filtered = filtered.filter(r => 
        r.archetype.toLowerCase().includes(filters.archetype.toLowerCase())
      );
    }

    // Filter by date range
    if (filters.dateRange !== 'all') {
      const now = Date.now();
      const ranges = {
        '7days': 7 * 24 * 60 * 60 * 1000,
        '30days': 30 * 24 * 60 * 60 * 1000,
        '90days': 90 * 24 * 60 * 60 * 1000
      };
      const range = ranges[filters.dateRange as keyof typeof ranges];
      filtered = filtered.filter(r => {
        const created = new Date(r.createdAt).getTime();
        return now - created <= range;
      });
    }

    // Sort
    if (filters.sortBy === 'archetype') {
      filtered.sort((a, b) => a.archetype.localeCompare(b.archetype));
    } else {
      filtered.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    }

    return filtered;
  };

  const filteredResults = getFilteredResults();

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <FiRefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading your results history...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Results History</h1>
          <p className="text-gray-600">
            View and manage your Brand House analysis results.
          </p>
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Results</p>
                  <p className="text-2xl font-bold text-gray-900">{statistics.totalResults}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Archetypes</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Object.keys(statistics.resultsByArchetype).length}
                  </p>
                </div>
                <Brain className="w-8 h-8 text-purple-600" />
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">This Month</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {filteredResults.filter(r => {
                      const created = new Date(r.createdAt).getTime();
                      const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                      return created >= thirtyDaysAgo;
                    }).length}
                  </p>
                </div>
                <FiCalendar className="w-8 h-8 text-green-600" />
              </div>
            </div>
            
            {statistics.expiringWithin7Days > 0 && (
              <div className="bg-orange-50 rounded-lg shadow-sm border border-orange-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-700">Expiring Soon</p>
                    <p className="text-2xl font-bold text-orange-900">
                      {statistics.expiringWithin7Days}
                    </p>
                  </div>
                  <FiAlertCircle className="w-8 h-8 text-orange-600" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <FiFilter className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-700">Filters:</span>
            </div>
            
            <select
              value={filters.archetype}
              onChange={(e) => setFilters({ ...filters, archetype: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Archetypes</option>
              <option value="innovative">Innovative Leader</option>
              <option value="empathetic">Empathetic Expert</option>
              <option value="strategic">Strategic Visionary</option>
              <option value="authentic">Authentic Changemaker</option>
            </select>
            
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
            </select>
            
            <select
              value={filters.sortBy}
              onChange={(e) => setFilters({ ...filters, sortBy: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date">Sort by Date</option>
              <option value="archetype">Sort by Archetype</option>
            </select>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Results List */}
        {filteredResults.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="text-gray-400 mb-4">
                <FiClock className="w-12 h-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-600 mb-6">
                {filters.archetype !== 'all' || filters.dateRange !== 'all'
                  ? 'Try adjusting your filters to see more results.'
                  : 'Complete your first Brand House workshop to see results here.'}
              </p>
              {filters.archetype === 'all' && filters.dateRange === 'all' && (
                <button
                  onClick={() => navigate('/workshop')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Brain className="w-5 h-5" />
                  <span>Start Workshop</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredResults.map((result) => {
              const ArchetypeIcon = getArchetypeIcon(result.archetype);
              const colorClass = getArchetypeColor(result.archetype);
              const isDeleting = deletingId === result.id;
              const isExpiringSoon = result.expiresAt && 
                new Date(result.expiresAt).getTime() < Date.now() + (7 * 24 * 60 * 60 * 1000);
              
              return (
                <div
                  key={result.id}
                  className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${
                    isDeleting ? 'opacity-50' : ''
                  } ${isExpiringSoon ? 'border-orange-300' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Result Info */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg bg-gray-50 ${colorClass}`}>
                          <ArchetypeIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">
                            {result.archetype}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Created: {formatDate(result.createdAt)}</span>
                            {result.shareCode && (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <FiShare2 className="w-3 h-3" />
                                  Share code: {result.shareCode}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expiration Warning */}
                      {isExpiringSoon && result.expiresAt && (
                        <div className="flex items-center gap-2 text-sm text-orange-600 mb-3">
                          <FiAlertCircle className="w-4 h-4" />
                          <span>
                            Expires {new Date(result.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 ml-6">
                      <button
                        onClick={() => handleViewResult(result.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View result"
                      >
                        <FiExternalLink className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => window.open(`/workshop/results?id=${result.id}`, '_blank')}
                        className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                        title="Open in new tab"
                      >
                        <FiShare2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(result.id)}
                        disabled={isDeleting}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Delete result"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Cache Status */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <button
            onClick={() => {
              loadResults();
              loadStatistics();
            }}
            className="inline-flex items-center gap-2 hover:text-gray-700"
          >
            <FiRefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </Layout>
  );
};