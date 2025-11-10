import { useMemo, useState, useCallback } from 'react';
import { Match, Team, SearchFilters } from '@app/lib/types';

interface MatchFilters extends SearchFilters {
  team: 'all' | 'team1' | 'team2';
  status: 'all' | Match['status'];
}

interface UseMatchFiltersReturn {
  filteredMatches: Match[];
  matchesByTeam: {
    team1Matches: Match[];
    team2Matches: Match[];
  };
  filters: MatchFilters;
  setFilters: (filters: MatchFilters) => void;
  updateFilter: <K extends keyof MatchFilters>(key: K, value: MatchFilters[K]) => void;
  clearFilters: () => void;
}

const initialFilters: MatchFilters = {
  search: '',
  team: 'all',
  status: 'all',
};

export function useMatchFilters(matches: Match[], teams: Team[]): UseMatchFiltersReturn {
  const [filters, setFilters] = useState<MatchFilters>(initialFilters);

  // Helper to get team name from ID
  const getTeamName = useCallback((teamId: string): string => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || 'Unknown Team';
  }, [teams]);

  const updateFilter = useCallback(<K extends keyof MatchFilters>(key: K, value: MatchFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
  }, []);

  const filteredMatches = useMemo(() => {
    return matches.filter(match => {
      const searchTerm = filters.search?.toLowerCase() || '';
      const homeTeamName = getTeamName(match.homeTeamId);
      const matchesSearch = !searchTerm ||
        homeTeamName.toLowerCase().includes(searchTerm) ||
        match.awayTeamName?.toLowerCase().includes(searchTerm) ||
        match.location.toLowerCase().includes(searchTerm) ||
        new Date(match.date).toLocaleDateString().toLowerCase().includes(searchTerm) ||
        (match.time && match.time.toLowerCase().includes(searchTerm));

      const matchesTeam = filters.team === 'all' ||
        homeTeamName.toLowerCase().includes(filters.team);

      const matchesStatus = filters.status === 'all' ||
        match.status === filters.status;

      return matchesSearch && matchesTeam && matchesStatus;
    });
  }, [matches, filters, getTeamName]);

  const matchesByTeam = useMemo(() => {
    const team1Matches = filteredMatches.filter(match => getTeamName(match.homeTeamId) === 'Team 1');
    const team2Matches = filteredMatches.filter(match => getTeamName(match.homeTeamId) === 'Team 2');
    return { team1Matches, team2Matches };
  }, [filteredMatches, getTeamName]);

  return {
    filteredMatches,
    matchesByTeam,
    filters,
    setFilters,
    updateFilter,
    clearFilters,
  };
}