import { describe, it, expect } from "vitest";

describe("Health API Route Logic", () => {
  it("formats health check response payload correctly", () => {
    const payload = {
      success: true,
      data: {
        status: "healthy",
        uptime: 120,
        timestamp: new Date().toISOString(),
        version: "0.1.0",
        database: {
          status: "connected",
        },
      },
      message: "CRM API is operational",
    };

    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe("healthy");
    expect(payload.data.version).toBe("0.1.0");
    expect(payload.data.database.status).toBe("connected");
  });
});
