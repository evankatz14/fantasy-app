import { Controller, Get, Query } from '@nestjs/common';
import { AuctionValuesService } from './auction-values.service';

@Controller('auction-values')
export class AuctionValuesController {
  constructor(private readonly service: AuctionValuesService) {}

  @Get()
  getValues(@Query('format') format?: string) {
    const fmt = (['half_ppr', 'ppr', 'standard'].includes(format ?? '')
      ? format
      : 'half_ppr') as 'half_ppr' | 'ppr' | 'standard';
    return this.service.getValues(fmt);
  }
}
