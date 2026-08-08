export type ActivityType = 
  | "game_win"
  | "game_loss"
  | "withdrawal"
  | "deposit"
  | "task_complete"
  | "referral_earn"
  | "daily_streak"
  | "vip_subscribe"
  | "transfer";

export type LiveActivity = {
  id: string;
  type: ActivityType;
  username: string;
  amount?: number;
  description: string;
  timestamp: Date;
  icon: string;
};

class LiveActivityService {
  private activities: LiveActivity[] = [];
  private listeners: Array<(activities: LiveActivity[]) => void> = [];
  private activityIdCounter = 1;

  constructor() {
    this.loadActivities();
    this.generateInitialActivities();
  }

  private loadActivities() {
    const saved = localStorage.getItem("bitzimiLiveActivities");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.activities = parsed.map((activity: any) => ({
          ...activity,
          timestamp: new Date(activity.timestamp),
        }));
        this.activityIdCounter = this.activities.length + 1;
      } catch (e) {
        this.activities = [];
      }
    }
  }

  private saveActivities() {
    // Keep only last 100 activities
    const toSave = this.activities.slice(-100);
    localStorage.setItem("bitzimiLiveActivities", JSON.stringify(toSave));
  }

  private generateInitialActivities() {
    // Feed starts empty — populated only by real user actions
  }

  addActivity(
    type: ActivityType,
    username: string,
    description: string,
    amount?: number,
    customIcon?: string
  ) {
    const iconMap: Record<ActivityType, string> = {
      game_win: "🎮",
      game_loss: "🎲",
      withdrawal: "💸",
      deposit: "💰",
      task_complete: "✅",
      referral_earn: "👥",
      daily_streak: "🔥",
      vip_subscribe: "👑",
      transfer: "🔄",
    };

    const activity: LiveActivity = {
      id: `activity_${this.activityIdCounter++}`,
      type,
      username,
      amount,
      description,
      timestamp: new Date(),
      icon: customIcon || iconMap[type],
    };

    this.activities.push(activity);
    this.saveActivities();
    this.notifyListeners();
  }

  getRecentActivities(limit: number = 50): LiveActivity[] {
    return [...this.activities]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  subscribe(callback: (activities: LiveActivity[]) => void) {
    this.listeners.push(callback);
    callback(this.getRecentActivities());
  }

  unsubscribe(callback: (activities: LiveActivity[]) => void) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  private notifyListeners() {
    const activities = this.getRecentActivities();
    this.listeners.forEach(listener => listener(activities));
  }

  // Helper method to mask username for privacy
  maskUsername(username: string): string {
    if (username.length <= 3) return username;
    return username.charAt(0) + "*".repeat(username.length - 2) + username.charAt(username.length - 1);
  }
}

export const liveActivityService = new LiveActivityService();
