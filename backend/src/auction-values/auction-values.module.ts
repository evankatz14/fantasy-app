import { Module } from '@nestjs/common';
import { AuctionValuesController } from './auction-values.controller';
import { AuctionValuesService } from './auction-values.service';

@Module({
  controllers: [AuctionValuesController],
  providers: [AuctionValuesService],
})
export class AuctionValuesModule {}
