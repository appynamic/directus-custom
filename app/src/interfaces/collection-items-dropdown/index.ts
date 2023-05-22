import { defineInterface } from '@directus/utils';
import InterfaceMultipleDropdownM2o from './collection-items-dropdown.vue';
import PreviewSVG from './preview.svg?raw';

export default defineInterface({
	id: 'collection-items-dropdown',
	name: '$t:interfaces.collection-item-dropdown.collection-item-dropdown',
	description: '$t:interfaces.collection-item-dropdown.description',
	icon: 'arrow_right_alt',
	component: InterfaceMultipleDropdownM2o,
	types: ['json'],
	options: [
		{
			field: 'selectedCollection',
			type: 'string',
			name: '$t:collection',
			meta: {
				required: true,
				interface: 'system-collection',
				options: {
					includeSystem: true,
					includeSingleton: false,
				},
				width: 'half',
			},
		},
		{
			field: 'template',
			name: '$t:display_template',
			type: 'string',
			meta: {
				interface: 'system-display-template',
				width: 'full',
				options: {
					collectionField: 'selectedCollection',
					placeholder: '{{ field }}',
				},
			},
		},
		{
			field: 'filter',
			type: 'json',
			name: '$t:filter',
			meta: {
				interface: 'system-filter',
				options: {
					collectionField: 'selectedCollection',
					relationalFieldSelectable: false,
				},
			},
		},
	],
	preview: PreviewSVG,
});
