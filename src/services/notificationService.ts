/**
 * Notification Service
 * 
 * Handles browser notifications for PDF extraction job completion and failures
 */

export class NotificationService {
  private static hasPermission = false

  /**
   * Request notification permission from user
   */
  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      this.hasPermission = true
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      this.hasPermission = permission === 'granted'
      return this.hasPermission
    }

    return false
  }

  /**
   * Show notification for job completion
   */
  static notifyJobComplete(fileName: string, stats?: { imagesFound: number; graphsDetected: number }): void {
    if (!this.hasPermission) return

    const options: NotificationOptions = {
      body: stats 
        ? `Found ${stats.imagesFound} images, ${stats.graphsDetected} graphs detected`
        : 'Extraction completed successfully',
      icon: '/abc-logo.svg',
      badge: '/abc-logo.svg',
      tag: 'pdf-extraction-complete',
      requireInteraction: false
    }

    const notification = new Notification(`✅ ${fileName} - Extraction Complete`, options)

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000)

    // Focus window when clicked
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  /**
   * Show notification for job failure
   */
  static notifyJobFailed(fileName: string, errorMessage?: string): void {
    if (!this.hasPermission) return

    const options: NotificationOptions = {
      body: errorMessage || 'Extraction failed. Click to view details.',
      icon: '/abc-logo.svg',
      badge: '/abc-logo.svg',
      tag: 'pdf-extraction-failed',
      requireInteraction: true // Require user to dismiss
    }

    const notification = new Notification(`❌ ${fileName} - Extraction Failed`, options)

    // Focus window when clicked
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  }

  /**
   * Show in-app toast notification (fallback if browser notifications not supported)
   */
  static showToast(message: string, type: 'success' | 'error' = 'success'): void {
    // Check if custom event system exists
    const event = new CustomEvent('show-toast', {
      detail: { message, type }
    })
    window.dispatchEvent(event)
  }
}

