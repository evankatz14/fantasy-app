import { Controller, Get, Query, Redirect, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('yahoo')
  @Redirect()
  initiateAuth() {
    return { url: this.authService.getAuthUrl() };
  }

  @Get('yahoo/callback')
  async handleCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    try {
      await this.authService.exchangeCode(code);
      // Redirect back to the frontend after successful auth
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
      res.redirect(`${frontendUrl}?yahoo_auth=success`);
    } catch (err) {
      res.status(500).send(`Authentication failed: ${err}`);
    }
  }

  @Get('yahoo/status')
  getStatus() {
    return { authenticated: this.authService.isAuthenticated() };
  }
}
