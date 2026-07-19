import { Controller, Get, Post, Query } from '@nestjs/common';
import { PlayersService } from './players.service';
import type { FantasyPosition } from './player.types';

@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  getPlayers(@Query('position') position?: string) {
    return this.playersService.getPlayers(position as FantasyPosition | undefined);
  }

  @Post('refresh')
  refreshPlayers() {
    return this.playersService.refreshPlayers();
  }
}
