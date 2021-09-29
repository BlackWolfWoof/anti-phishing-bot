import {request, RequestOptions} from 'http';
import {Database} from '..';

const OPTIONS: RequestOptions = {
  method: 'GET',
  hostname: 'api.phish.surf',
  path: '/gimme-domains',
  port: 5000,
};

export class DomainFetcher {
  interval = 5 * 1_000 * 60; // 5 minutes

  timeout?: NodeJS.Timeout;

  constructor(private db: Database) {}

  async run() {
    try {
      const domainList = await get(OPTIONS);

      await this.db.domains.bulkAdd(domainList);
    } catch (e) {
      console.error('Unable to fetch domains:', e);
    }
  }

  async up() {
    try {
      await this.run();
      this.timeout = setInterval(this.run, this.interval);
    } catch (e) {
      console.error(e);
    }
  }

  down() {
    if (this.timeout) {
      clearInterval(this.timeout);
      this.timeout = undefined;
    }
  }
}

function get(options: RequestOptions): Promise<string[]> {
  return new Promise((resolve, reject) => {
    try {
      request(options, res => {
        res.setEncoding('utf-8');
        res.setTimeout(10_000);

        let data = '';

        res.on('data', d => (data += d));
        res.on('close', () => resolve(JSON.parse(data)));
        res.on('end', () => resolve(JSON.parse(data)));
        res.on('error', reject);
      }).end();
    } catch (e) {
      return reject(e);
    }
  });
}