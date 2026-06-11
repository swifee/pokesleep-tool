import common from "./zh-TW/common.json";
import data from "./zh-TW/data.json";
import events from "./zh-TW/events.json";
import IvCalc from "./zh-TW/IvCalc.json";
import IvCalcNews from "./zh-TW/IvCalcNews.json";
import pokemons from "./zh-TW/pokemons.json";
import ResearchCalc from "./zh-TW/ResearchCalc.json";
import skills from "./zh-TW/skills.json";
import legacy from "./zh-TW.json";

export default {
	translation: {
		...common,
		...ResearchCalc,
		...IvCalc,
		...IvCalcNews,
		TeamTimeline: legacy.translation.TeamTimeline,
		IvCalc: {
			...IvCalc.IvCalc,
			...IvCalcNews.IvCalc,
		},
		...events,
		...skills,
		...data,
		...pokemons,
	},
};
