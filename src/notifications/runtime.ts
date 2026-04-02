let activePathname = "";

function normalizePathname(pathname: string | null | undefined): string {
  return typeof pathname === "string" ? pathname : "";
}

export function setActiveNotificationPathname(
  pathname: string | null | undefined,
): void {
  activePathname = normalizePathname(pathname);
}

export function isMessagesPath(pathname = activePathname): boolean {
  return pathname.includes("/message_cur") || pathname.includes("/chat/");
}

export function shouldShowMessageNotification(): boolean {
  return !isMessagesPath();
}

export function shouldShowForegroundPushAlert(
  data: Record<string, unknown> | undefined,
): boolean {
  const type = typeof data?.type === "string" ? data.type : "";

  if (type === "chat_message") {
    return shouldShowMessageNotification();
  }

  return true;
}
