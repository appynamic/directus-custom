import type { Knex } from 'knex';
import type { FnHelperOptions } from '../types.js';
import { FnHelper } from '../types.js';

export class FnHelperMySQL extends FnHelper {
	year(table: string, column: string): Knex.Raw {
		console.log('mysql___year___', table, column);
		return this.knex.raw('YEAR(??.??)', [table, column]);
	}

	month(table: string, column: string): Knex.Raw {
		return this.knex.raw('MONTH(??.??)', [table, column]);
	}

	week(table: string, column: string): Knex.Raw {
		return this.knex.raw('WEEK(??.??)', [table, column]);
	}

	day(table: string, column: string): Knex.Raw {
		return this.knex.raw('DAYOFMONTH(??.??)', [table, column]);
	}

	weekday(table: string, column: string): Knex.Raw {
		return this.knex.raw('DAYOFWEEK(??.??)', [table, column]);
	}

	hour(table: string, column: string): Knex.Raw {
		return this.knex.raw('HOUR(??.??)', [table, column]);
	}

	minute(table: string, column: string): Knex.Raw {
		return this.knex.raw('MINUTE(??.??)', [table, column]);
	}

	second(table: string, column: string): Knex.Raw {
		return this.knex.raw('SECOND(??.??)', [table, column]);
	}

	count(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		const collectionName = options?.originalCollectionName || table;
		const type = this.schema.collections?.[collectionName]?.fields?.[column]?.type ?? 'unknown';

		if (type === 'json') {
			return this.knex.raw('JSON_LENGTH(??.??)', [table, column]);
		}

		if (type === 'alias') {
			return this._relationalCount(table, column, options);
		}

		throw new Error(`Couldn't extract type from ${table}.${column}`);
	}
	
	// https://github.com/directus/directus/discussions/7277
	/*
	Some databases, like Postgres and more recent versions of MySQL have (limited) capabilities to search in JSON objects, instead of treating them as a flat value. Postgres f.e. has a dedicated syntax for it, where MySQL has a "EXTRACT_JSON" function that can be used to extract values from the JSON object.

	Seeing this would require a lot of custom magic per DB driver, I think this could be implemented in a similar fashion as the date extraction functions (year(datetime_created) etc):

	// json(my_json_field, path.to.the.value)
	
	The second argument would be a dot-notation path of where to find the value in the JSON, similar to lodashes get function
	
	// https://github.com/directus/directus/pull/15889
	// A json query is used as a function using the following format: json({{FIELD}}{{QUERY}}) (for example: json(fieldName$.jsonProperty))
	// GET /items/jason?fields=json(data$.propA)
	
	// http://localhost:3055/items/commerce_stores?fields=*,year(created_at),json(currencies$.collection)
	// http://localhost:3055/items/commerce_stores?fields=*,year(created_at),json(currencies$.collection),json(currencies$.keys)
	// http://localhost:3055/items/commerce_stores?fields=*,year(created_at),my_value&alias[my_value]=json(currencies$.collection)
	*/
	json(table: string, column: string, options?: FnHelperOptions): Knex.Raw {
		console.log('mysql______json______', table, column, options);
		
		const collectionName = options?.originalCollectionName || table;
		const type = this.schema.collections?.[collectionName]?.fields?.[column]?.type ?? 'unknown';
		
		if (type === 'json') {
			// uses the native `JSON_EXTRACT(...)` to extract field values
			if (options?.jsonPath) {
				const q = this.knex.raw('?', [options.jsonPath]).toQuery();
				return this.knex.raw(`JSON_EXTRACT(??.??, ${q})`, [table, column]); // node.fieldKey ???
				//return this.knex.raw(`JSON_EXTRACT(??.??, ${q}) as ??`, [table, column, options.fieldKey]); // node.fieldKey ???
				//return this.knex.raw(`JSON_EXTRACT(??.??, ${q}) as ??`, [table, node.name, node.fieldKey]);
			}			
		}

		throw new Error(`Couldn't extract type from ${table}.${column}`);
	}
	
}
