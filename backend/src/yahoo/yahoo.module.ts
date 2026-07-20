import { Module } from '@nestjs/common';
import { YahooController } from './yahoo.controller';
import { YahooService } from './yahoo.service';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';

@Module({
  imports: [AuthModule],
  controllers: [YahooController],
  providers: [YahooService, AuthService],
})
export class YahooModule {}
