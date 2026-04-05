import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('clients', (table) => {
    table.check('name IS NOT NULL OR company IS NOT NULL', [], 'clients_name_or_company');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('clients', (table) => {
    table.dropChecks(['clients_name_or_company']);
  });
}
