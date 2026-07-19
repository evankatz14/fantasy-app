import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { YahooService } from './yahoo.service';

@Controller('yahoo')
export class YahooController {
  constructor(private readonly yahooService: YahooService) {}

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
}
