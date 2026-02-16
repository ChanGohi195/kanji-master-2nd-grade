<script lang="ts">
	import { onMount } from 'svelte';
	import { UI } from '$lib/data/ui-text';
	import { settings } from '$lib/stores/settings';
	import { getAllProgress, getDailyStats, getGrowthCounts, getTotalStudyTime, getTodayStats, type KanjiProgress } from '$lib/db';
	import { getGrowthIcon, getGrowthLabel, type GrowthLevel } from '$lib/types';

	let dailyStats: { date: string; count: number }[] = $state([]);
	let growthCounts: Record<GrowthLevel, number> = $state({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
	let totalAttempts = $state(0);
	let averageAccuracy = $state(0);
	let totalStudyTime = $state(0);
	let todayStudyTime = $state(0);
	let loading = $state(true);

	onMount(async () => {
		const [stats, counts, progressList, studyTime, todayStats] = await Promise.all([
			getDailyStats(7),
			getGrowthCounts(),
			getAllProgress(),
			getTotalStudyTime(),
			getTodayStats()
		]);

		totalStudyTime = studyTime;
		todayStudyTime = todayStats.time;

		dailyStats = stats;
		growthCounts = counts;

		// 総試行回数と平均正答率
		let totalCorrect = 0;
		let totalAll = 0;
		for (const p of progressList) {
			totalAll += p.writingAttempts + p.readingAttempts;
			totalCorrect += p.writingCorrect + p.readingCorrect;
		}
		totalAttempts = totalAll;
		averageAccuracy = totalAll > 0 ? Math.round((totalCorrect / totalAll) * 100) : 0;

		loading = false;
	});

	function formatDate(dateStr: string): string {
		const d = new Date(dateStr);
		return `${d.getMonth() + 1}/${d.getDate()}`;
	}

	function formatStudyTime(ms: number): string {
		const totalMinutes = Math.floor(ms / 60000);
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		if (hours > 0) {
			return `${hours}時間${minutes}分`;
		}
		return `${minutes}分`;
	}

	const discoveredCount = $derived(
		growthCounts[1] + growthCounts[2] + growthCounts[3] + growthCounts[4] + growthCounts[5]
	);
</script>

<svelte:head>
	<title>保護者モード - {UI.appName}</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-indigo-50 to-purple-50">
	<header class="bg-white shadow-md">
		<div class="mx-auto flex max-w-lg items-center justify-between px-4 py-4">
			<a href="/settings" class="text-xl text-indigo-500 hover:text-indigo-700">← 戻る</a>
			<h1 class="text-2xl font-bold text-gray-800">保護者モード</h1>
			<div class="w-16"></div>
		</div>
	</header>

	<main class="mx-auto max-w-lg px-4 py-6">
		{#if loading}
			<div class="py-20 text-center text-xl text-gray-500">読み込み中...</div>
		{:else}
			<!-- サマリー -->
			<section class="mb-6 rounded-2xl bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-bold text-gray-700">📊 学習サマリー</h2>
				<div class="grid grid-cols-2 gap-4 text-center">
					<div class="rounded-xl bg-indigo-50 p-4">
						<div class="text-3xl font-bold text-indigo-600">{discoveredCount}</div>
						<div class="text-sm text-gray-500">学習した漢字</div>
					</div>
					<div class="rounded-xl bg-green-50 p-4">
						<div class="text-3xl font-bold text-green-600">{averageAccuracy}%</div>
						<div class="text-sm text-gray-500">平均正答率</div>
					</div>
					<div class="rounded-xl bg-orange-50 p-4">
						<div class="text-3xl font-bold text-orange-600">{totalAttempts}</div>
						<div class="text-sm text-gray-500">総練習回数</div>
					</div>
					<div class="rounded-xl bg-pink-50 p-4">
						<div class="text-3xl font-bold text-pink-600">{growthCounts[4] + growthCounts[5]}</div>
						<div class="text-sm text-gray-500">マスター数</div>
					</div>
					<div class="rounded-xl bg-amber-50 p-4">
						<div class="text-2xl font-bold text-amber-600">{formatStudyTime(totalStudyTime)}</div>
						<div class="text-sm text-gray-500">総学習時間</div>
					</div>
					<div class="rounded-xl bg-cyan-50 p-4">
						<div class="text-2xl font-bold text-cyan-600">{formatStudyTime(todayStudyTime)}</div>
						<div class="text-sm text-gray-500">今日の学習時間</div>
					</div>
				</div>
			</section>

			<!-- 成長レベル分布 -->
			<section class="mb-6 rounded-2xl bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-bold text-gray-700">🌱 習熟度分布</h2>
				<div class="space-y-3">
					{#each [5, 4, 3, 2, 1, 0] as level}
						{@const count = growthCounts[level as GrowthLevel]}
						{@const percent = 160 > 0 ? (count / 160) * 100 : 0}
						<div class="flex items-center gap-3">
							<span class="text-2xl">{getGrowthIcon(level as GrowthLevel)}</span>
							<span class="w-24 text-sm text-gray-600">{getGrowthLabel(level as GrowthLevel)}</span>
							<div class="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
								<div
									class="h-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all"
									style="width: {percent}%"
								></div>
							</div>
							<span class="w-10 text-right text-sm font-medium text-gray-600">{count}</span>
						</div>
					{/each}
				</div>
			</section>

			<!-- 週間学習グラフ -->
			<section class="mb-6 rounded-2xl bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-bold text-gray-700">📅 週間学習記録</h2>
				<div class="flex items-end justify-between gap-2 h-40">
					{#each dailyStats as stat}
						{@const maxCount = Math.max(...dailyStats.map(s => s.count), 1)}
						{@const height = (stat.count / maxCount) * 100}
						<div class="flex flex-col items-center flex-1">
							<div class="w-full bg-gray-100 rounded-t-lg relative" style="height: 120px;">
								<div
									class="absolute bottom-0 w-full bg-gradient-to-t from-indigo-500 to-purple-400 rounded-t-lg transition-all"
									style="height: {height}%"
								></div>
							</div>
							<div class="mt-2 text-xs text-gray-500">{formatDate(stat.date)}</div>
							<div class="text-sm font-medium text-gray-600">{stat.count}</div>
						</div>
					{/each}
				</div>
			</section>

			<!-- PIN変更 -->
			<section class="rounded-2xl bg-white p-6 shadow-lg">
				<h2 class="mb-4 text-xl font-bold text-gray-700">🔐 暗証番号変更</h2>
				<div class="flex gap-2">
					<input
						type="password"
						maxlength="4"
						placeholder="新しい4桁"
						class="flex-1 rounded-xl border-2 border-gray-200 px-4 py-3 text-xl text-center"
						onchange={(e) => {
							const val = e.currentTarget.value;
							if (val.length === 4 && /^\d{4}$/.test(val)) {
								settings.update(s => ({ ...s, parentPin: val }));
								alert('変更しました');
								e.currentTarget.value = '';
							}
						}}
					/>
				</div>
				<p class="mt-2 text-sm text-gray-500">現在: {$settings.parentPin}</p>
			</section>
		{/if}
	</main>
</div>
