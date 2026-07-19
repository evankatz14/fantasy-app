import { Module } from '@nestjs/common';
import { PlayersModule } from './players/players.module';
import { LeaguesModule } from './leagues/leagues.module';
import { StatsModule } from './stats/stats.module';
import { AuctionValuesModule } from './auction-values/auction-values.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PlayersModule, LeaguesModule, StatsModule, AuctionValuesModule, AuthModule],
})
export class AppModule {}
