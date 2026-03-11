/**
 * Capacitor Bridge — integrates native plugins with the game engine.
 * Only activates when running inside a Capacitor native app.
 * Safe to import in web builds (all calls are guarded).
 */

const isNative = typeof window.Capacitor !== 'undefined';

async function initNative() {
  if (!isNative) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#0A0A1A' }).catch(() => {});
  } catch (e) { /* plugin not available */ }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
  } catch (e) { /* plugin not available */ }

  try {
    const { App } = await import('@capacitor/app');
    App.addListener('backButton', ({ canGoBack }) => {
      if (typeof window._arcadeReturnToMenu === 'function') {
        window._arcadeReturnToMenu();
      } else {
        App.exitApp();
      }
    });

    // Pause/resume support
    App.addListener('appStateChange', ({ isActive }) => {
      // Games can listen to this via window event
      window.dispatchEvent(new CustomEvent('app-state-change', { detail: { isActive } }));
    });
  } catch (e) { /* plugin not available */ }
}

// Haptic feedback helpers
export async function hapticTap() {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    Haptics.impact({ style: ImpactStyle.Light });
  } catch (e) {}
}

export async function hapticScore() {
  if (!isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {}
}

export async function hapticGameOver() {
  if (!isNative) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    Haptics.notification({ type: NotificationType.ERROR });
  } catch (e) {}
}

// Native share
export async function nativeShare(title, text) {
  if (!isNative) return false;
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, dialogTitle: 'Share your score' });
    return true;
  } catch (e) {
    return false;
  }
}

// Initialize on load
initNative();
