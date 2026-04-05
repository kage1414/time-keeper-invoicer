import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (t) => {
    t.increments('id').primary();
    t.string('email').unique().notNullable();
    t.string('password_hash').notNullable();
    t.string('role').notNullable().defaultTo('user');
    t.string('name');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('invites', (t) => {
    t.increments('id').primary();
    t.string('token').unique().notNullable();
    t.string('email');
    t.integer('created_by').unsigned().notNullable().references('id').inTable('users');
    t.integer('used_by').unsigned().references('id').inTable('users');
    t.datetime('used_at');
    t.datetime('expires_at').notNullable();
    t.datetime('created_at').defaultTo(knex.fn.now());
  });

  await knex.schema.createTable('clients', (t) => {
    t.increments('id').primary();
    t.string('name');
    t.string('company');
    t.string('email');
    t.string('address1');
    t.string('address2');
    t.string('city');
    t.string('state');
    t.string('zip');
    t.string('phone');
    t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamps(true, true);
    t.check('?? IS NOT NULL OR ?? IS NOT NULL', ['name', 'company'], 'clients_name_or_company');
  });

  await knex.schema.createTable('projects', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.string('name').notNullable();
    t.text('description');
    t.decimal('default_rate', 10, 2).notNullable().defaultTo(0);
    t.boolean('is_active').notNullable().defaultTo(true);
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('invoices', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.string('invoice_number').notNullable();
    t.string('status').notNullable().defaultTo('draft');
    t.date('issue_date').notNullable();
    t.date('due_date').notNullable();
    t.decimal('subtotal', 10, 2).defaultTo(0);
    t.decimal('tax_rate', 5, 2).defaultTo(0);
    t.decimal('tax_amount', 10, 2).defaultTo(0);
    t.decimal('credits_applied', 10, 2).defaultTo(0);
    t.decimal('total', 10, 2).defaultTo(0);
    t.text('notes');
    t.string('payment_method');
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamps(true, true);
    t.unique(['user_id', 'invoice_number']);
  });

  await knex.schema.createTable('time_entries', (t) => {
    t.increments('id').primary();
    t.integer('project_id').unsigned().notNullable().references('id').inTable('projects').onDelete('CASCADE');
    t.text('description');
    t.string('start_time');
    t.string('end_time');
    t.decimal('duration_minutes', 10, 2).defaultTo(0);
    t.boolean('is_billable').notNullable().defaultTo(true);
    t.integer('invoice_id').unsigned().references('id').inTable('invoices').onDelete('SET NULL');
    t.decimal('rate_override', 10, 2);
    t.decimal('flat_amount', 10, 2);
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('invoice_line_items', (t) => {
    t.increments('id').primary();
    t.integer('invoice_id').unsigned().notNullable().references('id').inTable('invoices').onDelete('CASCADE');
    t.text('description').notNullable();
    t.decimal('quantity', 10, 2).notNullable();
    t.decimal('rate', 10, 2).notNullable();
    t.decimal('amount', 10, 2).notNullable();
    t.integer('time_entry_id').unsigned().references('id').inTable('time_entries').onDelete('SET NULL');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('credits', (t) => {
    t.increments('id').primary();
    t.integer('client_id').unsigned().notNullable().references('id').inTable('clients').onDelete('CASCADE');
    t.decimal('amount', 10, 2).notNullable();
    t.decimal('remaining_amount', 10, 2).notNullable();
    t.text('description');
    t.integer('source_invoice_id').unsigned().references('id').inTable('invoices').onDelete('SET NULL');
    t.integer('applied_invoice_id').unsigned().references('id').inTable('invoices').onDelete('SET NULL');
    t.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    t.timestamps(true, true);
  });

  await knex.schema.createTable('user_settings', (t) => {
    t.increments('id').primary();
    t.integer('user_id').unsigned().notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    t.string('company');
    t.string('first_name');
    t.string('last_name');
    t.string('email');
    t.string('address1');
    t.string('address2');
    t.string('city');
    t.string('state');
    t.string('zip');
    t.string('phone');
    t.string('venmo');
    t.string('cashapp');
    t.string('paypal');
    t.string('zelle');
    t.integer('default_due_days').defaultTo(30);
    t.string('smtp_host');
    t.integer('smtp_port');
    t.string('smtp_user');
    t.string('smtp_pass');
    t.boolean('smtp_secure').defaultTo(true);
    t.string('smtp_from_email');
    t.string('smtp_from_name');
    t.text('default_email_template');
    t.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_settings');
  await knex.schema.dropTableIfExists('credits');
  await knex.schema.dropTableIfExists('invoice_line_items');
  await knex.schema.dropTableIfExists('time_entries');
  await knex.schema.dropTableIfExists('invoices');
  await knex.schema.dropTableIfExists('projects');
  await knex.schema.dropTableIfExists('clients');
  await knex.schema.dropTableIfExists('invites');
  await knex.schema.dropTableIfExists('users');
}
