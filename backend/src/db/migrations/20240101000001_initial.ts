import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('clients', (table) => {
    table.increments('id').primary();
    table.string('name').notNullable();
    table.string('email');
    table.text('address');
    table.string('phone');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('projects', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('name').notNullable();
    table.text('description');
    table.decimal('default_rate', 10, 2).notNullable().defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('invoices', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.string('invoice_number').unique().notNullable();
    table.enum('status', ['draft', 'sent', 'paid', 'overdue', 'cancelled']).defaultTo('draft');
    table.date('issue_date').notNullable();
    table.date('due_date').notNullable();
    table.decimal('subtotal', 10, 2).defaultTo(0);
    table.decimal('tax_rate', 5, 2).defaultTo(0);
    table.decimal('tax_amount', 10, 2).defaultTo(0);
    table.decimal('credits_applied', 10, 2).defaultTo(0);
    table.decimal('total', 10, 2).defaultTo(0);
    table.text('notes');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('time_entries', (table) => {
    table.increments('id').primary();
    table.integer('project_id').unsigned().references('id').inTable('projects').onDelete('CASCADE');
    table.text('description');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time');
    table.integer('duration_minutes').defaultTo(0);
    table.boolean('is_billable').defaultTo(true);
    table.integer('invoice_id').unsigned().references('id').inTable('invoices').onDelete('SET NULL');
    table.decimal('rate_override', 10, 2);
    table.timestamps(true, true);
  });

  await knex.schema.createTable('invoice_line_items', (table) => {
    table.increments('id').primary();
    table.integer('invoice_id').unsigned().references('id').inTable('invoices').onDelete('CASCADE');
    table.text('description').notNullable();
    table.decimal('quantity', 10, 2).notNullable();
    table.decimal('rate', 10, 2).notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.integer('time_entry_id').unsigned().references('id').inTable('time_entries').onDelete('SET NULL');
    table.timestamps(true, true);
  });

  await knex.schema.createTable('credits', (table) => {
    table.increments('id').primary();
    table.integer('client_id').unsigned().references('id').inTable('clients').onDelete('CASCADE');
    table.decimal('amount', 10, 2).notNullable();
    table.decimal('remaining_amount', 10, 2).notNullable();
    table.text('description');
    table.integer('source_invoice_id').unsigned().references('id').inTable('invoices').onDelete('SET NULL');
    table.integer('applied_invoice_id').unsigned().references('id').inTable('invoices').onDelete('SET NULL');
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('credits');
  await knex.schema.dropTableIfExists('invoice_line_items');
  await knex.schema.dropTableIfExists('time_entries');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('clients');
}
