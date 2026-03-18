import { DailyStats, DropOffStats } from '../analytics/analytics.service';

function escMd(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!\-\\]/g, '\\$&');
}

export function buildDailyReport(stats: DailyStats, dropOff: DropOffStats[]): string {
  const date = escMd(new Date().toLocaleDateString('uk-UA'));

  const dropOffText =
    dropOff.length > 0
      ? dropOff
          .slice(0, 3)
          .map((d) => `Урок ${d.lessonNumber}: ${d.skips} пропусків`)
          .join('\n')
      : 'немає даних';

  return (
    `📊 *Щоденний звіт \u2014 ${date}*\n\n` +
    `👥 Нових користувачів: ${stats.newUsers}\n` +
    `✅ Активних: ${stats.activeUsers} з ${stats.totalUsers}\n\n` +
    `📚 Уроків надіслано: ${stats.lessonsDelivered}\n` +
    `🌙 Нагадувань надіслано: ${stats.remindersDelivered}\n` +
    `✅ Урок виконано: ${stats.completions}\n` +
    `⏭ Пропущено: ${stats.skips}\n\n` +
    `🔴 Помилок: ${stats.errors}\n\n` +
    `📉 Топ drop\\-off уроки:\n${dropOffText}`
  );
}
