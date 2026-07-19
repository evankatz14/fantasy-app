import { Controller, Get, Param, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  // More specific routes must come before wildcard routes

  @Get('player/:playerId/weekly/:season')
  getPlayerWeekly(
    @Param('playerId') playerId: string,
    @Param('season', ParseIntPipe) season: number,
  ) {
    return this.statsService.getPlayerWeeklyStats(playerId, season);
  }

  @Get('player/:playerId')
  getPlayer(@Param('playerId') playerId: string) {
    return this.statsService.getPlayerStats(playerId);
  }

  @Get(':season')
  getSeason(@Param('season', new DefaultValuePipe(2025), ParseIntPipe) season: number) {
    return this.statsService.getStats(season);
  }
}
