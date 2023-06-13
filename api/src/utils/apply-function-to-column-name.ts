//import { REGEX_BETWEEN_PARENS } from '@directus/constants';
import { parseJsonFunction } from './parse-json-function.js';
import { stripFunction } from './strip-function.js';

/**
 * Takes in a column name, and transforms the original name with the generated column name based on
 * the applied function.
 *
 * @example
 *
 * ```js
 * applyFunctionToColumnName('year(date_created)');
 * // => "date_created_year"
 * ```
 */
export function applyFunctionToColumnName(column: string): string {
	console.log('____applyFunctionToColumnName '+column);
	if (column.includes('(') && column.includes(')')) {
		const functionName = column.split('(')[0];
		//const columnName = column.match(REGEX_BETWEEN_PARENS)![1];
		if (functionName === 'json') {
			const { fieldName, jsonPath } = parseJsonFunction(column);
			//console.log('____json____fieldName='+fieldName, jsonPath);
			const queryStr = jsonPath
				.replace(/[^a-z0-9\\.\\[\\]]/gi, '')
				.replace(/[^a-z0-9]+/gi, '_')
				.replace(/_$/, '');
			return `${functionName}_${fieldName}${queryStr}`;
		}
		const columnName = stripFunction(column);
		return `${columnName}_${functionName}`;
	} else {
		return column;
	}
}
