import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { YahooService } from './yahoo.service';
import { AuthService } from '../auth/auth.service';

@Controller('yahoo')
export class YahooController {
  constructor(
    private readonly yahooService: YahooService,
    private readonly authService: AuthService,
  ) {}

  @Get('player-values')
  async getPlayerValues() {
    try {
      return await this.yahooService.getPlayerValues();
    } catch (err) {
      throw new HttpException(
        `Yahoo data unavailable: ${err}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  @Get('debug-raw')
  async debugRaw() {
    const token = await this.authService.getValidAccessToken();
    const url = `https://fantasysports.yahooapis.com/fantasy/v2/game/nfl/players;sort=AR;start=0;count=3;out=draft_analysis?format=json`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const text = await res.text();
    return { status: res.status, url, body: JSON.parse(text) };
  }
}
