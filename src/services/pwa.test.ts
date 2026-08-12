import { afterEach, describe, expect, it, vi } from "vitest";
import { resetServiceWorkerAndCaches } from "./pwa";

describe("resetServiceWorkerAndCaches", () => {
  const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    } else {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
  });

  it("keeps cache reset as an explicit repair that unregisters workers and deletes caches", async () => {
    const unregisterFirst = vi.fn().mockResolvedValue(true);
    const unregisterSecond = vi.fn().mockResolvedValue(true);
    const deleteCache = vi.fn().mockResolvedValue(true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([
          { unregister: unregisterFirst },
          { unregister: unregisterSecond }
        ])
      }
    });
    vi.stubGlobal("caches", {
      keys: vi.fn().mockResolvedValue(["precache-v1", "runtime-v1"]),
      delete: deleteCache
    });

    await resetServiceWorkerAndCaches();

    expect(unregisterFirst).toHaveBeenCalledOnce();
    expect(unregisterSecond).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledTimes(2);
    expect(deleteCache).toHaveBeenNthCalledWith(1, "precache-v1");
    expect(deleteCache).toHaveBeenNthCalledWith(2, "runtime-v1");
  });
});
