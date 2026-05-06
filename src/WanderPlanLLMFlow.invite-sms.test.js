import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import WanderPlan from "./WanderPlanLLMFlow";

function jsonResponse(body) {
  return Promise.resolve({
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function baseProfileFetch(profile) {
  return jsonResponse({
    profile: Object.assign(
      { display_name: "Tester", travel_styles: [], interests: {}, budget_tier: "moderate", dietary: [] },
      profile || {}
    ),
  });
}

beforeEach(() => {
  window.localStorage.clear();
  jest.clearAllMocks();
});

describe("WanderPlanLLMFlow invite-crew SMS step", () => {
  test("step 2 invite crew shows phone number input with +1 prefix, not email", async () => {
    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const path = new URL(String(url), "https://example.test").pathname;

      if (path === "/me/profile" && method === "GET") return baseProfileFetch({ display_name: "Alice" });
      if (path === "/me/bucket-list" && method === "GET") return jsonResponse({ items: [] });
      if (path === "/crew/peer-profiles" && method === "GET") return jsonResponse({ peers: [] });
      if (path === "/crew/invites/sent" && method === "GET") return jsonResponse({ invites: [] });
      if (path === "/me/trips" && method === "GET") return jsonResponse({ trips: [] });
      if (path === "/wizard/sessions" && method === "POST") {
        return jsonResponse({ session: { id: "s1", trip_id: "11111111-1111-4111-8111-111111111111" } });
      }
      return jsonResponse({});
    });

    window.localStorage.setItem("wp-auth", JSON.stringify("test-token:alice"));
    window.localStorage.setItem(
      "wp-u:uid:alice",
      JSON.stringify({ name: "Alice", email: "alice@test.com", styles: [], interests: {}, budget: "moderate", dietary: [] })
    );

    render(<WanderPlan />);
    await waitFor(() => expect(screen.queryByText("Trips")).not.toBeNull());
    fireEvent.click(screen.getByText("Plan a new trip"));
    await waitFor(() => expect(screen.queryByPlaceholderText("e.g. Summer 2025")).not.toBeNull());
    fireEvent.change(screen.getByPlaceholderText("e.g. Summer 2025"), { target: { value: "Beach Trip" } });
    fireEvent.change(
      screen.getByPlaceholderText("Add a destination directly (e.g. Kyoto)"),
      { target: { value: "Miami" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByText("Miami")).not.toBeNull());
    fireEvent.click(screen.getByText("Start Planning"));

    await waitFor(() => expect(screen.queryByText("Confirm 1 Destination")).not.toBeNull());
    fireEvent.click(screen.getByText("Confirm 1 Destination"));

    await waitFor(() => expect(screen.queryByPlaceholderText("Phone number")).not.toBeNull());
    expect(screen.getByText("+1")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Invite by SMS" })).not.toBeNull();
    expect(screen.queryByPlaceholderText("friend@email.com")).toBeNull();
  });

  test("clicking Invite by SMS calls POST /crew/invite-sms with tripId and phone", async () => {
    const smsCalls = [];
    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const path = new URL(String(url), "https://example.test").pathname;

      if (path === "/me/profile" && method === "GET") return baseProfileFetch({ display_name: "Bob" });
      if (path === "/me/bucket-list" && method === "GET") return jsonResponse({ items: [] });
      if (path === "/crew/peer-profiles" && method === "GET") return jsonResponse({ peers: [] });
      if (path === "/crew/invites/sent" && method === "GET") return jsonResponse({ invites: [] });
      if (path === "/me/trips" && method === "GET") return jsonResponse({ trips: [] });
      if (path === "/wizard/sessions" && method === "POST") {
        return jsonResponse({ session: { id: "s2", trip_id: "22222222-2222-4222-8222-222222222222" } });
      }
      if (path === "/crew/invite-sms" && method === "POST") {
        const body = JSON.parse(String((options && options.body) || "{}"));
        smsCalls.push(body);
        return jsonResponse({
          ok: true,
          sms_token: "tok-abc",
          sms_sent: true,
          trip_link: "http://localhost:3000/?sms_token=tok-abc",
        });
      }
      return jsonResponse({});
    });

    window.localStorage.setItem("wp-auth", JSON.stringify("test-token:bob"));
    window.localStorage.setItem(
      "wp-u:uid:bob",
      JSON.stringify({ name: "Bob", email: "bob@test.com", styles: [], interests: {}, budget: "moderate", dietary: [] })
    );

    render(<WanderPlan />);
    await waitFor(() => expect(screen.queryByText("Trips")).not.toBeNull());
    fireEvent.click(screen.getByText("Plan a new trip"));
    await waitFor(() => expect(screen.queryByPlaceholderText("e.g. Summer 2025")).not.toBeNull());
    fireEvent.change(screen.getByPlaceholderText("e.g. Summer 2025"), { target: { value: "City Tour" } });
    fireEvent.change(
      screen.getByPlaceholderText("Add a destination directly (e.g. Kyoto)"),
      { target: { value: "NYC" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByText("NYC")).not.toBeNull());
    fireEvent.click(screen.getByText("Start Planning"));

    await waitFor(() => expect(screen.queryByText("Confirm 1 Destination")).not.toBeNull());
    fireEvent.click(screen.getByText("Confirm 1 Destination"));

    await waitFor(() => expect(screen.queryByPlaceholderText("Phone number")).not.toBeNull());
    fireEvent.change(screen.getByPlaceholderText("Phone number"), { target: { value: "5551234567" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite by SMS" }));

    await waitFor(() => expect(smsCalls.length).toBeGreaterThan(0));
    expect(smsCalls[0]).toEqual(expect.objectContaining({ phone: "5551234567" }));
    expect(typeof smsCalls[0].tripId).toBe("string");
    expect(smsCalls[0].tripId.length).toBeGreaterThan(0);
  });

  test("SMS invite is not sent until the user explicitly clicks Invite by SMS", async () => {
    const smsCalls = [];
    global.fetch = jest.fn((url, options) => {
      const method = String((options && options.method) || "GET").toUpperCase();
      const path = new URL(String(url), "https://example.test").pathname;

      if (path === "/me/profile" && method === "GET") return baseProfileFetch({});
      if (path === "/me/bucket-list" && method === "GET") return jsonResponse({ items: [] });
      if (path === "/crew/peer-profiles" && method === "GET") return jsonResponse({ peers: [] });
      if (path === "/crew/invites/sent" && method === "GET") return jsonResponse({ invites: [] });
      if (path === "/me/trips" && method === "GET") return jsonResponse({ trips: [] });
      if (path === "/wizard/sessions" && method === "POST") {
        return jsonResponse({ session: { id: "s3", trip_id: "33333333-3333-4333-8333-333333333333" } });
      }
      if (path === "/crew/invite-sms" && method === "POST") {
        smsCalls.push(true);
        return jsonResponse({ ok: true, sms_sent: false, trip_link: "http://localhost:3000/?sms_token=tok-xyz" });
      }
      return jsonResponse({});
    });

    window.localStorage.setItem("wp-auth", JSON.stringify("test-token:carol"));
    window.localStorage.setItem(
      "wp-u:uid:carol",
      JSON.stringify({ name: "Carol", email: "carol@test.com", styles: [], interests: {}, budget: "moderate", dietary: [] })
    );

    render(<WanderPlan />);
    await waitFor(() => expect(screen.queryByText("Trips")).not.toBeNull());
    fireEvent.click(screen.getByText("Plan a new trip"));
    await waitFor(() => expect(screen.queryByPlaceholderText("e.g. Summer 2025")).not.toBeNull());
    fireEvent.change(screen.getByPlaceholderText("e.g. Summer 2025"), { target: { value: "Adventure" } });
    fireEvent.change(
      screen.getByPlaceholderText("Add a destination directly (e.g. Kyoto)"),
      { target: { value: "Paris" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.queryByText("Paris")).not.toBeNull());
    fireEvent.click(screen.getByText("Start Planning"));

    await waitFor(() => expect(screen.queryByText("Confirm 1 Destination")).not.toBeNull());
    fireEvent.click(screen.getByText("Confirm 1 Destination"));

    await waitFor(() => expect(screen.queryByPlaceholderText("Phone number")).not.toBeNull());
    // Type phone number but do NOT click the button yet
    fireEvent.change(screen.getByPlaceholderText("Phone number"), { target: { value: "9998887777" } });
    // Verify no SMS call was made yet
    expect(smsCalls.length).toBe(0);
  });

  test("guest with sms_token in URL sees full trip without login wall", async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { search: "?sms_token=test-sms-token-xyz", hash: "", pathname: "/" };

    global.fetch = jest.fn((url) => {
      const parsedUrl = new URL(String(url), "https://example.test");
      const path = parsedUrl.pathname;
      const qs = parsedUrl.searchParams;
      if (path === "/trips/guest" && qs.get("sms_token") === "test-sms-token-xyz") {
        return jsonResponse({
          trip: {
            id: "44444444-4444-4444-8444-444444444444",
            name: "Summer in Tokyo",
            status: "planning",
            duration_days: 7,
            destinations: [{ name: "Tokyo", country: "Japan" }],
          },
        });
      }
      return jsonResponse({});
    });

    render(<WanderPlan />);

    await waitFor(() => expect(screen.queryByText("Summer in Tokyo")).not.toBeNull());
    expect(screen.getByText("Tokyo")).not.toBeNull();
    // Should not show login/signup form
    expect(screen.queryByPlaceholderText("Password")).toBeNull();
    // Should offer a signup CTA (not a wall)
    expect(screen.getByText("Join WanderPlan")).not.toBeNull();

    window.location = originalLocation;
  });

  test("guest trip view shows error when sms_token is invalid", async () => {
    const originalLocation = window.location;
    delete window.location;
    window.location = { search: "?sms_token=bad-token", hash: "", pathname: "/" };

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ detail: "Invite not found" })),
      })
    );

    render(<WanderPlan />);

    await waitFor(() =>
      expect(screen.queryByText(/Trip not found or invite link is invalid/)).not.toBeNull()
    );
    expect(screen.queryByPlaceholderText("Password")).toBeNull();

    window.location = originalLocation;
  });
});
