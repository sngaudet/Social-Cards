import { router, type Href } from "expo-router";

/** Shared navigation actions for screens, components, and other classes. */
export class NavigationService {
  /**
   * Return through the active navigator's page or tab history.
   * Use a fallback when the screen was opened without any history, e.g. a deep link.
   */
  static goBack(fallback: Href = "/"): void {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace(fallback);
  }
}
