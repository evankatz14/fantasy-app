import { Module } from '@nestjs/common';
import { PlayersModule } from './players/players.module';
import { LeaguesModule } from './leagues/leagues.module';
import { StatsModule } from './stats/stats.module';
import { AuctionValuesModule } from './auction-values/auction-values.module';
import { AuthModule } from './auth/auth.module';
import { YahooModule } from './yahoo/yahoo.module';

@Module({
  imports: [PlayersModule, LeaguesModule, StatsModule, AuctionValuesModule, AuthModule, YahooModule],
})
export class AppModule {}
