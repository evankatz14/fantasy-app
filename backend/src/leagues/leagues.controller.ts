import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto, UpdateLeagueDto } from './league.types';

@Controller('leagues')
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Get()
  findAll() {
    return this.leaguesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.leaguesService.findOne(id);
  }

  @Post()
  create(@Body() body: CreateLeagueDto) {
    return this.leaguesService.create(body);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: UpdateLeagueDto) {
    return this.leaguesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leaguesService.remove(id);
  }
}
