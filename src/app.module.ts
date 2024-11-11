// src/app.module.ts
import { Module } from '@nestjs/common';
import { VotingGateway } from './voting/voting.gateway';

@Module({
  imports: [],
  providers: [VotingGateway],
})
export class AppModule {}
