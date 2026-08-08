/**
 * Task Verification System
 * 
 * IMPORTANT: This is a SIMULATED verification system for development.
 * In PRODUCTION, this should be replaced with REAL API calls to:
 * - Twitter API v2 (verify follows/retweets)
 * - Telegram Bot API (verify channel joins)
 * - YouTube Data API (verify subscriptions)
 * - Instagram Graph API (verify follows)
 * 
 * Current simulation tracks:
 * - Link open time (must stay on external site for minimum duration)
 * - User input verification (username/ID verification)
 */

interface VerificationSession {
  taskId: string;
  taskType: string;
  linkOpenedAt: number | null;
  timeSpentOnSite: number;
  userInput?: string;
}

// Track verification sessions
const verificationSessions = new Map<string, VerificationSession>();

/**
 * Track when user opens task link
 */
export function trackLinkOpened(taskId: string, taskType: string) {
  const session: VerificationSession = {
    taskId,
    taskType,
    linkOpenedAt: Date.now(),
    timeSpentOnSite: 0,
  };
  
  verificationSessions.set(taskId, session);
  
  // Track when user returns to the tab
  const handleVisibilityChange = () => {
    if (!document.hidden && session.linkOpenedAt) {
      // User returned to our site, calculate time spent
      session.timeSpentOnSite = Date.now() - session.linkOpenedAt;
    }
  };
  
  document.addEventListener("visibilitychange", handleVisibilityChange);
  
  // Store in sessionStorage for cross-tab tracking
  sessionStorage.setItem(`verification_${taskId}`, JSON.stringify({
    openedAt: session.linkOpenedAt,
    type: taskType,
  }));
}

/**
 * Get minimum required time on external site (in milliseconds)
 */
function getMinimumRequiredTime(taskType: string): number {
  const timeRequirements: Record<string, number> = {
    twitter_follow: 8000,      // 8 seconds to follow
    twitter_retweet: 6000,     // 6 seconds to retweet
    twitter_like: 4000,        // 4 seconds to like
    telegram_join: 10000,      // 10 seconds to join channel
    youtube_subscribe: 8000,   // 8 seconds to subscribe
    youtube_like: 5000,        // 5 seconds to like video
    instagram_follow: 7000,    // 7 seconds to follow
    tiktok_follow: 7000,       // 7 seconds to follow
    facebook_like: 5000,       // 5 seconds to like page
    discord_join: 12000,       // 12 seconds to join server
    app_download: 15000,       // 15 seconds to download app
    other: 5000,               // 5 seconds default
  };
  
  return timeRequirements[taskType] || timeRequirements.other;
}

/**
 * Verify task completion
 */
export async function verifyTaskCompletion(
  taskId: string,
  taskType: string,
  taskLink: string,
  userProof?: string
): Promise<{
  success: boolean;
  message: string;
  details?: string;
}> {
  // Simulate API call delay
  await new Promise((resolve) => setTimeout(resolve, 2000));
  
  // Check if user opened the link
  const session = verificationSessions.get(taskId);
  const storedSession = sessionStorage.getItem(`verification_${taskId}`);
  
  if (!session && !storedSession) {
    return {
      success: false,
      message: "You must open the task link first before verifying.",
      details: "Click 'Open Task Link' and complete the required action.",
    };
  }
  
  // Calculate time spent (if user returned)
  let timeSpent = 0;
  if (session && session.linkOpenedAt) {
    timeSpent = Date.now() - session.linkOpenedAt;
  } else if (storedSession) {
    const stored = JSON.parse(storedSession);
    timeSpent = Date.now() - stored.openedAt;
  }
  
  const minimumTime = getMinimumRequiredTime(taskType);
  
  // Check if user spent enough time on the external site
  if (timeSpent < minimumTime) {
    const secondsNeeded = Math.ceil((minimumTime - timeSpent) / 1000);
    return {
      success: false,
      message: "Verification failed: Insufficient time on task site.",
      details: `Please spend at least ${Math.ceil(minimumTime / 1000)} seconds completing the task. You need ${secondsNeeded} more seconds.`,
    };
  }
  
  // For Twitter tasks, require username verification (simulated)
  if (taskType.startsWith("twitter_") && !userProof) {
    return {
      success: false,
      message: "Please enter your Twitter username to verify completion.",
      details: "We need to verify that you completed the action with your account.",
    };
  }
  
  // For Telegram tasks, require username/ID verification
  if (taskType.startsWith("telegram_") && !userProof) {
    return {
      success: false,
      message: "Please enter your Telegram username to verify membership.",
      details: "We need to verify that you joined the channel/group.",
    };
  }
  
  // For YouTube tasks, require channel verification
  if (taskType.startsWith("youtube_") && !userProof) {
    return {
      success: false,
      message: "Please enter your YouTube channel name to verify subscription.",
      details: "We need to verify that you subscribed to the channel.",
    };
  }
  
  // SIMULATED VERIFICATION (90% success rate for realistic testing)
  // In production, this would make actual API calls to verify the action
  const verified = Math.random() > 0.1;
  
  if (verified) {
    // Clear verification session
    verificationSessions.delete(taskId);
    sessionStorage.removeItem(`verification_${taskId}`);
    
    return {
      success: true,
      message: "Task verified successfully! Reward credited to your Task Wallet.",
      details: "Thank you for completing the task.",
    };
  } else {
    return {
      success: false,
      message: "Verification failed: Could not confirm task completion.",
      details: "Please ensure you completed the task correctly and try again in a few moments.",
    };
  }
}

