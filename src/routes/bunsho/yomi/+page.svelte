<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { UI } from '$lib/data/ui-text';
	import { recordStudy, recordBunshoStudy } from '$lib/db';
	import { playCorrectSound } from '$lib/services/sound';
	import VerticalSentence from '$lib/components/VerticalSentence.svelte';
	import SpeakButton from '$lib/components/SpeakButton.svelte';

	// 読みから送り仮名を除去（文章モードでは送り仮名がヒントになるため）
	function getStemReading(reading: string): string {
		return reading.includes('.') ? reading.split('.')[0] : reading;
	}

	interface Example {
		id: string;
		sentence: string;
		sentenceWithRuby?: string;
		reading: string;
		type: 'kun' | 'on';
	}

	interface KanjiExample {
		kanjiId: string;
		character: string;
		examples: Example[];
	}

	let allExamples: KanjiExample[] = $state([]);
	let currentIndex = $state(0);
	let currentExample: { kanji: KanjiExample; example: Example } | null = $state(null);

	let choices: string[] = $state([]);
	let selectedAnswer: string | null = $state(null);
	let showResult = $state(false);
	let isCorrect = $state(false);
	let startTime = $state(0);

	let questionList: { kanji: KanjiExample; example: Example }[] = $state([]);
	let targetKanjiChar: string | null = $state(null);
	let targetQuestionCount = $state(0); // 図鑑からアクセス時、対象漢字の問題数

	onMount(async () => {
		const res = await fetch('/data/examples.json');
		allExamples = await res.json();

		const kanjiParam = $page.url.searchParams.get('kanji');
		targetKanjiChar = kanjiParam;

		const flat: { kanji: KanjiExample; example: Example }[] = [];
		for (const kanji of allExamples) {
			for (const ex of kanji.examples) {
				flat.push({ kanji, example: ex });
			}
		}

		if (kanjiParam) {
			const targetQuestions = flat.filter(q => q.kanji.character === kanjiParam);
			const otherQuestions = flat.filter(q => q.kanji.character !== kanjiParam);
			targetQuestionCount = targetQuestions.length;
			questionList = [
				...targetQuestions.sort(() => Math.random() - 0.5),
				...otherQuestions.sort(() => Math.random() - 0.5)
			];
		} else {
			questionList = flat.sort(() => Math.random() - 0.5);
		}

		loadQuestion();
	});

	function loadQuestion() {
		if (questionList.length === 0) return;

		currentExample = questionList[currentIndex];
		generateChoices();
		selectedAnswer = null;
		showResult = false;
		isCorrect = false;
		startTime = Date.now();
	}

	function generateChoices() {
		if (!currentExample) return;

		const correct = currentExample.example.reading;
		const allReadings = allExamples
			.flatMap(k => k.examples.map(e => e.reading))
			.filter(r => r !== correct);

		const shuffled = [...new Set(allReadings)].sort(() => Math.random() - 0.5);
		const wrongChoices = shuffled.slice(0, 3);

		choices = [correct, ...wrongChoices].sort(() => Math.random() - 0.5);
	}

	async function handleSelect(answer: string) {
		if (showResult || !currentExample) return;

		selectedAnswer = answer;
		isCorrect = answer === currentExample.example.reading;
		showResult = true;

		await recordStudy({
			kanjiId: currentExample.kanji.kanjiId,
			mode: 'reading',
			result: isCorrect ? 'correct' : 'incorrect',
			score: isCorrect ? 1 : 0,
			hintUsed: false,
			timeSpent: Date.now() - startTime
		});

		// ぶんしょうモード進捗を記録
		await recordBunshoStudy(
			currentExample.kanji.kanjiId,
			currentExample.example.id,
			'yomi',
			isCorrect
		);

		if (isCorrect) {
			// 正解時はSE再生
			playCorrectSound();
			// 図鑑からのアクセス時は同じ漢字の別の例文へ
			if (targetKanjiChar && targetQuestionCount > 1) {
				setTimeout(() => {
					currentIndex = (currentIndex + 1) % targetQuestionCount;
					loadQuestion();
				}, 700);
			} else if (!targetKanjiChar) {
				setTimeout(handleNext, 700);
			}
		}
	}

	function handleNext() {
		currentIndex = (currentIndex + 1) % questionList.length;
		loadQuestion();
	}
