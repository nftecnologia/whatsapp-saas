import { CampaignService } from '@/services/campaignService';

export class Scheduler {
  private static intervals: Map<string, NodeJS.Timeout> = new Map();

  static startScheduledCampaignProcessor(intervalMs: number = 60000): void {
    console.log('🕐 Starting scheduled campaign processor...');
    
    const interval = setInterval(async () => {
      try {
        await CampaignService.processScheduledCampaigns();
      } catch (error) {
        console.error('Error in scheduled campaign processor:', error);
      }
    }, intervalMs);

    this.intervals.set('scheduledCampaigns', interval);
  }

  static startCampaignCompletionChecker(intervalMs: number = 30000): void {
    console.log('🕐 Starting campaign completion checker...');
    
    const interval = setInterval(async () => {
      try {
        // This would need to track active campaigns and check their completion
        // For now, it's a placeholder for future implementation
        console.log('Checking campaign completions...');
      } catch (error) {
        console.error('Error in campaign completion checker:', error);
      }
    }, intervalMs);

    this.intervals.set('campaignCompletion', interval);
  }

  static stopScheduler(name: string): void {
    const interval = this.intervals.get(name);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(name);
      console.log(`🛑 Stopped scheduler: ${name}`);
    }
  }

  static stopAllSchedulers(): void {
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`🛑 Stopped scheduler: ${name}`);
    });
    this.intervals.clear();
  }

  static getActiveSchedulers(): string[] {
    return Array.from(this.intervals.keys());
  }
}