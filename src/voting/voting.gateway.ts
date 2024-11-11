import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface VoteState {
  participants: string[];
  votes: Record<string, number>;
  hasVoted: Record<string, boolean>;
  showResults: boolean;
  votingComplete: boolean;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VotingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private voteState: VoteState = {
    participants: [],
    votes: {},
    hasVoted: {},
    showResults: false,
    votingComplete: false,
  };

  private socketToUser: Map<string, string> = new Map();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const username = this.socketToUser.get(client.id);
    if (username) {
      this.removeParticipant(username);
      this.socketToUser.delete(client.id);
      this.broadcastState();
    }
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, username: string) {
    if (!this.voteState.participants.includes(username)) {
      this.voteState.participants.push(username);
      this.voteState.hasVoted[username] = false;
      this.socketToUser.set(client.id, username);
      this.broadcastState();
    }
  }

  @SubscribeMessage('vote')
  handleVote(client: Socket, data: { username: string; value: number }) {
    const { username, value } = data;

    if (
      this.voteState.participants.includes(username) &&
      !this.voteState.hasVoted[username]
    ) {
      this.voteState.votes[username] = value;
      this.voteState.hasVoted[username] = true;

      // Check if all participants have voted
      this.voteState.votingComplete = this.voteState.participants.every(
        (participant) => this.voteState.hasVoted[participant],
      );

      this.broadcastState();
    }
  }

  @SubscribeMessage('showResults')
  handleShowResults() {
    if (this.voteState.votingComplete) {
      this.voteState.showResults = true;
      this.broadcastState();
    }
  }

  @SubscribeMessage('resetVoting')
  handleResetVoting() {
    this.voteState = {
      participants: [...this.voteState.participants],
      votes: {},
      hasVoted: Object.fromEntries(
        this.voteState.participants.map((p) => [p, false]),
      ),
      showResults: false,
      votingComplete: false,
    };
    this.broadcastState();
  }

  private removeParticipant(username: string) {
    this.voteState.participants = this.voteState.participants.filter(
      (p) => p !== username,
    );
    delete this.voteState.votes[username];
    delete this.voteState.hasVoted[username];

    // Recheck if voting is complete after participant removal
    this.voteState.votingComplete = this.voteState.participants.every(
      (participant) => this.voteState.hasVoted[participant],
    );
  }

  private broadcastState() {
    this.server.emit('voteState', this.voteState);
  }
}