</script>

<svelte:head>
	<title>ぶんしょう よみ{targetKanjiChar ? ' - ' + targetKanjiChar : ''} - {UI.appName}</title>
</svelte:head>

<div class="h-screen flex flex-col bg-gradient-to-br from-green-50 to-emerald-100">
	<header class="bg-white shadow-md flex-shrink-0">
		<div class="flex items-center justify-between px-4 py-2">
			<a href={targetKanjiChar ? '/zukan/' + (currentExample?.kanji.kanjiId || '') : '/bunsho'} class="text-lg text-green-500 hover:text-green-700">← もどる</a>
			<h1 class="text-xl font-bold text-gray-800">
				ぶんしょう よみ
				{#if targetKanjiChar}
					<span class="ml-2 rounded-full bg-yellow-100 px-3 py-1 text-yellow-700">「{targetKanjiChar}」</span>
				{/if}
			</h1>
			<span class="text-lg text-gray-500">{currentIndex + 1} / {questionList.length}</span>
		</div>
	</header>

	<main class="flex-1 flex overflow-hidden min-h-0">
		{#if currentExample}
			<div class="w-1/2 flex flex-col bg-gradient-to-br from-amber-50 to-yellow-100 p-3">
				<div class="flex-1 min-h-0 flex items-center justify-center">
					<VerticalSentence
						sentence={currentExample.example.sentence}
						targetKanji={currentExample.kanji.character}
					/>
				</div>
				<div class="flex-shrink-0 flex justify-center py-2">
					{#if showResult && !isCorrect}
						<!-- 不正解時のみ読み上げで確認可能 -->
						<SpeakButton text={currentExample.example.sentence} size="md" />
					{:else}
						<div class="h-10"></div>
					{/if}
				</div>
			</div>

			<div class="w-1/2 flex flex-col justify-center items-center p-4 bg-white/50">
				<div class="mb-4 text-center">
					<span class="inline-block rounded-full bg-yellow-100 px-4 py-2 text-xl font-bold text-yellow-700">
						「{currentExample.kanji.character}」の よみかたは？
					</span>
				</div>

				<div class="grid grid-cols-2 gap-3 mb-4">
					{#each choices as choice}
						{@const isSelected = selectedAnswer === choice}
						{@const isCorrectChoice = choice === currentExample.example.reading}
						<button
							onclick={() => handleSelect(choice)}
							disabled={showResult}
							class="w-32 h-16 rounded-2xl text-2xl font-bold transition-all active:scale-95
								{showResult && isCorrectChoice ? 'bg-green-500 text-white' : ''}
								{showResult && isSelected && !isCorrectChoice ? 'bg-red-400 text-white' : ''}
								{!showResult ? 'bg-white text-gray-700 shadow-lg hover:shadow-xl hover:bg-gray-50' : ''}
								{showResult && !isSelected && !isCorrectChoice ? 'bg-gray-100 text-gray-400' : ''}"
						>
							{getStemReading(choice)}
						</button>
					{/each}
				</div>

				{#if showResult}
					<div class="mb-4 text-center">
						{#if isCorrect}
							<div class="text-5xl mb-1">⭕</div>
							<div class="text-xl font-bold text-green-600">{UI.correct}</div>
						{:else}
							<div class="text-5xl mb-1">❌</div>
							<div class="text-xl font-bold text-red-600">
								こたえは「{currentExample.example.reading}」
							</div>
						{/if}
					</div>

					{#if !isCorrect}
						<button
							onclick={handleNext}
							class="rounded-2xl bg-green-500 px-8 py-3 text-xl font-bold text-white
								   hover:bg-green-600 active:scale-95 shadow-lg"
						>
							つぎへ →
						</button>
					{/if}
				{/if}
			</div>
		{:else}
			<div class="flex-1 flex items-center justify-center">
				<div class="text-2xl text-gray-500">{UI.loading}</div>
			</div>
		{/if}
	</main>
</div>