/**
 * Check if user can verify (has opened link and spent minimum time)
 */
export function canVerifyTask(taskId: string, taskType: string): {
  canVerify: boolean;
  reason?: string;
  timeRemaining?: number;
} {
  const session = verificationSessions.get(taskId);
  const storedSession = sessionStorage.getItem(`verification_${taskId}`);
  
  if (!session && !storedSession) {
    return {
      canVerify: false,
      reason: "You must open the task link first",
    };
  }
  
  let timeSpent = 0;
  if (session && session.linkOpenedAt) {
    timeSpent = Date.now() - session.linkOpenedAt;
  } else if (storedSession) {
    const stored = JSON.parse(storedSession);
    timeSpent = Date.now() - stored.openedAt;
  }
  
  const minimumTime = getMinimumRequiredTime(taskType);
  
  if (timeSpent < minimumTime) {
    return {
      canVerify: false,
      reason: "Please complete the task on the external site first",
      timeRemaining: Math.ceil((minimumTime - timeSpent) / 1000),
    };
  }
  
  return {
    canVerify: true,
  };
}

/**
 * Get task type display info
 */
export function getTaskVerificationInfo(taskType: string): {
  action: string;
  proofLabel: string;
  proofPlaceholder: string;
  requiresProof: boolean;
} {
  const infoMap: Record<string, any> = {
    twitter_follow: {
      action: "Follow the account",
      proofLabel: "Your Twitter Username",
      proofPlaceholder: "@username",
      requiresProof: true,
    },
    twitter_retweet: {
      action: "Retweet the post",
      proofLabel: "Your Twitter Username",
      proofPlaceholder: "@username",
      requiresProof: true,
    },
    twitter_like: {
      action: "Like the post",
      proofLabel: "Your Twitter Username",
      proofPlaceholder: "@username",
      requiresProof: true,
    },
    telegram_join: {
      action: "Join the channel/group",
      proofLabel: "Your Telegram Username",
      proofPlaceholder: "@username or user ID",
      requiresProof: true,
    },
    youtube_subscribe: {
      action: "Subscribe to the channel",
      proofLabel: "Your YouTube Channel Name",
      proofPlaceholder: "Your channel name",
      requiresProof: true,
    },
    youtube_like: {
      action: "Like the video",
      proofLabel: "Your YouTube Channel Name",
      proofPlaceholder: "Your channel name",
      requiresProof: true,
    },
    instagram_follow: {
      action: "Follow the account",
      proofLabel: "Your Instagram Username",
      proofPlaceholder: "@username",
      requiresProof: false,
    },
    tiktok_follow: {
      action: "Follow the account",
      proofLabel: "Your TikTok Username",
      proofPlaceholder: "@username",
      requiresProof: false,
    },
    facebook_like: {
      action: "Like the page",
      proofLabel: "Your Facebook Profile Name",
      proofPlaceholder: "Your name",
      requiresProof: false,
    },
    discord_join: {
      action: "Join the server",
      proofLabel: "Your Discord Username",
      proofPlaceholder: "username#0000",
      requiresProof: false,
    },
    app_download: {
      action: "Download and install the app",
      proofLabel: "Device ID (optional)",
      proofPlaceholder: "Your device identifier",
      requiresProof: false,
    },
  };
  
  return infoMap[taskType] || {
    action: "Complete the task",
    proofLabel: "Verification Info",
    proofPlaceholder: "Enter verification details",
    requiresProof: false,
  };
}
