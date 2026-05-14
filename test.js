

const yesterdayAT200 = new Date();
yesterdayAT200.setDate(yesterdayAT200.getDate() - 1);
yesterdayAT200.setHours(14, 0, 0, 0); // Set to 2:00 PM

const toDay = new Date();
toDay.setHours(14, 0, 0, 0); // Set to 2:00 PM

console.log("Yesterday at 2:00 PM:", yesterdayAT200);
console.log("Today at 2:00 PM:", toDay);

const durationMs = toDay.getTime() - yesterdayAT200.getTime();
const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(2);
console.log(`Duration between yesterday at 2:00 PM and today at 2:00 PM: ${durationHours} hours`);