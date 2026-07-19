import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';

@Module({
  imports: [HttpModule],
  controllers: [PlayersController],
  providers: [PlayersService],
  exports: [PlayersService],
})
export class PlayersModule {}
