import {ExemptionKind, GuildConfigs} from '@prisma/client';
import {
  APIApplicationCommandOption,
  ApplicationCommandOptionType,
} from 'discord-api-types';
import {CommandInteraction, Permissions} from 'discord.js';
import {Command} from 'fish';

export class ConfigCommand extends Command {
  name = 'config';
  description = 'Configure how the bot works';
  options: APIApplicationCommandOption[] = [
    {
      name: 'get',
      description: 'Get the current server configuration',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      // TODO: maybe use sub command groups?
      name: 'set',
      description: 'Configure how the bot works',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'delete',
          description: 'Should phishing messages be deleted?',
          type: ApplicationCommandOptionType.Boolean,
        },
        {
          name: 'action',
          description: 'What action should be taken?',
          type: ApplicationCommandOptionType.String,
          choices: [
            {
              name: 'Ban',
              value: 'BAN',
            },
            {
              name: 'Softban',
              value: 'SOFTBAN',
            },
            {
              name: 'Kick',
              value: 'KICK',
            },
            {
              name: 'Mute',
              value: 'MUTE',
            },
            {
              name: 'None',
              value: 'NONE',
            },
          ],
        },
        {
          name: 'log_channel',
          description: 'The channel where logs will be posted',
          type: ApplicationCommandOptionType.Channel,
        },
        {
          name: 'mute_role',
          description: 'The role to give users when `action` is set to `MUTE`',
          type: ApplicationCommandOptionType.Role,
        },
      ],
    },
    {
      name: 'exemptions',
      description: 'Exempt users or roles from scam link detection',
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        {
          name: 'list',
          description: 'List all exemptions',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'filter',
              description: 'Filter exemption list',
              type: ApplicationCommandOptionType.String,
              required: false,
              choices: [
                {
                  name: 'Role',
                  value: 'ROLE',
                },
                {
                  name: 'User',
                  value: 'USER',
                },
              ],
            },
          ],
        },
        {
          name: 'create',
          description: 'Create a new exemption',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'kind',
              description: 'What kind of exemption to create',
              type: ApplicationCommandOptionType.String,
              required: true,
              choices: [
                {
                  name: 'Role',
                  value: 'ROLE',
                },
                {
                  name: 'User',
                  value: 'USER',
                },
              ],
            },
            {
              name: 'role',
              description: 'The role to exempt. Only usable when `kind: Role`',
              type: ApplicationCommandOptionType.Role,
            },
            {
              name: 'user',
              description: 'The user to exempt. Only usable when `kind: User`',
              type: ApplicationCommandOptionType.User,
            },
          ],
        },

        {
          name: 'remove',
          description: 'Delete an exemption',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'kind',
              description: 'What kind of exemption to remove',
              type: ApplicationCommandOptionType.String,
              required: true,
              choices: [
                {
                  name: 'Role',
                  value: 'ROLE',
                },
                {
                  name: 'User',
                  value: 'USER',
                },
              ],
            },
            {
              name: 'role',
              description:
                'The exemption to remove. Only usable when `kind: Role`',
              type: ApplicationCommandOptionType.Role,
            },
            {
              name: 'user',
              description:
                'The exemption to remove. Only usable when `kind: User`',
              type: ApplicationCommandOptionType.User,
            },
          ],
        },
      ],
    },
    {
      name: 'reset',
      description: 'Reset parts of your configuration',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'reset_field',
          description: 'Which field to reset',
          type: ApplicationCommandOptionType.String,
          required: true,
          choices: [
            {
              name: 'delete',
              value: 'delete',
            },
            {
              name: 'action',
              value: 'action',
            },
            {
              name: 'log_channel',
              value: 'logChannel',
            },
            {
              name: 'mute_role',
              value: 'muteRole',
            },
          ],
        },
      ],
    },
  ];

  async run(i: CommandInteraction) {
    if (!i.guild) {
      await i.reply({
        content: ':x: This command can only be used in servers.',
        ephemeral: true,
      });
      return;
    }

    if (
      !new Permissions(BigInt(i.member?.permissions as string)).has(
        'MANAGE_GUILD'
      )
    ) {
      await i.reply(':x: You do not have permission to use this command');

      return;
    }

    switch (i.options.getSubcommandGroup()) {
      case 'exemptions': {
        switch (i.options.getSubcommand(true)) {
          case 'list': {
            const filter = (i.options.getString('filter') || undefined) as
              | 'USER'
              | 'ROLE'
              | undefined;

            const exemptions = await i.client.db.exemptions.all(
              i.guild.id,
              filter
            );

            const _users = exemptions
              .filter(e => e.kind === 'USER')
              .map(e => `- ${e.id}`);
            const users = _users.join('\n');

            const _roles = exemptions
              .filter(e => e.kind === 'ROLE')
              .map(e => `- ${e.id}`);
            const roles = _roles.join('\n');

            const msg = `\`\`\`md
            => Total Exemptions: ${exemptions.length}

            -- Users (${_users.length}): --
            ${users || 'No Exempt Users'}

            -- Roles (${_roles.length}): --
            ${roles || 'No Exempt Roles'}
            \`\`\``
              .replace(/^ +/gm, '')
              .trim();

            await i.reply({content: msg, ephemeral: true});

            return;
          }

          case 'create': {
            const kind = i.options.getString('kind', true);
            const secondOp = i.options.get(kind.toLowerCase(), false);

            if (!secondOp) {
              await i.reply({
                content: `:x: You must provide a value to the \`${kind.toLowerCase()}\` parameter.`,
              });

              return;
            }

            const id = secondOp.value as string;

            try {
              await i.client.db.exemptions.add(
                i.guild.id,
                kind as ExemptionKind,
                id
              );

              await i.reply({
                content: `:white_check_mark: Created \`${kind}\` exemption for \`id=${id}\``,
                ephemeral: true,
              });
            } catch {
              await i.reply({
                content: ':x: This exemption already exists!',
                ephemeral: true,
              });
            }

            return;
          }

          case 'remove': {
            const kind = i.options.getString('kind', true);
            const secondOp = i.options.get(kind.toLowerCase(), false);

            if (!secondOp) {
              await i.reply({
                content: `:x: You must provide a value to the \`${kind.toLowerCase()}\` parameter.`,
              });

              return;
            }

            const id = secondOp.value as string;

            try {
              await i.client.db.exemptions.delete(i.guild.id, id);

              await i.reply({
                content: `:white_check_mark: Deleted \`${kind}\` exemption for \`id=${id}\``,
                ephemeral: true,
              });
            } catch {
              await i.reply({
                content: ':x: This exemption does not exist.',
                ephemeral: true,
              });
            }

            return;
          }
        }
        break;
      }

      default: {
        switch (i.options.getSubcommand()) {
          case 'get': {
            let guildConfig = await i.client.db.guildConfigs.get(i.guild.id);

            if (!guildConfig) {
              guildConfig = await i.client.db.guildConfigs.add(i.guild.id);
            }

            const msg = formatConfig(guildConfig);

            await i.reply({content: msg, ephemeral: true});
            return;
          }

          case 'set': {
            const data = i.options.data.find(
              p => p.name === 'set' && p.type === 'SUB_COMMAND'
            )!;

            if (!data.options?.length) {
              await i.reply({
                content:
                  ':x: Incorrect command usage. Please provide options to modify.',
                ephemeral: true,
              });

              return;
            }

            // TODO: this is awful
            const update: Record<string, string | number | boolean> = {};
            for (const op of data.options || []) {
              if (op.name === 'log_channel') {
                op.name = 'logChannel';
              } else if (op.name === 'mute_role') {
                op.name = 'muteRole';
              }

              update[op.name as string] = op.value!;
            }

            const updated = await i.client.db.guildConfigs.update(
              i.guild.id,
              update
            );

            const msg = formatConfig(updated);

            await i.reply({content: msg, ephemeral: true});
            return;
          }

          case 'reset': {
            const d = i.options.get('reset_field', true);

            const DEFAULTS: Record<string, string | boolean | null> = {
              delete: true,
              action: 'NONE',
              muteRole: null,
              logChannel: null,
            };

            const field = d.value! as string;
            const val = DEFAULTS[field];

            await i.client.db.guildConfigs.update(i.guild.id, {
              [field]: val,
            });

            await i.reply({
              content: `:white_check_mark: Set \`${field}\` to the default value (\`${val}\`)`,
              ephemeral: true,
            });

            return;
          }
        }
      }
    }
  }
}

function formatConfig(config: GuildConfigs) {
  const entries = Object.entries(config);
  const longest = Math.max(...entries.map(([k]) => k.length));

  return `\`\`\`ini
      ${entries
        .map(
          ([k, v]) =>
            `${k.padEnd(longest)} = ${typeof v === 'string' ? `'${v}'` : v}`
        )
        .join('\n')}
      \`\`\``
    .replace(/^ +/gm, '')
    .trim();
}