<template>
	<div class="collection-item-dropdown">
		<v-skeleton-loader v-if="loading" type="input" />
		<v-input v-else clickable :placeholder="t('select_an_item')" :disabled="disabled" @click="selectDrawerOpen = true">
			<template v-if="displayItem" #input>
				<div class="preview">													
					<v-chip
						v-for="(currentDisplayItem, index) in displayItem" 
						:key="index" 
						class="tag"
						small
						label
					>
						<render-template :collection="selectedCollection" :item="currentDisplayItem" :template="displayTemplate" />											
					</v-chip>
				</div>
			</template>

			<template #append>
				<template v-if="displayItem">
					<v-icon v-tooltip="t('deselect')" name="close" class="deselect" @click.stop="$emit('input', null)" />
				</template>
				<template v-else>
					<v-icon class="expand" name="expand_more" />
				</template>
			</template>
		</v-input>

		<drawer-collection
			v-model:active="selectDrawerOpen"
			:collection="selectedCollection"
			:selection="value?.keys ? value.keys : []"
			:filter="filter!"
			@input="onSelection"
			@update:active="selectDrawerOpen = false"
			multiple
		/>
	</div>
</template>

<script setup lang="ts">
// <render-template v-for="(currentDisplayItem, index) in displayItem" :key="index" :collection="selectedCollection" :item="currentDisplayItem" :template="displayTemplate" />	
import api from '@/api';
import { useCollectionsStore } from '@/stores/collections';
import { useFieldsStore } from '@/stores/fields';
import { adjustFieldsForDisplays } from '@/utils/adjust-fields-for-displays';
import { unexpectedError } from '@/utils/unexpected-error';
import DrawerCollection from '@/views/private/components/drawer-collection.vue';
import { Filter } from '@directus/types';
import { getEndpoint, getFieldsFromTemplate } from '@directus/utils';
import { computed, ref, toRefs, unref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

type Value = {
	keys: (number | string)[] | null;
	collection: string;
};

const props = withDefaults(
	defineProps<{
		value?: Value | null;
		//value?: (number | string | Record<string, any>)[] | Record<string, any>;
		selectedCollection: string;
		template?: string | null;
		disabled?: boolean;
		filter?: Filter | null;
	}>(),
	{
		value: () => ({ keys: null, collection: '' }),
		//value: () => [],
		disabled: false,
		template: () => null,
		filter: () => null,
	}
);

const { t } = useI18n();

const emit = defineEmits(['input']);

const { selectedCollection, template } = toRefs(props);

const collectionsStore = useCollectionsStore();
const fieldStore = useFieldsStore();

const loading = ref(false);
const selectDrawerOpen = ref(false);
const displayItem = ref<Record<string, any> | null>(null);

const value = computed({
	get: () => props.value,
	set: (value) => {
		if (value && typeof value === 'object' && value.keys) {
			emit('input', value);
		} else {
			emit('input', null);
		}
	},
});


/*
const value = computed({
	get: () => props.value,
	set: (val) => {
		//emit('input', val);
		if (val && val.length > 0) emit('input', val);
		else emit('input', null);
	},
});
*/

const primaryKey = computed(() => fieldStore.getPrimaryKeyFieldForCollection(unref(selectedCollection))?.field ?? '');

const displayTemplate = computed(() => {
	if (unref(template)) return unref(template);

	const displayTemplate = collectionsStore.getCollection(unref(selectedCollection))?.meta?.display_template;

	return displayTemplate || `{{ ${primaryKey.value || ''} }}`;
});

const requiredFields = computed(() => {
	if (!displayTemplate.value || !unref(selectedCollection)) return [];
	return adjustFieldsForDisplays(getFieldsFromTemplate(displayTemplate.value), unref(selectedCollection));
});

watch(value, getDisplayItem, { immediate: true });

async function getDisplayItem() {
	if (!value.value || !value.value.keys) {
		displayItem.value = null;
		return;
	}

	if (!unref(selectedCollection) || !primaryKey.value) return;
	
	const fields = new Set(requiredFields.value);
	fields.add(primaryKey.value);

	try {
		loading.value = true;

		const response = await api.get(getEndpoint(unref(selectedCollection)), {
			params: {
				fields: Array.from(fields),
				filter: { [primaryKey.value]: { _in: value.value.keys } },
				//filter: { [primaryKey.value]: { _eq: value.value.key } },
			},
		});

		displayItem.value = response.data.data ?? null;
		//displayItem.value = response.data.data?.[0] ?? null;
	} catch (err: any) {
		unexpectedError(err);
	} finally {
		loading.value = false;
	}
}

function onSelection(selectedIds: (number | string)[] | null) {
	selectDrawerOpen.value = false;
	//value.value = { key: Array.isArray(selectedIds) ? selectedIds[0] : null, collection: unref(selectedCollection) };
	value.value = { keys: Array.isArray(selectedIds) ? selectedIds : null, collection: unref(selectedCollection) };
}
</script>

<style lang="scss" scoped>
.preview {
	flex-grow: 1;
	display: inline-flex;
}
.tag {
	margin-right: 8px;
}
:deep(.render-template) {
	padding-right: 0px !important;
}
	
</style>