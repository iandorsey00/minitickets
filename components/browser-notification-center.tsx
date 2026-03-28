"use client";

import { useEffect } from "react";

type BrowserNotificationCenterProps = {
  supported: boolean;
};

type BrowserNotificationPayload = {
  id: string;
  title: string;
  body?: string | null;
  url: string;
};

async function markDelivered(ids: string[]) {
  await fetch("/api/browser-notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ids }),
    cache: "no-store",
  });
}

export function BrowserNotificationCenter({ supported }: BrowserNotificationCenterProps) {
  useEffect(() => {
    if (!supported || typeof window === "undefined" || !("Notification" in window)) {
      return;
    }

    let active = true;
    let intervalId: number | undefined;

    const showNotifications = async (items: BrowserNotificationPayload[]) => {
      if (!items.length) {
        return;
      }

      const deliveredIds: string[] = [];

      for (const item of items) {
        try {
          const notification = new Notification(item.title, {
            body: item.body ?? "",
            tag: item.id,
          });

          notification.onclick = () => {
            window.focus();
            window.location.href = item.url;
          };

          deliveredIds.push(item.id);
        } catch (error) {
          console.error("Failed to display browser notification", error);
        }
      }

      if (deliveredIds.length) {
        await markDelivered(deliveredIds);
      }
    };

    const poll = async () => {
      if (!active || Notification.permission !== "granted") {
        return;
      }

      const response = await fetch("/api/browser-notifications", {
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { notifications?: BrowserNotificationPayload[] };
      await showNotifications(data.notifications ?? []);
    };

    const startPolling = () => {
      void poll();
      intervalId = window.setInterval(() => {
        void poll();
      }, 60_000);
    };

    if (Notification.permission === "granted") {
      startPolling();
    } else if (Notification.permission === "default") {
      void Notification.requestPermission().then((permission) => {
        if (!active || permission !== "granted") {
          return;
        }
        startPolling();
      });
    }

    return () => {
      active = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [supported]);

  return null;
}
