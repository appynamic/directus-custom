import type { FieldFunction, Type } from '@directus/types';

export function getOutputTypeForFunction(fn: FieldFunction): Type {
	const typeMap: Record<FieldFunction, Type> = {
		year: 'integer',
		month: 'integer',
		week: 'integer',
		day: 'integer',
		weekday: 'integer',
		hour: 'integer',
		minute: 'integer',
		second: 'integer',
		count: 'integer',
		json: 'json', // to display in json format, not string
	};

	return typeMap[fn];
}
