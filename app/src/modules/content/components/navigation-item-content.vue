<template>
	<v-list-item-icon>
		<v-icon :name="icon ?? 'label'" :color="color" />
	</v-list-item-icon>
	<v-list-item-content><v-text-overflow :text="naming" :highlight="search" /></v-list-item-content>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
	defineProps<{
		name: string;
		search?: string;
		icon?: string;
		color?: string;
	}>(),
	{
		icon: 'label',
		color: 'var(--foreground-normal)',
	}
);

const naming = computed(() => {
	if (props.name.indexOf('Commerce ') === 0) return props.name.replace('Commerce ', '');
	else return props.name;
});
</script>
