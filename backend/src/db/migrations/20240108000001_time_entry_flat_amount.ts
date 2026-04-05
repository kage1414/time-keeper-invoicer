import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('time_entries', (table) => {
    table.string('start_time').nullable().alter();
    table.decimal('flat_amount', 10, 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('time_entries', (table) => {
    table.dropColumn('flat_amount');
    table.string('start_time').notNullable().alter();
  });
}
