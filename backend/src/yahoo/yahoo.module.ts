import { Module } from '@nestjs/common';
import { YahooController } from './yahoo.controller';
import { YahooService } from './yahoo.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [YahooController],
  providers: [YahooService],
})
export class YahooModule {}
