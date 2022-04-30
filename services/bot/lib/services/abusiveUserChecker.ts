import {URL} from 'url';

import {credentials} from '@grpc/grpc-js';
import {AbusiveUserServiceClient} from '../protos/abusiveUserChecker_grpc_pb';
import {
  CheckImageRequest,
  CheckImageResponse,
} from '../protos/abusiveUserChecker_pb';
import {Client} from '..';
import {GuildMember, User} from 'discord.js';
import {remove} from 'confusables';

export class AbusiveUserChecker {
  #checkerService = new AbusiveUserServiceClient(
    process.env.GRPC_CHECKER_SERVICE_URL,
    credentials.createInsecure()
  );

  readonly imageThreshold = 5;

  constructor(private client: Client) {}

  async checkImage(url: string): Promise<CheckImageResponse | undefined> {
    const u = new URL(url);
    if (!u.searchParams.has('size')) {
      u.searchParams.append('size', '512');
    }

    const req = new CheckImageRequest();
    req.setUrl(u.toString());

    return new Promise((res, rej) => {
      this.#checkerService.checkImage(req, (err, val) => {
        if (err) {
          console.log('Error checking image:', url, err);
          return rej(err);
        }

        return res(val);
      });
    });
  }

  // TODO: near match usernames?
  checkUsername(username: string): boolean {
    const normalized = remove(username).replace(/\s/g, '').toLowerCase();

    const keywords = [
      'academy',
      'agent',
      'bot',
      'dev',
      'discord',
      'employee',
      'events',
      'hype',
      'hypesquad',
      'message',
      'mod',
      'notif',
      'recurit',
      'staff',
      'system',
      'team',
      'terms',
    ];

    return keywords.some(w => normalized.includes(w));
  }

  // TODO: this should probably return more data, like hash distance
  async checkMember(m: GuildMember): Promise<CheckedUser> {
    const u = m.user;
    const verdict: CheckedUser = {
      user: u,
      matchedUsername: false,
      matchedAvatar: false,
    };

    if (u.bot || u.avatar?.startsWith('a_')) {
      return verdict;
    }

    const isExempt = await this.client.db.exemptions.isExempt(m);

    if (!isExempt) {
      return verdict;
    }

    const usernameMatches = this.checkUsername(u.username);
    if (!usernameMatches) {
      return verdict;
    }

    verdict.matchedUsername = true;

    const av = u.avatarURL({dynamic: false, format: 'png', size: 4096});
    if (!av) {
      // TODO: what should happen if they don't have an avatar?
      return verdict;
    }

    try {
      const checkedAvatar = await this.checkImage(av);
      if (!checkedAvatar) {
        return verdict;
      }

      verdict.nearestAvatar = checkedAvatar;

      if (checkedAvatar.getPhashDistance() <= this.imageThreshold) {
        verdict.matchedAvatar = true;

        this.client.metrics.addAbusiveUser(verdict);

        return verdict;
      }
    } catch (err) {
      console.log(`failed to check for user ${u.id} ${av}:`, err);
    }

    return verdict;
  }
}

export interface CheckedUser {
  user: User;

  matchedUsername: boolean;
  // TODO: nearestUsername?: string;

  matchedAvatar: boolean;
  nearestAvatar?: CheckImageResponse;
}