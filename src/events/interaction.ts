import {Interaction} from 'discord.js';
import {Event} from 'fish';

export class InteractionCreateEvent extends Event {
  name = 'interactionCreate';

  async run(i: Interaction) {
    if (i.isCommand()) {
      const cmd = i.client.cmds.get(i.commandName);

      if (cmd) {
        try {
          cmd.run(i);
        } catch {
          //
        }
      }
    }
  }
}